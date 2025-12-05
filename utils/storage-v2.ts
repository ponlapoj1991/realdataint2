/**
 * Storage v2: High-Performance IndexedDB Architecture
 *
 * Features:
 * - Multi-store pattern (metadata + chunked data)
 * - Batch operations
 * - Smart indexing
 * - Pagination support
 * - Result caching
 * - Supports 1M+ rows efficiently
 *
 * Migration: Backward compatible with storage.ts (v1)
 */

import {
  Project,
  ProjectTab,
  RawRow,
  ColumnConfig,
  DashboardWidget,
  TransformationRule,
  ReportSlide,
  ReportPresentation,
  AISettings,
  AIPresets,
  DataSource,
  ProjectDashboard
} from '../types';

const DB_NAME = 'RealDataDB';
const DB_VERSION = 2; // Upgraded from v1
const CONFIG_KEY = 'real_data_config_v2';

// Store names
const STORE_PROJECTS = 'projects'; // Metadata only
const STORE_DATA_CHUNKS = 'data_chunks'; // Chunked raw data
const STORE_CACHE = 'cache'; // Aggregation cache

// Configuration
const CHUNK_SIZE = 1000; // Rows per chunk
const CACHE_TTL = 3600000; // 1 hour

// --- Interfaces ---

interface ProjectMetadata {
  id: string;
  name: string;
  description: string;
  lastModified: number;
  rowCount: number;
  chunkCount: number;
  columns: ColumnConfig[];
  dataSources?: DataSource[];
  activeDataSourceId?: string;
  transformRules?: TransformationRule[];
  dashboards?: ProjectDashboard[];
  activeDashboardId?: string;
  dashboard?: DashboardWidget[];
  reportConfig?: ReportSlide[];
  reportPresentations?: ReportPresentation[];
  activePresentationId?: string;
  aiSettings?: AISettings;
  aiPresets?: AIPresets;
  storageVersion: 2; // Mark as v2
}

interface DataChunk {
  projectId: string;
  chunkIndex: number;
  data: RawRow[];
}

interface CacheEntry {
  projectId: string;
  cacheKey: string;
  result: any;
  expiry: number;
}

interface PaginationResult {
  rows: RawRow[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// --- Database Connection ---

let dbInstance: IDBDatabase | null = null;

const openDB = (): Promise<IDBDatabase> => {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(new Error('Failed to open database'));

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result as IDBDatabase;

      // Create or upgrade stores
      if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
        const projectStore = db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
        projectStore.createIndex('lastModified', 'lastModified', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_DATA_CHUNKS)) {
        const dataStore = db.createObjectStore(STORE_DATA_CHUNKS, { keyPath: ['projectId', 'chunkIndex'] });
        dataStore.createIndex('projectId', 'projectId', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_CACHE)) {
        const cacheStore = db.createObjectStore(STORE_CACHE, { keyPath: ['projectId', 'cacheKey'] });
        cacheStore.createIndex('expiry', 'expiry', { unique: false });
      }
    };

    request.onsuccess = (event: any) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };
  });
};

// --- Project Metadata Operations ---

export const getProjectsV2 = async (): Promise<ProjectMetadata[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_PROJECTS], 'readonly');
    const store = transaction.objectStore(STORE_PROJECTS);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
};

export const getProjectMetadata = async (projectId: string): Promise<ProjectMetadata | null> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_PROJECTS], 'readonly');
    const store = transaction.objectStore(STORE_PROJECTS);
    const request = store.get(projectId);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
};

export const saveProjectMetadata = async (metadata: ProjectMetadata): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_PROJECTS], 'readwrite');
    const store = transaction.objectStore(STORE_PROJECTS);

    const updatedMetadata = {
      ...metadata,
      lastModified: Date.now(),
      storageVersion: 2
    };

    const request = store.put(updatedMetadata);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const deleteProjectV2 = async (projectId: string): Promise<void> => {
  const db = await openDB();

  // Delete metadata
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction([STORE_PROJECTS], 'readwrite');
    const store = transaction.objectStore(STORE_PROJECTS);
    const request = store.delete(projectId);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });

  // Delete all data chunks
  await deleteAllDataChunks(projectId);

  // Delete cache
  await clearCache(projectId);
};

// --- Data Chunk Operations ---

export const saveDataChunk = async (projectId: string, chunkIndex: number, data: RawRow[]): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_DATA_CHUNKS], 'readwrite');
    const store = transaction.objectStore(STORE_DATA_CHUNKS);

    const chunk: DataChunk = {
      projectId,
      chunkIndex,
      data
    };

    const request = store.put(chunk);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const getDataChunk = async (projectId: string, chunkIndex: number): Promise<RawRow[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_DATA_CHUNKS], 'readonly');
    const store = transaction.objectStore(STORE_DATA_CHUNKS);
    const request = store.get([projectId, chunkIndex]);

    request.onsuccess = () => {
      const chunk = request.result as DataChunk | undefined;
      resolve(chunk?.data || []);
    };
    request.onerror = () => reject(request.error);
  });
};

export const getAllDataChunks = async (projectId: string): Promise<RawRow[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_DATA_CHUNKS], 'readonly');
    const store = transaction.objectStore(STORE_DATA_CHUNKS);
    const index = store.index('projectId');
    const request = index.getAll(projectId);

    request.onsuccess = () => {
      const chunks = request.result as DataChunk[];
      // Sort by chunkIndex and flatten
      const sortedData = chunks
        .sort((a, b) => a.chunkIndex - b.chunkIndex)
        .flatMap(chunk => chunk.data);
      resolve(sortedData);
    };
    request.onerror = () => reject(request.error);
  });
};

