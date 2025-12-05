import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Save, Play, Loader2, Table2, Layers, ChevronUp, ChevronDown, X, ArrowRight } from 'lucide-react';
import {
  BuildStructureConfig,
  ColumnConfig,
  DataSource,
  Project,
  RawRow,
  StructureRule,
  TransformationRule,
  TransformMethod,
} from '../types';
import { ensureDataSources, getDataSourcesByKind, addDerivedDataSource } from '../utils/dataSources';
import { saveProject } from '../utils/storage-compat';
import { inferColumns } from '../utils/excel';
import { analyzeSourceColumn, applyTransformation, getAllUniqueValues } from '../utils/transform';
import { useToast } from '../components/ToastProvider';
import EmptyState from '../components/EmptyState';

const safeRender = (val: any) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
};

interface BuildStructureProps {
  project: Project;
  onUpdateProject: (p: Project) => void;
}

const BuildStructure: React.FC<BuildStructureProps> = ({ project, onUpdateProject }) => {
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

  const [configs, setConfigs] = useState<BuildStructureConfig[]>(normalizedProject.buildStructureConfigs || []);
  const [activeConfigId, setActiveConfigId] = useState<string | null>(normalizedProject.activeBuildConfigId || null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configName, setConfigName] = useState('');

  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [showSourcePicker, setShowSourcePicker] = useState(false);

  const [rules, setRules] = useState<StructureRule[]>([]);
  const [resultRows, setResultRows] = useState<RawRow[]>([]);
  const [previewTotal, setPreviewTotal] = useState<number>(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [editingTargetName, setEditingTargetName] = useState<string | null>(null);
  const [newRuleName, setNewRuleName] = useState('');

  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveError, setSaveError] = useState('');

  type RuleDraft = {
    sourceId: string;
    sourceKey: string;
    method: TransformMethod;
    params: any;
    valueMap: Record<string, string>;
    manualKey: string;
    manualValue: string;
    analysis: {
      isArrayLikely: boolean;
      isDateLikely: boolean;
      uniqueTags: string[];
      sampleValues: string[];
    } | null;
    uniqueValues: string[];
  };

  const [ruleDrafts, setRuleDrafts] = useState<Record<string, RuleDraft>>({});

  const groupedRules = useMemo(
    () => {
      const order: string[] = [];
      const grouping: Record<string, StructureRule[]> = {};
      rules.forEach((rule) => {
        if (!grouping[rule.targetName]) {
          grouping[rule.targetName] = [];
          order.push(rule.targetName);
        }
        grouping[rule.targetName].push(rule);
      });
      return order.map((targetName) => ({ targetName, rules: grouping[targetName] || [] }));
    },
    [rules]
  );

  const { showToast } = useToast();

  // Sync configs from project changes
  useEffect(() => {
    setConfigs(normalizedProject.buildStructureConfigs || []);
    setActiveConfigId(normalizedProject.activeBuildConfigId || normalizedProject.buildStructureConfigs?.[0]?.id || null);
  }, [normalizedProject.buildStructureConfigs, normalizedProject.activeBuildConfigId]);

  const activeConfig = useMemo(
    () => configs.find((c) => c.id === activeConfigId) || configs[0] || null,
    [configs, activeConfigId]
  );

  useEffect(() => {
    if (activeConfig) {
      setSelectedSources(activeConfig.sourceIds);
      setRules(activeConfig.rules);
    } else {
      setSelectedSources([]);
      setRules([]);
    }
    setResultRows([]);
    const sum = (activeConfig?.sourceIds || []).reduce((acc, id) => {
      const src = allSources.find((s) => s.id === id);
      return acc + (src?.rows.length || 0);
    }, 0);
    setPreviewTotal(sum);
  }, [activeConfig]);

  const buildDraftForSource = (sourceId: string, existing?: StructureRule): RuleDraft => {
    const src = allSources.find((s) => s.id === sourceId);
    const firstCol = existing?.sourceKey || src?.columns[0]?.key || '';
    const analysis = src && firstCol ? analyzeSourceColumn(src.rows, firstCol) : null;
    const inferredMethod: TransformMethod = existing?.method
      ? existing.method
      : analysis?.isDateLikely
      ? 'date_extract'
      : analysis?.isArrayLikely
      ? 'array_count'
      : 'copy';
    return {
      sourceId,
      sourceKey: firstCol,
      method: inferredMethod,
      params: existing?.params || (inferredMethod === 'date_extract' ? { datePart: 'date_only' } : {}),
      valueMap: existing?.valueMap || {},
      manualKey: '',
      manualValue: '',
      analysis,
      uniqueValues:
        src && firstCol ? getAllUniqueValues(src.rows, firstCol, inferredMethod || 'copy', 5000) : [],
    };
  };

  const refreshDraftAnalysis = (srcId: string, draft: RuleDraft) => {
    const src = allSources.find((s) => s.id === srcId);
    if (!src || !draft.sourceKey) return draft;
    const analysis = analyzeSourceColumn(src.rows, draft.sourceKey);
    const uniqueValues = getAllUniqueValues(src.rows, draft.sourceKey, draft.method, 5000);
    return { ...draft, analysis, uniqueValues };
  };

  const persistConfigs = async (nextConfigs: BuildStructureConfig[], nextActiveId?: string | null) => {
    setConfigs(nextConfigs);
    const updatedProject = {
      ...normalizedProject,
      buildStructureConfigs: nextConfigs,
      activeBuildConfigId: nextActiveId ?? activeConfigId ?? nextConfigs[0]?.id,
    } as Project;
    onUpdateProject(updatedProject);
    await saveProject(updatedProject);
  };

  const submitNewConfig = async () => {
    const name = configName.trim() || `Structure ${configs.length + 1}`;
    if (selectedSources.length === 0) return;
    const newConfig: BuildStructureConfig = {
      id: crypto.randomUUID(),
      name,
      sourceIds: selectedSources,
      rules: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const nextConfigs = [...configs, newConfig];
    setActiveConfigId(newConfig.id);
    setShowConfigModal(false);
    await persistConfigs(nextConfigs, newConfig.id);
  };

  const updateActiveConfig = async (nextSources = selectedSources, nextRules = rules) => {
    if (!activeConfig) return;
    const updatedConfig: BuildStructureConfig = {
      ...activeConfig,
      sourceIds: nextSources,
      rules: nextRules,
      updatedAt: Date.now(),
    };
    const nextConfigs = configs.map((c) => (c.id === activeConfig.id ? updatedConfig : c));
    await persistConfigs(nextConfigs, activeConfig.id);
  };

  const handleSourceToggle = (id: string, checked: boolean) => {
    setSelectedSources((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)));
  };

  const openAddRule = () => {
    if (!selectedSources.length) {
      showToast('Select sources first', 'Choose one or more tables before adding columns.', 'warning');
      return;
    }
    setEditingTargetName(null);
    setNewRuleName('');
    const drafts: Record<string, RuleDraft> = {};
    selectedSources.forEach((srcId) => {
      drafts[srcId] = buildDraftForSource(srcId);
    });
    setRuleDrafts(drafts);
    setIsRuleModalOpen(true);
  };

  const closeRuleModal = () => {
    setIsRuleModalOpen(false);
    setRuleDrafts({});
    setNewRuleName('');
    setEditingTargetName(null);
  };

  const openEditRule = (targetName: string) => {
    const relevant = rules.filter((r) => r.targetName === targetName);
    setEditingTargetName(targetName);
    setNewRuleName(targetName);
    const drafts: Record<string, RuleDraft> = {};
    selectedSources.forEach((srcId) => {
      const existing = relevant.find((r) => r.sourceId === srcId);
      drafts[srcId] = buildDraftForSource(srcId, existing);
    });
    setRuleDrafts(drafts);
    setIsRuleModalOpen(true);
  };

  const updateDraft = (srcId: string, updater: (draft: RuleDraft) => RuleDraft) => {
    setRuleDrafts((prev) => {
      const next = { ...prev };
      const current = prev[srcId];
      if (!current) return prev;
      next[srcId] = refreshDraftAnalysis(srcId, updater(current));
      return next;
    });
  };

  const saveRule = async () => {
    const trimmedName = newRuleName.trim();
    if (!trimmedName) return;

    const draftEntries = Object.values(ruleDrafts).filter((d) => d.sourceKey);
    if (!draftEntries.length) return;

    const newRules: StructureRule[] = draftEntries.map((draft) => ({
      id: crypto.randomUUID(),
      sourceId: draft.sourceId,
      targetName: trimmedName,
      sourceKey: draft.sourceKey,
      method: draft.method,
      params: draft.params,
      valueMap: Object.keys(draft.valueMap).length ? draft.valueMap : undefined,
    }));

    const existingOrder = groupedRules.map((g) => g.targetName);
    let nextRules: StructureRule[] = [];

    if (editingTargetName) {
      const filteredExisting = rules.filter(
        (r) => r.targetName !== editingTargetName && r.targetName !== trimmedName
      );
      const orderWithout = existingOrder.filter((name) => name !== editingTargetName && name !== trimmedName);
      const insertIndex = Math.max(existingOrder.indexOf(editingTargetName), 0);
      const nextOrder = [...orderWithout];
      nextOrder.splice(insertIndex, 0, trimmedName);

      const bundle: Record<string, StructureRule[]> = {};
      filteredExisting.forEach((r) => {
        if (!bundle[r.targetName]) bundle[r.targetName] = [];
        bundle[r.targetName].push(r);
      });
      bundle[trimmedName] = newRules;
      const dedupedOrder: string[] = [];
      nextOrder.forEach((name) => {
        if (!dedupedOrder.includes(name)) dedupedOrder.push(name);
      });
      nextRules = dedupedOrder.flatMap((name) => bundle[name] || []);
    } else {
      const filteredExisting = rules.filter((r) => r.targetName !== trimmedName);
      const orderWithout = existingOrder.filter((name) => name !== trimmedName);
      const nextOrder = [...orderWithout, trimmedName];
      const bundle: Record<string, StructureRule[]> = {};
      filteredExisting.forEach((r) => {
        if (!bundle[r.targetName]) bundle[r.targetName] = [];
        bundle[r.targetName].push(r);
      });
      bundle[trimmedName] = newRules;
      nextRules = nextOrder.flatMap((name) => bundle[name] || []);
    }

    setRules(nextRules);
    closeRuleModal();
    await updateActiveConfig(selectedSources, nextRules);
    await runQuery(true, nextRules);
  };

  const removeRule = async (targetName: string) => {
    const nextRules = rules.filter((r) => r.targetName !== targetName);
    setRules(nextRules);
    await updateActiveConfig(selectedSources, nextRules);
  };

  const moveRule = async (targetName: string, direction: 'up' | 'down') => {
    const order = groupedRules.map((g) => g.targetName);
    const idx = order.indexOf(targetName);
    if (idx === -1) return;
    if ((direction === 'up' && idx === 0) || (direction === 'down' && idx === order.length - 1)) return;
    const swapIndex = direction === 'up' ? idx - 1 : idx + 1;
    [order[idx], order[swapIndex]] = [order[swapIndex], order[idx]];
    const bundle: Record<string, StructureRule[]> = {};
    groupedRules.forEach((g) => {
      bundle[g.targetName] = g.rules;
    });
    const next = order.flatMap((name) => bundle[name] || []);
    setRules(next);
    await updateActiveConfig(selectedSources, next);
  };

  const runQuery = async (silent = false, overrideRules?: StructureRule[]) => {
    const workingRules = overrideRules || rules;
    if (!selectedSources.length || !workingRules.length) {
      showToast('Setup incomplete', 'Choose sources and add mappings before querying.', 'warning');
      return;
    }
    if (!silent) {
      setIsRunning(true);
    }
    const output: RawRow[] = [];
    selectedSources.forEach((sourceId) => {
      const source = allSources.find((s) => s.id === sourceId);
      if (!source) return;
      const scopedRules = workingRules.filter((r) => r.sourceId === sourceId);
      if (!scopedRules.length) return;
      const baseRules = scopedRules.map(({ sourceId: _sid, ...rest }) => rest);
      const structured = applyTransformation(source.rows, baseRules);
      output.push(...structured);
    });
    setResultRows(output);
    setPreviewTotal(output.length);
    if (!silent) {
      setTimeout(() => setIsRunning(false), 300);
    }
  };

  const openSaveModal = () => {
    if (!resultRows.length) {
      showToast('No results', 'Run Query before saving.', 'warning');
      return;
    }
    const defaultName = activeConfig ? `${activeConfig.name} output` : `Structured ${selectedSources.length} files`;
    setSaveName(defaultName);
    setSaveError('');
    setShowSaveModal(true);
  };

  const handleSave = async () => {
    const trimmed = saveName.trim();
    if (!trimmed) {
      setSaveError('Please enter a table name.');
      return;
    }
    setIsSaving(true);
    const columns: ColumnConfig[] = inferColumns(resultRows[0]);
    const updated = addDerivedDataSource(normalizedProject, trimmed, resultRows, columns, 'prepared');
    await saveProject(updated);
    onUpdateProject(updated);
    showToast('Saved', `${trimmed} stored in Preparation Data.`, 'success');
    setShowSaveModal(false);
    setTimeout(() => setIsSaving(false), 400);
  };

  const hasConfig = Boolean(activeConfig);
  const previewRowCount = resultRows.length || previewTotal || 0;

  return (
    <div className="h-full flex flex-col px-10 py-8 overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <h1 className="text-xl font-semibold text-gray-900">Build Structure</h1>
          {configs.length > 0 && (
            <select
              value={activeConfig?.id || ''}
              onChange={async (e) => {
                setActiveConfigId(e.target.value);
                await persistConfigs(configs, e.target.value);
              }}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white shadow-sm"
            >
              {configs.map((cfg) => (
                <option key={cfg.id} value={cfg.id}>
                  {cfg.name}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="flex items-center space-x-3">
          {hasConfig && (
            <button
              onClick={openSaveModal}
              disabled={isSaving}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg shadow-sm hover:bg-blue-700 transition disabled:opacity-60"
            >
              {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save to Preparation
            </button>
          )}
          <button
            onClick={() => {
              setConfigName(`Structure ${configs.length + 1}`);
              setShowConfigModal(true);
            }}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-800 hover:bg-gray-50"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create
          </button>
        </div>
      </div>

      {!hasConfig && (
        <div className="flex-1 border border-dashed border-gray-200 rounded-xl bg-white/60 flex items-center justify-center text-gray-400 text-sm">
          Create a configuration to start.
        </div>
      )}

      {hasConfig && (
        <div className="space-y-6">
          <div className="border border-gray-200 rounded-xl bg-white shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="space-y-0.5">
                <p className="text-sm text-gray-500">Sources</p>
                <h2 className="font-semibold text-gray-900">{selectedSources.length} tables selected</h2>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowSourcePicker(true)}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-800 hover:bg-gray-50"
                >
                  <Layers className="w-4 h-4 mr-2" />
                  Choose tables
                </button>
                <button
                  onClick={openAddRule}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-800 hover:bg-gray-50"
                >
                  <Plus className="w-4 h-4 mr-2" /> Add column
                </button>
              </div>
            </div>
            <div className="grid grid-cols-12 gap-3 text-sm font-semibold text-gray-500 px-2">
              <span className="col-span-1 text-center">#</span>
              <span className="col-span-5">Target column</span>
              <span className="col-span-4">Sources</span>
              <span className="col-span-2 text-right">Actions</span>
            </div>
            <div className="space-y-2 mt-2">
              {groupedRules.map((group, idx) => {
                const sourceLabels = group.rules
                  .map((r) => allSources.find((s) => s.id === r.sourceId)?.name || 'Source removed')
                  .join(', ');
                const methods = Array.from(new Set(group.rules.map((r) => r.method.replace('_', ' '))));
                return (
                  <div key={group.targetName} className="grid grid-cols-12 gap-3 items-center px-2 py-2 rounded-lg hover:bg-gray-50">
                    <div className="col-span-1 text-center text-sm text-gray-500">{idx + 1}</div>
                    <div className="col-span-5">
                      <p className="font-medium text-gray-900 truncate">{group.targetName}</p>
                      <p className="text-xs text-gray-500 uppercase tracking-wide truncate">{methods.join(' • ')}</p>
                    </div>
                    <div className="col-span-4 text-sm text-gray-800 truncate" title={sourceLabels}>
                      {sourceLabels || 'Sources removed'}
                    </div>
                    <div className="col-span-2 flex items-center justify-end space-x-2 text-xs text-gray-500">
                      <button onClick={() => openEditRule(group.targetName)} className="hover:text-blue-600">
                        Edit
                      </button>
                      <span className="text-gray-300">|</span>
                      <button onClick={() => moveRule(group.targetName, 'up')} disabled={idx === 0} className="hover:text-gray-700 disabled:opacity-30">
                        <ChevronUp className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => moveRule(group.targetName, 'down')}
                        disabled={idx === groupedRules.length - 1}
                        className="hover:text-gray-700 disabled:opacity-30"
                      >
                        <ChevronDown className="w-3 h-3" />
                      </button>
                      <span className="text-gray-300">|</span>
                      <button onClick={() => removeRule(group.targetName)} className="hover:text-red-500">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
              {groupedRules.length === 0 && (
                <div className="px-2 py-6">
                  <EmptyState
                    icon={Table2}
                    title="No columns"
                    description="Add mappings for each source before querying."
                    actionLabel="Add column"
                    onAction={openAddRule}
                    className="border-0 bg-transparent"
                  />
                </div>
              )}
            </div>
            {selectedSources.length > 0 && (
              <div className="flex justify-end mt-4">
                <button
                  onClick={runQuery}
                  disabled={isRunning}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg shadow-sm hover:bg-blue-700 transition disabled:opacity-60"
                >
                  {isRunning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                  Query
                </button>
              </div>
            )}
          </div>

            <div className="border border-gray-200 rounded-xl bg-white shadow-sm">
            <div className="px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Preview</p>
                <h3 className="font-semibold text-gray-900">{previewRowCount.toLocaleString()} rows</h3>
                {selectedSources.length > 0 && (
                  <p className="text-xs text-gray-500">
                    {selectedSources
                      .map((id) => {
                        const src = allSources.find((s) => s.id === id);
                        if (!src) return null;
                        return `${src.name} (${src.rows.length.toLocaleString()})`;
                      })
                      .filter(Boolean)
                      .join(' + ')}
                  </p>
                )}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm text-gray-700">
                <thead>
                  <tr className="bg-gray-50 text-left">
                    {Object.keys(resultRows[0] || {}).map((key) => (
                      <th key={key} className="px-4 py-3 font-semibold text-gray-500 whitespace-nowrap">
                        {key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {resultRows.slice(0, 20).map((row, idx) => (
                    <tr key={idx} className="border-t border-gray-100">
                      {Object.keys(row).map((key) => (
                        <td key={key} className="px-4 py-2 text-gray-800">
                          {row[key] as any}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {resultRows.length === 0 && (
                    <tr>
                      <td className="px-4 py-6 text-center text-gray-400" colSpan={Math.max(Object.keys(resultRows[0] || {}).length, 1)}>
                        Run Query to preview structured data.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showSourcePicker && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-30">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Choose tables for Build Structure</h3>
              <button onClick={() => setShowSourcePicker(false)} className="text-gray-400 hover:text-gray-600">×</button>
            </div>
            <div className="grid grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-1">
              {allSources.map((src) => {
                const checked = selectedSources.includes(src.id);
                return (
                  <label
                    key={src.id}
                    className={`border rounded-lg px-4 py-3 cursor-pointer transition ${
                      checked ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{src.name}</p>
                        <p className="text-xs text-gray-500">{src.kind === 'ingestion' ? 'Ingestion' : 'Preparation'} data</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => handleSourceToggle(src.id, e.target.checked)}
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                      />
                    </div>
                  </label>
                );
              })}
              {allSources.length === 0 && <p className="text-sm text-gray-500">Upload data before creating a structure.</p>}
            </div>
            <div className="flex justify-end space-x-3">
              <button onClick={() => setShowSourcePicker(false)} className="px-4 py-2 text-sm text-gray-600 rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={async () => {
                  setShowSourcePicker(false);
                  await updateActiveConfig(selectedSources, rules.filter((r) => selectedSources.includes(r.sourceId)));
                  setRules((prev) => prev.filter((r) => selectedSources.includes(r.sourceId)));
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg shadow-sm hover:bg-blue-700 disabled:opacity-60"
                disabled={!selectedSources.length}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {showConfigModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-30">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">New structure config</h3>
              <button onClick={() => setShowConfigModal(false)} className="text-gray-400 hover:text-gray-600">×</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700">Name</label>
                <input
                  value={configName}
                  onChange={(e) => setConfigName(e.target.value)}
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                  placeholder="Structure config"
                />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Tables</p>
                <div className="grid grid-cols-2 gap-3 max-h-64 overflow-y-auto">
                  {allSources.map((src) => {
                    const checked = selectedSources.includes(src.id);
                    return (
                      <label
                        key={src.id}
                        className={`border rounded-lg px-4 py-3 cursor-pointer transition ${
                          checked ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-900">{src.name}</p>
                            <p className="text-xs text-gray-500">{src.kind === 'ingestion' ? 'Ingestion' : 'Preparation'} data</p>
                          </div>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => handleSourceToggle(src.id, e.target.checked)}
                            className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                          />
                        </div>
                      </label>
                    );
                  })}
                  {allSources.length === 0 && <p className="text-sm text-gray-500">Upload data before creating a structure.</p>}
                </div>
              </div>
            </div>
            <div className="flex justify-end space-x-3">
              <button onClick={() => setShowConfigModal(false)} className="px-4 py-2 text-sm text-gray-600 rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={submitNewConfig}
                disabled={!selectedSources.length}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg shadow-sm hover:bg-blue-700 disabled:opacity-60"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {isRuleModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center px-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm uppercase tracking-wide text-blue-600 font-semibold">{editingTargetName ? 'Edit' : 'Add'} column</p>
                <h3 className="text-xl font-bold text-gray-900">Column mapping</h3>
              </div>
              <button onClick={closeRuleModal} className="text-gray-400 hover:text-gray-600">×</button>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Target column name</label>
                <input
                  value={newRuleName}
                  onChange={(e) => setNewRuleName(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  placeholder="e.g. Date"
                />
              </div>
            </div>

            <div className="space-y-4">
              {selectedSources.map((srcId) => {
                const draft = ruleDrafts[srcId];
                const src = allSources.find((s) => s.id === srcId);
                if (!src || !draft) return null;
                return (
                  <div key={draft.sourceId} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide">Source</p>
                        <h4 className="font-semibold text-gray-900">{src.name}</h4>
                      </div>
                      <div className="text-xs text-gray-600 bg-white border border-gray-200 rounded-full px-3 py-1">
                        {src.rows.length.toLocaleString()} rows
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Source column</label>
                        <select
                          value={draft.sourceKey}
                          onChange={(e) => {
                            const nextKey = e.target.value;
                            updateDraft(draft.sourceId, (curr) => {
                              const srcRef = allSources.find((s) => s.id === draft.sourceId);
                              const analysis = srcRef && nextKey ? analyzeSourceColumn(srcRef.rows, nextKey) : null;
                              let nextMethod = curr.method;
                              let nextParams = curr.params || {};
                              if (!editingTargetName) {
                                if (analysis?.isDateLikely) {
                                  nextMethod = 'date_extract';
                                  nextParams = { datePart: 'date_only' };
                                } else if (analysis?.isArrayLikely) {
                                  nextMethod = 'array_count';
                                  nextParams = {};
                                } else {
                                  nextMethod = 'copy';
                                  nextParams = {};
                                }
                              }
                              return {
                                ...curr,
                                sourceKey: nextKey,
                                method: nextMethod,
                                params: nextParams,
                                valueMap: editingTargetName ? curr.valueMap : {},
                              };
                            });
                          }}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                        >
                          {(src.columns || []).map((col) => (
                            <option key={col.key} value={col.key}>
                              {col.key}
                            </option>
                          ))}
                        </select>
                        {draft.analysis?.sampleValues?.length ? (
                          <p className="text-xs text-gray-500">Sample: {draft.analysis.sampleValues.slice(0, 3).join(', ')}</p>
                        ) : null}
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Extraction logic</label>
                        <select
                          value={draft.method}
                          onChange={(e) => {
                            const method = e.target.value as TransformMethod;
                            updateDraft(draft.sourceId, (curr) => ({
                              ...curr,
                              method,
                              params:
                                method === 'date_extract'
                                  ? { datePart: curr.params?.datePart || 'date_only' }
                                  : method === 'date_format'
                                  ? { format: curr.params?.format || 'YYYY-MM-DD' }
                                  : method === 'array_join'
                                  ? { delimiter: curr.params?.delimiter || ', ' }
                                  : method === 'array_extract'
                                  ? { index: curr.params?.index ?? 0 }
                                  : method === 'array_includes'
                                  ? { keyword: curr.params?.keyword || '' }
                                  : {},
                            }));
                          }}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                        >
                          <option value="copy">Direct Copy</option>
                          <option value="array_count">Count Items</option>
                          <option value="array_extract">Extract item by index</option>
                          <option value="array_join">Join to String</option>
                          <option value="array_includes">Check presence (Boolean)</option>
                          <option value="date_extract">Extract Date/Time</option>
                          <option value="date_format">Date format</option>
                        </select>
                      </div>
                    </div>

                    {draft.method === 'array_join' && (
                      <div className="grid grid-cols-2 gap-4 mt-3">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-700">Delimiter</label>
                          <input
                            value={draft.params?.delimiter || ', '}
                            onChange={(e) => updateDraft(draft.sourceId, (curr) => ({
                              ...curr,
                              params: { ...curr.params, delimiter: e.target.value },
                            }))}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                          />
                        </div>
                      </div>
                    )}

                    {draft.method === 'array_extract' && (
                      <div className="grid grid-cols-2 gap-4 mt-3">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-700">Index</label>
                          <input
                            type="number"
                            value={draft.params?.index ?? 0}
                            onChange={(e) => updateDraft(draft.sourceId, (curr) => ({
                              ...curr,
                              params: { ...curr.params, index: Number(e.target.value) },
                            }))}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                          />
                        </div>
                      </div>
                    )}

                    {draft.method === 'array_includes' && (
                      <div className="grid grid-cols-2 gap-4 mt-3">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-700">Keyword</label>
                          <input
                            value={draft.params?.keyword || ''}
                            onChange={(e) => updateDraft(draft.sourceId, (curr) => ({
                              ...curr,
                              params: { ...curr.params, keyword: e.target.value },
                            }))}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                          />
                        </div>
                      </div>
                    )}

                    {draft.method === 'date_extract' && (
                      <div className="grid grid-cols-2 gap-4 mt-3">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-700">Date part</label>
                          <select
                            value={draft.params?.datePart || 'date_only'}
                            onChange={(e) => updateDraft(draft.sourceId, (curr) => ({
                              ...curr,
                              params: { ...curr.params, datePart: e.target.value },
                            }))}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                          >
                            <option value="date_only">Date only</option>
                            <option value="time_only">Time only</option>
                            <option value="year">Year</option>
                            <option value="month">Month</option>
                          </select>
                        </div>
                      </div>
                    )}

                    {draft.method === 'date_format' && (
                      <div className="grid grid-cols-2 gap-4 mt-3">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-700">Format</label>
                          <input
                            value={draft.params?.format || 'YYYY-MM-DD'}
                            onChange={(e) => updateDraft(draft.sourceId, (curr) => ({
                              ...curr,
                              params: { ...curr.params, format: e.target.value },
                            }))}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                          />
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                      <div className="border border-gray-200 rounded-lg bg-white p-4 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-semibold text-gray-800 flex items-center space-x-2">
                            <Play className="w-4 h-4 text-blue-500" />
                            <span>Live preview</span>
                          </span>
                          <span className="text-xs text-gray-400">Sample values</span>
                        </div>
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {draft.analysis?.sampleValues.slice(0, 5).map((val, i) => {
                            const tempRule: TransformationRule = {
                              id: 'temp',
                              targetName: 'Preview',
                              sourceKey: draft.sourceKey,
                              method: draft.method,
                              params: draft.params,
                              valueMap: Object.keys(draft.valueMap).length ? draft.valueMap : undefined,
                            };
                            const mockRow: RawRow = { [draft.sourceKey]: val } as RawRow;
                            const result = applyTransformation([mockRow], [tempRule])[0]?.Preview;

                            return (
                              <div key={`${draft.sourceId}-${i}`} className="text-sm grid grid-cols-2 gap-3 border-b border-gray-100 pb-2 last:border-0 last:pb-0">
                                <div className="text-gray-500 truncate" title={String(val)}>
                                  {safeRender(val)}
                                </div>
                                <div className="font-medium text-gray-900 truncate flex items-center" title={safeRender(result)}>
                                  <ArrowRight className="w-3 h-3 mr-2 text-blue-400" />
                                  {safeRender(result)}
                                </div>
                              </div>
                            );
                          })}
                          {!draft.analysis?.sampleValues?.length && (
                            <p className="text-xs text-gray-400">No sample values available for this source.</p>
                          )}
                        </div>
                      </div>

                      <div className="border border-gray-200 rounded-lg bg-white shadow-sm overflow-hidden">
                        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                          <div>
                            <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Map values</h4>
                            <p className="text-[10px] text-gray-400">Found {draft.uniqueValues.length} values (scanning top 5000)</p>
                          </div>
                          <button
                            onClick={() => updateDraft(draft.sourceId, (curr) => ({ ...curr, valueMap: {} }))}
                            className="text-xs text-gray-500 hover:text-red-500"
                          >
                            Clear
                          </button>
                        </div>
                        <div className="max-h-48 overflow-y-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-gray-500 text-xs sticky top-0">
                              <tr>
                                <th className="px-4 py-2 text-left font-medium">Original found</th>
                                <th className="px-4 py-2 text-left font-medium">Map to</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {draft.uniqueValues.map((val) => (
                                <tr key={`${draft.sourceId}-${val}`}>
                                  <td className="px-4 py-2 text-gray-600 font-mono text-xs truncate max-w-[120px]" title={val}>
                                    {val}
                                  </td>
                                  <td className="px-4 py-2">
                                    <input
                                      className="w-full px-2 py-1 border border-gray-200 rounded text-xs focus:border-blue-500 outline-none"
                                      placeholder={val}
                                      value={draft.valueMap[val] || ''}
                                      onChange={(e) =>
                                        updateDraft(draft.sourceId, (curr) => ({
                                          ...curr,
                                          valueMap: { ...curr.valueMap, [val]: e.target.value },
                                        }))
                                      }
                                    />
                                  </td>
                                </tr>
                              ))}
                              {Object.keys(draft.valueMap)
                                .filter((k) => !draft.uniqueValues.includes(k))
                                .map((k) => (
                                  <tr key={`${draft.sourceId}-custom-${k}`}>
                                    <td className="px-4 py-2 text-gray-600 font-mono text-xs truncate max-w-[120px]" title={k}>
                                      {k} (Custom)
                                    </td>
                                    <td className="px-4 py-2">
                                      <div className="flex items-center">
                                        <input
                                          className="w-full px-2 py-1 border border-gray-200 rounded text-xs focus:border-blue-500 outline-none"
                                          value={draft.valueMap[k]}
                                          onChange={(e) =>
                                            updateDraft(draft.sourceId, (curr) => ({
                                              ...curr,
                                              valueMap: { ...curr.valueMap, [k]: e.target.value },
                                            }))
                                          }
                                        />
                                        <button
                                          onClick={() =>
                                            updateDraft(draft.sourceId, (curr) => {
                                              const nextMap = { ...curr.valueMap };
                                              delete nextMap[k];
                                              return { ...curr, valueMap: nextMap };
                                            })
                                          }
                                          className="ml-2 text-gray-400 hover:text-red-500"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              {draft.uniqueValues.length === 0 && Object.keys(draft.valueMap).length === 0 && (
                                <tr>
                                  <td className="px-4 py-3 text-xs text-gray-400" colSpan={2}>
                                    No mapped values yet. Add mappings below.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>

                        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
                          <div className="text-[10px] text-gray-500 mb-2 font-medium">Add custom map (if value not found)</div>
                          <div className="flex space-x-2">
                            <input
                              className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-xs outline-none"
                              placeholder="Original value"
                              value={draft.manualKey}
                              onChange={(e) => updateDraft(draft.sourceId, (curr) => ({ ...curr, manualKey: e.target.value }))}
                            />
                            <ArrowRight className="w-4 h-4 text-gray-400 self-center" />
                            <input
                              className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-xs outline-none"
                              placeholder="New value"
                              value={draft.manualValue}
                              onChange={(e) => updateDraft(draft.sourceId, (curr) => ({ ...curr, manualValue: e.target.value }))}
                            />
                            <button
                              onClick={() => {
                                if (draft.manualKey && draft.manualValue) {
                                  updateDraft(draft.sourceId, (curr) => ({
                                    ...curr,
                                    valueMap: { ...curr.valueMap, [draft.manualKey]: draft.manualValue },
                                    manualKey: '',
                                    manualValue: '',
                                  }));
                                }
                              }}
                              disabled={!draft.manualKey || !draft.manualValue}
                              className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 text-xs font-medium disabled:opacity-50"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end space-x-3 pt-2">
              <button onClick={closeRuleModal} className="px-4 py-2 text-sm text-gray-600 rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={saveRule}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg shadow-sm hover:bg-blue-700"
              >
                {editingTargetName ? 'Update' : 'Add column'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showSaveModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-40 px-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-blue-600 font-semibold">Save structured output</p>
                <h3 className="text-lg font-semibold text-gray-900">Preparation Data</h3>
              </div>
              <button onClick={() => setShowSaveModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Table name</label>
              <input
                value={saveName}
                onChange={(e) => {
                  setSaveName(e.target.value);
                  setSaveError('');
                }}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                placeholder="Structured table name"
              />
              {saveError && <p className="text-xs text-red-500">{saveError}</p>}
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button onClick={() => setShowSaveModal(false)} className="px-4 py-2 text-sm text-gray-600 rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg shadow-sm hover:bg-blue-700 disabled:opacity-60 flex items-center"
              >
                {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BuildStructure;
