
import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { Project, DashboardWidget, DashboardFilter, DrillDownState, RawRow, FilterDataType } from '../types';
import {
    PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, AreaChart, Area, LabelList, ComposedChart, Legend as RechartsLegend
} from 'recharts';
import { Loader2, Plus, LayoutGrid, Trash2, Pencil, Filter, X, Presentation, FileOutput, Eye, EyeOff, Table, Download, ChevronRight, MousePointer2 } from 'lucide-react';
import { applyTransformation } from '../utils/transform';
import { saveProject } from '../utils/storage-compat';
import { generatePowerPoint } from '../utils/report';
import { exportToExcel } from '../utils/excel';
import ChartBuilder from '../components/ChartBuilder';
import EmptyState from '../components/EmptyState';
import { ensureDataSources, setActiveDataSource } from '../utils/dataSources';
import WidgetRenderer from '../components/WidgetRenderer';
import { ChartTheme, CLASSIC_ANALYTICS_THEME } from '../constants/chartTheme';

const SAMPLE_SIZE = 50;

const toDateValue = (value: any): Date | null => {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed);
};

const normalizeDateInputValue = (value: string): string => {
  const date = toDateValue(value);
  if (!date) return '';
  return date.toISOString().slice(0, 10);
};

const normalizeRangeStart = (value?: string) => {
  if (!value) return null;
  const date = toDateValue(value);
  if (!date) return null;
  date.setHours(0, 0, 0, 0);
  return date;
};

const normalizeRangeEnd = (value?: string) => {
  if (!value) return null;
  const date = toDateValue(value);
  if (!date) return null;
  date.setHours(23, 59, 59, 999);
  return date;
};

const inferColumnType = (column: string, rows: RawRow[]): FilterDataType => {
  const samples: any[] = [];
  for (let i = 0; i < rows.length && samples.length < SAMPLE_SIZE; i++) {
    const val = rows[i][column];
    if (val !== undefined && val !== null && val !== '') {
      samples.push(val);
    }
  }

  if (samples.length === 0) return 'text';

  const dateLikes = samples.filter((val) => {
    if (val instanceof Date) return !isNaN(val.getTime());
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (trimmed.length < 6) return false;
      const containsDateSep = /[-/]/.test(trimmed);
      const parsed = Date.parse(trimmed);
      return containsDateSep && !Number.isNaN(parsed);
    }
    return false;
  });
  if (dateLikes.length / samples.length >= 0.6) return 'date';

  const numberLikes = samples.filter((val) => {
    if (typeof val === 'number') return true;
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (!trimmed) return false;
      return !Number.isNaN(Number(trimmed));
    }
    return false;
  });
  if (numberLikes.length / samples.length >= 0.6) return 'number';

  return 'text';
};

export interface AnalyticsProps {
  project: Project;
  onUpdateProject?: (p: Project) => void;
  chartTheme?: ChartTheme;
  initialWidgets?: DashboardWidget[];
  onSaveWidgets?: (widgets: DashboardWidget[]) => Promise<void> | void;
}

