import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, RefreshCcw, Pencil, Star, Trash2, Loader2, Download, FileDown } from 'lucide-react';
import { DataSource, DataSourceKind, Project, RawRow } from '../types';
import { useToast } from '../components/ToastProvider';
import { useExcelWorker } from '../hooks/useExcelWorker';
import { exportToCsv, exportToExcel, inferColumns } from '../utils/excel';
import { ensureDataSources, getDataSourcesByKind, removeDataSource, setActiveDataSource, updateDataSourceRows, upsertDataSource } from '../utils/dataSources';
import { saveProject } from '../utils/storage-compat';

interface DataIngestProps {
  project: Project;
  onUpdateProject: (p: Project) => void;
  kind: DataSourceKind;
  onNext?: () => void;
}

interface PendingUpload {
  mode: 'new' | 'append' | 'replace';
  sourceId?: string;
  name?: string;
}

const titles: Record<DataSourceKind, { title: string; subtitle: string; empty: string }> = {
  ingestion: {
    title: 'Ingestion Data',
    subtitle: 'Upload raw files as reusable tables.',
    empty: 'No ingestion tables yet. Upload a file to get started.',
  },
  prepared: {
    title: 'Preparation Data',
    subtitle: 'Data saved from Preparation Tools.',
    empty: 'No prepared tables yet. Save from Preparation Tools to populate this list.',
  },
};