export const deleteAllDataChunks = async (projectId: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_DATA_CHUNKS], 'readwrite');
    const store = transaction.objectStore(STORE_DATA_CHUNKS);
    const index = store.index('projectId');
    const request = index.openCursor(IDBKeyRange.only(projectId));

    request.onsuccess = (event: any) => {
      const cursor = event.target.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      } else {
        resolve();
      }
    };

    request.onerror = () => reject(request.error);
  });
};

/**
 * Batch insert data chunks
 * Optimized for large datasets (1M+ rows)
 */
export const batchInsertData = async (
  projectId: string,
  data: RawRow[],
  onProgress?: (progress: number) => void
): Promise<void> => {
  const totalRows = data.length;
  const totalChunks = Math.ceil(totalRows / CHUNK_SIZE);

  // Save chunks
  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, totalRows);
    const chunkData = data.slice(start, end);

    await saveDataChunk(projectId, i, chunkData);

    if (onProgress) {
      const progress = Math.round(((i + 1) / totalChunks) * 100);
      onProgress(progress);
    }
  }
};

/**
 * Append new data to existing chunks
 */
export const appendData = async (projectId: string, newData: RawRow[]): Promise<number> => {
  const metadata = await getProjectMetadata(projectId);
  if (!metadata) throw new Error('Project not found');

  const startChunkIndex = metadata.chunkCount;
  const newChunkCount = Math.ceil(newData.length / CHUNK_SIZE);

  for (let i = 0; i < newChunkCount; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, newData.length);
    const chunkData = newData.slice(start, end);

    await saveDataChunk(projectId, startChunkIndex + i, chunkData);
  }

  // Update metadata
  metadata.rowCount += newData.length;
  metadata.chunkCount = startChunkIndex + newChunkCount;
  await saveProjectMetadata(metadata);

  return metadata.rowCount;
};

/**
 * Paginated data retrieval
 */
export const getDataPaginated = async (
  projectId: string,
  page: number = 0,
  pageSize: number = 1000
): Promise<PaginationResult> => {
  const metadata = await getProjectMetadata(projectId);
  if (!metadata) {
    return { rows: [], total: 0, page, pageSize, hasMore: false };
  }

  const startRow = page * pageSize;
  const endRow = startRow + pageSize;

  const startChunk = Math.floor(startRow / CHUNK_SIZE);
  const endChunk = Math.ceil(endRow / CHUNK_SIZE);

  const rows: RawRow[] = [];

  for (let i = startChunk; i < endChunk && i < metadata.chunkCount; i++) {
    const chunkData = await getDataChunk(projectId, i);
    rows.push(...chunkData);
  }

  // Slice to exact page bounds
  const offsetInFirstChunk = startRow % CHUNK_SIZE;
  const slicedRows = rows.slice(offsetInFirstChunk, offsetInFirstChunk + pageSize);

  return {
    rows: slicedRows,
    total: metadata.rowCount,
    page,
    pageSize,
    hasMore: endRow < metadata.rowCount
  };
};

// --- Cache Operations ---

export const getCachedResult = async (projectId: string, cacheKey: string): Promise<any | null> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_CACHE], 'readonly');
    const store = transaction.objectStore(STORE_CACHE);
    const request = store.get([projectId, cacheKey]);

    request.onsuccess = () => {
      const entry = request.result as CacheEntry | undefined;

      if (!entry) {
        resolve(null);
        return;
      }

      // Check expiry
      if (entry.expiry < Date.now()) {
        resolve(null);
        return;
      }

      resolve(entry.result);
    };

    request.onerror = () => reject(request.error);
  });
};

export const setCachedResult = async (projectId: string, cacheKey: string, result: any): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_CACHE], 'readwrite');
    const store = transaction.objectStore(STORE_CACHE);

    const entry: CacheEntry = {
      projectId,
      cacheKey,
      result,
      expiry: Date.now() + CACHE_TTL
    };

    const request = store.put(entry);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const clearCache = async (projectId: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_CACHE], 'readwrite');
    const store = transaction.objectStore(STORE_CACHE);
    const request = store.openCursor();

    request.onsuccess = (event: any) => {
      const cursor = event.target.result;
      if (cursor) {
        const entry = cursor.value as CacheEntry;
        if (entry.projectId === projectId) {
          cursor.delete();
        }
        cursor.continue();
      } else {
        resolve();
      }
    };

    request.onerror = () => reject(request.error);
  });
};

// --- LocalStorage (UI Config) ---

export const saveLastStateV2 = (projectId: string, tab: ProjectTab) => {
  localStorage.setItem(CONFIG_KEY, JSON.stringify({ projectId, tab }));
};

export const getLastStateV2 = (): { projectId: string | null; tab: ProjectTab } => {
  try {
    const stored = localStorage.getItem(CONFIG_KEY);
    if (stored) return JSON.parse(stored);
  } catch (e) {
    // Fallback to v1 key
    try {
      const v1Stored = localStorage.getItem('real_data_config_v1');
      if (v1Stored) return JSON.parse(v1Stored);
    } catch (e2) {}
  }
  return { projectId: null, tab: ProjectTab.UPLOAD };
};

// --- Statistics ---

export const getStorageStats = async (): Promise<{
  projectCount: number;
  totalRows: number;
  totalChunks: number;
  cacheSize: number;
}> => {
  const projects = await getProjectsV2();

  const totalRows = projects.reduce((sum, p) => sum + p.rowCount, 0);
  const totalChunks = projects.reduce((sum, p) => sum + p.chunkCount, 0);

  const db = await openDB();
  const cacheSize = await new Promise<number>((resolve, reject) => {
    const transaction = db.transaction([STORE_CACHE], 'readonly');
    const store = transaction.objectStore(STORE_CACHE);
    const request = store.count();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return {
    projectCount: projects.length,
    totalRows,
    totalChunks,
    cacheSize
  };
};
