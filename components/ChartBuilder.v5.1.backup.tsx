/**
 * ChartBuilder v5.1 - Complete Combo Chart + All Fixes
 *
 * FIXES:
 * 1. Column Field shows in Series Modal (when Sum/Average)
 * 2. Sort Options (Value, Name, Original Order)
 * 3. Bar Orientation (Vertical/Horizontal)
 * 4. Category Filter (checkbox list instead of limit)
 * 5. Double-click to change bar colors
 */

import React, { useState, useEffect, useMemo } from 'react';
import { X, Save, ChevronDown, ChevronUp, Palette, Type as TypeIcon, Sliders as SlidersIcon, Plus, Trash2, Edit as EditIcon, Search } from 'lucide-react';
import {
  ChartType,
  DashboardWidget,
  AggregateMethod,
  RawRow,
  DataLabelConfig,
  AxisConfig,
  LegendConfig,
  CategoryConfig,
  SeriesConfig,
  SortOrder
} from '../types';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend as RechartsLegend,
  LabelList,
  PieChart,
  Pie,
  Cell,
  BarChart
} from 'recharts';

interface ChartBuilderProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (widget: DashboardWidget) => void;
  availableColumns: string[];
  initialWidget?: DashboardWidget | null;
  data: RawRow[];
}

const generateId = () => 'w-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 9);

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#6366F1'];

