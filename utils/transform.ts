
import { RawRow, TransformationRule, TransformMethod } from '../types';
import { smartParseDate } from './excel';

// Helper to parse array-like strings: "['A', 'B']", "A, B", "A/B/C", or even single val "5"
const parseArrayValue = (val: any): string[] => {
  if (val === null || val === undefined || val === '') return [];
  
  const str = String(val).trim(); // Force string conversion first
  
  try {
    // Try JSON parse first (e.g. "['A','B']")
    if (str.startsWith('[') && str.endsWith(']')) {
       const jsonStr = str.replace(/'/g, '"'); 
       const parsed = JSON.parse(jsonStr);
       if (Array.isArray(parsed)) return parsed.map(String);
    }
  } catch (e) {}

  // Regex checks for delimiters: , | / ;
  // If delimiters exist, split. 
  if (/[,|/;\n]/.test(str)) {
      return str.split(/[,|/;\n]+/).map(s => s.trim()).filter(s => s.length > 0);
  }
  
  // Fallback: treat the whole string as a single item array
  return [str];
};

// Increased limit from 20 to 200 for better detection
export const analyzeSourceColumn = (data: RawRow[], key: string) => {
  let isArrayLikely = false;
  let isDateLikely = false;
  let sampleValues: string[] = [];
  const uniqueTags = new Set<string>();

  let checkCount = 0;
  for (const row of data) {
    if (checkCount > 200) break; 
    const val = row[key];
    if (val === null || val === undefined || val === '') continue;
    
    checkCount++;
    const str = String(val);
    if (checkCount <= 20) sampleValues.push(str); // Keep sample small for UI

    if ((str.startsWith('[') && str.endsWith(']')) || /[,|/;\n]/.test(str)) {
       isArrayLikely = true;
       const tags = parseArrayValue(val);
       tags.forEach(t => uniqueTags.add(t));
    }

    // Check for date patterns (roughly)
    if (!isArrayLikely && (str.match(/\d{4}-\d{2}-\d{2}/) || str.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/))) {
        isDateLikely = true;
    } else if (typeof val === 'number' && val > 35000 && val < 60000) {
        isDateLikely = true; // Excel serial date range
    }
  }

  return {
    isArrayLikely,
    isDateLikely,
    sampleValues,
    uniqueTags: Array.from(uniqueTags).slice(0, 50)
  };
};

// New: Comprehensive scan for Mapping Features
// Scans up to 5000 rows (or all if small) to ensure comprehensive mapping options
export const getAllUniqueValues = (data: RawRow[], key: string, method: TransformMethod, limit = 5000): string[] => {
    const unique = new Set<string>();
    let count = 0;

    for (const row of data) {
        if (count >= limit) break;
        
        const val = row[key];
        if (val === null || val === undefined || val === '') continue;
        
        // For Array methods, we want individual items to map
        if (method.startsWith('array_') && method !== 'array_count') {
            const items = parseArrayValue(val);
            items.forEach(i => unique.add(i));
        } else {
            // For direct copy/date, we map the full value
            unique.add(String(val));
        }
        count++;
    }
    
    return Array.from(unique).sort().slice(0, 500); // Return top 500 sorted unique values
};

export const applyTransformation = (data: RawRow[], rules: TransformationRule[]): RawRow[] => {
  if (!rules || rules.length === 0) return [];

  return data.map((row) => {
    const newRow: RawRow = {};
    
    rules.forEach(rule => {
      const sourceVal = row[rule.sourceKey];
      let result: any = null;

      // Helper to map a single value
      const mapValue = (v: string) => {
          if (rule.valueMap && rule.valueMap[v] !== undefined) {
              return rule.valueMap[v];
          }
          return v;
      };

      switch (rule.method) {
        case 'copy':
          result = sourceVal;
          break;

        case 'array_count': {
          const arr = parseArrayValue(sourceVal);
          result = arr.length;
          break;
        }

        case 'array_join': {
           const arr = parseArrayValue(sourceVal);
           // CRITICAL CHANGE: Map items BEFORE joining
           const mappedArr = arr.map(item => mapValue(String(item)));
           const delimiter = rule.params?.delimiter || ', ';
           result = mappedArr.join(delimiter);
           break;
        }

        case 'array_extract': {
            const arr = parseArrayValue(sourceVal);
            const idx = rule.params?.index || 0;
            let extracted = arr[idx] !== undefined ? String(arr[idx]) : ''; 
            // Map extracted value
            if (rule.valueMap && rule.valueMap[extracted] !== undefined) {
                extracted = rule.valueMap[extracted];
            }
            result = extracted;
            break;
        }

        case 'array_includes': {
            const arr = parseArrayValue(sourceVal);
            const keyword = rule.params?.keyword?.toLowerCase() || '';
            // Check logic on raw data
            result = arr.some(item => String(item).toLowerCase().includes(keyword));
            break;
        }

        case 'date_extract': {
            const isoStr = smartParseDate(sourceVal); 
            if (!isoStr) {
                result = null;
            } else {
                const dateObj = new Date(isoStr);
                switch(rule.params?.datePart) {
                    case 'year': 
                        result = dateObj.getFullYear(); 
                        break;
                    case 'month': 
                        result = String(dateObj.getMonth() + 1).padStart(2, '0'); 
                        break;
                    case 'day': 
                        result = String(dateObj.getDate()).padStart(2, '0'); 
                        break;
                    case 'date_only': 
                        const y = dateObj.getFullYear();
                        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
                        const d = String(dateObj.getDate()).padStart(2, '0');
                        result = `${y}-${m}-${d}`;
                        break;
                    case 'time_only': {
                        const h = String(dateObj.getHours()).padStart(2, '0');
                        const min = String(dateObj.getMinutes()).padStart(2, '0');
                        result = `${h}:${min}`;
                        break;
                    }
                    default: 
                        result = isoStr;
                }
            }
            break;
        }
        
        default:
            result = sourceVal;
      }

      // Global Mapping (Post-processing)
      // If not array_join/extract (handled above), map result here
      if (rule.method !== 'array_join' && rule.method !== 'array_extract' && rule.valueMap && result !== null && result !== undefined) {
          const strKey = String(result).trim();
          if (rule.valueMap[strKey] !== undefined) {
              result = rule.valueMap[strKey];
          }
      }

      newRow[rule.targetName] = result;
    });

    return newRow;
  });
};