const DataIngest: React.FC<DataIngestProps> = ({ project, onUpdateProject, kind, onNext }) => {
  const needsNormalization = !project.dataSources?.length || !project.activeDataSourceId;
  const normalizedProject = useMemo(() => (needsNormalization ? ensureDataSources(project).project : project), [needsNormalization, project]);

  useEffect(() => {
    if (needsNormalization) {
      onUpdateProject(normalizedProject);
    }
  }, [needsNormalization, normalizedProject, onUpdateProject]);

  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [pendingUpload, setPendingUpload] = useState<PendingUpload | null>(null);
  const [isNameModalOpen, setIsNameModalOpen] = useState(false);
  const [tableName, setTableName] = useState('');
  const [nameError, setNameError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sources = useMemo(() => getDataSourcesByKind(normalizedProject, kind).sort((a, b) => b.updatedAt - a.updatedAt), [kind, normalizedProject]);

  const { parseFile } = useExcelWorker();

  const buildColumns = (rows: RawRow[]): ReturnType<typeof inferColumns> => {
    if (!rows.length) return [];
    return inferColumns(rows[0]);
  };

  const persistProject = async (updated: Project) => {
    onUpdateProject(updated);
    await saveProject(updated);
  };

  const resetFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const triggerFilePicker = () => {
    resetFileInput();
    fileInputRef.current?.click();
  };

  const submitNewTableName = () => {
    const trimmed = tableName.trim();
    if (!trimmed) {
      setNameError('Please enter a table name.');
      return;
    }
    setPendingUpload({ mode: 'new', name: trimmed });
    setIsNameModalOpen(false);
    setTimeout(() => triggerFilePicker(), 10);
  };

  const startUpload = (config: PendingUpload) => {
    if (config.mode === 'new') {
      const suggested = kind === 'ingestion' ? `Table ${sources.length + 1}` : `Prepared Table ${sources.length + 1}`;
      setTableName(suggested);
      setNameError('');
      setPendingUpload({ mode: 'new' });
      setIsNameModalOpen(true);
      return;
    }

    setPendingUpload(config);
    triggerFilePicker();
  };

  const processIncomingData = async (rows: RawRow[], upload: PendingUpload) => {
    const columns = buildColumns(rows);

    if (upload.mode === 'new') {
      const newSource: DataSource = {
        id: crypto.randomUUID(),
        name: upload.name || 'New Table',
        kind,
        rows,
        columns,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      const updatedProject = upsertDataSource(normalizedProject, newSource, { setActive: true });
      await persistProject(updatedProject);
      return;
    }

    if (!upload.sourceId) return;
    const mode = upload.mode === 'append' ? 'append' : 'replace';
    const updatedProject = updateDataSourceRows(normalizedProject, upload.sourceId, rows, columns, mode);
    await persistProject(updatedProject);
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const targetUpload: PendingUpload = pendingUpload || { mode: 'new', name: `Table ${sources.length + 1}` };
    const file = files[0];
    if (!file.name.match(/\.(xlsx|xls|csv)$/)) {
      showToast('Invalid Format', 'Please upload an Excel (.xlsx, .xls) or CSV file.', 'error');
      return;
    }
    setIsLoading(true);
    try {
      const newData = await parseFile(file);
      if (newData.length === 0) {
        throw new Error('The file appears to be empty.');
      }
      await processIncomingData(newData, targetUpload);
      showToast('Import Successful', `${file.name} processed successfully.`, 'success');
    } catch (err: any) {
      console.error('[DataManagement] Upload error:', err);
      showToast('Import Failed', err.message || 'Failed to process file.', 'error');
    } finally {
      setIsLoading(false);
      setPendingUpload(null);
    }
  };

  const setActive = async (id: string) => {
    const updated = setActiveDataSource(normalizedProject, id);
    await persistProject(updated);
    showToast('Active table changed', 'Other features will now use this table.', 'info');
  };

  const handleDownload = (source: DataSource, format: 'excel' | 'csv') => {
    if (!source.rows || source.rows.length === 0) {
      showToast('No data to export', 'This table is empty.', 'warning');
      return;
    }

    const safeName = source.name.trim() || 'Exported Table';
    if (format === 'excel') {
      exportToExcel(source.rows, safeName);
    } else {
      exportToCsv(source.rows, safeName);
    }
  };

  const meta = titles[kind];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx, .xls, .csv"
        onChange={(e) => handleFileUpload(e.target.files)}
        className="hidden"
      />

      {isNameModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center px-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="space-y-1">
              <p className="text-sm uppercase tracking-wide text-blue-600 font-semibold">New table</p>
              <h3 className="text-xl font-bold text-gray-900">Name your table</h3>
              <p className="text-sm text-gray-500">Set a table name before uploading your file.</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Table name</label>
              <input
                autoFocus
                value={tableName}
                onChange={(e) => {
                  setTableName(e.target.value);
                  setNameError('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    submitNewTableName();
                  }
                }}
                className={`w-full rounded-lg border ${nameError ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 focus:ring-blue-200'} px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2`}
                placeholder="Customer Orders Q1"
              />
              {nameError && <p className="text-xs text-red-600">{nameError}</p>}
            </div>

            <div className="flex justify-end space-x-3 pt-2">
              <button
                onClick={() => {
                  setIsNameModalOpen(false);
                  setPendingUpload(null);
                }}
                className="px-3 py-2 text-sm rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  submitNewTableName();
                }}
                className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 shadow-sm"
              >
                Continue to upload
              </button>
            </div>
          </div>
        </div>
      )}

        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{meta.title}</h2>
            <p className="text-gray-500 text-sm">{meta.subtitle}</p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => startUpload({ mode: 'new' })}
              disabled={isLoading}
              className="inline-flex items-center px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium shadow-sm hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4 mr-1" /> Upload
            </button>
          </div>
        </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
        <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100 text-sm text-gray-500">
          <div className="flex items-center space-x-2">
            <span className="text-xs uppercase tracking-wide text-gray-400">Overview</span>
            <span className="text-gray-300">•</span>
            <span>{sources.length} table{sources.length === 1 ? '' : 's'}</span>
          </div>
          <div className="flex items-center space-x-2 text-xs text-gray-400">
            <span>Rows per page</span>
            <select className="border border-gray-200 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500">
              <option>10</option>
              <option>20</option>
              <option>50</option>
            </select>
          </div>
        </div>

        <div className="divide-y divide-gray-100">
          <div className="grid grid-cols-[72px,2fr,1fr,1.2fr,1fr,1.6fr] px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 items-center">
            <span className="text-center">No.</span>
            <span>Table name</span>
            <span className="text-center">Rows</span>
            <span className="text-center">Updated</span>
            <span className="text-center">Status</span>
            <span className="text-right">Action</span>
          </div>

          {sources.length === 0 ? (
            <div className="p-6 text-center text-gray-500 text-sm">{meta.empty}</div>
          ) : (
            sources.map((source, idx) => {
              const isActive = normalizedProject.activeDataSourceId === source.id;
              return (
                <div key={source.id} className="grid grid-cols-[72px,2fr,1fr,1.2fr,1fr,1.6fr] px-6 py-3 items-center text-sm hover:bg-gray-50 gap-2">
                  <span className="text-gray-500 text-center">{idx + 1}</span>
                  <div>
                    <div className="font-semibold text-gray-900">{source.name}</div>
                    <div className="text-xs text-gray-500">{kind === 'ingestion' ? 'Uploaded table' : 'Prepared output'}</div>
                  </div>
                  <span className="text-gray-700 text-center">{source.rows.length.toLocaleString()}</span>
                  <span className="text-gray-700 text-center">{new Date(source.updatedAt).toLocaleString()}</span>
                  <div className="flex justify-center">
                    {isActive ? (
                      <span className="inline-flex items-center px-2 py-1 text-xs rounded-full bg-green-50 text-green-700 border border-green-100">Active</span>
                    ) : (
                      <button
                        onClick={() => setActive(source.id)}
                        className="inline-flex items-center px-2 py-1 text-xs rounded-full border border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-700"
                      >
                        <Star className="w-3 h-3 mr-1" /> Set active
                      </button>
                    )}
                  </div>
                  <div className="flex items-center justify-end flex-wrap gap-2">
                    {kind === 'prepared' && (
                      <>
                        <button
                          onClick={() => handleDownload(source, 'excel')}
                          disabled={isLoading}
                          className="inline-flex items-center px-2.5 py-1.5 rounded-md border border-gray-200 text-gray-700 text-xs hover:border-blue-300 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Download className="w-4 h-4 mr-1" /> Excel
                        </button>
                        <button
                          onClick={() => handleDownload(source, 'csv')}
                          disabled={isLoading}
                          className="inline-flex items-center px-2.5 py-1.5 rounded-md border border-gray-200 text-gray-700 text-xs hover:border-blue-300 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <FileDown className="w-4 h-4 mr-1" /> CSV
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => startUpload({ mode: 'append', sourceId: source.id })}
                      disabled={isLoading}
                      className="inline-flex items-center px-2.5 py-1.5 rounded-md border border-gray-200 text-gray-700 text-xs hover:border-blue-300 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Pencil className="w-4 h-4 mr-1" /> Append
                    </button>
                    <button
                      onClick={() => startUpload({ mode: 'replace', sourceId: source.id })}
                      disabled={isLoading}
                      className="inline-flex items-center px-2.5 py-1.5 rounded-md border border-gray-200 text-gray-700 text-xs hover:border-blue-300 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <RefreshCcw className="w-4 h-4 mr-1" /> Replace
                    </button>
                    <button
                      onClick={async () => {
                        const confirmed = confirm('Delete this table?');
                        if (!confirmed) return;
                        const updated = removeDataSource(normalizedProject, source.id);
                        await persistProject(updated);
                        showToast('Table deleted', `${source.name} has been removed.`, 'info');
                      }}
                      disabled={isLoading}
                      className="inline-flex items-center px-2.5 py-1.5 rounded-md border border-red-100 text-red-600 text-xs hover:border-red-200 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-4 h-4 mr-1" /> Delete
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {isLoading && (
        <div className="fixed inset-0 bg-black/30 z-30 flex items-center justify-center">
          <div className="bg-white shadow-xl rounded-xl px-6 py-4 flex items-center space-x-3 text-gray-800">
            <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
            <span className="text-sm font-medium">Uploading…</span>
          </div>
        </div>
      )}

    </div>
  );
};

export default DataIngest;
