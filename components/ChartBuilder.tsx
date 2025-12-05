/**
 * ChartBuilder v6.0 - Complete Chart System Redesign
 *
 * NEW FEATURES:
 * - Chart Type Selector Screen (Google Sheets style)
 * - Chart-specific configuration forms
 * - 23 chart types with proper metadata
 * - Stack By field for stacked charts
 * - Bubble chart support (3D scatter)
 * - Pie/Donut specific configs
 * - Line curve types
 *
 * PREVIOUS FIXES (v5.1):
 * 1. Column Field shows in Series Modal
 * 2. Sort Options (5 types)
 * 3. Bar Orientation
 * 4. Category Filter
 * 5. Double-click colors
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
import { ChartTheme, CLASSIC_ANALYTICS_THEME } from '../constants/chartTheme';
import ChartTypeSelector from './ChartTypeSelector';
import ChartConfigForm from './ChartConfigForm';
import { getChartSupports, getDefaultOrientation, validateChartConfig } from '../utils/chartConfigHelpers';
import WidgetRenderer from './WidgetRenderer';
import { buildColumnProfiles } from '../utils/columnProfiles';
import { buildFieldErrors, getConstraintsForType, hasBlockingErrors } from '../utils/chartValidation';
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
  chartTheme?: ChartTheme;
}

const generateId = () => 'w-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 9);

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#6366F1'];
const COLOR_SWATCHES = [
  '#1D4ED8', '#3B82F6', '#06B6D4', '#0EA5E9', '#22C55E', '#16A34A', '#F59E0B', '#F97316',
  '#EF4444', '#DC2626', '#8B5CF6', '#A855F7', '#EC4899', '#DB2777', '#14B8A6', '#0F766E',
  '#111827', '#4B5563', '#9CA3AF', '#D1D5DB'
];

const createDefaultLegend = (): LegendConfig => ({
  enabled: true,
  position: 'bottom',
  fontSize: 11,
  fontColor: '#666666',
  alignment: 'center'
});

const createDefaultDataLabels = (): DataLabelConfig => ({
  enabled: false,
  position: 'top',
  fontSize: 11,
  fontWeight: 'normal',
  color: '#000000',
  showPercent: false,
  percentPlacement: 'suffix',
  percentDecimals: 1
});

const createDefaultAxis = (overrides: Partial<AxisConfig> = {}): AxisConfig => ({
  title: '',
  min: 'auto',
  max: 'auto',
  fontSize: 11,
  fontColor: '#666666',
  format: '#,##0',
  showGridlines: true,
  gridColor: '#E5E7EB',
  slant: 0,
  ...overrides
});

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
            <div className="grid grid-cols-10 gap-2 mb-3">
              {COLOR_SWATCHES.map((swatch) => (
                <button
                  key={swatch}
                  type="button"
                  onClick={() => setColor(swatch)}
                  className={`h-7 w-7 rounded border ${color === swatch ? 'ring-2 ring-blue-500 border-blue-200' : 'border-gray-200'}`}
                  style={{ backgroundColor: swatch }}
                />
              ))}
            </div>
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
          <div className="grid grid-cols-10 gap-2 mb-3">
            {COLOR_SWATCHES.map((swatch) => (
              <button
                key={swatch}
                type="button"
                onClick={() => setColor(swatch)}
                className={`h-7 w-7 rounded border ${color === swatch ? 'ring-2 ring-blue-500 border-blue-200' : 'border-gray-200'}`}
                style={{ backgroundColor: swatch }}
              />
            ))}
          </div>
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
  data,
  chartTheme = CLASSIC_ANALYTICS_THEME
}) => {
  // UI State
  const [showTypeSelector, setShowTypeSelector] = useState(true); // Show type selector first
  const [activeTab, setActiveTab] = useState<'setup' | 'customize'>('setup');

  // Widget state
  const [title, setTitle] = useState('New Chart');
  const [type, setType] = useState<ChartType | null>(null); // null until selected
  const [dimension, setDimension] = useState('');
  const [width, setWidth] = useState<'half' | 'full'>('half');

  // Stacked Charts
  const [stackBy, setStackBy] = useState('');

  // Bubble/Scatter
  const [xDimension, setXDimension] = useState('');
  const [yDimension, setYDimension] = useState('');
  const [sizeDimension, setSizeDimension] = useState('');
  const [colorBy, setColorBy] = useState('');

  // Pie/Donut
  const [innerRadius, setInnerRadius] = useState(0);
  const [startAngle, setStartAngle] = useState(0);

  // Line
  const [curveType, setCurveType] = useState<'linear' | 'monotone' | 'step'>('linear');
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [barSize, setBarSize] = useState(22);
  const [categoryGap, setCategoryGap] = useState(20);

  // Sort & Filter
  const [sortBy, setSortBy] = useState<SortOrder>('value-desc');
  const [topNEnabled, setTopNEnabled] = useState(false);
  const [topNCount, setTopNCount] = useState(5);
  const [groupOthers, setGroupOthers] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [categorySearch, setCategorySearch] = useState('');

  // Bar Orientation (deprecated - now determined by chart type)
  const [barOrientation, setBarOrientation] = useState<'vertical' | 'horizontal'>('vertical');

  // Multiple Series (for Combo charts)
const [series, setSeries] = useState<SeriesConfig[]>([]);
const [sortSeriesId, setSortSeriesId] = useState('');

  // Legacy single-series (for backward compatibility)
  const [measure, setMeasure] = useState<AggregateMethod>('count');
  const [measureCol, setMeasureCol] = useState('');
  const [categoryConfig, setCategoryConfig] = useState<Record<string, CategoryConfig>>({});

  // Style state
  const [chartTitle, setChartTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [legend, setLegend] = useState<LegendConfig>(createDefaultLegend);
  const [dataLabels, setDataLabels] = useState<DataLabelConfig>(createDefaultDataLabels);

  // Axes state
  const [xAxis, setXAxis] = useState<AxisConfig>(() => createDefaultAxis({ min: undefined, max: undefined, format: undefined }));
  const [leftYAxis, setLeftYAxis] = useState<AxisConfig>(createDefaultAxis);
  const [rightYAxis, setRightYAxis] = useState<AxisConfig>(createDefaultAxis);
  const [valueFormat, setValueFormat] = useState<'number' | 'compact' | 'percent' | 'currency'>('number');

  // UI state
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());
  const [seriesModal, setSeriesModal] = useState<{ isOpen: boolean; series: SeriesConfig | null }>({ isOpen: false, series: null });
  const [categoryModal, setCategoryModal] = useState<{ isOpen: boolean; category: string } | null>(null);

  const resetBuilderState = useCallback(() => {
    setShowTypeSelector(true);
    setActiveTab('setup');
    setTitle('New Chart');
    setType(null);
    setDimension(availableColumns[0] || '');
    setWidth('half');
    setStackBy('');
    setXDimension('');
    setYDimension('');
    setSizeDimension('');
    setColorBy('');
    setInnerRadius(0);
    setStartAngle(0);
    setCurveType('linear');
    setStrokeWidth(2);
    setBarSize(22);
    setCategoryGap(20);
    setSortBy('value-desc');
    setTopNEnabled(false);
    setTopNCount(5);
    setGroupOthers(true);
    setCategoryFilter([]);
    setCategorySearch('');
    setBarOrientation('vertical');
    setSeries([]);
    setSortSeriesId('');
    setMeasure('count');
    setMeasureCol('');
    setCategoryConfig({});
    setChartTitle('');
    setSubtitle('');
    setLegend(createDefaultLegend());
    setDataLabels(createDefaultDataLabels());
    setXAxis(createDefaultAxis({ min: undefined, max: undefined, format: undefined }));
    setLeftYAxis(createDefaultAxis());
    setRightYAxis(createDefaultAxis());
    setValueFormat('number');
    setOpenSections(new Set());
    setSeriesModal({ isOpen: false, series: null });
    setCategoryModal(null);
  }, [availableColumns]);

  // Initialize
  useEffect(() => {
    if (!isOpen) return;

    if (initialWidget) {
      setShowTypeSelector(false);
      setActiveTab('setup');
      setTitle(initialWidget.title);
      setType(initialWidget.type);
      setDimension(initialWidget.dimension);
      setWidth(initialWidget.width);
      setSortBy(initialWidget.sortBy || 'value-desc');
      if (typeof initialWidget.topN === 'number' && initialWidget.topN > 0) {
        setTopNEnabled(true);
        setTopNCount(initialWidget.topN);
        setGroupOthers(initialWidget.groupOthers !== false);
      } else {
        setTopNEnabled(false);
        setTopNCount(5);
        setGroupOthers(true);
      }
      setBarOrientation(initialWidget.barOrientation || 'vertical');
      setCategoryFilter(initialWidget.categoryFilter || []);
      setChartTitle(initialWidget.chartTitle || initialWidget.title);
      setSubtitle(initialWidget.subtitle || '');

      if (initialWidget.series && initialWidget.series.length > 0) {
        setSeries(initialWidget.series);
        setSortSeriesId(initialWidget.sortSeriesId || initialWidget.series[0]?.id || '');
      } else {
        setMeasure(initialWidget.measure || 'count');
        setMeasureCol(initialWidget.measureCol || '');
        setSortSeriesId('');
      }

      setCategoryConfig(initialWidget.categoryConfig || {});
      setLegend(initialWidget.legend || createDefaultLegend());
      setDataLabels(initialWidget.dataLabels || createDefaultDataLabels());
      setXAxis(initialWidget.xAxis || createDefaultAxis({ min: undefined, max: undefined, format: undefined }));
      setLeftYAxis(initialWidget.leftYAxis || createDefaultAxis());
      setRightYAxis(initialWidget.rightYAxis || createDefaultAxis());
      setBarSize(initialWidget.barSize || 22);
      setCategoryGap(initialWidget.categoryGap ?? 20);
      if (initialWidget.valueFormat) {
        setValueFormat(initialWidget.valueFormat);
      } else if (['100-stacked-column', '100-stacked-bar', '100-stacked-area'].includes(initialWidget.type)) {
        setValueFormat('percent');
      } else {
        setValueFormat('number');
      }
    } else {
      resetBuilderState();
    }
  }, [isOpen, initialWidget, availableColumns, resetBuilderState]);

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

  const sortByTotals = (rows: any[], order: SortOrder) => {
    const withTotals = rows.map((row) => ({
      ...row,
      __total: Object.keys(row)
        .filter((k) => k !== 'name')
        .reduce((sum, key) => sum + (row[key] || 0), 0)
    }));

    const sorted = applySorting(withTotals, order, '__total');
    return sorted.map(({ __total, ...rest }) => rest);
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
    if (!type) return;

    if (blockingErrors) {
      setActiveTab('setup');
      alert('Please fix the highlighted fields before saving.');
      return;
    }
    const errors = validateChartConfig(type, {
      dimension,
      stackBy,
      measure,
      measureCol,
      series,
      xDimension,
      yDimension,
      sizeDimension
    });

    if (errors.length > 0) {
      alert(errors.join('\n'));
      return;
    }

    const widget: DashboardWidget = {
      id: initialWidget?.id || generateId(),
      title,
      type: type!,
      dimension,
      width,
      sortBy,
      barOrientation,
      categoryFilter: categoryFilter.length > 0 ? categoryFilter : undefined,
      sortSeriesId: sortSeriesId || undefined,
      chartTitle,
      subtitle,
      legend,
      dataLabels,
      xAxis,
      leftYAxis,
      rightYAxis,
      barSize,
      categoryGap,
      topN: topNEnabled ? Math.max(1, topNCount) : undefined,
      groupOthers: topNEnabled ? groupOthers : undefined,
      valueFormat,
      categoryConfig,

      // Stacked charts
      stackBy: stackBy || undefined,

      // Bubble/Scatter
      xDimension: xDimension || undefined,
      yDimension: yDimension || undefined,
      sizeDimension: sizeDimension || undefined,
      colorBy: colorBy || undefined,

      // Pie/Donut
      innerRadius: type === 'donut' ? innerRadius : undefined,
      startAngle: (type === 'pie' || type === 'donut') ? startAngle : undefined,

      // Line
      curveType: (type === 'line' || type === 'smooth-line' || type?.includes('area')) ? curveType : undefined,
      strokeWidth: (type === 'line' || type === 'smooth-line' || type?.includes('area')) ? strokeWidth : undefined
    };

    // Add series for multi-series charts
    if (supports?.multiSeries && series.length > 0) {
      widget.series = series;
    } else {
      // Single-series
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
      if (!sortSeriesId) {
        setSortSeriesId(newSeries.id);
      }
    }
  };

  const handleSeriesChange = (id: string, changes: Partial<SeriesConfig>) => {
    setSeries(prev =>
      prev.map(s => (s.id === id ? { ...s, ...changes } : s))
    );
  };

  useEffect(() => {
    if (sortSeriesId && !series.find(s => s.id === sortSeriesId)) {
      setSortSeriesId(series[0]?.id || '');
    }
  }, [series, sortSeriesId]);

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

  const handlePreviewCategoryClick = (category: string) => {
    if (!category) return;
    setActiveTab('customize');
    setCategoryModal({ isOpen: true, category });
  };

  // Handle chart type selection
  const handleChartTypeSelect = (selectedType: ChartType) => {
    setType(selectedType);
    setShowTypeSelector(false);
    setActiveTab('setup');

    // Set default orientation based on chart type
    const defaultOrientation = getDefaultOrientation(selectedType);
    setBarOrientation(defaultOrientation);

    const supports = getChartSupports(selectedType);

    // Reset fields based on type
    setDimension(supports.dimension ? (availableColumns[0] || '') : '');
    setStackBy('');
    setSeries([]);
    setSortSeriesId('');
    setMeasure('count');
    setMeasureCol('');
    setCategoryFilter([]);
    setCategoryConfig({});
    setXDimension('');
    setYDimension('');
    setSizeDimension('');
    setColorBy('');
    setInnerRadius(selectedType === 'donut' ? 50 : 0);
    setStartAngle(0);
    setCurveType(selectedType === 'smooth-line' ? 'monotone' : 'linear');
    setStrokeWidth(2);
    setBarSize(22);
    setCategoryGap(20);
    setLegend(createDefaultLegend());
    setDataLabels(createDefaultDataLabels());
    setXAxis(createDefaultAxis({ min: undefined, max: undefined, format: undefined }));

    if (['100-stacked-column', '100-stacked-bar', '100-stacked-area'].includes(selectedType)) {
      setLeftYAxis(createDefaultAxis({ min: 0, max: 1, format: '0%' }));
      setValueFormat('percent');
    } else {
      setLeftYAxis(createDefaultAxis());
      setValueFormat('number');
    }

    setRightYAxis(createDefaultAxis());
  };

  const handleCloseTypeSelector = () => {
    if (!type) {
      onClose();
      return;
    }

    setShowTypeSelector(false);
  };

  const supports = type ? getChartSupports(type) : null;
  const columnProfiles = useMemo(() => buildColumnProfiles(data), [data]);
  const fieldConstraints = useMemo(() => getConstraintsForType(type ?? null), [type]);
  const fieldState = useMemo(
    () => ({
      dimension,
      stackBy,
      measure,
      measureCol,
      xDimension,
      yDimension,
      sizeDimension,
      colorBy
    }),
    [dimension, stackBy, measure, measureCol, xDimension, yDimension, sizeDimension, colorBy]
  );
  const fieldErrors = useMemo(
    () => buildFieldErrors(type, fieldState, columnProfiles),
    [type, fieldState, columnProfiles]
  );
  const blockingErrors = hasBlockingErrors(fieldErrors);
  const previewWidget = useMemo<DashboardWidget | null>(() => {
    if (!type) return null;
    return {
      id: initialWidget?.id || 'preview',
      title: title || 'Untitled',
      type,
      width,
      dimension,
      stackBy: stackBy || undefined,
      measure,
      measureCol: measureCol || undefined,
      series: series.length > 0 ? series : undefined,
      sortSeriesId: sortSeriesId || undefined,
      xDimension: xDimension || undefined,
      yDimension: yDimension || undefined,
      sizeDimension: sizeDimension || undefined,
      colorBy: colorBy || undefined,
      chartTitle: chartTitle || title,
      subtitle,
      legend,
      dataLabels,
      innerRadius: type === 'donut' ? innerRadius : undefined,
      startAngle: (type === 'pie' || type === 'donut') ? startAngle : undefined,
      curveType,
      strokeWidth,
      categoryFilter: categoryFilter.length > 0 ? categoryFilter : undefined,
      sortBy,
      barOrientation,
      barSize,
      categoryGap,
      topN: topNEnabled ? Math.max(1, topNCount) : undefined,
      groupOthers: topNEnabled ? groupOthers : undefined,
      categoryConfig,
      filters: [],
      xAxis,
      leftYAxis,
      rightYAxis,
      valueFormat
    } as DashboardWidget;
  }, [
    type,
    initialWidget?.id,
    title,
    width,
    dimension,
    stackBy,
    measure,
    measureCol,
    series,
    xDimension,
    yDimension,
    sizeDimension,
    colorBy,
    chartTitle,
    subtitle,
    legend,
    dataLabels,
    innerRadius,
    startAngle,
    curveType,
    strokeWidth,
    categoryFilter,
    sortBy,
    barOrientation,
    barSize,
    categoryGap,
    topNEnabled,
    topNCount,
    groupOthers,
    categoryConfig,
    xAxis,
    leftYAxis,
    rightYAxis,
    valueFormat,
    sortSeriesId
  ]);
  const showAxes = Boolean(supports?.axes);
  const isComboChart = type === 'combo';
  const isMultiSeriesChart = supports?.multiSeries;

  const filteredCategories = allCategories.filter(cat =>
    cat.toLowerCase().includes(categorySearch.toLowerCase())
  );

  if (!isOpen) return null;

  // Show ChartTypeSelector if no type selected
  if (showTypeSelector || type === null) {
    return (
      <ChartTypeSelector
        isOpen={true}
        onSelect={handleChartTypeSelect}
        onClose={handleCloseTypeSelector}
      />
    );
  }

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
                {previewWidget ? 'Preview matches what will appear on the dashboard' : 'Pick a chart type to start configuring'}
              </p>
            </div>
            <div className="flex-1 bg-white">
              {previewWidget ? (
                <div className="h-full relative">
                  <WidgetRenderer
                    widget={previewWidget}
                    data={data}
                    onValueClick={handlePreviewCategoryClick}
                    theme={chartTheme}
                  />
                  {/* Interactive overlay for quick access to panels */}
                  <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
                    <div className="flex justify-end p-2">
                      <button
                        type="button"
                        className="pointer-events-auto px-2 py-1 text-[11px] rounded bg-white/80 border border-gray-300 text-gray-700 hover:bg-gray-100"
                        onClick={() => {
                          setActiveTab('customize');
                          toggleSection('legend');
                        }}
                        style={{ outline: 'none' }}
                      >
                        Legend
                      </button>
                    </div>
                    <div className="flex justify-between items-end px-2 pb-2">
                      <button
                        type="button"
                        className="pointer-events-auto px-2 py-1 text-[11px] rounded bg-white/80 border border-gray-300 text-gray-700 hover:bg-gray-100"
                        onClick={() => {
                          setActiveTab('customize');
                          toggleSection('left-y-axis');
                        }}
                        style={{ outline: 'none' }}
                      >
                        Y-Axis
                      </button>
                      <button
                        type="button"
                        className="pointer-events-auto px-2 py-1 text-[11px] rounded bg-white/80 border border-gray-300 text-gray-700 hover:bg-gray-100"
                        onClick={() => {
                          setActiveTab('customize');
                          toggleSection('x-axis');
                        }}
                        style={{ outline: 'none' }}
                      >
                        X-Axis
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                  Select chart settings to see preview
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
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Widget Title</label>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                        placeholder="e.g., Top Posts by Channel"
                        style={{ outline: 'none' }}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Dashboard Width</label>
                      <select
                        value={width}
                        onChange={(e) => setWidth(e.target.value as 'half' | 'full')}
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                        style={{ outline: 'none' }}
                      >
                        <option value="half">Half (1 column)</option>
                        <option value="full">Full (2 columns)</option>
                      </select>
                      <p className="text-[11px] text-gray-500 mt-1">Full width spans the entire dashboard row.</p>
                    </div>
                  </div>

                  {/* Chart Type Info with Change Button */}
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-gray-600">Chart Type</p>
                        <p className="text-base font-semibold text-gray-900 mt-1">
                          {type && type.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                        </p>
                      </div>
                      <button
                        onClick={() => setShowTypeSelector(true)}
                        className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
                      >
                        Change Type
                      </button>
                    </div>
                  </div>

                  {/* Chart Config Form */}
                  <ChartConfigForm
                    chartType={type!}
                    availableColumns={availableColumns}
                    columnProfiles={columnProfiles}
                    fieldConstraints={fieldConstraints}
                    fieldErrors={fieldErrors}
                    dimension={dimension}
                    setDimension={setDimension}
                    stackBy={stackBy}
                    setStackBy={setStackBy}
                    measure={measure}
                    setMeasure={setMeasure}
                    measureCol={measureCol}
                    setMeasureCol={setMeasureCol}
                    series={series}
                    sortSeriesId={sortSeriesId}
                    setSortSeriesId={setSortSeriesId}
                    onAddSeries={handleAddSeries}
                    onEditSeries={handleEditSeries}
                    onDeleteSeries={handleDeleteSeries}
                    xDimension={xDimension}
                    setXDimension={setXDimension}
                    yDimension={yDimension}
                    setYDimension={setYDimension}
                    sizeDimension={sizeDimension}
                    setSizeDimension={setSizeDimension}
                    colorBy={colorBy}
                    setColorBy={setColorBy}
                    innerRadius={innerRadius}
                    setInnerRadius={setInnerRadius}
                    startAngle={startAngle}
                    setStartAngle={setStartAngle}
                    curveType={curveType}
                    setCurveType={setCurveType}
                    strokeWidth={strokeWidth}
                    setStrokeWidth={setStrokeWidth}
                    barSize={barSize}
                    setBarSize={setBarSize}
                    sortBy={sortBy}
                    setSortBy={setSortBy}
                    topNEnabled={topNEnabled}
                    setTopNEnabled={setTopNEnabled}
                    topNCount={topNCount}
                    setTopNCount={setTopNCount}
                    groupOthers={groupOthers}
                    setGroupOthers={setGroupOthers}
                    categoryFilter={categoryFilter}
                    setCategoryFilter={setCategoryFilter}
                    allCategories={allCategories}
                    categorySearch={categorySearch}
                    setCategorySearch={setCategorySearch}
                    onCategoryToggle={handleCategoryToggle}
                    onSelectAllCategories={handleSelectAllCategories}
                    onClearAllCategories={handleClearAllCategories}
                    onSeriesChange={handleSeriesChange}
                  />
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

                  {supports?.dataLabels && (
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

                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Font Weight</label>
                              <select
                                value={dataLabels.fontWeight}
                                onChange={(e) => setDataLabels({ ...dataLabels, fontWeight: e.target.value as 'normal' | 'bold' })}
                                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                                style={{ outline: 'none' }}
                              >
                                <option value="normal">Regular</option>
                                <option value="bold">Bold</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Text Color</label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="color"
                                  value={dataLabels.color}
                                  onChange={(e) => setDataLabels({ ...dataLabels, color: e.target.value })}
                                  className="h-8 w-8 rounded border border-gray-200"
                                  style={{ outline: 'none' }}
                                />
                                <input
                                  type="text"
                                  value={dataLabels.color}
                                  onChange={(e) => setDataLabels({ ...dataLabels, color: e.target.value })}
                                  className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs font-mono"
                                  style={{ outline: 'none' }}
                                />
                              </div>
                            </div>

                            <div className="col-span-2">
                              <label className="flex items-center text-sm mb-2">
                                <input
                                  type="checkbox"
                                  checked={dataLabels.showPercent ?? false}
                                  onChange={(e) => setDataLabels({ ...dataLabels, showPercent: e.target.checked })}
                                  className="mr-2"
                                  style={{ outline: 'none' }}
                                />
                                Append Percent Share
                              </label>
                              {dataLabels.showPercent && (
                                <div className="grid grid-cols-2 gap-3 pl-4">
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Placement</label>
                                    <select
                                      value={dataLabels.percentPlacement || 'suffix'}
                                      onChange={(e) => setDataLabels({ ...dataLabels, percentPlacement: e.target.value as 'prefix' | 'suffix' })}
                                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                                      style={{ outline: 'none' }}
                                    >
                                      <option value="prefix">% before value</option>
                                      <option value="suffix">% after value</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                      Decimal Places: {dataLabels.percentDecimals ?? 1}
                                    </label>
                                    <input
                                      type="range"
                                      min="0"
                                      max="4"
                                      value={dataLabels.percentDecimals ?? 1}
                                      onChange={(e) => setDataLabels({ ...dataLabels, percentDecimals: parseInt(e.target.value, 10) })}
                                      className="w-full"
                                      style={{ outline: 'none' }}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </Section>
                  )}

                  {supports?.legend && (
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

                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Alignment</label>
                              <select
                                value={legend.alignment || 'center'}
                                onChange={(e) => setLegend({ ...legend, alignment: e.target.value as 'left' | 'center' | 'right' })}
                                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                                style={{ outline: 'none' }}
                              >
                                <option value="left">Left</option>
                                <option value="center">Center</option>
                                <option value="right">Right</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Text Color</label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="color"
                                  value={legend.fontColor || '#666666'}
                                  onChange={(e) => setLegend({ ...legend, fontColor: e.target.value })}
                                  className="h-8 w-8 rounded border border-gray-200"
                                  style={{ outline: 'none' }}
                                />
                                <input
                                  type="text"
                                  value={legend.fontColor || '#666666'}
                                  onChange={(e) => setLegend({ ...legend, fontColor: e.target.value })}
                                  className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs font-mono"
                                  style={{ outline: 'none' }}
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </Section>
                  )}

                  {showAxes && (
                    <>
                      <Section
                        title="Layout"
                        icon={<SlidersIcon className="w-4 h-4 text-gray-700" />}
                        isOpen={openSections.has('layout')}
                        onToggle={() => toggleSection('layout')}
                      >
                        <div className="space-y-4">
                          {(type === 'combo' ||
                            type === 'column' ||
                            type === 'stacked-column' ||
                            type === '100-stacked-column' ||
                            type === 'bar' ||
                            type === 'stacked-bar' ||
                            type === '100-stacked-bar') && (
                            <>
                              <div>
                                <div className="flex items-center justify-between">
                                  <label className="block text-xs font-medium text-gray-700">
                                    Bar Thickness
                                  </label>
                                  <span className="text-[11px] text-gray-500">{barSize}px</span>
                                </div>
                                <input
                                  type="range"
                                  min={4}
                                  max={120}
                                  step={2}
                                  value={barSize}
                                  onChange={(e) => setBarSize(parseInt(e.target.value, 10))}
                                  className="w-full mt-1"
                                  style={{ outline: 'none' }}
                                />
                                <p className="text-[11px] text-gray-500 mt-1">
                                  Lower = thin columns, Higher = solid blocks (applies to dashboard & preview)
                                </p>
                              </div>

                              <div>
                                <div className="flex items-center justify-between">
                                  <label className="block text-xs font-medium text-gray-700">
                                    Category Spacing
                                  </label>
                                  <span className="text-[11px] text-gray-500">{categoryGap}%</span>
                                </div>
                                <input
                                  type="range"
                                  min={0}
                                  max={60}
                                  value={categoryGap}
                                  onChange={(e) => setCategoryGap(parseInt(e.target.value, 10))}
                                  className="w-full mt-1"
                                  style={{ outline: 'none' }}
                                />
                                <p className="text-[11px] text-gray-500 mt-1">
                                  Adjusts spacing between category groups (0 = packed, 60 = airy).
                                </p>
                              </div>
                            </>
                          )}
                        </div>
                      </Section>
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
                              <label className="block text-xs font-medium text-gray-700 mb-1">Font Size: {xAxis.fontSize ?? 11}px</label>
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

                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Label Color</label>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={xAxis.fontColor || '#666666'}
                                onChange={(e) => setXAxis({ ...xAxis, fontColor: e.target.value })}
                                className="h-8 w-8 rounded border border-gray-200"
                                style={{ outline: 'none' }}
                              />
                              <input
                                type="text"
                                value={xAxis.fontColor || '#666666'}
                                onChange={(e) => setXAxis({ ...xAxis, fontColor: e.target.value })}
                                className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs font-mono"
                                style={{ outline: 'none' }}
                              />
                            </div>
                          </div>

                          <label className="flex items-center text-xs font-medium text-gray-700">
                            <input
                              type="checkbox"
                              className="mr-2"
                              checked={xAxis.showGridlines !== false}
                              onChange={(e) => setXAxis({ ...xAxis, showGridlines: e.target.checked })}
                              style={{ outline: 'none' }}
                            />
                            Show Gridlines
                          </label>

                          {xAxis.showGridlines !== false && (
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Gridline Color</label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="color"
                                  value={xAxis.gridColor || '#E5E7EB'}
                                  onChange={(e) => setXAxis({ ...xAxis, gridColor: e.target.value })}
                                  className="h-8 w-8 rounded border border-gray-200"
                                  style={{ outline: 'none' }}
                                />
                                <input
                                  type="text"
                                  value={xAxis.gridColor || '#E5E7EB'}
                                  onChange={(e) => setXAxis({ ...xAxis, gridColor: e.target.value })}
                                  className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs font-mono"
                                  style={{ outline: 'none' }}
                                />
                              </div>
                            </div>
                          )}
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

                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Font Size: {leftYAxis.fontSize ?? 11}px</label>
                          <input
                            type="range"
                            min="8"
                            max="18"
                            value={leftYAxis.fontSize || 11}
                            onChange={(e) => setLeftYAxis({ ...leftYAxis, fontSize: parseInt(e.target.value) })}
                            className="w-full"
                            style={{ outline: 'none' }}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Min</label>
                            <input
                              type="text"
                              value={leftYAxis.min === 'auto' || leftYAxis.min === undefined || leftYAxis.min === null ? '' : leftYAxis.min}
                              onChange={(e) => {
                                const val = e.target.value.trim();
                                if (val === '') {
                                  setLeftYAxis({ ...leftYAxis, min: 'auto' });
                                } else if (!Number.isNaN(Number(val))) {
                                  setLeftYAxis({ ...leftYAxis, min: Number(val) });
                                }
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
                                value={leftYAxis.max === 'auto' || leftYAxis.max === undefined || leftYAxis.max === null ? '' : leftYAxis.max}
                                onChange={(e) => {
                                  const val = e.target.value.trim();
                                  if (val === '') {
                                    setLeftYAxis({ ...leftYAxis, max: 'auto' });
                                  } else if (!Number.isNaN(Number(val))) {
                                    setLeftYAxis({ ...leftYAxis, max: Number(val) });
                                  }
                                }}
                                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                                placeholder="auto"
                                style={{ outline: 'none' }}
                              />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Number Format</label>
                            <input
                              type="text"
                              value={leftYAxis.format || '#,##0'}
                              onChange={(e) => setLeftYAxis({ ...leftYAxis, format: e.target.value })}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                              placeholder="#,##0.0 | percent | currency"
                              style={{ outline: 'none' }}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Label Color</label>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={leftYAxis.fontColor || '#666666'}
                                onChange={(e) => setLeftYAxis({ ...leftYAxis, fontColor: e.target.value })}
                                className="h-8 w-8 rounded border border-gray-200"
                                style={{ outline: 'none' }}
                              />
                              <input
                                type="text"
                                value={leftYAxis.fontColor || '#666666'}
                                onChange={(e) => setLeftYAxis({ ...leftYAxis, fontColor: e.target.value })}
                                className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs font-mono"
                                style={{ outline: 'none' }}
                              />
                            </div>
                          </div>
                        </div>

                        <label className="flex items-center text-xs font-medium text-gray-700">
                          <input
                            type="checkbox"
                            className="mr-2"
                            checked={leftYAxis.showGridlines !== false}
                            onChange={(e) => setLeftYAxis({ ...leftYAxis, showGridlines: e.target.checked })}
                            style={{ outline: 'none' }}
                          />
                          Show Gridlines
                        </label>

                        {leftYAxis.showGridlines !== false && (
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Gridline Color</label>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={leftYAxis.gridColor || '#E5E7EB'}
                                onChange={(e) => setLeftYAxis({ ...leftYAxis, gridColor: e.target.value })}
                                className="h-8 w-8 rounded border border-gray-200"
                                style={{ outline: 'none' }}
                              />
                              <input
                                type="text"
                                value={leftYAxis.gridColor || '#E5E7EB'}
                                onChange={(e) => setLeftYAxis({ ...leftYAxis, gridColor: e.target.value })}
                                className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs font-mono"
                                style={{ outline: 'none' }}
                              />
                            </div>
                          </div>
                        )}
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

                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Font Size: {rightYAxis.fontSize ?? 11}px</label>
                              <input
                                type="range"
                                min="8"
                                max="18"
                                value={rightYAxis.fontSize || 11}
                                onChange={(e) => setRightYAxis({ ...rightYAxis, fontSize: parseInt(e.target.value) })}
                                className="w-full"
                                style={{ outline: 'none' }}
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Min</label>
                                <input
                                  type="text"
                                  value={rightYAxis.min === 'auto' || rightYAxis.min === undefined || rightYAxis.min === null ? '' : rightYAxis.min}
                                  onChange={(e) => {
                                    const val = e.target.value.trim();
                                    if (val === '') {
                                      setRightYAxis({ ...rightYAxis, min: 'auto' });
                                    } else if (!Number.isNaN(Number(val))) {
                                      setRightYAxis({ ...rightYAxis, min: Number(val) });
                                    }
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
                                  value={rightYAxis.max === 'auto' || rightYAxis.max === undefined || rightYAxis.max === null ? '' : rightYAxis.max}
                                  onChange={(e) => {
                                    const val = e.target.value.trim();
                                    if (val === '') {
                                      setRightYAxis({ ...rightYAxis, max: 'auto' });
                                    } else if (!Number.isNaN(Number(val))) {
                                      setRightYAxis({ ...rightYAxis, max: Number(val) });
                                    }
                                  }}
                                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                                  placeholder="auto"
                                  style={{ outline: 'none' }}
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Number Format</label>
                                <input
                                  type="text"
                                  value={rightYAxis.format || '#,##0'}
                                  onChange={(e) => setRightYAxis({ ...rightYAxis, format: e.target.value })}
                                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                  placeholder="#,##0.0 | percent | currency"
                                  style={{ outline: 'none' }}
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Label Color</label>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="color"
                                    value={rightYAxis.fontColor || '#666666'}
                                    onChange={(e) => setRightYAxis({ ...rightYAxis, fontColor: e.target.value })}
                                    className="h-8 w-8 rounded border border-gray-200"
                                    style={{ outline: 'none' }}
                                  />
                                  <input
                                    type="text"
                                    value={rightYAxis.fontColor || '#666666'}
                                    onChange={(e) => setRightYAxis({ ...rightYAxis, fontColor: e.target.value })}
                                    className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs font-mono"
                                    style={{ outline: 'none' }}
                                  />
                                </div>
                              </div>
                            </div>

                            <label className="flex items-center text-xs font-medium text-gray-700">
                              <input
                                type="checkbox"
                                className="mr-2"
                                checked={rightYAxis.showGridlines !== false}
                                onChange={(e) => setRightYAxis({ ...rightYAxis, showGridlines: e.target.checked })}
                                style={{ outline: 'none' }}
                              />
                              Show Gridlines
                            </label>

                            {rightYAxis.showGridlines !== false && (
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Gridline Color</label>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="color"
                                    value={rightYAxis.gridColor || '#E5E7EB'}
                                    onChange={(e) => setRightYAxis({ ...rightYAxis, gridColor: e.target.value })}
                                    className="h-8 w-8 rounded border border-gray-200"
                                    style={{ outline: 'none' }}
                                  />
                                  <input
                                    type="text"
                                    value={rightYAxis.gridColor || '#E5E7EB'}
                                    onChange={(e) => setRightYAxis({ ...rightYAxis, gridColor: e.target.value })}
                                    className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs font-mono"
                                    style={{ outline: 'none' }}
                                  />
                                </div>
                              </div>
                            )}
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
          {blockingErrors && (
            <span className="text-xs text-red-500 mr-auto">
              Fix the highlighted fields before saving.
            </span>
          )}
          <button
            onClick={onClose}
            className="px-5 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
            style={{ outline: 'none' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={blockingErrors}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              blockingErrors
                ? 'bg-blue-300 text-white cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
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

