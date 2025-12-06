/**
 * Project Backup & Restore Utility
 *
 * Export: Creates a .zip file containing all project data
 * Import: Restores a project from a .zip backup file
 *
 * File structure inside .zip:
 * - manifest.json     - Version info and project metadata
 * - metadata.json     - Full project configuration
 * - data/chunk_0.json - Data chunks (1000 rows each)
 * - data/chunk_1.json
 * - ...
 */

import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import {
  getProjectMetadata,
  getAllDataChunks,
  saveProjectMetadata,
  batchInsertData,
  deleteProjectV2,
} from './storage-v2';
import type { RawRow } from '../types';

const BACKUP_VERSION = 1;
const CHUNK_SIZE = 1000;

interface BackupManifest {
  version: number;
  exportedAt: number;
  appVersion: string;
  projectId: string;
  projectName: string;
  rowCount: number;
  chunkCount: number;
}

export interface ExportProgress {
  phase: 'preparing' | 'metadata' | 'data' | 'compressing' | 'done';
  percent: number;
  message: string;
}

export interface ImportProgress {
  phase: 'reading' | 'validating' | 'metadata' | 'data' | 'done';
  percent: number;
  message: string;
}

/**
 * Export a project to a downloadable .zip file
 */
export const exportProject = async (
  projectId: string,
  onProgress?: (progress: ExportProgress) => void
): Promise<void> => {
  const report = (phase: ExportProgress['phase'], percent: number, message: string) => {
    onProgress?.({ phase, percent, message });
  };

  try {
    report('preparing', 0, 'Preparing export...');

    // Get project metadata
    const metadata = await getProjectMetadata(projectId);
    if (!metadata) {
      throw new Error('Project not found');
    }

    report('metadata', 10, 'Loading project configuration...');

    // Get all data chunks
    report('data', 20, 'Loading project data...');
    const allData = await getAllDataChunks(projectId);

    // Create ZIP file
    const zip = new JSZip();

    // Add manifest
    const manifest: BackupManifest = {
      version: BACKUP_VERSION,
      exportedAt: Date.now(),
      appVersion: '2.0.0',
      projectId: metadata.id,
      projectName: metadata.name,
      rowCount: allData.length,
      chunkCount: Math.ceil(allData.length / CHUNK_SIZE),
    };
    zip.file('manifest.json', JSON.stringify(manifest, null, 2));

    report('metadata', 30, 'Saving project configuration...');

    // Add metadata (without the raw data - that's in chunks)
    const metadataForExport = {
      ...metadata,
      // Clear data-related fields that will be reconstructed on import
      rowCount: allData.length,
      chunkCount: Math.ceil(allData.length / CHUNK_SIZE),
    };
    zip.file('metadata.json', JSON.stringify(metadataForExport, null, 2));

    // Add data chunks
    const dataFolder = zip.folder('data');
    if (!dataFolder) {
      throw new Error('Failed to create data folder in ZIP');
    }

    const totalChunks = Math.ceil(allData.length / CHUNK_SIZE);
    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, allData.length);
      const chunkData = allData.slice(start, end);

      dataFolder.file(`chunk_${i}.json`, JSON.stringify(chunkData));

      const percent = 30 + Math.round(((i + 1) / totalChunks) * 50);
      report('data', percent, `Saving data chunk ${i + 1}/${totalChunks}...`);
    }

    report('compressing', 85, 'Compressing backup file...');

    // Generate ZIP blob
    const blob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    report('compressing', 95, 'Preparing download...');

    // Trigger download
    const filename = `${metadata.name.replace(/[^a-z0-9]/gi, '_')}_backup_${formatDate(new Date())}.zip`;
    saveAs(blob, filename);

    report('done', 100, 'Export complete!');
  } catch (error) {
    console.error('Export failed:', error);
    throw error;
  }
};

/**
 * Import a project from a .zip backup file
 */
