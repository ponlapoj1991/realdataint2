import { RawRow } from '../types';

export type ColumnValueType = 'text' | 'number' | 'date';

export interface ColumnProfile {
  key: string;
  type: ColumnValueType;
  sample?: string;
}

export type ColumnProfileMap = Record<string, ColumnProfile>;

const isNumeric = (value: any): boolean => {
  if (value === null || value === undefined || value === '') return false;
  const num = Number(value);
  return Number.isFinite(num);
};

const isDateLike = (value: any): boolean => {
  if (value === null || value === undefined || value === '') return false;
  const date = new Date(value);
  return !isNaN(date.getTime());
};

const classifyValue = (value: any): ColumnValueType => {
  if (isNumeric(value)) return 'number';
  if (isDateLike(value)) return 'date';
  return 'text';
};

export const buildColumnProfiles = (rows: RawRow[], limit = 200): ColumnProfileMap => {
  const profiles: ColumnProfileMap = {};
  if (!rows || rows.length === 0) return profiles;

  const keys = new Set<string>();
  rows.forEach(row => Object.keys(row).forEach(key => keys.add(key)));

  keys.forEach(key => {
    let textCount = 0;
    let numberCount = 0;
    let dateCount = 0;
    let sample: string | undefined;

    for (let i = 0; i < rows.length && i < limit; i++) {
      const value = rows[i][key];
      if (value === null || value === undefined || value === '') continue;
      if (!sample) sample = String(value).slice(0, 24);
      const type = classifyValue(value);
      if (type === 'number') numberCount++;
      else if (type === 'date') dateCount++;
      else textCount++;
    }

    let finalType: ColumnValueType = 'text';
    if (numberCount > textCount && numberCount > dateCount) {
      finalType = 'number';
    } else if (dateCount > textCount && dateCount >= numberCount) {
      finalType = 'date';
    }

    profiles[key] = {
      key,
      type: finalType,
      sample
    };
  });

  return profiles;
};

export const describeColumnType = (type: ColumnValueType) => {
  switch (type) {
    case 'number':
      return 'Number';
    case 'date':
      return 'Date';
    default:
      return 'Text';
  }
};
