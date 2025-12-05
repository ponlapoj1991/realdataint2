import React, { useMemo } from 'react';
import { Plus, Trash2, Edit as EditIcon } from 'lucide-react';
import { ChartType, AggregateMethod, SeriesConfig, SortOrder } from '../types';
import {
  getChartSupports,
  isPieChart,
  isLineChart,
  isAreaChart,
  getDefaultOrientation
} from '../utils/chartConfigHelpers';
import { ColumnProfileMap, describeColumnType } from '../utils/columnProfiles';
import { FieldConstraint, ChartFieldKey } from '../constants/chartFieldConstraints';
import { FieldErrorMap } from '../utils/chartValidation';

interface ChartConfigFormProps {
  chartType: ChartType;
  availableColumns: string[];
  columnProfiles: ColumnProfileMap;
  fieldConstraints: FieldConstraint[];
  fieldErrors: FieldErrorMap;

  // Basic fields
  dimension: string;
  setDimension: (val: string) => void;

  // Stacking
  stackBy: string;
  setStackBy: (val: string) => void;

  // Single measure
  measure: AggregateMethod;
  setMeasure: (val: AggregateMethod) => void;
  measureCol: string;
  setMeasureCol: (val: string) => void;

  // Multi-series
  series: SeriesConfig[];
  sortSeriesId: string;
  setSortSeriesId: (val: string) => void;
  onAddSeries: () => void;
  onEditSeries: (s: SeriesConfig) => void;
  onDeleteSeries: (id: string) => void;

  // Bubble/Scatter
  xDimension: string;
  setXDimension: (val: string) => void;
  yDimension: string;
  setYDimension: (val: string) => void;
  sizeDimension: string;
  setSizeDimension: (val: string) => void;
  colorBy: string;
  setColorBy: (val: string) => void;

  // Pie/Donut
  innerRadius: number;
  setInnerRadius: (val: number) => void;
  startAngle: number;
  setStartAngle: (val: number) => void;

  // Line
  curveType: 'linear' | 'monotone' | 'step';
  setCurveType: (val: 'linear' | 'monotone' | 'step') => void;
  strokeWidth: number;
  setStrokeWidth: (val: number) => void;
  barSize: number;
  setBarSize: (val: number) => void;

  // Sort & Filter
  sortBy: SortOrder;
  setSortBy: (val: SortOrder) => void;
  topNEnabled: boolean;
  setTopNEnabled: (val: boolean) => void;
  topNCount: number;
  setTopNCount: (val: number) => void;
  groupOthers: boolean;
  setGroupOthers: (val: boolean) => void;
  categoryFilter: string[];
  setCategoryFilter: (val: string[]) => void;
  allCategories: string[];
  categorySearch: string;
  setCategorySearch: (val: string) => void;
  onCategoryToggle: (cat: string) => void;
  onSelectAllCategories: () => void;
  onClearAllCategories: () => void;
  onSeriesChange: (id: string, changes: Partial<SeriesConfig>) => void;
}

