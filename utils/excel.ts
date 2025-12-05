import { RawRow, ColumnConfig } from '../types';

export const parseExcelFile = async (file: File): Promise<RawRow[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!window.XLSX) {
          reject(new Error("XLSX library not loaded"));
          return;
        }
        const workbook = window.XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Use raw: false to get the "formatted string" as seen in Excel.
        const json = window.XLSX.utils.sheet_to_json(worksheet, { 
            raw: false,
            defval: "" 
        });
        resolve(json as RawRow[]);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsBinaryString(file);
  });
};

export const parseCsvUrl = async (url: string): Promise<RawRow[]> => {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch CSV');
    const csvText = await response.text();
    
    if (!window.XLSX) throw new Error("XLSX library not loaded");
    
    const workbook = window.XLSX.read(csvText, { type: 'string' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    return window.XLSX.utils.sheet_to_json(worksheet, { raw: false, defval: "" }) as RawRow[];
  } catch (err) {
    throw err;
  }
};

const normalizeDataForExport = (data: RawRow[]) => {
  return data.map(row => {
    const newRow: any = {};
    Object.keys(row).forEach(k => {
      const val = row[k];
      if (typeof val === 'object' && val !== null) {
        newRow[k] = JSON.stringify(val);
      } else {
        newRow[k] = val;
      }
    });
    return newRow;
  });
};

export const exportToExcel = (data: RawRow[], filename: string) => {
  if (!window.XLSX) {
      alert("Excel library not loaded.");
      return;
  }
  if (!data || data.length === 0) {
      alert("No data available to export.");
      return;
  }

  const safeData = normalizeDataForExport(data);

  const ws = window.XLSX.utils.json_to_sheet(safeData);
  const wb = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(wb, ws, "Processed Data");
  window.XLSX.writeFile(wb, `${filename}.xlsx`);
};

export const exportToCsv = (data: RawRow[], filename: string) => {
  if (!window.XLSX) {
    alert("Excel library not loaded.");
    return;
  }
  if (!data || data.length === 0) {
    alert("No data available to export.");
    return;
  }

  const safeData = normalizeDataForExport(data);
  const ws = window.XLSX.utils.json_to_sheet(safeData);
  const wb = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(wb, ws, "Processed Data");
  window.XLSX.writeFile(wb, `${filename}.csv`, { bookType: 'csv' });
};

export const inferColumns = (row: RawRow): ColumnConfig[] => {
  return Object.keys(row).map(key => ({
    key,
    type: 'string', // Default
    visible: true,
    label: key
  }));
};

// Helper to attempt parsing mixed date formats to ISO String
export const smartParseDate = (val: any): string | null => {
  if (val === null || val === undefined || val === '') return null;
  
  // 1. Handle Excel Serial Numbers
  if (typeof val === 'number') {
      if (val > 30000 && val < 60000) {
          const totalMilliseconds = Math.round((val - 25569) * 86400 * 1000);
          const date = new Date(totalMilliseconds);
          return date.toISOString(); 
      }
  }

  let strVal = String(val).trim();
  if (!strVal) return null;

  // Manual Regex for DD/MM/YY or DD-MM-YY (Common source of 19xx errors)
  // Matches: 01/12/25 or 1-12-25
  const shortYearRegex = /^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2})$/; 
  const shortYearMatch = strVal.match(shortYearRegex);
  
  if (shortYearMatch) {
      const d = parseInt(shortYearMatch[1], 10);
      const m = parseInt(shortYearMatch[2], 10) - 1;
      let y = parseInt(shortYearMatch[3], 10);
      
      // Assume 20xx for 2-digit years (unless user implies 19xx, but for social data 20xx is safer default)
      y += 2000; 
      
      const date = new Date(y, m, d);
      if (!isNaN(date.getTime())) return date.toISOString();
  }

  // 2. Try standard Date.parse (ISO, etc)
  let date = new Date(strVal);
  
  // 3. If invalid, try common formats including Thai Year
  if (isNaN(date.getTime())) {
    const parts = strVal.split(/[\/\-\.\s:]/);
    
    if (parts.length >= 3) {
      let d = parseInt(parts[0], 10);
      let m = parseInt(parts[1], 10) - 1;
      let y = parseInt(parts[2], 10);
      
      // Fix for Thai Year (25xx)
      if (y > 2400) y -= 543;
      
      // Fix for 2-digit year if it wasn't caught by regex above (e.g. space separated)
      if (y < 100) y += 2000;

      let hours = 0, mins = 0;
      if (parts.length >= 5) {
          hours = parseInt(parts[3], 10) || 0;
          mins = parseInt(parts[4], 10) || 0;
      }

      date = new Date(y, m, d, hours, mins, 0);
    }
  }

  if (!isNaN(date.getTime())) {
    // Final sanity check: if year is < 1950, it's probably a parsing error for social data, bump to 20xx?
    // For now, leave as is to be safe, but the 2-digit logic above handles most cases.
    return date.toISOString(); 
  }
  return null; 
};
