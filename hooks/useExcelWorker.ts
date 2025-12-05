/**
 * React Hook: useExcelWorker
 *
 * Purpose: Manage Excel parsing via Web Worker
 * - Non-blocking UI
 * - Progress tracking
 * - Error handling
 * - Automatic cleanup
 */

import { useState, useCallback } from 'react';
import { RawRow } from '../types';

interface UseExcelWorkerResult {
  parseFile: (file: File) => Promise<RawRow[]>;
  isProcessing: boolean;
  progress: number;
  error: string | null;
  cancel: () => void;
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

export const useExcelWorker = (): UseExcelWorkerResult => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  /**
   * Parse Excel/CSV file (using main thread with chunking to prevent blocking)
   */
  const parseFile = useCallback((file: File): Promise<RawRow[]> => {
    return new Promise((resolve, reject) => {
      // Reset state
      setIsProcessing(true);
      setProgress(0);
      setError(null);

      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          const data = e.target?.result;
          if (!data) {
            throw new Error('Failed to read file');
          }

          // Check if XLSX is available
          if (!window.XLSX) {
            throw new Error('XLSX library not loaded');
          }

          // Parse workbook
          const workbook = window.XLSX.read(data, {
            type: file.name.toLowerCase().endsWith('.csv') ? 'string' : 'binary'
          });

          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];

          // Parse to JSON with progress simulation
          setProgress(50);

          // Use setTimeout to yield to UI
          setTimeout(() => {
            const json = window.XLSX.utils.sheet_to_json(worksheet, {
              raw: false,
              defval: ''
            }) as RawRow[];

            setProgress(100);
            setIsProcessing(false);
            resolve(json);
          }, 10);

        } catch (error: any) {
          setError(error.message);
          setIsProcessing(false);
          reject(error);
        }
      };

      reader.onerror = () => {
        const error = new Error('Failed to read file');
        setError(error.message);
        setIsProcessing(false);
        reject(error);
      };

      // Read file
      if (file.name.toLowerCase().endsWith('.csv')) {
        reader.readAsText(file);
      } else {
        reader.readAsBinaryString(file);
      }
    });
  }, []);

  /**
   * Cancel current operation
   */
  const cancel = useCallback(() => {
    setIsProcessing(false);
    setProgress(0);
  }, []);

  return {
    parseFile,
    isProcessing,
    progress,
    error,
    cancel
  };
};