const Analytics: React.FC<AnalyticsProps> = ({
  project,
  onUpdateProject,
  chartTheme = CLASSIC_ANALYTICS_THEME,
  initialWidgets,
  onSaveWidgets,
}) => {
  const needsNormalization = !project.dataSources?.length || !project.activeDataSourceId;
  const { project: normalizedProject, active: activeSource } = useMemo(() => ensureDataSources(project), [project]);
  useEffect(() => {
    if (needsNormalization && onUpdateProject) {
      onUpdateProject(normalizedProject);
    }
  }, [needsNormalization, normalizedProject, onUpdateProject]);

  // Dashboard State
  const resolvedInitialWidgets = useMemo(
    () => initialWidgets ?? project.dashboard ?? [],
    [initialWidgets, project.dashboard]
  );
  const [widgets, setWidgets] = useState<DashboardWidget[]>(resolvedInitialWidgets);
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [editingWidget, setEditingWidget] = useState<DashboardWidget | null>(null);

  const activeData = activeSource.rows;
  const activeColumns = activeSource.columns;
  
  // Phase 3 & 5: Filters, Presentation & Interaction Modes
  const [filters, setFilters] = useState<DashboardFilter[]>([]);
  const [isPresentationMode, setIsPresentationMode] = useState(false);
  const [interactionMode, setInteractionMode] = useState<'drill' | 'filter'>('filter');
  const [isExporting, setIsExporting] = useState(false);
  const [newFilterCol, setNewFilterCol] = useState('');
  
  // Phase 4: Drill Down
  const [drillDown, setDrillDown] = useState<DrillDownState | null>(null);

  const dashboardRef = useRef<HTMLDivElement>(null);

  // Sync widgets to local state if project changes
  useEffect(() => {
    setWidgets(resolvedInitialWidgets);
  }, [resolvedInitialWidgets]);

  // 1. Prepare Base Data (Raw or Structured)
  const baseData = useMemo(() => {
      if (project.transformRules && project.transformRules.length > 0) {
          return applyTransformation(activeData, project.transformRules);
      }
      return activeData;
  }, [activeData, project.transformRules]);

  const availableColumns = useMemo(() => {
      if (baseData.length === 0) return [];
      return Object.keys(baseData[0]);
  }, [baseData]);

  const columnTypeMap = useMemo(() => {
      const sampleRows = baseData.slice(0, SAMPLE_SIZE);
      const map: Record<string, FilterDataType> = {};
      availableColumns.forEach(col => {
          map[col] = inferColumnType(col, sampleRows);
      });
      return map;
  }, [availableColumns, baseData]);

  const isDeckTheme = chartTheme?.id === 'pptist';

  const getColumnType = useCallback(
      (column: string): FilterDataType => columnTypeMap[column] || 'text',
      [columnTypeMap]
  );

  const matchesFilterCondition = useCallback((row: RawRow, filter: DashboardFilter) => {
      if (!filter.column) return true;
      const value = row[filter.column];
      if (filter.dataType === 'date') {
          const rowDate = toDateValue(value);
          if (!rowDate) return false;
          const start = normalizeRangeStart(filter.value);
          const end = normalizeRangeEnd(filter.endValue);
          if (start && rowDate < start) return false;
          if (end && rowDate > end) return false;
          if (!start && !end) return true;
          return true;
      }
      if (!filter.value) return true;
      return String(value ?? '').toLowerCase() === filter.value.toLowerCase();
  }, []);

  // 2. Apply Global Filters
  const filteredData = useMemo(() => {
      if (filters.length === 0) return baseData;

      return baseData.filter(row => filters.every(f => matchesFilterCondition(row, f)));
  }, [baseData, filters, matchesFilterCondition]);

  const applyWidgetFilters = (rows: RawRow[], widgetFilters?: DashboardFilter[]) => {
      if (!widgetFilters || widgetFilters.length === 0) return rows;
      return rows.filter(row => widgetFilters.every(f => matchesFilterCondition(row, f)));
  };

  // --- Filter Logic ---

  const addFilter = (column: string, value: string = '') => {
      if (!column) return;
      // Check if exists
      const exists = filters.find(f => f.column === column);
      if (exists) {
          if (value) updateFilterValue(exists.id, value);
          return;
      }

      let dataType = getColumnType(column);
      let initialValue = value;
      let endValue: string | undefined;

      if (dataType === 'date') {
          if (value) {
              const normalized = normalizeDateInputValue(value);
              if (normalized) {
                  initialValue = normalized;
              } else {
                  dataType = 'text';
              }
          } else {
              initialValue = '';
              endValue = '';
          }
      }

      const newFilter: DashboardFilter = {
          id: crypto.randomUUID(),
          column,
          value: initialValue,
          endValue,
          dataType
      };
      setFilters([...filters, newFilter]);
      setNewFilterCol('');
  };

  const removeFilter = (id: string) => {
      setFilters(filters.filter(f => f.id !== id));
  };

  const updateFilterValue = (id: string, val: string, field: 'value' | 'endValue' = 'value') => {
      setFilters(filters.map(f => f.id === id ? { ...f, [field]: val } : f));
  };

  const getUniqueValues = (col: string) => {
      const unique = new Set(baseData.map(row => String(row[col] || '')));
      return Array.from(unique).filter(Boolean).sort().slice(0, 100); // Limit dropdown size
  };

  // --- Dashboard Logic ---

  const handleAddWidget = () => {
      setEditingWidget(null);
      setIsBuilderOpen(true);
  };

  const handleEditWidget = (e: React.MouseEvent, widget: DashboardWidget) => {
      e.stopPropagation(); // Critical: Prevent triggering parent clicks
      setEditingWidget(widget);
      setIsBuilderOpen(true);
  };

  const persistWidgets = useCallback(
    async (nextWidgets: DashboardWidget[]) => {
      if (onSaveWidgets) {
        await onSaveWidgets(nextWidgets);
        return;
      }

      if (onUpdateProject) {
        const updatedProject = { ...normalizedProject, dashboard: nextWidgets };
        onUpdateProject(updatedProject);
        await saveProject(updatedProject);
      }
    },
    [normalizedProject, onSaveWidgets, onUpdateProject]
  );

  const handleSaveWidget = async (newWidget: DashboardWidget) => {
      let updatedWidgets = [...widgets];
      if (editingWidget) {
          updatedWidgets = updatedWidgets.map(w => w.id === newWidget.id ? newWidget : w);
      } else {
          updatedWidgets.push(newWidget);
      }
      
      setWidgets(updatedWidgets);
      setIsBuilderOpen(false);
      setEditingWidget(null);

      await persistWidgets(updatedWidgets);
  };

  const handleDeleteWidget = async (e: React.MouseEvent, id: string) => {
      e.stopPropagation(); // Critical: Prevent triggering parent clicks
      if(!window.confirm("Remove this chart?")) return;
      
      const updatedWidgets = widgets.filter(w => w.id !== id);
      setWidgets(updatedWidgets);

      await persistWidgets(updatedWidgets);
  };

  const handleActiveChange = async (value: string) => {
      if (!onUpdateProject) return;
      const updated = setActiveDataSource(normalizedProject, value);
      onUpdateProject(updated);
      await saveProject(updated);
  };

  const handleExportPPT = async () => {
      if (!dashboardRef.current) return;
      setIsExporting(true);
      setTimeout(async () => {
          const filterStr = filters.map(f => {
              if (f.dataType === 'date') {
                  const start = f.value || 'Any';
                  const end = f.endValue || 'Any';
                  return `${f.column}=${start} → ${end}`;
              }
              return `${f.column}=${f.value || 'All'}`;
          }).join(', ');
          await generatePowerPoint(project, dashboardRef.current!, filterStr);
          setIsExporting(false);
      }, 100);
  };

  // --- Interaction Handler (Drill vs Filter) ---
  const handleChartValueSelect = (widget: DashboardWidget, activeLabel?: string) => {
      if (!activeLabel) return;
      
      // Special handling for Stacked Bar: activeLabel might be the stack key (e.g. 'Positive') or the category (e.g. 'Facebook')
      // Recharts click event provides 'activeLabel' as the X-axis value (Category).
      // If clicked on a specific stack, we might get data from `e`.
      
      const filterColumn = widget.dimension;
      const filterValue = activeLabel; // This is typically the X-axis value

      if (interactionMode === 'filter') {
          // Add/Update global filter
          addFilter(filterColumn, filterValue);
      } else {
          // Drill Down Logic
          const clickedData = filteredData.filter(row => {
             // Simple check, might need refinement for array values
             return String(row[filterColumn]).includes(filterValue);
          });

          setDrillDown({
              isOpen: true,
              title: `${widget.title} - ${filterValue}`,
              filterCol: filterColumn,
              filterVal: filterValue,
              data: clickedData
          });
      }
  };

  const renderWidget = (widget: DashboardWidget) => (
    <WidgetRenderer
      key={widget.id}
      widget={widget}
      data={filteredData}
      filters={widget.filters}
      onValueClick={(value) => handleChartValueSelect(widget, value)}
      theme={chartTheme}
    />
  );

  if (baseData.length === 0) {
      return (
        <div className="p-12">
            <EmptyState 
                icon={Table}
                title="Data is not ready"
                description="Please go to Data Prep and structure your data before creating analytics."
            />
        </div>
      );
  }

  return (
    <div
      className="p-8 min-h-screen flex flex-col"
      style={{ background: chartTheme.background.canvas, fontFamily: isDeckTheme ? chartTheme.typography.fontFamily : undefined }}
    >
      
      {/* Top Controls */}
      <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                Analytics Dashboard
                {isPresentationMode && <span className="ml-3 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-medium flex items-center"><Presentation className="w-3 h-3 mr-1"/> Live Mode</span>}
            </h2>
            <p className="text-gray-500 text-sm mt-1">
                {filteredData.length} rows matching filters
            </p>
        </div>

        <div className="flex flex-wrap gap-2.5">

            <div className="flex items-center space-x-2 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 shadow-sm">
                <span className="text-xs font-semibold text-gray-500 uppercase">Active table</span>
                <select
                  value={activeSource.id}
                  onChange={(e) => handleActiveChange(e.target.value)}
                  className="text-xs border border-gray-200 bg-white rounded-md px-2 py-1 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  {(normalizedProject.dataSources || []).map((src) => (
                    <option key={src.id} value={src.id}>{src.name}</option>
                  ))}
                </select>
            </div>

            {/* Interaction Toggle */}
            <div className="bg-white border border-gray-300 rounded-lg flex p-0.5 shadow-sm">
                <button 
                    onClick={() => setInteractionMode('filter')}
                    className={`flex items-center px-3 py-1.5 rounded-md text-xs font-medium transition-all ${interactionMode === 'filter' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:text-gray-900'}`}
                    title="Click charts to filter dashboard"
                >
                    <Filter className="w-3 h-3 mr-1.5" />
                    Filter
                </button>
                <button 
                    onClick={() => setInteractionMode('drill')}
                    className={`flex items-center px-3 py-1.5 rounded-md text-xs font-medium transition-all ${interactionMode === 'drill' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:text-gray-900'}`}
                    title="Click charts to see data rows"
                >
                    <MousePointer2 className="w-3 h-3 mr-1.5" />
                    Drill
                </button>
            </div>

            <div className="h-9 w-px bg-gray-300 mx-1 self-center hidden md:block"></div>

            {!isPresentationMode && (
                <>
                    <button onClick={handleAddWidget} className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 transition-colors shadow-sm">
                        <Plus className="w-3.5 h-3.5" />
                        <span className="hidden md:inline">Add Chart</span>
                    </button>
                </>
            )}
            
            <button 
                onClick={() => setIsPresentationMode(!isPresentationMode)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 border rounded-md text-xs font-medium transition-colors shadow-sm ${isPresentationMode ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
            >
                {isPresentationMode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span className="hidden md:inline">{isPresentationMode ? 'Edit' : 'Present'}</span>
            </button>
            
            <button 
                onClick={handleExportPPT}
                disabled={isExporting}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-orange-200 text-orange-700 text-xs font-medium rounded-md hover:bg-orange-50 transition-colors shadow-sm"
            >
                {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileOutput className="w-3.5 h-3.5" />}
                <span className="hidden md:inline text-[10px] font-semibold tracking-wide uppercase">PPTX</span>
            </button>
        </div>
      </div>

      {/* Global Filter Bar */}
      {(filters.length > 0 || !isPresentationMode) && (
      <div className={`bg-white border border-gray-200 rounded-xl p-4 mb-8 shadow-sm transition-all ${isPresentationMode ? 'opacity-80 hover:opacity-100' : ''}`}>
          <div className="flex items-center space-x-2 mb-3">
              <Filter className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-bold text-gray-700">Global Filters</span>
              <span className="text-xs text-gray-400">(Applies to all charts)</span>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
              {filters.map(filter => (
                  filter.dataType === 'date' ? (
                    <div key={filter.id} className="flex flex-wrap items-center bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2 animate-in fade-in zoom-in duration-200 gap-2">
                        <span className="text-[11px] font-bold text-indigo-800 uppercase">{filter.column}</span>
                        <div className="flex items-center gap-1">
                            <input
                                type="date"
                                value={filter.value || ''}
                                onChange={(e) => updateFilterValue(filter.id, e.target.value)}
                                className="text-xs border border-indigo-200 rounded px-2 py-1 bg-white focus:ring-2 focus:ring-indigo-400 outline-none"
                            />
                            <span className="text-[10px] text-indigo-500">to</span>
                            <input
                                type="date"
                                value={filter.endValue || ''}
                                onChange={(e) => updateFilterValue(filter.id, e.target.value, 'endValue')}
                                className="text-xs border border-indigo-200 rounded px-2 py-1 bg-white focus:ring-2 focus:ring-indigo-400 outline-none"
                            />
                        </div>
                        <button onClick={() => removeFilter(filter.id)} className="text-indigo-400 hover:text-indigo-600">
                            <X className="w-3 h-3" />
                        </button>
                    </div>
                  ) : (
                    <div key={filter.id} className="flex items-center bg-blue-50 border border-blue-100 rounded-lg px-2 py-1 animate-in fade-in zoom-in duration-200">
                        <span className="text-[11px] font-bold text-blue-800 mr-2 uppercase">{filter.column}:</span>
                        <select 
                            className="bg-transparent text-xs text-blue-900 border-none focus:ring-0 p-0 pr-5 cursor-pointer font-medium"
                            value={filter.value || ''}
                            onChange={(e) => updateFilterValue(filter.id, e.target.value)}
                        >
                            <option value="">All</option>
                            {getUniqueValues(filter.column).map(val => (
                                <option key={val} value={val}>{val}</option>
                            ))}
                        </select>
                        
                        <button onClick={() => removeFilter(filter.id)} className="ml-2 text-blue-400 hover:text-blue-600">
                              <X className="w-3 h-3" />
                        </button>
                    </div>
                  )
              ))}

              {!isPresentationMode && (
                  <div className="flex items-center">
                    <select 
                        className="text-xs border border-gray-300 rounded-l-lg px-2.5 py-1.5 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                        value={newFilterCol}
                        onChange={(e) => setNewFilterCol(e.target.value)}
                    >
                        <option value="">+ Add Filter</option>
                        {availableColumns.filter(c => !filters.find(f => f.column === c)).map(col => (
                            <option key={col} value={col}>{col}</option>
                        ))}
                    </select>
                    <button 
                        disabled={!newFilterCol}
                        onClick={() => addFilter(newFilterCol)}
                        className="bg-gray-100 border border-l-0 border-gray-300 rounded-r-lg px-2.5 py-1.5 hover:bg-gray-200 disabled:opacity-50 text-xs font-semibold uppercase"
                    >
                        Add
                    </button>
                  </div>
              )}
          </div>
      </div>
      )}

      {/* Dashboard Grid */}
      <div ref={dashboardRef} className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-10 overflow-visible">
        {widgets.map((widget) => {
          const widgetCardClasses = `report-widget rounded-2xl border p-5 flex flex-col transition-all group relative ${
            widget.width === 'full' ? 'lg:col-span-2' : ''
          } ${isDeckTheme ? '' : 'bg-white border-gray-200 shadow-sm hover:shadow-md'}`;
          const widgetCardStyle: React.CSSProperties = {
            minHeight: '420px',
            ...(isDeckTheme
              ? {
                  background: chartTheme.background.card,
                  borderColor: chartTheme.background.grid,
                  boxShadow: '0 35px 70px rgba(15, 18, 44, 0.2)',
                  color: chartTheme.typography.labelColor,
                  fontFamily: chartTheme.typography.fontFamily,
                }
              : {}),
          };
          const titleStyle = isDeckTheme ? { color: chartTheme.typography.labelColor } : undefined;
          const metaStyle = isDeckTheme ? { color: chartTheme.typography.axisColor } : undefined;
          const controlBarStyle = isDeckTheme ? { background: 'transparent' } : undefined;

          return (
            <div key={widget.id} className={widgetCardClasses} style={widgetCardStyle}>
                {/* Widget Header */}
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="widget-title font-bold text-gray-800" style={titleStyle}>
                          {widget.title}
                        </h3>
                        <p className="widget-meta text-xs text-gray-400 mt-0.5 capitalize" style={metaStyle}>
                          {widget.type === 'wordcloud' ? 'Word Cloud' : `${widget.dimension} ${widget.stackBy ? `by ${widget.stackBy}` : ''} • ${widget.measure}`}
                        </p>
                    </div>
                    {!isPresentationMode && (
                      <div
                        className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity no-print z-20 bg-white pl-2"
                        style={controlBarStyle}
                      >
                            <button 
                                onClick={(e) => handleEditWidget(e, widget)} 
                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                            >
                                <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button 
                                onClick={(e) => handleDeleteWidget(e, widget.id)} 
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                      )}
                  </div>

                {/* Chart Body */}
                <div className="flex-1 w-full h-full min-h-0 relative z-10">
                    {renderWidget(widget)}
                </div>
                
                {/* Hint for interactivity */}
                {!isPresentationMode && widget.type !== 'kpi' && widget.type !== 'table' && (
                    <div
                      className="absolute bottom-2 right-4 text-[10px] text-gray-300 opacity-0 group-hover:opacity-100 pointer-events-none flex items-center"
                      style={metaStyle}
                    >
                        <MousePointer2 className="w-3 h-3 mr-1" />
                        {interactionMode === 'filter' ? 'Filter' : 'Drill'}
                    </div>
                )}
            </div>
          );
        })}
          
          {!isPresentationMode && widgets.length === 0 && (
              <div className="col-span-full">
                  <EmptyState
                    icon={LayoutGrid}
                    title="Your dashboard is empty"
                    description="Click 'Add Chart' to create your first visualization."
                    actionLabel="Add Chart"
                    onAction={handleAddWidget}
                  />
              </div>
          )}
      </div>

      <ChartBuilder 
        isOpen={isBuilderOpen}
        onClose={() => setIsBuilderOpen(false)}
        onSave={handleSaveWidget}
        availableColumns={availableColumns}
        initialWidget={editingWidget}
        data={filteredData}
        chartTheme={chartTheme}
      />

      {/* Drill Down Modal */}
      {drillDown && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-6 animate-in fade-in duration-200">
              <div className="bg-white w-full max-w-5xl h-[80vh] rounded-xl shadow-2xl flex flex-col overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                      <div>
                        <h3 className="font-bold text-lg text-gray-800 flex items-center">
                            Drill Down: {drillDown.title}
                        </h3>
                        <p className="text-xs text-gray-500">
                            Filtered by <span className="font-semibold">{drillDown.filterCol} = {drillDown.filterVal}</span> ({drillDown.data.length} rows)
                        </p>
                      </div>
                      <div className="flex space-x-2">
                        <button 
                            onClick={() => exportToExcel(drillDown.data, `DrillDown_${drillDown.title}`)}
                            className="flex items-center space-x-1.5 px-3 py-1.5 bg-green-600 text-white rounded-md text-xs font-medium hover:bg-green-700"
                        >
                            <Download className="w-3.5 h-3.5" /> <span>Export Excel</span>
                        </button>
                        <button onClick={() => setDrillDown(null)} className="p-1.5 text-gray-400 hover:bg-gray-200 rounded">
                            <X className="w-5 h-5" />
                        </button>
                      </div>
                  </div>
                  
                  <div className="flex-1 overflow-auto p-0">
                      <table className="w-full text-left text-sm border-collapse">
                           <thead className="bg-white text-gray-500 text-xs uppercase sticky top-0 z-10 shadow-sm">
                               <tr>
                                   <th className="px-6 py-3 border-b border-gray-200 w-12">#</th>
                                   {availableColumns.map(col => (
                                       <th key={col} className="px-6 py-3 border-b border-gray-200 font-semibold whitespace-nowrap">{col}</th>
                                   ))}
                               </tr>
                           </thead>
                           <tbody className="divide-y divide-gray-100">
                               {drillDown.data.slice(0, 200).map((row, idx) => (
                                   <tr key={idx} className="hover:bg-blue-50">
                                       <td className="px-6 py-3 text-gray-400 font-mono text-xs bg-gray-50/50">{idx + 1}</td>
                                       {availableColumns.map(col => (
                                           <td key={col} className="px-6 py-3 text-gray-700 truncate max-w-xs" title={String(row[col])}>
                                               {String(row[col])}
                                           </td>
                                       ))}
                                   </tr>
                               ))}
                           </tbody>
                      </table>
                      {drillDown.data.length > 200 && (
                          <div className="p-4 text-center text-gray-500 text-sm bg-gray-50 border-t">
                              Showing first 200 rows. Export to see all {drillDown.data.length} rows.
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

export default Analytics;