// Collapsible Section
const Section: React.FC<{
  title: string;
  icon?: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}> = ({ title, icon, isOpen, onToggle, children }) => (
  <div className="border border-gray-200 rounded-lg mb-2 bg-white">
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
      style={{ outline: 'none' }}
    >
      <div className="flex items-center gap-2">
        {icon}
        <span className="font-medium text-gray-900">{title}</span>
      </div>
      {isOpen ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
    </button>
    {isOpen && <div className="px-4 pb-4 pt-2">{children}</div>}
  </div>
);

// Category Config Modal (for double-click)
const CategoryConfigModal: React.FC<{
  isOpen: boolean;
  category: string;
  config: CategoryConfig;
  onClose: () => void;
  onSave: (config: CategoryConfig) => void;
}> = ({ isOpen, category, config, onClose, onSave }) => {
  const [color, setColor] = useState(config.color || COLORS[0]);
  const [label, setLabel] = useState(config.label || category);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl p-6 w-96" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-gray-900 mb-4">Edit "{category}"</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-16 h-10 border border-gray-300 rounded cursor-pointer"
                style={{ outline: 'none' }}
              />
              <input
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm font-mono"
                style={{ outline: 'none' }}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Custom Label</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={category}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
              style={{ outline: 'none' }}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
            style={{ outline: 'none' }}
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onSave({ color, label: label !== category ? label : undefined });
              onClose();
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            style={{ outline: 'none' }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

// Series Config Modal (FIXED: Column field shows full width)
const SeriesConfigModal: React.FC<{
  isOpen: boolean;
  series: SeriesConfig | null;
  availableColumns: string[];
  onClose: () => void;
  onSave: (series: SeriesConfig) => void;
}> = ({ isOpen, series, availableColumns, onClose, onSave }) => {
  const [label, setLabel] = useState(series?.label || '');
  const [type, setType] = useState<'bar' | 'line' | 'area'>(series?.type || 'bar');
  const [measure, setMeasure] = useState<AggregateMethod>(series?.measure || 'count');
  const [measureCol, setMeasureCol] = useState(series?.measureCol || '');
  const [yAxis, setYAxis] = useState<'left' | 'right'>(series?.yAxis || 'left');
  const [color, setColor] = useState(series?.color || COLORS[0]);

  const needsColumn = measure === 'sum' || measure === 'avg';

  if (!isOpen) return null;

  const handleSave = () => {
    const newSeries: SeriesConfig = {
      id: series?.id || `s-${Date.now()}`,
      label: label || 'Untitled Series',
      type,
      measure,
      measureCol: needsColumn ? measureCol : undefined,
      yAxis,
      color
    };
    onSave(newSeries);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl p-6 w-[500px]" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-gray-900 mb-4">
          {series ? 'Edit Series' : 'Add Series'}
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Series Name</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g., Post Count, Engagement Rate"
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
              style={{ outline: 'none' }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Chart Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                style={{ outline: 'none' }}
              >
                <option value="bar">Bar</option>
                <option value="line">Line</option>
                <option value="area">Area</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Y-Axis</label>
              <select
                value={yAxis}
                onChange={(e) => setYAxis(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                style={{ outline: 'none' }}
              >
                <option value="left">Left</option>
                <option value="right">Right</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Measure</label>
            <select
              value={measure}
              onChange={(e) => setMeasure(e.target.value as AggregateMethod)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
              style={{ outline: 'none' }}
            >
              <option value="count">Count</option>
              <option value="sum">Sum</option>
              <option value="avg">Average</option>
            </select>
          </div>

          {/* FIXED: Column field shows full width when needed */}
          {needsColumn && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Column</label>
              <select
                value={measureCol}
                onChange={(e) => setMeasureCol(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                style={{ outline: 'none' }}
              >
                <option value="">Select...</option>
                {availableColumns.map(col => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-16 h-10 border border-gray-300 rounded cursor-pointer"
                style={{ outline: 'none' }}
              />
              <input
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm font-mono"
                style={{ outline: 'none' }}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
            style={{ outline: 'none' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            style={{ outline: 'none' }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

const ChartBuilder: React.FC<ChartBuilderProps> = ({
  isOpen,
  onClose,
  onSave,
  availableColumns,
  initialWidget,
  data
}) => {
  const [activeTab, setActiveTab] = useState<'setup' | 'customize'>('setup');

  // Widget state
  const [title, setTitle] = useState('New Chart');
  const [type, setType] = useState<ChartType>('bar');
  const [dimension, setDimension] = useState('');
  const [width, setWidth] = useState<'half' | 'full'>('half');

  // NEW: Sort & Orientation
  const [sortBy, setSortBy] = useState<SortOrder>('value-desc');
  const [barOrientation, setBarOrientation] = useState<'vertical' | 'horizontal'>('vertical');

  // NEW: Category Filter (replaces limit)
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [categorySearch, setCategorySearch] = useState('');

  // Multiple Series (for Combo charts)
  const [series, setSeries] = useState<SeriesConfig[]>([]);

  // Legacy single-series (for backward compatibility)
  const [measure, setMeasure] = useState<AggregateMethod>('count');
  const [measureCol, setMeasureCol] = useState('');
  const [categoryConfig, setCategoryConfig] = useState<Record<string, CategoryConfig>>({});

  // Style state
  const [chartTitle, setChartTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [legend, setLegend] = useState<LegendConfig>({
    enabled: true,
    position: 'bottom',
    fontSize: 11,
    fontColor: '#666666',
    alignment: 'center'
  });
  const [dataLabels, setDataLabels] = useState<DataLabelConfig>({
    enabled: false,
    position: 'top',
    fontSize: 11,
    fontWeight: 'normal',
    color: '#000000'
  });

  // Axes state
  const [xAxis, setXAxis] = useState<AxisConfig>({
    title: '',
    fontSize: 11,
    fontColor: '#666666',
    slant: 0,
    showGridlines: true
  });
  const [leftYAxis, setLeftYAxis] = useState<AxisConfig>({
    title: '',
    min: 'auto',
    max: 'auto',
    fontSize: 11,
    fontColor: '#666666',
    format: '#,##0',
    showGridlines: true
  });
  const [rightYAxis, setRightYAxis] = useState<AxisConfig>({
    title: '',
    min: 'auto',
    max: 'auto',
    fontSize: 11,
    fontColor: '#666666',
    format: '#,##0',
    showGridlines: true
  });

  // UI state
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());
  const [seriesModal, setSeriesModal] = useState<{ isOpen: boolean; series: SeriesConfig | null }>({ isOpen: false, series: null });
  const [categoryModal, setCategoryModal] = useState<{ isOpen: boolean; category: string } | null>(null);

  // Initialize
  useEffect(() => {
    if (initialWidget) {
      setTitle(initialWidget.title);
      setType(initialWidget.type);
      setDimension(initialWidget.dimension);
      setWidth(initialWidget.width);
      setSortBy(initialWidget.sortBy || 'value-desc');
      setBarOrientation(initialWidget.barOrientation || 'vertical');
      setCategoryFilter(initialWidget.categoryFilter || []);
      setChartTitle(initialWidget.chartTitle || initialWidget.title);
      setSubtitle(initialWidget.subtitle || '');

      if (initialWidget.series && initialWidget.series.length > 0) {
        setSeries(initialWidget.series);
      } else {
        setMeasure(initialWidget.measure || 'count');
        setMeasureCol(initialWidget.measureCol || '');
      }

      setCategoryConfig(initialWidget.categoryConfig || {});
      if (initialWidget.legend) setLegend(initialWidget.legend);
      if (initialWidget.dataLabels) setDataLabels(initialWidget.dataLabels);
      setXAxis(initialWidget.xAxis || xAxis);
      setLeftYAxis(initialWidget.leftYAxis || leftYAxis);
      setRightYAxis(initialWidget.rightYAxis || rightYAxis);
    } else {
      if (availableColumns.length > 0) {
        setDimension(availableColumns[0]);
      }
    }
  }, [initialWidget, availableColumns]);

  // Sorting function (must be declared before useMemo that uses it)
  const applySorting = (data: any[], order: SortOrder, valueKey: string) => {
    switch (order) {
      case 'value-desc':
        return [...data].sort((a, b) => (b[valueKey] || 0) - (a[valueKey] || 0));
      case 'value-asc':
        return [...data].sort((a, b) => (a[valueKey] || 0) - (b[valueKey] || 0));
      case 'name-asc':
        return [...data].sort((a, b) => String(a.name).localeCompare(String(b.name)));
      case 'name-desc':
        return [...data].sort((a, b) => String(b.name).localeCompare(String(a.name)));
      case 'original':
      default:
        return data; // No sorting
    }
  };

  // Get all unique categories from data
  const allCategories = useMemo(() => {
    if (!dimension || data.length === 0) return [];
    const unique = new Set<string>();
    data.forEach(row => {
      const val = String(row[dimension] || 'N/A');
      unique.add(val);
    });
    return Array.from(unique).sort();
  }, [dimension, data]);

  // Aggregate data for preview
  const previewData = useMemo(() => {
    if (!dimension || data.length === 0) return [];

    // For multi-series (Combo chart & Stacked bar)
    if ((type === 'combo' || type === 'stacked-bar') && series.length > 0) {
      const groups: Record<string, any> = {};

      data.forEach(row => {
        const dimValue = String(row[dimension] || 'N/A');

        // Apply category filter
        if (categoryFilter.length > 0 && !categoryFilter.includes(dimValue)) {
          return;
        }

        if (!groups[dimValue]) {
          groups[dimValue] = { name: dimValue };
        }

        // Calculate each series
        series.forEach(s => {
          if (s.measure === 'count') {
            groups[dimValue][s.id] = (groups[dimValue][s.id] || 0) + 1;
          } else if (s.measure === 'sum' && s.measureCol) {
            const val = parseFloat(String(row[s.measureCol])) || 0;
            groups[dimValue][s.id] = (groups[dimValue][s.id] || 0) + val;
          } else if (s.measure === 'avg' && s.measureCol) {
            if (!groups[dimValue][`${s.id}_sum`]) {
              groups[dimValue][`${s.id}_sum`] = 0;
              groups[dimValue][`${s.id}_count`] = 0;
            }
            const val = parseFloat(String(row[s.measureCol])) || 0;
            groups[dimValue][`${s.id}_sum`] += val;
            groups[dimValue][`${s.id}_count`]++;
          }
        });
      });

      // Finalize averages
      series.forEach(s => {
        if (s.measure === 'avg') {
          Object.keys(groups).forEach(k => {
            const count = groups[k][`${s.id}_count`] || 0;
            if (count > 0) {
              groups[k][s.id] = groups[k][`${s.id}_sum`] / count;
            }
          });
        }
      });

      let result = Object.values(groups);

      // Apply sorting
      result = applySorting(result, sortBy, series.length > 0 ? series[0].id : 'value');

      // Normalize to 100% for stacked bar
      if (type === 'stacked-bar') {
        result = result.map(row => {
          const total = series.reduce((sum, s) => sum + (row[s.id] || 0), 0);
          if (total > 0) {
            const normalized: any = { name: row.name };
            series.forEach(s => {
              normalized[s.id] = ((row[s.id] || 0) / total) * 100;
            });
            return normalized;
          }
          return row;
        });
      }

      return result;
    }

    // For single-series (legacy)
    const groups: Record<string, number> = {};

    data.forEach(row => {
      const dimValue = String(row[dimension] || 'N/A');

      // Apply category filter
      if (categoryFilter.length > 0 && !categoryFilter.includes(dimValue)) {
        return;
      }

      if (!groups[dimValue]) groups[dimValue] = 0;

      if (measure === 'count') {
        groups[dimValue]++;
      } else if (measure === 'sum' && measureCol) {
        const val = parseFloat(String(row[measureCol])) || 0;
        groups[dimValue] += val;
      } else if (measure === 'avg' && measureCol) {
        if (!groups[`${dimValue}_sum`]) {
          groups[`${dimValue}_sum`] = 0;
          groups[`${dimValue}_count`] = 0;
        }
        const val = parseFloat(String(row[measureCol])) || 0;
        groups[`${dimValue}_sum`] += val;
        groups[`${dimValue}_count`]++;
      }
    });

    // Finalize averages
    if (measure === 'avg') {
      Object.keys(groups).filter(k => !k.includes('_')).forEach(k => {
        const count = groups[`${k}_count`] || 0;
        if (count > 0) {
          groups[k] = groups[`${k}_sum`] / count;
        }
      });
    }

    let result = Object.keys(groups)
      .filter(k => !k.includes('_'))
      .map(k => ({
        name: k,
        value: groups[k]
      }));

    // Apply sorting
    result = applySorting(result, sortBy, 'value');

    return result;
  }, [dimension, measure, measureCol, data, type, series, categoryFilter, sortBy]);

  const toggleSection = (section: string) => {
    const newSections = new Set(openSections);
    if (newSections.has(section)) {
      newSections.delete(section);
    } else {
      newSections.add(section);
    }
    setOpenSections(newSections);
  };

  const handleSave = () => {
    const widget: DashboardWidget = {
      id: initialWidget?.id || generateId(),
      title,
      type,
      dimension,
      width,
      sortBy,
      barOrientation,
      categoryFilter: categoryFilter.length > 0 ? categoryFilter : undefined,
      chartTitle,
      subtitle,
      legend,
      dataLabels,
      xAxis,
      leftYAxis,
      rightYAxis,
      categoryConfig
    };

    // Add series for combo chart
    if (type === 'combo' && series.length > 0) {
      widget.series = series;
    } else {
      // Legacy single-series
      widget.measure = measure;
      widget.measureCol = measureCol || undefined;
    }

    onSave(widget);
    onClose();
  };

  const handleAddSeries = () => {
    setSeriesModal({ isOpen: true, series: null });
  };

  const handleEditSeries = (s: SeriesConfig) => {
    setSeriesModal({ isOpen: true, series: s });
  };

  const handleDeleteSeries = (id: string) => {
    setSeries(series.filter(s => s.id !== id));
  };

  const handleSaveSeries = (newSeries: SeriesConfig) => {
    const existing = series.find(s => s.id === newSeries.id);
    if (existing) {
      setSeries(series.map(s => s.id === newSeries.id ? newSeries : s));
    } else {
      setSeries([...series, newSeries]);
    }
  };

  const handleCategoryToggle = (cat: string) => {
    if (categoryFilter.includes(cat)) {
      setCategoryFilter(categoryFilter.filter(c => c !== cat));
    } else {
      setCategoryFilter([...categoryFilter, cat]);
    }
  };

  const handleSelectAllCategories = () => {
    setCategoryFilter([...allCategories]);
  };

  const handleClearAllCategories = () => {
    setCategoryFilter([]);
  };

  const handleBarDoubleClick = (category: string) => {
    setCategoryModal({ isOpen: true, category });
  };

  const showAxes = type !== 'pie' && type !== 'kpi' && type !== 'wordcloud' && type !== 'table';
  const isComboChart = type === 'combo';
  const isMultiSeriesChart = type === 'combo' || type === 'stacked-bar';

  const filteredCategories = allCategories.filter(cat =>
    cat.toLowerCase().includes(categorySearch.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full h-full max-w-[95vw] max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-blue-50 to-white">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {initialWidget ? 'Edit Chart' : 'Create Chart'}
            </h2>
            <p className="text-sm text-gray-500 mt-1">Configure your visualization</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" style={{ outline: 'none' }}>
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* 2-Column Layout */}
        <div className="flex-1 grid grid-cols-2 gap-6 p-6 overflow-hidden">
          {/* LEFT: Preview */}
          <div className="flex flex-col bg-gray-50 rounded-lg border-2 border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-white border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Live Preview</h3>
              <p className="text-xs text-gray-500 mt-1">
                {isMultiSeriesChart ? (type === 'stacked-bar' ? 'Stacked bar chart (100%)' : 'Multi-series combo chart') : 'Single series chart'}
                {' • '}
                {categoryFilter.length > 0 ? `${categoryFilter.length} categories` : 'All categories'}
              </p>
            </div>

            <div className="flex-1 p-6 overflow-auto">
              {previewData.length > 0 ? (
                <div className="bg-white rounded-lg shadow-sm p-6 h-full">
                  {chartTitle && (
                    <div className="text-center mb-2">
                      <h3 className="text-lg font-bold text-gray-900">{chartTitle}</h3>
                      {subtitle && <p className="text-sm text-gray-600">{subtitle}</p>}
                    </div>
                  )}

                  <ResponsiveContainer width="100%" height={400}>
                    {type === 'pie' ? (
                      <PieChart>
                        <Pie
                          data={previewData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          label={dataLabels.enabled}
                          onDoubleClick={(data: any) => handleBarDoubleClick(data.name)}
                          style={{ cursor: 'pointer', outline: 'none' }}
                        >
                          {previewData.map((entry: any, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={categoryConfig[entry.name]?.color || COLORS[index % COLORS.length]}
                            />
                          ))}
                        </Pie>
                        {legend.enabled && <RechartsLegend />}
                        <Tooltip />
                      </PieChart>
                    ) : isMultiSeriesChart && series.length > 0 ? (
                      <ComposedChart data={previewData} layout={barOrientation === 'horizontal' ? 'vertical' : 'horizontal'}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        {barOrientation === 'vertical' ? (
                          <>
                            <XAxis
                              dataKey="name"
                              angle={xAxis.slant || 0}
                              textAnchor={xAxis.slant ? 'end' : 'middle'}
                              height={xAxis.slant === 90 ? 100 : xAxis.slant === 45 ? 80 : 60}
                              tick={{ fontSize: xAxis.fontSize, fill: xAxis.fontColor }}
                              style={{ outline: 'none' }}
                            />
                            <YAxis
                              yAxisId="left"
                              tick={{ fontSize: leftYAxis.fontSize, fill: leftYAxis.fontColor }}
                              domain={[
                                leftYAxis.min === 'auto' ? 'auto' : leftYAxis.min,
                                leftYAxis.max === 'auto' ? 'auto' : leftYAxis.max
                              ]}
                              style={{ outline: 'none' }}
                            />
                            {series.some(s => s.yAxis === 'right') && (
                              <YAxis
                                yAxisId="right"
                                orientation="right"
                                tick={{ fontSize: rightYAxis.fontSize, fill: rightYAxis.fontColor }}
                                domain={[
                                  rightYAxis.min === 'auto' ? 'auto' : rightYAxis.min,
                                  rightYAxis.max === 'auto' ? 'auto' : rightYAxis.max
                                ]}
                                style={{ outline: 'none' }}
                              />
                            )}
                          </>
                        ) : (
                          <>
                            <XAxis
                              type="number"
                              tick={{ fontSize: leftYAxis.fontSize, fill: leftYAxis.fontColor }}
                              style={{ outline: 'none' }}
                            />
                            <YAxis
                              type="category"
                              dataKey="name"
                              tick={{ fontSize: xAxis.fontSize, fill: xAxis.fontColor }}
                              style={{ outline: 'none' }}
                            />
                          </>
                        )}
                        <Tooltip />
                        {legend.enabled && <RechartsLegend />}

                        {series.map((s) => {
                          if (s.type === 'bar') {
                            return (
                              <Bar
                                key={s.id}
                                dataKey={s.id}
                                name={s.label}
                                fill={s.color}
                                yAxisId={barOrientation === 'vertical' ? s.yAxis : undefined}
                                stackId={type === 'stacked-bar' ? 'stack' : undefined}
                                style={{ outline: 'none' }}
                              />
                            );
                          } else if (s.type === 'line') {
                            return (
                              <Line
                                key={s.id}
                                dataKey={s.id}
                                name={s.label}
                                stroke={s.color}
                                strokeWidth={2}
                                yAxisId={barOrientation === 'vertical' ? s.yAxis : undefined}
                                dot={{ r: 4 }}
                                style={{ outline: 'none' }}
                              />
                            );
                          } else if (s.type === 'area') {
                            return (
                              <Area
                                key={s.id}
                                dataKey={s.id}
                                name={s.label}
                                fill={s.color}
                                stroke={s.color}
                                yAxisId={barOrientation === 'vertical' ? s.yAxis : undefined}
                                style={{ outline: 'none' }}
                              />
                            );
                          }
                          return null;
                        })}
                      </ComposedChart>
                    ) : type === 'line' ? (
                      <ComposedChart data={previewData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis
                          dataKey="name"
                          angle={xAxis.slant || 0}
                          textAnchor={xAxis.slant ? 'end' : 'middle'}
                          height={xAxis.slant === 90 ? 100 : xAxis.slant === 45 ? 80 : 60}
                          tick={{ fontSize: xAxis.fontSize, fill: xAxis.fontColor }}
                          style={{ outline: 'none' }}
                        />
                        <YAxis
                          tick={{ fontSize: leftYAxis.fontSize, fill: leftYAxis.fontColor }}
                          domain={[
                            leftYAxis.min === 'auto' ? 'auto' : leftYAxis.min,
                            leftYAxis.max === 'auto' ? 'auto' : leftYAxis.max
                          ]}
                          style={{ outline: 'none' }}
                        />
                        <Tooltip />
                        {legend.enabled && <RechartsLegend />}
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke={COLORS[0]}
                          strokeWidth={2}
                          dot={{ r: 4 }}
                          style={{ outline: 'none' }}
                        >
                          {dataLabels.enabled && (
                            <LabelList
                              dataKey="value"
                              position={dataLabels.position as any}
                              style={{
                                fontSize: dataLabels.fontSize,
                                fontWeight: dataLabels.fontWeight,
                                fill: dataLabels.color
                              }}
                            />
                          )}
                        </Line>
                      </ComposedChart>
                    ) : (
                      <BarChart
                        data={previewData}
                        layout={barOrientation === 'horizontal' ? 'vertical' : 'horizontal'}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        {barOrientation === 'vertical' ? (
                          <>
                            <XAxis
                              dataKey="name"
                              angle={xAxis.slant || 0}
                              textAnchor={xAxis.slant ? 'end' : 'middle'}
                              height={xAxis.slant === 90 ? 100 : xAxis.slant === 45 ? 80 : 60}
                              tick={{ fontSize: xAxis.fontSize, fill: xAxis.fontColor }}
                              style={{ outline: 'none' }}
                            />
                            <YAxis
                              tick={{ fontSize: leftYAxis.fontSize, fill: leftYAxis.fontColor }}
                              domain={[
                                leftYAxis.min === 'auto' ? 'auto' : leftYAxis.min,
                                leftYAxis.max === 'auto' ? 'auto' : leftYAxis.max
                              ]}
                              style={{ outline: 'none' }}
                            />
                          </>
                        ) : (
                          <>
                            <XAxis
                              type="number"
                              tick={{ fontSize: leftYAxis.fontSize, fill: leftYAxis.fontColor }}
                              style={{ outline: 'none' }}
                            />
                            <YAxis
                              type="category"
                              dataKey="name"
                              tick={{ fontSize: xAxis.fontSize, fill: xAxis.fontColor }}
                              style={{ outline: 'none' }}
                            />
                          </>
                        )}
                        <Tooltip />
                        {legend.enabled && <RechartsLegend />}
                        <Bar
                          dataKey="value"
                          onDoubleClick={(data: any) => handleBarDoubleClick(data.name)}
                          style={{ cursor: 'pointer', outline: 'none' }}
                        >
                          {previewData.map((entry: any, idx) => (
                            <Cell
                              key={`cell-${idx}`}
                              fill={categoryConfig[entry.name]?.color || COLORS[idx % COLORS.length]}
                            />
                          ))}
                          {dataLabels.enabled && (
                            <LabelList
                              dataKey="value"
                              position={dataLabels.position as any}
                              style={{
                                fontSize: dataLabels.fontSize,
                                fontWeight: dataLabels.fontWeight,
                                fill: dataLabels.color
                              }}
                            />
                          )}
                        </Bar>
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400">
                  <p>Select dimension to see preview</p>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Config */}
          <div className="flex flex-col bg-white rounded-lg border-2 border-gray-200 overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b border-gray-200 bg-gray-50">
              <button
                onClick={() => setActiveTab('setup')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'setup'
                    ? 'bg-white text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                style={{ outline: 'none' }}
              >
                Setup
              </button>
              <button
                onClick={() => setActiveTab('customize')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'customize'
                    ? 'bg-white text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                style={{ outline: 'none' }}
              >
                Customize
              </button>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {activeTab === 'setup' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Chart Type</label>
                    <select
                      value={type}
                      onChange={(e) => setType(e.target.value as ChartType)}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                      style={{ outline: 'none' }}
                    >
                      <option value="bar">Bar</option>
                      <option value="line">Line</option>
                      <option value="area">Area</option>
                      <option value="combo">Combo (Bar + Line)</option>
                      <option value="stacked-bar">Stacked Bar (100%)</option>
                      <option value="bubble">Bubble Chart</option>
                      <option value="pie">Pie</option>
                      <option value="kpi">KPI</option>
                      <option value="wordcloud">Word Cloud</option>
                      <option value="table">Table</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Dimension (X-Axis)</label>
                    <select
                      value={dimension}
                      onChange={(e) => setDimension(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                      style={{ outline: 'none' }}
                    >
                      <option value="">Select...</option>
                      {availableColumns.map(col => (
                        <option key={col} value={col}>{col}</option>
                      ))}
                    </select>
                  </div>

                  {/* Series Management for Multi-Series Charts */}
                  {isMultiSeriesChart && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-gray-700">
                          Series ({series.length})
                        </label>
                        <button
                          onClick={handleAddSeries}
                          className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700"
                          style={{ outline: 'none' }}
                        >
                          <Plus className="w-3 h-3" />
                          Add Series
                        </button>
                      </div>

                      <div className="space-y-2">
                        {series.map((s, idx) => (
                          <div
                            key={s.id}
                            className="flex items-center gap-2 p-3 border border-gray-200 rounded bg-gray-50"
                          >
                            <div
                              className="w-4 h-4 rounded"
                              style={{ backgroundColor: s.color }}
                            />
                            <div className="flex-1">
                              <div className="text-sm font-medium text-gray-900">{s.label}</div>
                              <div className="text-xs text-gray-500">
                                {s.type} • {s.yAxis} Y-Axis • {s.measure}
                                {s.measureCol && ` of ${s.measureCol}`}
                              </div>
                            </div>
                            <button
                              onClick={() => handleEditSeries(s)}
                              className="p-1 hover:bg-gray-200 rounded"
                              style={{ outline: 'none' }}
                            >
                              <EditIcon className="w-4 h-4 text-gray-600" />
                            </button>
                            <button
                              onClick={() => handleDeleteSeries(s.id)}
                              className="p-1 hover:bg-red-100 rounded"
                              style={{ outline: 'none' }}
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </button>
                          </div>
                        ))}

                        {series.length === 0 && (
                          <div className="text-center py-4 text-sm text-gray-500">
                            No series added. Click "Add Series" to start.
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Single Series Config (for non-multi-series charts) */}
                  {!isMultiSeriesChart && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Measure</label>
                        <select
                          value={measure}
                          onChange={(e) => setMeasure(e.target.value as AggregateMethod)}
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                          style={{ outline: 'none' }}
                        >
                          <option value="count">Count</option>
                          <option value="sum">Sum</option>
                          <option value="avg">Average</option>
                        </select>
                      </div>

                      {(measure === 'sum' || measure === 'avg') && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Column</label>
                          <select
                            value={measureCol}
                            onChange={(e) => setMeasureCol(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                            style={{ outline: 'none' }}
                          >
                            <option value="">Select...</option>
                            {availableColumns.map(col => (
                              <option key={col} value={col}>{col}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Sort Options */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as SortOrder)}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                      style={{ outline: 'none' }}
                    >
                      <option value="value-desc">Value (High to Low)</option>
                      <option value="value-asc">Value (Low to High)</option>
                      <option value="name-asc">Name (A-Z)</option>
                      <option value="name-desc">Name (Z-A)</option>
                      <option value="original">Original Order (for Dates)</option>
                    </select>
                  </div>

                  {/* Bar Orientation */}
                  {(type === 'bar' || isMultiSeriesChart) && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Bar Orientation</label>
                      <div className="flex gap-4">
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="orientation"
                            value="vertical"
                            checked={barOrientation === 'vertical'}
                            onChange={(e) => setBarOrientation('vertical')}
                            className="mr-2"
                            style={{ outline: 'none' }}
                          />
                          <span className="text-sm">Vertical</span>
                        </label>
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="orientation"
                            value="horizontal"
                            checked={barOrientation === 'horizontal'}
                            onChange={(e) => setBarOrientation('horizontal')}
                            className="mr-2"
                            style={{ outline: 'none' }}
                          />
                          <span className="text-sm">Horizontal</span>
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Category Filter */}
                  {allCategories.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-gray-700">
                          Categories ({categoryFilter.length > 0 ? categoryFilter.length : allCategories.length} of {allCategories.length})
                        </label>
                        <div className="flex gap-2">
                          <button
                            onClick={handleSelectAllCategories}
                            className="text-xs text-blue-600 hover:text-blue-800"
                            style={{ outline: 'none' }}
                          >
                            Select All
                          </button>
                          <button
                            onClick={handleClearAllCategories}
                            className="text-xs text-gray-600 hover:text-gray-800"
                            style={{ outline: 'none' }}
                          >
                            Clear
                          </button>
                        </div>
                      </div>

                      {allCategories.length > 5 && (
                        <div className="mb-2">
                          <div className="relative">
                            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                            <input
                              type="text"
                              value={categorySearch}
                              onChange={(e) => setCategorySearch(e.target.value)}
                              placeholder="Search categories..."
                              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded text-sm"
                              style={{ outline: 'none' }}
                            />
                          </div>
                        </div>
                      )}

                      <div className="border border-gray-200 rounded p-3 max-h-48 overflow-y-auto bg-gray-50">
                        {filteredCategories.map((cat, idx) => (
                          <label
                            key={idx}
                            className="flex items-center py-1.5 px-2 hover:bg-gray-100 rounded cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={categoryFilter.length === 0 || categoryFilter.includes(cat)}
                              onChange={() => handleCategoryToggle(cat)}
                              className="mr-2"
                              style={{ outline: 'none' }}
                            />
                            <span className="text-sm text-gray-900">{cat}</span>
                          </label>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {categoryFilter.length === 0 ? 'All categories shown' : `${categoryFilter.length} selected`}
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Widget Width</label>
                    <select
                      value={width}
                      onChange={(e) => setWidth(e.target.value as any)}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                      style={{ outline: 'none' }}
                    >
                      <option value="half">Half (50%)</option>
                      <option value="full">Full (100%)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Widget Title</label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Enter widget title"
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                      style={{ outline: 'none' }}
                    />
                  </div>
                </div>
              )}

              {activeTab === 'customize' && (
                <div className="space-y-2">
                  <Section
                    title="Titles"
                    icon={<TypeIcon className="w-4 h-4 text-blue-600" />}
                    isOpen={openSections.has('titles')}
                    onToggle={() => toggleSection('titles')}
                  >
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Chart Title</label>
                        <input
                          type="text"
                          value={chartTitle}
                          onChange={(e) => setChartTitle(e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                          style={{ outline: 'none' }}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Subtitle</label>
                        <input
                          type="text"
                          value={subtitle}
                          onChange={(e) => setSubtitle(e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                          style={{ outline: 'none' }}
                        />
                      </div>
                    </div>
                  </Section>

                  <Section
                    title="Data Labels"
                    icon={<TypeIcon className="w-4 h-4 text-green-600" />}
                    isOpen={openSections.has('data-labels')}
                    onToggle={() => toggleSection('data-labels')}
                  >
                    <div className="space-y-3">
                      <label className="flex items-center text-sm">
                        <input
                          type="checkbox"
                          checked={dataLabels.enabled}
                          onChange={(e) => setDataLabels({ ...dataLabels, enabled: e.target.checked })}
                          className="mr-2"
                          style={{ outline: 'none' }}
                        />
                        Show Data Labels
                      </label>

                      {dataLabels.enabled && (
                        <div className="grid grid-cols-2 gap-3 ml-6">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Position</label>
                            <select
                              value={dataLabels.position}
                              onChange={(e) => setDataLabels({ ...dataLabels, position: e.target.value as any })}
                              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                              style={{ outline: 'none' }}
                            >
                              <option value="top">Top</option>
                              <option value="center">Center</option>
                              <option value="bottom">Bottom</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Font Size: {dataLabels.fontSize}px</label>
                            <input
                              type="range"
                              min="8"
                              max="24"
                              value={dataLabels.fontSize}
                              onChange={(e) => setDataLabels({ ...dataLabels, fontSize: parseInt(e.target.value) })}
                              className="w-full"
                              style={{ outline: 'none' }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </Section>

                  <Section
                    title="Legend"
                    icon={<Palette className="w-4 h-4 text-purple-600" />}
                    isOpen={openSections.has('legend')}
                    onToggle={() => toggleSection('legend')}
                  >
                    <div className="space-y-3">
                      <label className="flex items-center text-sm">
                        <input
                          type="checkbox"
                          checked={legend.enabled}
                          onChange={(e) => setLegend({ ...legend, enabled: e.target.checked })}
                          className="mr-2"
                          style={{ outline: 'none' }}
                        />
                        Show Legend
                      </label>

                      {legend.enabled && (
                        <div className="grid grid-cols-2 gap-3 ml-6">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Position</label>
                            <select
                              value={legend.position}
                              onChange={(e) => setLegend({ ...legend, position: e.target.value as any })}
                              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                              style={{ outline: 'none' }}
                            >
                              <option value="top">Top</option>
                              <option value="bottom">Bottom</option>
                              <option value="left">Left</option>
                              <option value="right">Right</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Font Size: {legend.fontSize}px</label>
                            <input
                              type="range"
                              min="8"
                              max="16"
                              value={legend.fontSize}
                              onChange={(e) => setLegend({ ...legend, fontSize: parseInt(e.target.value) })}
                              className="w-full"
                              style={{ outline: 'none' }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </Section>

                  {showAxes && (
                    <>
                      <Section
                        title="X-Axis"
                        icon={<SlidersIcon className="w-4 h-4 text-indigo-600" />}
                        isOpen={openSections.has('x-axis')}
                        onToggle={() => toggleSection('x-axis')}
                      >
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Title</label>
                            <input
                              type="text"
                              value={xAxis.title || ''}
                              onChange={(e) => setXAxis({ ...xAxis, title: e.target.value })}
                              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                              style={{ outline: 'none' }}
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Font Size: {xAxis.fontSize}px</label>
                              <input
                                type="range"
                                min="8"
                                max="16"
                                value={xAxis.fontSize || 11}
                                onChange={(e) => setXAxis({ ...xAxis, fontSize: parseInt(e.target.value) })}
                                className="w-full"
                                style={{ outline: 'none' }}
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Label Slant</label>
                              <select
                                value={xAxis.slant || 0}
                                onChange={(e) => setXAxis({ ...xAxis, slant: parseInt(e.target.value) as any })}
                                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                                style={{ outline: 'none' }}
                              >
                                <option value={0}>0°</option>
                                <option value={45}>45°</option>
                                <option value={90}>90°</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      </Section>

                      <Section
                        title="Left Y-Axis"
                        icon={<SlidersIcon className="w-4 h-4 text-pink-600" />}
                        isOpen={openSections.has('left-y-axis')}
                        onToggle={() => toggleSection('left-y-axis')}
                      >
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Title</label>
                            <input
                              type="text"
                              value={leftYAxis.title || ''}
                              onChange={(e) => setLeftYAxis({ ...leftYAxis, title: e.target.value })}
                              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                              style={{ outline: 'none' }}
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Min</label>
                              <input
                                type="text"
                                value={leftYAxis.min === 'auto' ? 'auto' : leftYAxis.min || 'auto'}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setLeftYAxis({ ...leftYAxis, min: val === 'auto' ? 'auto' : parseFloat(val) || 0 });
                                }}
                                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                                placeholder="auto"
                                style={{ outline: 'none' }}
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Max</label>
                              <input
                                type="text"
                                value={leftYAxis.max === 'auto' ? 'auto' : leftYAxis.max || 'auto'}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setLeftYAxis({ ...leftYAxis, max: val === 'auto' ? 'auto' : parseFloat(val) || 0 });
                                }}
                                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                                placeholder="auto"
                                style={{ outline: 'none' }}
                              />
                            </div>
                          </div>
                        </div>
                      </Section>

                      {isComboChart && (
                        <Section
                          title="Right Y-Axis"
                          icon={<SlidersIcon className="w-4 h-4 text-orange-600" />}
                          isOpen={openSections.has('right-y-axis')}
                          onToggle={() => toggleSection('right-y-axis')}
                        >
                          <div className="space-y-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Title</label>
                              <input
                                type="text"
                                value={rightYAxis.title || ''}
                                onChange={(e) => setRightYAxis({ ...rightYAxis, title: e.target.value })}
                                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                                style={{ outline: 'none' }}
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Min</label>
                                <input
                                  type="text"
                                  value={rightYAxis.min === 'auto' ? 'auto' : rightYAxis.min || 'auto'}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setRightYAxis({ ...rightYAxis, min: val === 'auto' ? 'auto' : parseFloat(val) || 0 });
                                  }}
                                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                                  placeholder="auto"
                                  style={{ outline: 'none' }}
                                />
                              </div>

                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Max</label>
                                <input
                                  type="text"
                                  value={rightYAxis.max === 'auto' ? 'auto' : rightYAxis.max || 'auto'}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setRightYAxis({ ...rightYAxis, max: val === 'auto' ? 'auto' : parseFloat(val) || 0 });
                                  }}
                                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                                  placeholder="auto"
                                  style={{ outline: 'none' }}
                                />
                              </div>
                            </div>
                          </div>
                        </Section>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-5 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
            style={{ outline: 'none' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
            style={{ outline: 'none' }}
          >
            <Save className="w-4 h-4" />
            Save Chart
          </button>
        </div>
      </div>

      {seriesModal.isOpen && (
        <SeriesConfigModal
          isOpen={seriesModal.isOpen}
          series={seriesModal.series}
          availableColumns={availableColumns}
          onClose={() => setSeriesModal({ isOpen: false, series: null })}
          onSave={handleSaveSeries}
        />
      )}

      {categoryModal && (
        <CategoryConfigModal
          isOpen={categoryModal.isOpen}
          category={categoryModal.category}
          config={categoryConfig[categoryModal.category] || {}}
          onClose={() => setCategoryModal(null)}
          onSave={(config) => {
            setCategoryConfig({
              ...categoryConfig,
              [categoryModal.category]: config
            });
          }}
        />
      )}
    </div>
  );
};

export default ChartBuilder;
