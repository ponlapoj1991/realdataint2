import React, { useState, useMemo, useEffect } from 'react';
import { Settings, Download, Save, Search, X, Eraser, Trash2, Replace, ArrowRight, Zap, Calendar, Split, Table2, Database, Plus, GripVertical, Check, ListFilter, ChevronUp, ChevronDown, Pencil } from 'lucide-react';
import { Project, RawRow, ColumnConfig, TransformationRule, TransformMethod } from '../types';
import { saveProject } from '../utils/storage-compat';
import { addDerivedDataSource, ensureDataSources, setActiveDataSource, updateDataSourceRows } from '../utils/dataSources';
import { exportToExcel, smartParseDate, inferColumns } from '../utils/excel';
import { analyzeSourceColumn, applyTransformation, getAllUniqueValues } from '../utils/transform';
import EmptyState from '../components/EmptyState';
import { useToast } from '../components/ToastProvider';

interface DataPrepProps {
  project: Project;
  onUpdateProject: (p: Project) => void;
}

type Mode = 'clean' | 'build';

const DataPrep: React.FC<DataPrepProps> = ({ project, onUpdateProject }) => {
  const needsNormalization = !project.dataSources?.length || !project.activeDataSourceId;
  const { project: normalizedProject, active: activeSource } = useMemo(() => ensureDataSources(project), [project]);
  useEffect(() => {
    if (needsNormalization) {
      onUpdateProject(normalizedProject);
    }
  }, [needsNormalization, normalizedProject, onUpdateProject]);

  const [mode, setMode] = useState<Mode>('clean');
  const [isSaving, setIsSaving] = useState(false);

  const { showToast } = useToast();

  // --- CLEAN MODE STATES ---
  const [editingCol, setEditingCol] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeToolMode, setActiveToolMode] = useState<'none' | 'cleaner' | 'transform'>('none');
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [targetCol, setTargetCol] = useState<string>('all');
  const [transformAction, setTransformAction] = useState<'date' | 'explode'>('date');
  const [transformCol, setTransformCol] = useState<string>('');
  const [delimiter, setDelimiter] = useState<string>(',');

  // --- BUILD MODE STATES ---
  const [rules, setRules] = useState<TransformationRule[]>(normalizedProject.transformRules || []);
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  
  // New Rule Form
  const [newRuleName, setNewRuleName] = useState('');
  const [selectedSourceCol, setSelectedSourceCol] = useState('');
  const [sourceAnalysis, setSourceAnalysis] = useState<{ isArrayLikely: boolean, isDateLikely: boolean, uniqueTags: string[], sampleValues: string[] } | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<TransformMethod>('copy');
  const [methodParams, setMethodParams] = useState<any>({});
  const [valueMap, setValueMap] = useState<Record<string, string>>({});

  const activeData = activeSource.rows;
  const activeColumns = activeSource.columns;
  
  // Manual Map State
  const [manualMapKey, setManualMapKey] = useState('');
  const [manualMapValue, setManualMapValue] = useState('');

  // Computed Structured Data
  const structuredData = useMemo(() => {
      if (mode === 'build' && rules.length > 0) {
          return applyTransformation(activeData, rules);
      }
      return [];
  }, [activeData, rules, mode]);

  // Sync Rules to Project
  useEffect(() => {
      if (JSON.stringify(normalizedProject.transformRules) !== JSON.stringify(rules)) {
         // Keep local state in sync
      }
  }, [rules, normalizedProject.transformRules]);

  // --- SHARED FUNCTIONS ---
  const safeRender = (val: any) => {
    if (typeof val === 'object' && val !== null) return JSON.stringify(val);
    if (val === null || val === undefined) return '';
    if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
    return String(val);
  };

  const persistActiveData = async (rows: RawRow[], columns: ColumnConfig[] = activeColumns) => {
    const updatedProject = updateDataSourceRows(normalizedProject, activeSource.id, rows, columns, 'replace');
    onUpdateProject(updatedProject);
    await saveProject(updatedProject);
  };

  const handleActiveChange = async (value: string) => {
    const updated = setActiveDataSource(normalizedProject, value);
    onUpdateProject(updated);
    await saveProject(updated);
  };

  const handleManualSave = async () => {
      setIsSaving(true);
      const updatedProject = { ...normalizedProject, transformRules: rules };
      onUpdateProject(updatedProject);
      await saveProject(updatedProject);
      setTimeout(() => setIsSaving(false), 800);
  };

  const handleExport = () => {
      if (mode === 'clean') {
        exportToExcel(activeData, `${project.name}_Raw_Cleaned`);
      } else {
        exportToExcel(structuredData, `${project.name}_Structured`);
      }
  };

  const handleSavePreparedTable = async () => {
      if (structuredData.length === 0) {
        showToast('No structured data yet', 'Switch to Build Structure and add a rule before saving.', 'warning');
        return;
      }
      const name = prompt('Name for this prepared table', `${project.name} - Prepared`);
      if (!name) return;
      const columns = inferColumns(structuredData[0]);
      const updatedProject = addDerivedDataSource(normalizedProject, name, structuredData, columns, 'prepared');
      onUpdateProject(updatedProject);
      await saveProject(updatedProject);
      showToast('Prepared table saved', 'Find it under Management Data > Preparation Data.', 'success');
  };

  // --- CLEAN MODE FUNCTIONS ---
  const updateColumnType = async (key: string, type: ColumnConfig['type']) => {
    const newCols = activeColumns.map(c => c.key === key ? { ...c, type } : c);
    await persistActiveData(activeData, newCols);
    setEditingCol(null);
  };

  const handleFindReplace = async () => {
    if (!findText) return;
    const newData = activeData.map(row => {
        const newRow = { ...row };
        const colsToSearch = targetCol === 'all' ? activeColumns.map(c => c.key) : [targetCol];
        colsToSearch.forEach(key => {
            const val = newRow[key];
            if (typeof val === 'string' && val.includes(findText)) {
                newRow[key] = val.split(findText).join(replaceText);
            }
        });
        return newRow;
    });
    await persistActiveData(newData, activeColumns);
  };

  const handleTransform = async () => {
    if (!transformCol) return;
    let newData = [...activeData];
    let newCols = [...activeColumns];

    if (transformAction === 'date') {
        newData = newData.map(row => {
            const val = row[transformCol];
            if (typeof val === 'string') {
                const parsed = smartParseDate(val);
                return { ...row, [transformCol]: parsed || val };
            }
            return row;
        });
        newCols = newCols.map(c => c.key === transformCol ? { ...c, type: 'date' } : c);
    } else if (transformAction === 'explode') {
        newData = newData.map(row => {
            const val = row[transformCol];
            if (typeof val === 'string') {
                const parts = val.split(delimiter).map(s => s.trim()).filter(s => s);
                return { ...row, [transformCol]: JSON.stringify(parts) };
            }
            return row;
        });
        newCols = newCols.map(c => c.key === transformCol ? { ...c, type: 'tag_array' } : c);
    }
    await persistActiveData(newData, newCols);
    setTransformCol('');
  };

  const handleDeleteRow = async (index: number) => {
    const newData = activeData.filter((_, i) => i !== index);
    await persistActiveData(newData, activeColumns);
  };

  // --- BUILD MODE FUNCTIONS ---
  const handleSourceColSelect = (colKey: string) => {
      setSelectedSourceCol(colKey);
      const analysis = analyzeSourceColumn(activeData, colKey);
      setSourceAnalysis(analysis);
      
      // Smart Default logic, only if we are NOT editing an existing rule
      if (!editingRuleId) {
          if (analysis.isDateLikely) {
              setSelectedMethod('date_extract');
              setMethodParams({ datePart: 'date_only' });
          } else if (analysis.isArrayLikely) {
              setSelectedMethod('array_count');
              setMethodParams({});
          } else {
              setSelectedMethod('copy');
              setMethodParams({});
          }
          setValueMap({});
      }
  };

  const openAddModal = () => {
      setEditingRuleId(null);
      setNewRuleName('');
      setSelectedSourceCol('');
      setSourceAnalysis(null);
      setSelectedMethod('copy');
      setMethodParams({});
      setValueMap({});
      setManualMapKey('');
      setManualMapValue('');
      setIsRuleModalOpen(true);
  };

  const openEditModal = (rule: TransformationRule) => {
      setEditingRuleId(rule.id);
      setNewRuleName(rule.targetName);
      setSelectedSourceCol(rule.sourceKey);
      setSelectedMethod(rule.method);
      setMethodParams(rule.params || {});
      setValueMap(rule.valueMap || {});
      
      // Run analysis to populate preview/options
      const analysis = analyzeSourceColumn(activeData, rule.sourceKey);
      setSourceAnalysis(analysis);

      setIsRuleModalOpen(true);
  };

  const saveRule = () => {
      if (!newRuleName || !selectedSourceCol) return;
      
      const newRule: TransformationRule = {
          id: editingRuleId || crypto.randomUUID(),
          targetName: newRuleName,
          sourceKey: selectedSourceCol,
          method: selectedMethod,
          params: methodParams,
          valueMap: Object.keys(valueMap).length > 0 ? valueMap : undefined
      };

      if (editingRuleId) {
          setRules(rules.map(r => r.id === editingRuleId ? newRule : r));
      } else {
          setRules([...rules, newRule]);
      }

      setIsRuleModalOpen(false);
      
      // Reset Form
      setNewRuleName('');
      setSelectedSourceCol('');
      setSourceAnalysis(null);
      setValueMap({});
      setManualMapKey('');
      setManualMapValue('');
  };

  const removeRule = (id: string) => {
      setRules(rules.filter(r => r.id !== id));
  };
  
  const moveRule = (index: number, direction: 'up' | 'down') => {
      if (direction === 'up' && index === 0) return;
      if (direction === 'down' && index === rules.length - 1) return;
      
      const newRules = [...rules];
      const swapIndex = direction === 'up' ? index - 1 : index + 1;
      [newRules[index], newRules[swapIndex]] = [newRules[swapIndex], newRules[index]];
      setRules(newRules);
  };

  const handleAddManualMap = () => {
      if (manualMapKey && manualMapValue) {
          setValueMap({ ...valueMap, [manualMapKey]: manualMapValue });
          setManualMapKey('');
          setManualMapValue('');
      }
  };

  // UPDATED: More robust extraction of values for mapping
  const uniqueValuesForMapping = useMemo(() => {
      if (!selectedSourceCol) return [];
      // Use the comprehensive scan function here, scanning up to 5000 rows
      return getAllUniqueValues(activeData, selectedSourceCol, selectedMethod, 5000);
  }, [selectedSourceCol, selectedMethod, activeData]);

  // Clean Mode Filter Logic
  const filteredRawData = useMemo(() => {
    if (!searchQuery.trim()) return activeData;
    const lowerQuery = searchQuery.toLowerCase();
    return activeData.filter(row => Object.values(row).some(val => String(val).toLowerCase().includes(lowerQuery)));
  }, [activeData, searchQuery]);

  const displayRawData = useMemo(() => filteredRawData.slice(0, 50), [filteredRawData]);

  return (
    <div className="flex flex-col h-full bg-gray-50">
      
      {/* Top Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center flex-shrink-0">
        <div className="flex items-center space-x-6">
            <div>
                <h2 className="text-2xl font-bold text-gray-900">Data Preparation</h2>
                <p className="text-gray-500 text-sm">Clean raw data or build your structured report.</p>
            </div>
            <div className="h-10 w-px bg-gray-200"></div>
            <div className="flex items-center space-x-2 bg-gray-100 rounded-lg px-3 py-2">
                <span className="text-xs font-semibold text-gray-600 uppercase">Active table</span>
                <select
                  value={activeSource.id}
                  onChange={(e) => handleActiveChange(e.target.value)}
                  className="text-sm border border-gray-200 bg-white rounded-md px-2 py-1 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  {(normalizedProject.dataSources || []).map((src) => (
                    <option key={src.id} value={src.id}>
                      {src.name}
                    </option>
                  ))}
                </select>
            </div>
            <div className="h-10 w-px bg-gray-200"></div>
            <div className="flex bg-gray-100 p-1 rounded-lg">
                <button
                    onClick={() => setMode('clean')}
                    className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-all ${mode === 'clean' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                >
                    <Database className="w-4 h-4 mr-2" />
                    Clean Raw Data
                </button>
                <button 
                    onClick={() => setMode('build')}
                    className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-all ${mode === 'build' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                >
                    <Table2 className="w-4 h-4 mr-2" />
                    Build Structure
                </button>
            </div>
        </div>
        
        <div className="flex space-x-3">
             <button onClick={handleExport} className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors shadow-sm">
                <Download className="w-4 h-4" />
                <span>Export {mode === 'build' ? 'Structure' : 'Raw'}</span>
            </button>
            <button
                onClick={handleSavePreparedTable}
                disabled={mode !== 'build'}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors shadow-sm border ${mode === 'build' ? 'bg-emerald-600 text-white hover:bg-emerald-700 border-emerald-600' : 'bg-white text-gray-400 border-gray-200 cursor-not-allowed'}`}
            >
                <Save className="w-4 h-4" />
                <span>Save as prepared table</span>
            </button>
             <button
                onClick={handleManualSave}
                disabled={isSaving}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm disabled:opacity-50">
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'Saving...' : 'Save Project'}</span>
            </button>
        </div>
      </div>

      {/* ==================== CLEAN MODE UI ==================== */}
      {mode === 'clean' && (
        <div className="flex-1 flex flex-col overflow-hidden animate-in fade-in duration-300">
            {/* Toolbar */}
            <div className="px-8 py-3 bg-white border-b border-gray-200 flex items-center justify-between">
                 <div className="flex space-x-3">
                    <button 
                        onClick={() => setActiveToolMode(activeToolMode === 'cleaner' ? 'none' : 'cleaner')}
                        className={`flex items-center space-x-2 px-3 py-1.5 border rounded-md text-sm transition-colors ${activeToolMode === 'cleaner' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-gray-300 text-gray-700'}`}
                    >
                        <Eraser className="w-3.5 h-3.5" /><span>Find & Replace</span>
                    </button>
                    <button 
                        onClick={() => setActiveToolMode(activeToolMode === 'transform' ? 'none' : 'transform')}
                        className={`flex items-center space-x-2 px-3 py-1.5 border rounded-md text-sm transition-colors ${activeToolMode === 'transform' ? 'bg-purple-50 border-purple-200 text-purple-700' : 'bg-white border-gray-300 text-gray-700'}`}
                    >
                        <Zap className="w-3.5 h-3.5" /><span>Auto Transform</span>
                    </button>
                 </div>
                 <div className="relative w-64">
                     <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                     <input 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search raw data..."
                        className="w-full pl-9 pr-4 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                     />
                 </div>
            </div>

            {/* Tool Panels */}
            {activeToolMode === 'cleaner' && (
                <div className="px-8 py-4 bg-blue-50 border-b border-blue-100 flex items-center space-x-4">
                    <span className="text-sm font-semibold text-blue-800">Find & Replace:</span>
                    <input className="px-2 py-1 text-sm border rounded w-40" placeholder="Find" value={findText} onChange={e => setFindText(e.target.value)} />
                    <ArrowRight className="w-4 h-4 text-blue-400" />
                    <input className="px-2 py-1 text-sm border rounded w-40" placeholder="Replace" value={replaceText} onChange={e => setReplaceText(e.target.value)} />
                    <select className="px-2 py-1 text-sm border rounded" value={targetCol} onChange={e => setTargetCol(e.target.value)}>
                        <option value="all">All Columns</option>
                        {activeColumns.map(c => <option key={c.key} value={c.key}>{c.key}</option>)}
                    </select>
                    <button onClick={handleFindReplace} className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">Execute</button>
                </div>
            )}

            {activeToolMode === 'transform' && (
                <div className="px-8 py-4 bg-purple-50 border-b border-purple-100 flex items-center space-x-4">
                    <span className="text-sm font-semibold text-purple-800">Transform:</span>
                    <div className="flex bg-white rounded border p-0.5">
                        <button onClick={() => setTransformAction('date')} className={`px-3 py-1 text-xs font-medium rounded ${transformAction === 'date' ? 'bg-purple-100 text-purple-800' : 'text-gray-500'}`}>Date</button>
                        <button onClick={() => setTransformAction('explode')} className={`px-3 py-1 text-xs font-medium rounded ${transformAction === 'explode' ? 'bg-purple-100 text-purple-800' : 'text-gray-500'}`}>Explode Tags</button>
                    </div>
                    <select className="px-2 py-1 text-sm border rounded w-40" value={transformCol} onChange={e => setTransformCol(e.target.value)}>
                        <option value="">Select Column</option>
                        {activeColumns.map(c => <option key={c.key} value={c.key}>{c.key}</option>)}
                    </select>
                    {transformAction === 'explode' && (
                        <input className="px-2 py-1 text-sm border rounded w-20" placeholder="Delimiter" value={delimiter} onChange={e => setDelimiter(e.target.value)} />
                    )}
                    <button onClick={handleTransform} className="px-3 py-1 bg-purple-600 text-white text-sm rounded hover:bg-purple-700">Apply</button>
                </div>
            )}

            {/* Clean Table */}
            <div className="flex-1 overflow-auto relative bg-white">
                <table className="w-full text-sm text-left text-gray-600">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0 z-10">
                        <tr>
                            <th className="px-4 py-3 w-10 border-b border-gray-200">#</th>
                            {activeColumns.map(col => (
                                <th key={col.key} className="px-6 py-3 border-b border-gray-200 font-bold whitespace-nowrap min-w-[150px]">
                                    <div className="flex items-center justify-between">
                                        <span>{col.key}</span>
                                        <button onClick={() => setEditingCol(editingCol === col.key ? null : col.key)}><Settings className="w-3 h-3 text-gray-400" /></button>
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
                                                <option value="tag_array">Tag Array</option>
                                            </select>
                                        </div>
                                    )}
                                </th>
                            ))}
                            <th className="px-4 py-3 border-b border-gray-200 w-10"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {displayRawData.map((row, idx) => (
                            <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                                <td className="px-4 py-3 text-xs font-mono text-gray-400">{idx + 1}</td>
                                {activeColumns.map(col => (
                                    <td key={col.key} className="px-6 py-3 truncate max-w-xs" title={String(row[col.key])}>
                                        {safeRender(row[col.key])}
                                    </td>
                                ))}
                                <td className="px-4 py-3 text-center">
                                    <button onClick={() => handleDeleteRow(idx)} className="text-gray-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
      )}

      {/* ==================== BUILD MODE UI ==================== */}
      {mode === 'build' && (
          <div className="flex-1 flex overflow-hidden animate-in fade-in duration-300">
              
              {/* Left: Configuration Panel */}
              <div className="w-80 bg-white border-r border-gray-200 flex flex-col z-10 shadow-lg">
                  <div className="p-5 border-b border-gray-200 bg-gray-50">
                      <h3 className="font-bold text-gray-800 flex items-center">
                          <Table2 className="w-4 h-4 mr-2 text-blue-600" />
                          Table Structure
                      </h3>
                      <p className="text-xs text-gray-500 mt-1">Define columns for your report.</p>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-3 space-y-2">
                      {rules.length === 0 && (
                          <div className="h-full flex flex-col justify-center p-4">
                            <EmptyState 
                                icon={Table2} 
                                title="No Columns Defined" 
                                description="Start by adding columns to structure your raw data into a clean report format."
                                actionLabel="Add First Column"
                                onAction={openAddModal}
                                className="border-0 bg-transparent"
                            />
                          </div>
                      )}
                      {rules.map((rule, idx) => (
                          <div key={rule.id} className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm hover:border-blue-300 group relative transition-all">
                              {/* Action Buttons */}
                              <div className="absolute right-2 top-2 flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white pl-2 shadow-sm rounded-lg border border-gray-100">
                                   <button onClick={() => openEditModal(rule)} className="p-1.5 hover:bg-blue-50 rounded text-gray-400 hover:text-blue-600" title="Edit Column">
                                      <Pencil className="w-3 h-3" />
                                  </button>
                                  <div className="w-px h-3 bg-gray-200"></div>
                                  <button onClick={() => moveRule(idx, 'up')} disabled={idx === 0} className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-blue-600 disabled:opacity-30">
                                      <ChevronUp className="w-3 h-3" />
                                  </button>
                                  <button onClick={() => moveRule(idx, 'down')} disabled={idx === rules.length - 1} className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-blue-600 disabled:opacity-30">
                                      <ChevronDown className="w-3 h-3" />
                                  </button>
                                  <div className="w-px h-3 bg-gray-200"></div>
                                  <button onClick={() => removeRule(rule.id)} className="p-1.5 hover:bg-red-50 rounded text-gray-400 hover:text-red-500" title="Remove">
                                      <X className="w-3 h-3" />
                                  </button>
                              </div>

                              <div className="mb-1 pr-16">
                                  <span className="font-bold text-gray-800 text-sm truncate block" title={rule.targetName}>{rule.targetName}</span>
                              </div>
                              <div className="text-xs text-gray-500 flex items-center">
                                  <ArrowRight className="w-3 h-3 mr-1" />
                                  From: <span className="font-medium bg-gray-100 px-1 rounded mx-1 text-gray-700 truncate max-w-[100px]" title={rule.sourceKey}>{rule.sourceKey}</span>
                              </div>
                              <div className="flex items-center justify-between mt-2">
                                <div className="text-[10px] uppercase tracking-wider font-semibold text-blue-600 bg-blue-50 inline-block px-1.5 py-0.5 rounded">
                                    {rule.method.replace('array_', '').replace('_', ' ')}
                                </div>
                                {rule.valueMap && (
                                    <div className="text-[10px] font-semibold text-green-600 bg-green-50 px-1.5 py-0.5 rounded flex items-center">
                                        <Replace className="w-3 h-3 mr-1" /> Mapped
                                    </div>
                                )}
                              </div>
                          </div>
                      ))}
                  </div>

                  <div className="p-4 border-t border-gray-200 bg-gray-50">
                      <button 
                        onClick={openAddModal}
                        className="w-full py-2 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 transition-colors flex items-center justify-center"
                      >
                          <Plus className="w-4 h-4 mr-2" /> Add Column
                      </button>
                  </div>
              </div>

              {/* Right: Preview Panel */}
              <div className="flex-1 bg-gray-100 flex flex-col overflow-hidden">
                  <div className="px-6 py-3 bg-white border-b border-gray-200 flex justify-between items-center shadow-sm z-10">
                      <span className="text-sm font-semibold text-gray-700">Live Preview (Top 50 rows)</span>
                      <span className="text-xs text-gray-400">{structuredData.length} rows generated</span>
                  </div>
                  
                  <div className="flex-1 overflow-auto p-6">
                      <div className="bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden min-h-[200px]">
                          {rules.length === 0 ? (
                              <div className="flex items-center justify-center h-64 text-gray-400 flex-col">
                                  <Table2 className="w-12 h-12 mb-3 opacity-20" />
                                  <p>Your structured table is empty.</p>
                              </div>
                          ) : (
                              <table className="w-full text-sm text-left">
                                  <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-200">
                                      <tr>
                                          <th className="px-6 py-3 w-12">#</th>
                                          {rules.map(r => (
                                              <th key={r.id} className="px-6 py-3 border-r border-gray-100 last:border-0 whitespace-nowrap">{r.targetName}</th>
                                          ))}
                                      </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100">
                                      {structuredData.slice(0, 50).map((row, idx) => (
                                          <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                                              <td className="px-6 py-3 text-gray-400 text-xs font-mono">{idx + 1}</td>
                                              {rules.map(r => (
                                                  <td key={r.id} className="px-6 py-3 text-gray-700 border-r border-gray-50 last:border-0 truncate max-w-xs" title={safeRender(row[r.targetName])}>
                                                      {safeRender(row[r.targetName])}
                                                  </td>
                                              ))}
                                          </tr>
                                      ))}
                                  </tbody>
                              </table>
                          )}
                      </div>
                  </div>
              </div>

              {/* Add Rule Modal */}
              {isRuleModalOpen && (
                  <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in duration-200 flex max-h-[90vh]">
                          
                          {/* Left Side: Configuration */}
                          <div className="w-1/2 flex flex-col border-r border-gray-200">
                            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                                <h3 className="font-bold text-lg text-gray-800">
                                    {editingRuleId ? 'Edit Column' : 'Add Column'}
                                </h3>
                            </div>
                            
                            <div className="p-6 overflow-y-auto custom-scrollbar space-y-5 flex-1">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Target Column Name</label>
                                    <input 
                                        autoFocus
                                        value={newRuleName}
                                        onChange={e => setNewRuleName(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="e.g. Date Only, Main Tag"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Source from Raw Data</label>
                                    <select 
                                        value={selectedSourceCol}
                                        onChange={e => handleSourceColSelect(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    >
                                        <option value="">-- Select Source --</option>
                                        {activeColumns.map(c => <option key={c.key} value={c.key}>{c.key}</option>)}
                                    </select>
                                </div>

                                {selectedSourceCol && (
                                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 text-xs">
                                        <p className="font-semibold text-blue-800 mb-1">AI Detection:</p>
                                        {sourceAnalysis?.isArrayLikely ? (
                                            <div className="flex items-center text-blue-700"><Split className="w-3 h-3 mr-1" /> Array/List Format</div>
                                        ) : sourceAnalysis?.isDateLikely ? (
                                            <div className="flex items-center text-blue-700"><Calendar className="w-3 h-3 mr-1" /> Date/Time Format</div>
                                        ) : (
                                            <div className="flex items-center text-gray-600">Simple Text Format</div>
                                        )}
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Extraction Logic</label>
                                    <select 
                                        value={selectedMethod}
                                        onChange={e => {
                                            setSelectedMethod(e.target.value as TransformMethod);
                                            if (e.target.value === 'date_extract' && !methodParams.datePart) {
                                                setMethodParams({...methodParams, datePart: 'date_only'});
                                            }
                                        }}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    >
                                        <option value="copy">Direct Copy</option>
                                        <option value="array_count">Count Items</option>
                                        <option value="array_extract">Extract Item by Index</option>
                                        <option value="array_join">Join to String</option>
                                        <option value="array_includes">Check Presence (Boolean)</option>
                                        <option value="date_extract">Extract Date/Time</option>
                                    </select>
                                    <p className="text-[10px] text-gray-400 mt-1">
                                        * All array methods support single numeric/text values by treating them as a list of one.
                                    </p>
                                </div>

                                {/* Dynamic Params */}
                                {selectedMethod === 'array_extract' && (
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Index (0 = First)</label>
                                        <input 
                                            type="number"
                                            className="w-full px-3 py-2 border rounded-lg"
                                            value={methodParams.index || 0}
                                            onChange={e => setMethodParams({...methodParams, index: parseInt(e.target.value)})}
                                        />
                                    </div>
                                )}
                                {selectedMethod === 'array_join' && (
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Delimiter</label>
                                        <input 
                                            type="text"
                                            className="w-full px-3 py-2 border rounded-lg"
                                            value={methodParams.delimiter || ', '}
                                            placeholder=", "
                                            onChange={e => setMethodParams({...methodParams, delimiter: e.target.value})}
                                        />
                                        <p className="text-[10px] text-orange-500 mt-1">
                                            * Value Mapping will apply to individual items before joining.
                                        </p>
                                    </div>
                                )}
                                {selectedMethod === 'array_includes' && (
                                    <div>
                                            <label className="block text-xs font-medium text-gray-500 mb-1">Keyword to Check</label>
                                            <div className="relative">
                                                <select 
                                                    className="w-full px-3 py-2 border rounded-lg mb-2"
                                                    onChange={e => setMethodParams({...methodParams, keyword: e.target.value})}
                                                >
                                                    <option value="">Select Detected Tag...</option>
                                                    {sourceAnalysis?.uniqueTags.map(t => (
                                                        <option key={t} value={t}>{t}</option>
                                                    ))}
                                                </select>
                                                <input 
                                                    type="text"
                                                    placeholder="Or type custom keyword..."
                                                    className="w-full px-3 py-2 border rounded-lg"
                                                    value={methodParams.keyword || ''}
                                                    onChange={e => setMethodParams({...methodParams, keyword: e.target.value})}
                                                />
                                            </div>
                                    </div>
                                )}
                                {selectedMethod === 'date_extract' && (
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Part to Extract</label>
                                        <select 
                                            className="w-full px-3 py-2 border rounded-lg"
                                            value={methodParams.datePart || 'date_only'}
                                            onChange={e => setMethodParams({...methodParams, datePart: e.target.value})}
                                        >
                                            <option value="date_only">Date Only (YYYY-MM-DD)</option>
                                            <option value="time_only">Time Only (HH:MM)</option>
                                            <option value="year">Year</option>
                                            <option value="month">Month</option>
                                            <option value="day">Day</option>
                                        </select>
                                    </div>
                                )}
                            </div>
                          </div>

                          {/* Right Side: Preview & Mapping */}
                          <div className="w-1/2 flex flex-col bg-gray-50">
                                <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                                    <h3 className="font-bold text-lg text-gray-800">Value Mapping</h3>
                                    <button onClick={() => setIsRuleModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                                </div>

                                <div className="flex-1 overflow-y-auto p-6">
                                    {/* Live Preview Block */}
                                    <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm mb-6">
                                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center">
                                            <Zap className="w-3 h-3 mr-1" /> Live Preview
                                        </h4>
                                        <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                                            {sourceAnalysis?.sampleValues.slice(0, 5).map((val, i) => {
                                                // Mock Transformation for Preview
                                                const tempRule: TransformationRule = {
                                                    id: 'temp', targetName: 'Preview', sourceKey: 'temp', method: selectedMethod, params: methodParams, valueMap
                                                };
                                                const mockRow = { temp: val };
                                                const result = applyTransformation([mockRow], [{ ...tempRule, sourceKey: 'temp' }])[0].Preview;

                                                return (
                                                    <div key={i} className="text-sm grid grid-cols-2 gap-2 border-b border-gray-100 pb-2 last:border-0">
                                                        <div className="text-gray-400 truncate" title={String(val)}>{String(val)}</div>
                                                        <div className="font-medium text-gray-900 truncate flex items-center">
                                                            <ArrowRight className="w-3 h-3 mr-2 text-blue-400" />
                                                            {safeRender(result)}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Mapping Table Block */}
                                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                                        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                                            <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Map Values</h4>
                                            <span className="text-[10px] text-gray-400">
                                                Found {uniqueValuesForMapping.length} values (Scanning top 5000)
                                            </span>
                                        </div>
                                        
                                        {/* Generated Map List */}
                                        <div className="max-h-40 overflow-y-auto">
                                            <table className="w-full text-sm">
                                                <thead className="bg-gray-50 text-gray-500 text-xs sticky top-0">
                                                    <tr>
                                                        <th className="px-4 py-2 text-left font-medium">Original Found</th>
                                                        <th className="px-4 py-2 text-left font-medium">Map To</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {/* Use the comprehensive unique values list */}
                                                    {uniqueValuesForMapping.map((val) => (
                                                        <tr key={val}>
                                                            <td className="px-4 py-2 text-gray-600 font-mono text-xs truncate max-w-[100px]" title={val}>{val}</td>
                                                            <td className="px-4 py-2">
                                                                <input 
                                                                    className="w-full px-2 py-1 border border-gray-200 rounded text-xs focus:border-blue-500 outline-none"
                                                                    placeholder={val}
                                                                    value={valueMap[val] || ''}
                                                                    onChange={e => setValueMap({...valueMap, [val]: e.target.value})}
                                                                />
                                                            </td>
                                                        </tr>
                                                    ))}
                                                    
                                                    {/* Manually Added Mappings that might not be in the scan */}
                                                    {Object.keys(valueMap).filter(k => !uniqueValuesForMapping.includes(k)).map(k => (
                                                        <tr key={k}>
                                                            <td className="px-4 py-2 text-gray-600 font-mono text-xs truncate max-w-[100px]" title={k}>{k} (Custom)</td>
                                                            <td className="px-4 py-2">
                                                                <div className="flex items-center">
                                                                    <input 
                                                                        className="w-full px-2 py-1 border border-gray-200 rounded text-xs focus:border-blue-500 outline-none"
                                                                        value={valueMap[k]}
                                                                        onChange={e => setValueMap({...valueMap, [k]: e.target.value})}
                                                                    />
                                                                    <button 
                                                                        onClick={() => {
                                                                            const newMap = {...valueMap};
                                                                            delete newMap[k];
                                                                            setValueMap(newMap);
                                                                        }}
                                                                        className="ml-2 text-gray-400 hover:text-red-500"
                                                                    >
                                                                        <X className="w-3 h-3" />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* Add Manual Map Row */}
                                        <div className="p-3 bg-gray-50 border-t border-gray-200">
                                            <div className="text-[10px] text-gray-500 mb-2 font-medium">Add Custom Map (if value not found)</div>
                                            <div className="flex space-x-2">
                                                <input 
                                                    className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-xs outline-none"
                                                    placeholder="Original Value"
                                                    value={manualMapKey}
                                                    onChange={e => setManualMapKey(e.target.value)}
                                                />
                                                <ArrowRight className="w-4 h-4 text-gray-400 self-center" />
                                                <input 
                                                    className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-xs outline-none"
                                                    placeholder="New Value"
                                                    value={manualMapValue}
                                                    onChange={e => setManualMapValue(e.target.value)}
                                                />
                                                <button 
                                                    onClick={handleAddManualMap}
                                                    disabled={!manualMapKey || !manualMapValue}
                                                    className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 text-xs font-medium disabled:opacity-50"
                                                >
                                                    <Plus className="w-3 h-3" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="px-6 py-4 bg-white border-t border-gray-200 flex justify-end space-x-3">
                                    <button onClick={() => setIsRuleModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors">Cancel</button>
                                    <button 
                                        onClick={saveRule}
                                        disabled={!newRuleName || !selectedSourceCol}
                                        className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed shadow-sm"
                                    >
                                        {editingRuleId ? 'Update Column' : 'Add Column'}
                                    </button>
                                </div>
                          </div>
                      </div>
                  </div>
              )}

          </div>
      )}
    </div>
  );
};

export default DataPrep;