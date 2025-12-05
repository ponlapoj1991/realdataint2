/**
 * Excel Parser Web Worker
 *
 * Purpose: Parse large Excel/CSV files in background thread
 * - Prevents UI blocking
 * - Processes data in chunks
 * - Reports progress to main thread
 *
 * Supports: 1M+ rows without freezing the browser
 */

import { RawRow } from '../types';

// Chunk size for processing (balance between memory and performance)
const DEFAULT_CHUNK_SIZE = 10000;

interface WorkerMessage {
  type: 'parse';
  data: ArrayBuffer | string;
  fileType: 'excel' | 'csv';
  chunkSize?: number;
}

interface ChunkMessage {
  type: 'chunk';
  data: RawRow[];
  progress: number;
  chunkIndex: number;
}

interface CompleteMessage {
  type: 'complete';
  totalRows: number;
  totalChunks: number;
}

interface ErrorMessage {
  type: 'error';
  error: string;
}

type WorkerResponse = ChunkMessage | CompleteMessage | ErrorMessage;

// XLSX will be passed from main thread
declare const XLSX: any;

/**
 * Parse Excel/CSV in chunks and send back progressively
 */
const parseExcelInChunks = (
  data: ArrayBuffer | string,
  fileType: 'excel' | 'csv',
  chunkSize: number
): void => {
  try {
    // Parse workbook
    const readType = fileType === 'excel' ? 'array' : 'string';
    const workbook = XLSX.read(data, { type: readType });

    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Get range to determine total rows
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    const totalRows = range.e.r - range.s.r; // Exclude header
    const totalChunks = Math.ceil(totalRows / chunkSize);

    // Parse in chunks
    let processedRows = 0;

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      const startRow = range.s.r + (chunkIndex * chunkSize);
      const endRow = Math.min(startRow + chunkSize, range.e.r + 1);

      // Create a sub-range for this chunk
      const chunkRange = {
        s: { r: startRow, c: range.s.c },
        e: { r: endRow - 1, c: range.e.c }
      };

      // Parse only this chunk
      const chunkData = XLSX.utils.sheet_to_json(worksheet, {
        raw: false,
        defval: '',
        range: chunkRange
      }) as RawRow[];

      processedRows += chunkData.length;
      const progress = Math.round((processedRows / totalRows) * 100);

      // Send chunk to main thread
      const message: ChunkMessage = {
        type: 'chunk',
        data: chunkData,
        progress,
        chunkIndex
      };

      self.postMessage(message);
    }

    // Send completion message
    const completeMessage: CompleteMessage = {
      type: 'complete',
      totalRows: processedRows,
      totalChunks
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
  const { type, data, fileType, chunkSize = DEFAULT_CHUNK_SIZE } = event.data;

  if (type === 'parse') {
    parseExcelInChunks(data, fileType, chunkSize);
  }
};

// Export types for main thread usage
export type { WorkerMessage, ChunkMessage, CompleteMessage, ErrorMessage, WorkerResponse };