export const importProject = async (
  file: File,
  options: {
    overwriteExisting?: boolean;
    newProjectId?: string;
    newProjectName?: string;
  } = {},
  onProgress?: (progress: ImportProgress) => void
): Promise<string> => {
  const report = (phase: ImportProgress['phase'], percent: number, message: string) => {
    onProgress?.({ phase, percent, message });
  };

  try {
    report('reading', 0, 'Reading backup file...');

    // Read ZIP file
    const zip = await JSZip.loadAsync(file);

    report('validating', 10, 'Validating backup format...');

    // Read and validate manifest
    const manifestFile = zip.file('manifest.json');
    if (!manifestFile) {
      throw new Error('Invalid backup file: missing manifest.json');
    }

    const manifestText = await manifestFile.async('string');
    const manifest: BackupManifest = JSON.parse(manifestText);

    if (!manifest.version || manifest.version > BACKUP_VERSION) {
      throw new Error(`Unsupported backup version: ${manifest.version}`);
    }

    report('validating', 20, 'Validating project metadata...');

    // Read metadata
    const metadataFile = zip.file('metadata.json');
    if (!metadataFile) {
      throw new Error('Invalid backup file: missing metadata.json');
    }

    const metadataText = await metadataFile.async('string');
    const metadata = JSON.parse(metadataText);

    // Determine project ID and name
    const projectId = options.newProjectId || `imported_${Date.now()}`;
    const projectName = options.newProjectName || `${metadata.name} (Imported)`;

    report('metadata', 30, 'Preparing project...');

    // Check if we need to delete existing project
    if (options.overwriteExisting && options.newProjectId) {
      try {
        await deleteProjectV2(options.newProjectId);
      } catch (e) {
        // Ignore if project doesn't exist
      }
    }

    // Read all data chunks
    report('data', 40, 'Loading data chunks...');

    const allData: RawRow[] = [];
    const dataFolder = zip.folder('data');

    if (dataFolder) {
      const chunkFiles: { index: number; file: JSZip.JSZipObject }[] = [];

      dataFolder.forEach((relativePath, file) => {
        const match = relativePath.match(/chunk_(\d+)\.json$/);
        if (match) {
          chunkFiles.push({ index: parseInt(match[1], 10), file });
        }
      });

      // Sort by index
      chunkFiles.sort((a, b) => a.index - b.index);

      for (let i = 0; i < chunkFiles.length; i++) {
        const { file } = chunkFiles[i];
        const chunkText = await file.async('string');
        const chunkData: RawRow[] = JSON.parse(chunkText);
        allData.push(...chunkData);

        const percent = 40 + Math.round(((i + 1) / chunkFiles.length) * 40);
        report('data', percent, `Loading chunk ${i + 1}/${chunkFiles.length}...`);
      }
    }

    report('data', 85, 'Saving project data...');

    // Save data chunks
    await batchInsertData(projectId, allData, (progress) => {
      const percent = 85 + Math.round(progress * 0.1);
      report('data', percent, `Saving data... ${progress}%`);
    });

    report('metadata', 95, 'Saving project configuration...');

    // Save metadata with new ID and name
    const newMetadata = {
      ...metadata,
      id: projectId,
      name: projectName,
      lastModified: Date.now(),
      rowCount: allData.length,
      chunkCount: Math.ceil(allData.length / CHUNK_SIZE),
      storageVersion: 2,
    };

    await saveProjectMetadata(newMetadata);

    report('done', 100, 'Import complete!');

    return projectId;
  } catch (error) {
    console.error('Import failed:', error);
    throw error;
  }
};

/**
 * Validate a backup file without importing
 */
export const validateBackupFile = async (
  file: File
): Promise<{
  valid: boolean;
  manifest?: BackupManifest;
  error?: string;
}> => {
  try {
    const zip = await JSZip.loadAsync(file);

    const manifestFile = zip.file('manifest.json');
    if (!manifestFile) {
      return { valid: false, error: 'Missing manifest.json' };
    }

    const manifestText = await manifestFile.async('string');
    const manifest: BackupManifest = JSON.parse(manifestText);

    if (!manifest.version) {
      return { valid: false, error: 'Invalid manifest: missing version' };
    }

    if (manifest.version > BACKUP_VERSION) {
      return { valid: false, error: `Backup version ${manifest.version} is newer than supported (${BACKUP_VERSION})` };
    }

    const metadataFile = zip.file('metadata.json');
    if (!metadataFile) {
      return { valid: false, error: 'Missing metadata.json' };
    }

    return { valid: true, manifest };
  } catch (error) {
    return { valid: false, error: String(error) };
  }
};

/**
 * Get estimated storage size for a project
 */
export const getProjectStorageSize = async (projectId: string): Promise<number> => {
  const metadata = await getProjectMetadata(projectId);
  if (!metadata) return 0;

  const allData = await getAllDataChunks(projectId);

  // Rough estimate: metadata + data as JSON
  const metadataSize = JSON.stringify(metadata).length;
  const dataSize = JSON.stringify(allData).length;

  return metadataSize + dataSize;
};

/**
 * Format bytes to human-readable string
 */
export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Format date for filename
 */
const formatDate = (date: Date): string => {
  return date.toISOString().slice(0, 10).replace(/-/g, '');
};