const ChartConfigForm: React.FC<ChartConfigFormProps> = ({
  chartType,
  availableColumns,
  columnProfiles,
  fieldConstraints,
  fieldErrors,
  dimension,
  setDimension,
  stackBy,
  setStackBy,
  measure,
  setMeasure,
  measureCol,
  setMeasureCol,
  series,
  sortSeriesId,
  setSortSeriesId,
  onAddSeries,
  onEditSeries,
  onDeleteSeries,
  xDimension,
  setXDimension,
  yDimension,
  setYDimension,
  sizeDimension,
  setSizeDimension,
  colorBy,
  setColorBy,
  innerRadius,
  setInnerRadius,
  startAngle,
  setStartAngle,
  curveType,
  setCurveType,
  strokeWidth,
  setStrokeWidth,
  barSize,
  setBarSize,
  sortBy,
  setSortBy,
  topNEnabled,
  setTopNEnabled,
  topNCount,
  setTopNCount,
  groupOthers,
  setGroupOthers,
  categoryFilter,
  setCategoryFilter,
  allCategories,
  categorySearch,
  setCategorySearch,
  onCategoryToggle,
  onSelectAllCategories,
  onClearAllCategories,
  onSeriesChange
}) => {
  const supports = getChartSupports(chartType);
  const showStackBy = supports.stackBy;
  const showMeasure = supports.measure;
  const showMultiSeries = supports.multiSeries;
  const showBubble = supports.bubble;
  const showPie = isPieChart(chartType);
  const showLine = isLineChart(chartType);
  const showArea = isAreaChart(chartType);
  const showBarSizeControl = useMemo(() => {
    const BAR_TYPES = new Set<ChartType>([
      'column',
      'stacked-column',
      '100-stacked-column',
      'bar',
      'stacked-bar',
      '100-stacked-bar'
    ]);
    return BAR_TYPES.has(chartType) || chartType === 'combo';
  }, [chartType]);

  const filteredCategories = allCategories.filter(cat =>
    cat.toLowerCase().includes(categorySearch.toLowerCase())
  );
  const constraintMap = useMemo(() => {
    const map: Partial<Record<ChartFieldKey, FieldConstraint>> = {};
    fieldConstraints.forEach((constraint) => {
      map[constraint.key] = constraint;
    });
    return map;
  }, [fieldConstraints]);

  const formatOptionLabel = (col: string) => {
    const profile = columnProfiles[col];
    const typeLabel = describeColumnType(profile?.type || 'text');
    return `[${typeLabel}] ${col}`;
  };

  const renderColumnSelect = (
    key: ChartFieldKey,
    value: string,
    setter: (val: string) => void,
    fallbackLabel: string,
    allowEmpty = false
  ) => {
    const meta = constraintMap[key];
    const error = fieldErrors[key];
    const label = meta?.label || fallbackLabel;
    const helper = meta?.helper;
    const required = meta?.required && !allowEmpty;
    const emptyLabel = allowEmpty ? 'None' : 'Select...';

    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
          {meta?.required && <span className="ml-1 text-red-500">*</span>}
        </label>
        <select
          value={value}
          onChange={(e) => setter(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
        >
          <option value="">{emptyLabel}</option>
          {availableColumns.map(col => (
            <option key={col} value={col}>
              {formatOptionLabel(col)}
            </option>
          ))}
        </select>
        {(helper || value) && (
          <div className="flex items-center justify-between text-xs text-gray-500 mt-1">
            <span>{helper}</span>
            {value && (
              <span className="text-gray-600 font-semibold">
                {describeColumnType(columnProfiles[value]?.type || 'text')}
              </span>
            )}
          </div>
        )}
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* ========================================
          BUBBLE / SCATTER - Special Dimensions
          ======================================== */}
      {showBubble && (
        <>
          {renderColumnSelect('xDimension', xDimension, setXDimension, 'X-Axis Dimension')}

          {renderColumnSelect('yDimension', yDimension, setYDimension, 'Y-Axis Dimension')}

          {chartType === 'bubble' && (
            <>
              {renderColumnSelect('sizeDimension', sizeDimension, setSizeDimension, 'Bubble Size')}
            </>
          )}

          {renderColumnSelect('colorBy', colorBy, setColorBy, 'Color By (Optional)', true)}
        </>
      )}

      {/* ========================================
          STANDARD DIMENSION (for non-bubble charts)
          ======================================== */}
      {!showBubble && !showPie && chartType !== 'kpi' && chartType !== 'table' && supports.dimension && (
        renderColumnSelect('dimension', dimension, setDimension, `Dimension (${getDefaultOrientation(chartType) === 'vertical' ? 'X' : 'Y'}-Axis)`)
      )}

      {/* ========================================
          PIE CHART - Category
          ======================================== */}
      {showPie && renderColumnSelect('dimension', dimension, setDimension, 'Category')}

      {/* ========================================
          STACKED CHARTS - Stack By
          ======================================== */}
      {showStackBy && (
        renderColumnSelect('stackBy', stackBy, setStackBy, 'Stack By (Breakdown Dimension)')
      )}

      {/* ========================================
          MULTI-SERIES (Combo Chart)
          ======================================== */}
      {showMultiSeries && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-700">
              Series ({series.length})
            </label>
            <button
              onClick={onAddSeries}
              className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700"
            >
              <Plus className="w-3 h-3" />
              Add Series
            </button>
          </div>

          {series.length > 0 ? (
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="min-w-full text-xs">
                <thead className="bg-gray-50 text-gray-600 uppercase tracking-wide">
                  <tr>
                    <th className="px-3 py-2 text-left">Name</th>
                    <th className="px-3 py-2 text-left">Type</th>
                    <th className="px-3 py-2 text-left">Measure</th>
                    <th className="px-3 py-2 text-left">Column</th>
                    <th className="px-3 py-2 text-left">Axis</th>
                    <th className="px-3 py-2 text-left">Color</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {series.map((s) => {
                    const needsColumn = s.measure === 'sum' || s.measure === 'avg';
                    return (
                      <tr key={s.id} className="align-middle">
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={s.label || ''}
                            onChange={(e) => onSeriesChange(s.id, { label: e.target.value })}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={s.type}
                            onChange={(e) => onSeriesChange(s.id, { type: e.target.value as 'bar' | 'line' | 'area' })}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                          >
                            <option value="bar">Bar</option>
                            <option value="line">Line</option>
                            <option value="area">Area</option>
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={s.measure}
                            onChange={(e) => {
                              const next = e.target.value as AggregateMethod;
                              onSeriesChange(s.id, {
                                measure: next,
                                measureCol: next === 'count' ? undefined : s.measureCol
                              });
                            }}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                          >
                            <option value="count">Count</option>
                            <option value="sum">Sum</option>
                            <option value="avg">Average</option>
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          {needsColumn ? (
                            <select
                              value={s.measureCol || ''}
                              onChange={(e) =>
                                onSeriesChange(s.id, { measureCol: e.target.value || undefined })
                              }
                              className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                            >
                              <option value="">Select column…</option>
                              {availableColumns.map((col) => (
                                <option key={col} value={col}>
                                  {col}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-[11px] text-gray-400">Not required</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={s.yAxis}
                            onChange={(e) =>
                              onSeriesChange(s.id, { yAxis: e.target.value as 'left' | 'right' })
                            }
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                          >
                            <option value="left">Left</option>
                            <option value="right">Right</option>
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={s.color}
                              onChange={(e) => onSeriesChange(s.id, { color: e.target.value })}
                              className="h-7 w-7 rounded border border-gray-200"
                            />
                            <input
                              type="text"
                              value={s.color}
                              onChange={(e) => onSeriesChange(s.id, { color: e.target.value })}
                              className="flex-1 px-2 py-1 border border-gray-300 rounded text-[11px] font-mono"
                            />
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => onEditSeries(s)}
                              className="p-1 hover:bg-gray-100 rounded"
                            >
                              <EditIcon className="w-4 h-4 text-gray-600" />
                            </button>
                            <button
                              onClick={() => onDeleteSeries(s.id)}
                              className="p-1 hover:bg-red-100 rounded"
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-4 text-sm text-gray-500 border border-dashed border-gray-300 rounded">
              No series added. Click "Add Series" to start.
            </div>
          )}

          {series.length > 0 && (
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                Sort bars based on
              </label>
              <select
                value={sortSeriesId || series[0].id}
                onChange={(e) => setSortSeriesId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
              >
                {series.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label || s.id}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500">
                This series controls the category order when sorting (High → Low).
              </p>
            </div>
          )}
        </div>
      )}

      {/* ========================================
          SINGLE MEASURE (for non-combo, non-bubble)
          ======================================== */}
      {showMeasure && !showMultiSeries && !showBubble && (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Measure</label>
            <select
              value={measure}
              onChange={(e) => setMeasure(e.target.value as AggregateMethod)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            >
              <option value="count">Count</option>
              <option value="sum">Sum</option>
              <option value="avg">Average</option>
            </select>
          </div>

          {(measure === 'sum' || measure === 'avg') && renderColumnSelect('measureCol', measureCol, setMeasureCol, 'Value Column')}
        </div>
      )}

      {/* ========================================
          PIE/DONUT SPECIFIC
          ======================================== */}
      {chartType === 'donut' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Inner Radius: {innerRadius}%
          </label>
          <input
            type="range"
            min="0"
            max="80"
            value={innerRadius}
            onChange={(e) => setInnerRadius(parseInt(e.target.value))}
            className="w-full"
          />
          <p className="text-xs text-gray-500 mt-1">
            Controls the donut hole size (0% = pie chart, 80% = thin ring)
          </p>
        </div>
      )}

      {showPie && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Start Angle: {startAngle}°
          </label>
          <input
            type="range"
            min="0"
            max="360"
            value={startAngle}
            onChange={(e) => setStartAngle(parseInt(e.target.value))}
            className="w-full"
          />
        </div>
      )}

      {/* ========================================
          LINE SPECIFIC
          ======================================== */}
      {(showLine || showArea) && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Curve Type</label>
            <select
              value={curveType}
              onChange={(e) => setCurveType(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            >
              <option value="linear">Linear (straight)</option>
              <option value="monotone">Smooth curve</option>
              <option value="step">Step</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Stroke Width: {strokeWidth}px
            </label>
            <input
              type="range"
              min="1"
              max="5"
              value={strokeWidth}
              onChange={(e) => setStrokeWidth(parseInt(e.target.value))}
              className="w-full"
            />
          </div>
        </>
      )}

      {/* ========================================
          SORT OPTIONS (all charts except Table)
          ======================================== */}
      {supports.sort && chartType !== 'table' && (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOrder)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            >
              <option value="value-desc">Value (High to Low)</option>
              <option value="value-asc">Value (Low to High)</option>
              <option value="name-asc">Name (A-Z)</option>
              <option value="name-desc">Name (Z-A)</option>
              <option value="original">Original Order (for Dates)</option>
            </select>
          </div>
          <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 space-y-2">
            <label className="flex items-center text-xs text-gray-700 gap-2">
              <input
                type="checkbox"
                checked={topNEnabled}
                onChange={(e) => setTopNEnabled(e.target.checked)}
                className="rounded"
              />
              Limit to Top N categories
            </label>
            {topNEnabled && (
              <div className="flex flex-col gap-2 md:flex-row md:items-center">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={topNCount}
                    onChange={(e) => {
                      const next = parseInt(e.target.value, 10);
                      setTopNCount(Number.isNaN(next) ? 1 : Math.max(1, next));
                    }}
                    className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                  <span className="text-xs text-gray-500">categories</span>
                </div>
                <label className="flex items-center gap-2 text-xs text-gray-600">
                  <input
                    type="checkbox"
                    checked={groupOthers}
                    onChange={(e) => setGroupOthers(e.target.checked)}
                  />
                  Combine remaining categories as &ldquo;Others&rdquo;
                </label>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================
          CATEGORY FILTER (for dimension-based charts)
          ======================================== */}
      {supports.categoryFilter && !showBubble && !showPie && chartType !== 'table' && chartType !== 'kpi' && allCategories.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Categories ({categoryFilter.length > 0 ? categoryFilter.length : allCategories.length} of {allCategories.length})
            </label>
            <div className="flex gap-2">
              <button
                onClick={onSelectAllCategories}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                Select All
              </button>
              <button
                onClick={onClearAllCategories}
                className="text-xs text-gray-600 hover:text-gray-800"
              >
                Clear
              </button>
            </div>
          </div>

          {allCategories.length > 5 && (
            <div className="mb-2">
              <input
                type="text"
                value={categorySearch}
                onChange={(e) => setCategorySearch(e.target.value)}
                placeholder="Search categories..."
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
              />
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
                  onChange={() => onCategoryToggle(cat)}
                  className="mr-2"
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
    </div>
  );
};

export default ChartConfigForm;
