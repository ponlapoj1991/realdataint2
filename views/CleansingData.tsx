import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Save, Loader2, Search, Settings, Eraser, Trash2, Zap } from 'lucide-react';
import { ColumnConfig, DataSource, Project, RawRow } from '../types';
import { ensureDataSources, getDataSourcesByKind, updateDataSourceRows, addDerivedDataSource } from '../utils/dataSources';
import { saveProject } from '../utils/storage-compat';
import { smartParseDate } from '../utils/excel';
import { useToast } from '../components/ToastProvider';

interface CleansingDataProps {
  project: Project;
  onUpdateProject: (p: Project) => void;
}

const CleansingData: React.FC<CleansingDataProps> = ({ project, onUpdateProject }) => {
  const needsNormalization = !project.dataSources?.length || !project.activeDataSourceId;
  const { project: normalizedProject } = useMemo(() => ensureDataSources(project), [project]);
  useEffect(() => {
    if (needsNormalization) {
      onUpdateProject(normalizedProject);
    }
  }, [needsNormalization, normalizedProject, onUpdateProject]);

  const ingestionSources = useMemo(() => getDataSourcesByKind(normalizedProject, 'ingestion'), [normalizedProject]);
  const preparedSources = useMemo(() => getDataSourcesByKind(normalizedProject, 'prepared'), [normalizedProject]);

  const allSources: DataSource[] = useMemo(
    () => [...ingestionSources, ...preparedSources].sort((a, b) => b.updatedAt - a.updatedAt),
    [ingestionSources, preparedSources]
  );

  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const [tableName, setTableName] = useState('');
  const [nameError, setNameError] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [activeToolMode, setActiveToolMode] = useState<'none' | 'cleaner' | 'transform'>('none');
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [targetCol, setTargetCol] = useState<string>('all');
  const [transformAction, setTransformAction] = useState<'date' | 'explode'>('date');
  const [transformCol, setTransformCol] = useState<string>('');
  const [delimiter, setDelimiter] = useState<string>(',');
  const [editingCol, setEditingCol] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const { showToast } = useToast();

  const selectedSource = useMemo(() => allSources.find((s) => s.id === selectedSourceId) || null, [allSources, selectedSourceId]);
  useEffect(() => {
    if (!selectedSource && allSources.length) {
      setSelectedSourceId(allSources[0].id);
    }
  }, [allSources, selectedSource]);

  const workingRows = selectedSource?.rows || [];
  const workingColumns = selectedSource?.columns || [];

  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return workingRows;
    const q = searchQuery.toLowerCase();
    return workingRows.filter((row) => Object.values(row).some((val) => String(val ?? '').toLowerCase().includes(q)));
  }, [workingRows, searchQuery]);

  const displayRows = useMemo(() => filteredRows.slice(0, 50), [filteredRows]);

  const persistSource = async (rows: RawRow[], columns: ColumnConfig[] = workingColumns) => {
    if (!selectedSource) return;
    const updated = updateDataSourceRows(normalizedProject, selectedSource.id, rows, columns, 'replace');
    await saveProject(updated);
    onUpdateProject(updated);
  };

  const handleSelect = (source: DataSource) => {
    setSelectedSourceId(source.id);
    setShowPicker(false);
  };

  const updateColumnType = async (key: string, type: ColumnConfig['type']) => {
    const next = workingColumns.map((c) => (c.key === key ? { ...c, type } : c));
    await persistSource(workingRows, next);
    setEditingCol(null);
  };

  const handleFindReplace = async () => {
    if (!findText.trim()) return;
    const colsToSearch = targetCol === 'all' ? workingColumns.map((c) => c.key) : [targetCol];
    const newRows = workingRows.map((row) => {
      const next = { ...row };
      colsToSearch.forEach((key) => {
        const val = next[key];
        if (typeof val === 'string' && val.includes(findText)) {
          next[key] = val.split(findText).join(replaceText);
        }
      });
      return next;
    });
    await persistSource(newRows, workingColumns);
  };

  const handleTransform = async () => {
    if (!transformCol) return;
    let newRows = [...workingRows];
    let newCols = [...workingColumns];
    if (transformAction === 'date') {
      newRows = newRows.map((row) => {
        const val = row[transformCol];
        if (typeof val === 'string') {
          const parsed = smartParseDate(val);
          return { ...row, [transformCol]: parsed || val };
        }
        return row;
      });
      newCols = newCols.map((c) => (c.key === transformCol ? { ...c, type: 'date' } : c));
    } else if (transformAction === 'explode') {
      newRows = newRows.map((row) => {
        const val = row[transformCol];
        if (typeof val === 'string') {
          const parts = val.split(delimiter).map((s) => s.trim()).filter(Boolean);
          return { ...row, [transformCol]: JSON.stringify(parts) };
        }
        return row;
      });
      newCols = newCols.map((c) => (c.key === transformCol ? { ...c, type: 'tag_array' } : c));
    }
    await persistSource(newRows, newCols);
    setTransformCol('');
  };

  const handleDeleteRow = async (index: number) => {
    const next = workingRows.filter((_, i) => i !== index);
    await persistSource(next, workingColumns);
  };

  const openNameModal = () => {
    if (!selectedSource) return;
    setTableName(`${selectedSource.name} - Cleansed`);
    setNameError('');
    setShowNameModal(true);
  };

  const confirmSave = async () => {
    const trimmed = tableName.trim();
    if (!trimmed) {
      setNameError('Please enter a name.');
      return;
    }
    if (!selectedSource) return;
    setIsSaving(true);
    const updated = addDerivedDataSource(normalizedProject, trimmed, selectedSource.rows, selectedSource.columns, 'prepared');
    await saveProject(updated);
    onUpdateProject(updated);
    showToast('Saved', 'Table stored under Preparation Data.', 'success');
    setTimeout(() => setIsSaving(false), 300);
    setShowNameModal(false);
  };

  return (
    <div className="h-full flex flex-col px-10 py-8 overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Cleansing Data</h1>
          <p className="text-sm text-gray-500">Pick a table and clean directly on it.</p>
        </div>
        <div className="flex items-center space-x-3">
          {selectedSource && (
            <button
              onClick={openNameModal}
              disabled={isSaving}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg shadow-sm hover:bg-blue-700 transition disabled:opacity-60"
            >
              {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save to Preparation
            </button>
          )}
          <button
            onClick={() => setShowPicker(true)}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-800 hover:bg-gray-50"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create
          </button>
        </div>
      </div>

      {!selectedSource && (
        <div className="flex-1 border border-dashed border-gray-200 rounded-xl bg-white/60 flex items-center justify-center text-gray-400 text-sm">
          Select a table to begin cleansing.
        </div>
      )}

      {selectedSource && (
        <div className="flex-1 flex flex-col border border-gray-200 rounded-xl bg-white shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-xs uppercase tracking-wide text-gray-500">Working source</p>
              <div className="flex items-center space-x-2 text-gray-900 font-semibold">
                <span>{selectedSource.name}</span>
                <span className="text-xs font-medium text-gray-500">{selectedSource.rows.length.toLocaleString()} rows</span>
              </div>
            </div>
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  placeholder="Search rows"
                />
              </div>
              <div className="flex bg-gray-100 rounded-lg p-0.5">
                <button
                  onClick={() => setActiveToolMode(activeToolMode === 'cleaner' ? 'none' : 'cleaner')}
                  className={`px-3 py-1 text-xs font-medium rounded-md flex items-center ${
                    activeToolMode === 'cleaner' ? 'bg-white shadow text-blue-700' : 'text-gray-600'
                  }`}
                >
                  <Eraser className="w-3 h-3 mr-1" />
                  Find & Replace
                </button>
                <button
                  onClick={() => setActiveToolMode(activeToolMode === 'transform' ? 'none' : 'transform')}
                  className={`px-3 py-1 text-xs font-medium rounded-md flex items-center ${
                    activeToolMode === 'transform' ? 'bg-white shadow text-purple-700' : 'text-gray-600'
                  }`}
                >
                  <Zap className="w-3 h-3 mr-1" />
                  Transform
                </button>
              </div>
            </div>
          </div>

          {activeToolMode === 'cleaner' && (
            <div className="px-6 py-3 bg-blue-50 border-b border-blue-100 flex items-center space-x-3">
              <span className="text-sm font-semibold text-blue-900">Find & Replace</span>
              <input
                className="px-3 py-2 text-sm border rounded-lg w-40"
                placeholder="Find"
                value={findText}
                onChange={(e) => setFindText(e.target.value)}
              />
              <input
                className="px-3 py-2 text-sm border rounded-lg w-40"
                placeholder="Replace"
                value={replaceText}
                onChange={(e) => setReplaceText(e.target.value)}
              />
              <select
                className="px-3 py-2 text-sm border rounded-lg"
                value={targetCol}
                onChange={(e) => setTargetCol(e.target.value)}
              >
                <option value="all">All columns</option>
                {workingColumns.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.key}
                  </option>
                ))}
              </select>
              <button
                onClick={handleFindReplace}
                className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
              >
                Apply
              </button>
            </div>
          )}

          {activeToolMode === 'transform' && (
            <div className="px-6 py-3 bg-purple-50 border-b border-purple-100 flex items-center space-x-3">
              <span className="text-sm font-semibold text-purple-900">Transform</span>
              <div className="flex bg-white rounded-lg border p-0.5">
                <button
                  onClick={() => setTransformAction('date')}
                  className={`px-3 py-1 text-xs font-medium rounded ${
                    transformAction === 'date' ? 'bg-purple-100 text-purple-800' : 'text-gray-600'
                  }`}
                >
                  Date
                </button>
                <button
                  onClick={() => setTransformAction('explode')}
                  className={`px-3 py-1 text-xs font-medium rounded ${
                    transformAction === 'explode' ? 'bg-purple-100 text-purple-800' : 'text-gray-600'
                  }`}
                >
                  Explode tags
                </button>
              </div>
              <select
                className="px-3 py-2 text-sm border rounded-lg w-44"
                value={transformCol}
                onChange={(e) => setTransformCol(e.target.value)}
              >
                <option value="">Select column</option>
                {workingColumns.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.key}
                  </option>
                ))}
              </select>
              {transformAction === 'explode' && (
                <input
                  className="px-3 py-2 text-sm border rounded-lg w-24"
                  value={delimiter}
                  onChange={(e) => setDelimiter(e.target.value)}
                  placeholder="," 
                />
              )}
              <button
                onClick={handleTransform}
                className="px-3 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700"
              >
                Apply
              </button>
            </div>
          )}

          <div className="flex-1 overflow-auto">
            <table className="w-full text-sm text-left text-gray-700">
              <thead className="text-xs text-gray-600 uppercase bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 w-10 border-b border-gray-200">#</th>
                  {workingColumns.map((col) => (
                    <th key={col.key} className="px-6 py-3 border-b border-gray-200 font-semibold whitespace-nowrap min-w-[140px]">
                      <div className="flex items-center justify-between">
                        <span>{col.key}</span>
                        <button onClick={() => setEditingCol(editingCol === col.key ? null : col.key)} className="text-gray-400 hover:text-gray-600">
                          <Settings className="w-3 h-3" />
                        </button>
                      </div>
                      {editingCol === col.key && (
                        <div className="absolute mt-2 bg-white border shadow-lg rounded p-2 z-20">
                          <select
                            className="text-xs p-1 border rounded w-full"
                            value={col.type}
                            onChange={(e) => updateColumnType(col.key, e.target.value as any)}
                          >
                            <option value="string">String</option>
                            <option value="number">Number</option>
                            <option value="date">Date</option>
                            <option value="tag_array">Tag array</option>
                          </select>
                        </div>
                      )}
                    </th>
                  ))}
                  <th className="px-4 py-3 border-b border-gray-200 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map((row, idx) => (
                  <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs font-mono text-gray-400">{idx + 1}</td>
                    {workingColumns.map((col) => (
                      <td key={col.key} className="px-6 py-3 truncate max-w-xs" title={String(row[col.key])}>
                        {typeof row[col.key] === 'object' && row[col.key] !== null
                          ? JSON.stringify(row[col.key])
                          : row[col.key] ?? ''}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => handleDeleteRow(idx)} className="text-gray-300 hover:text-red-500">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showPicker && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-30">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Select a source table</h3>
              <button onClick={() => setShowPicker(false)} className="text-gray-400 hover:text-gray-600">×</button>
            </div>
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {allSources.map((src) => (
                <button
                  key={src.id}
                  onClick={() => handleSelect(src)}
                  className={`w-full border rounded-lg px-4 py-3 text-left transition ${
                    selectedSourceId === src.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{src.name}</p>
                      <p className="text-xs text-gray-500">{src.kind === 'ingestion' ? 'Ingestion' : 'Preparation'} data</p>
                    </div>
                    <span className="text-xs text-gray-500">{src.rows.length.toLocaleString()} rows</span>
                  </div>
                </button>
              ))}
              {allSources.length === 0 && <p className="text-sm text-gray-500">No tables available. Upload data first.</p>}
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowPicker(false)}
                className="px-4 py-2 text-sm text-gray-600 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showNameModal && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center px-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="space-y-1">
              <p className="text-sm uppercase tracking-wide text-blue-600 font-semibold">Prepared table</p>
              <h3 className="text-xl font-bold text-gray-900">Name this table</h3>
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
                    confirmSave();
                  }
                }}
                className={`w-full rounded-lg border ${nameError ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 focus:ring-blue-200'} px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2`}
                placeholder="Cleaned table"
              />
              {nameError && <p className="text-xs text-red-600">{nameError}</p>}
            </div>
            <div className="flex justify-end space-x-3 pt-2">
              <button onClick={() => setShowNameModal(false)} className="px-4 py-2 text-sm text-gray-600 rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={confirmSave}
                disabled={isSaving}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg shadow-sm hover:bg-blue-700 disabled:opacity-60"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CleansingData;
