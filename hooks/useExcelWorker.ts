/**
 * React Hook: useExcelWorker
 *
 * Purpose: Manage Excel parsing via Web Worker
 * - Non-blocking UI (animation keeps spinning)
 * - Progress tracking
 * - Error handling
 * - Automatic cleanup
 */

import { useState, useCallback, useRef, useEffect } from 'react';
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
  const workerRef = useRef<Worker | null>(null);
  const isCancelledRef = useRef(false);

  // Cleanup worker on unmount
  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  /**
   * Parse Excel/CSV file using Web Worker
   */
  const parseFile = useCallback((file: File): Promise<RawRow[]> => {
    return new Promise((resolve, reject) => {
      // Reset state
      setIsProcessing(true);
      setProgress(0);
      setError(null);
      isCancelledRef.current = false;

      // Terminate any existing worker
      if (workerRef.current) {
        workerRef.current.terminate();
      }

      // Create new worker
      try {
        // Use URL constructor for Vite compatibility
        workerRef.current = new Worker(
          new URL('../workers/excel.worker.ts', import.meta.url),
          { type: 'classic' }
        );
      } catch (workerError) {
        console.warn('[useExcelWorker] Worker creation failed, falling back to main thread:', workerError);
        // Fallback to main thread processing
        return fallbackParse(file)
          .then(resolve)
          .catch(reject)
          .finally(() => {
            setIsProcessing(false);
          });
      }

      const worker = workerRef.current;
      const allData: RawRow[] = [];

      // Handle messages from worker
      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        if (isCancelledRef.current) return;

        const message = event.data;

        switch (message.type) {
          case 'chunk':
            // Accumulate chunk data
            allData.push(...message.data);
            setProgress(message.progress);
            break;

          case 'complete':
            setProgress(100);
            setIsProcessing(false);
            worker.terminate();
            workerRef.current = null;
            resolve(allData);
            break;

          case 'error':
            setError(message.error);
            setIsProcessing(false);
            worker.terminate();
            workerRef.current = null;
            reject(new Error(message.error));
            break;
        }
      };

      // Handle worker errors
      worker.onerror = (event) => {
        console.error('[useExcelWorker] Worker error:', event);
        setError(event.message || 'Worker error');
        setIsProcessing(false);
        worker.terminate();
        workerRef.current = null;
        reject(new Error(event.message || 'Worker error'));
      };

      // Read file and send to worker
      const reader = new FileReader();

      reader.onload = (e) => {
        const data = e.target?.result;
        if (!data) {
          setError('Failed to read file');
          setIsProcessing(false);
          reject(new Error('Failed to read file'));
          return;
        }

        const isCSV = file.name.toLowerCase().endsWith('.csv');

        // Send data to worker
        worker.postMessage({
          type: 'parse',
          data: data,
          fileType: isCSV ? 'csv' : 'excel',
          chunkSize: 5000 // Smaller chunks for better progress updates
        });
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
        reader.readAsArrayBuffer(file);
      }
    });
  }, []);

  /**
   * Fallback: Parse on main thread with requestAnimationFrame yielding
   * This is used when Web Worker fails to load
   */
  const fallbackParse = useCallback(async (file: File): Promise<RawRow[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          const data = e.target?.result;
          if (!data) {
            throw new Error('Failed to read file');
          }

          if (!window.XLSX) {
            throw new Error('XLSX library not loaded');
          }

          setProgress(20);

          // Yield to let UI update
          await new Promise(r => requestAnimationFrame(r));

          const isCSV = file.name.toLowerCase().endsWith('.csv');
          const workbook = window.XLSX.read(data, {
            type: isCSV ? 'string' : 'array'
          });

          setProgress(50);
          await new Promise(r => requestAnimationFrame(r));

          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];

          setProgress(70);
          await new Promise(r => requestAnimationFrame(r));

          const json = window.XLSX.utils.sheet_to_json(worksheet, {
            raw: false,
            defval: ''
          }) as RawRow[];

          setProgress(100);
          resolve(json);
        } catch (error: any) {
          setError(error.message);
          reject(error);
        }
      };

      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };

      if (file.name.toLowerCase().endsWith('.csv')) {
        reader.readAsText(file);
      } else {
        reader.readAsArrayBuffer(file);
      }
    });
  }, []);

  /**
   * Cancel current operation
   */
  const cancel = useCallback(() => {
    isCancelledRef.current = true;
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
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
