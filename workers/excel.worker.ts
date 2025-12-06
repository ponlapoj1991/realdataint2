/**
 * Excel Parser Web Worker
 *
 * Purpose: Parse large Excel/CSV files in background thread
 * - Prevents UI blocking (animation keeps spinning)
 * - Reports progress to main thread
 *
 * Note: Parsing happens in one go to ensure data integrity
 * The chunking approach had bugs with header row handling
 */

// Load XLSX library in worker context
importScripts('https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js');

// XLSX is now available globally in worker
declare const XLSX: any;

// Type for raw data rows
interface RawRow {
  [key: string]: string | number | boolean | null | undefined;
}

interface WorkerMessage {
  type: 'parse';
  data: ArrayBuffer | string;
  fileType: 'excel' | 'csv';
}

interface ProgressMessage {
  type: 'progress';
  percent: number;
  message: string;
}

interface CompleteMessage {
  type: 'complete';
  data: RawRow[];
  totalRows: number;
}

interface ErrorMessage {
  type: 'error';
  error: string;
}

type WorkerResponse = ProgressMessage | CompleteMessage | ErrorMessage;

/**
 * Parse Excel/CSV file and send back complete data
 */
const parseExcel = (
  data: ArrayBuffer | string,
  fileType: 'excel' | 'csv'
): void => {
  try {
    // Report: Starting parse
    self.postMessage({
      type: 'progress',
      percent: 10,
      message: 'Reading file...'
    } as ProgressMessage);

    // Parse workbook
    const readType = fileType === 'excel' ? 'array' : 'string';
    const workbook = XLSX.read(data, { type: readType });

    self.postMessage({
      type: 'progress',
      percent: 40,
      message: 'Parsing spreadsheet...'
    } as ProgressMessage);

    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    self.postMessage({
      type: 'progress',
      percent: 60,
      message: 'Converting to data...'
    } as ProgressMessage);

    // Parse to JSON - no chunking to preserve data integrity
    // defval: '' ensures empty cells become empty strings (not undefined/null)
    const json = XLSX.utils.sheet_to_json(worksheet, {
      raw: false,
      defval: ''
    }) as RawRow[];

    self.postMessage({
      type: 'progress',
      percent: 90,
      message: 'Finalizing...'
    } as ProgressMessage);

    // Send completion with all data
    const completeMessage: CompleteMessage = {
      type: 'complete',
      data: json,
      totalRows: json.length
    };

    self.postMessage(completeMessage);

  } catch (error: any) {
    const errorMessage: ErrorMessage = {
      type: 'error',
      error: error.message || 'Failed to parse file'
    };

    self.postMessage(errorMessage);
  }
};

/**
 * Worker message handler
 */
self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const { type, data, fileType } = event.data;

  if (type === 'parse') {
    parseExcel(data, fileType);
  }
};

// Export types for main thread usage
export type { WorkerMessage, ProgressMessage, CompleteMessage, ErrorMessage, WorkerResponse };
