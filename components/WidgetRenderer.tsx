import React from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  PieChart,
  LineChart,
  AreaChart,
  ScatterChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend as RechartsLegend,
  Bar,
  Line,
  Area,
  Pie,
  Cell,
  LabelList
} from 'recharts';
import { DashboardWidget, RawRow, DashboardFilter, AxisConfig, LegendConfig, DataLabelConfig } from '../types';
import { ChartTheme, CLASSIC_ANALYTICS_THEME } from '../constants/chartTheme';
import { applyWidgetFilters, aggregateWidgetData, processMultiSeriesData } from '../utils/widgetData';
import { getCategoryColor, getPalette, getWidgetColor } from '../utils/chartStyling';

const getBarCornerRadii = (orientation: 'vertical' | 'horizontal', theme?: ChartTheme) => {
  const radius = theme?.chart.barRadius ?? 4;
  const baseRadius = theme?.chart.barBaseRadius ?? 0;
  if (orientation === 'vertical') {
    return [radius, radius, baseRadius, baseRadius] as [number, number, number, number];
  }
  return [radius, radius, radius, radius] as [number, number, number, number];
};

const getDefaultAxis = (theme?: ChartTheme): AxisConfig => ({
  title: '',
  min: 'auto',
  max: 'auto',
  fontSize: 11,
  fontColor: theme?.typography.axisColor ?? '#666666',
  format: '#,##0',
  showGridlines: true,
  gridColor: theme?.background.grid ?? '#E5E7EB',
  slant: 0
});

const ensureAxis = (axis: AxisConfig | undefined, theme?: ChartTheme): AxisConfig => ({
  ...getDefaultAxis(theme),
  ...axis
});

const detectDecimals = (pattern?: string) => {
  if (!pattern) return 0;
  const match = pattern.match(/0\.([0]+)/);
  if (match) return match[1].length;
  if (pattern.includes('.00')) return 2;
  if (pattern.includes('.0')) return 1;
  return 0;
};

const formatAxisValue = (value: number, axis?: AxisConfig) => {
  const format = axis?.format?.toLowerCase().trim();
  const decimals = detectDecimals(axis?.format);
  if (!format) {
    return new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(value);
  }
  if (format.includes('percent') || format.includes('%')) {
    const digits = decimals || 1;
    return `${(value * 100).toFixed(digits)}%`;
  }
  if (format.includes('currency') || format.includes('$')) {
    return new Intl.NumberFormat('en', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals || 2
    }).format(value);
  }
  if (format.includes('compact')) {
    return new Intl.NumberFormat('en', {
      notation: 'compact',
      maximumFractionDigits: decimals || 1
    }).format(value);
  }

  return new Intl.NumberFormat('en', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value);
};

const getDefaultLegend = (theme?: ChartTheme): LegendConfig => ({
  enabled: true,
  position: 'bottom',
  fontSize: 11,
  fontColor: theme?.typography.labelColor ?? '#666666',
  alignment: 'center'
});

const resolveLegendConfig = (widget: DashboardWidget, theme?: ChartTheme): LegendConfig => {
  if (widget.legend) {
    return {
      ...getDefaultLegend(theme),
      ...widget.legend
    };
  }

  const base = getDefaultLegend(theme);
  return {
    ...base,
    enabled: widget.showLegend !== false,
    position: widget.legendPosition || base.position
  };
};

const getLegendLayout = (config: LegendConfig) => {
  if (config.position === 'left' || config.position === 'right') {
    return {
      verticalAlign: 'middle' as const,
      align: config.position,
      layout: 'vertical' as const
    };
  }

  return {
    verticalAlign: config.position as 'top' | 'bottom',
    align: config.alignment || 'center',
    layout: 'horizontal' as const
  };
};

const resolveDataLabels = (widget: DashboardWidget): DataLabelConfig | undefined => widget.dataLabels;

const formatWidgetValue = (widget: DashboardWidget, val: number) => {
  if (widget.valueFormat === 'percent') return `${(val * 100).toFixed(1)}%`;
  if (widget.valueFormat === 'currency') return new Intl.NumberFormat('en', { style: 'currency', currency: 'USD', maximumFractionDigits: 1 }).format(val);
  if (widget.valueFormat === 'compact') return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(val);
  return new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(val);
};

const getAxisDomain = (axis?: AxisConfig) => {
  const normalize = (value?: number | 'auto') =>
    value === undefined || value === null || value === 'auto' ? 'auto' : value;
  return [normalize(axis?.min), normalize(axis?.max)] as [number | 'auto', number | 'auto'];
};

const formatPercentText = (value: number, decimals: number) =>
  `${(value * 100).toFixed(decimals)}%`;

const formatDataLabelValue = (
  value: number,
  widget: DashboardWidget,
  config?: DataLabelConfig,
  percentValue?: number | null
) => {
  const baseValue = formatWidgetValue(widget, value);
  if (!config?.showPercent || percentValue === null || percentValue === undefined) {
    return baseValue;
  }
  const percentText = formatPercentText(percentValue, config.percentDecimals ?? 1);
  return config.percentPlacement === 'prefix'
    ? `${percentText} ${baseValue}`.trim()
    : `${baseValue} (${percentText})`;
};

const resolveBarSpacing = (widget: DashboardWidget) => {
  const raw = widget.categoryGap ?? 20;
  const normalized = Math.max(0, Math.min(raw, 80));
  const barGap = Math.max(-20, Math.min((normalized - 20) * 2, 80));
  return {
    barCategoryGap: `${normalized}%`,
    barGap
  };
};

interface WidgetRendererProps {
  widget: DashboardWidget;
  data: RawRow[];
  filters?: DashboardFilter[];
  onValueClick?: (value: string, widget: DashboardWidget) => void;
  theme?: ChartTheme;
  fixedWidth?: number;
  fixedHeight?: number;
}

const WidgetRenderer: React.FC<WidgetRendererProps> = ({
  widget,
  data,
  filters,
  onValueClick,
  theme,
  fixedWidth,
  fixedHeight,
}) => {
  const activeTheme = theme ?? CLASSIC_ANALYTICS_THEME;
  const filteredRows = React.useMemo(() => applyWidgetFilters(data, filters), [data, filters]);
  const resolvedBarSize = widget.barSize ?? 22;
  const spacingConfig = resolveBarSpacing(widget);
  const palette = getPalette(widget, activeTheme);
  const accentColor = widget.color || palette[0] || '#3B82F6';
  const tooltipStyle: React.CSSProperties = {
    backgroundColor: activeTheme.background.card,
    borderColor: activeTheme.background.grid,
    borderRadius: 10,
    boxShadow: '0 18px 32px rgba(15, 18, 37, 0.18)',
    fontFamily: activeTheme.typography.fontFamily,
    color: activeTheme.typography.labelColor,
  };
  const containerWidth = fixedWidth ?? '100%';
  const containerHeight = fixedHeight ?? '100%';
  const emptyState = (message: string) => (
    <div
      className="flex items-center justify-center h-full text-sm"
      style={{ color: activeTheme.typography.axisColor, fontFamily: activeTheme.typography.fontFamily }}
    >
      {message}
    </div>
  );
  const buildTickStyle = (axis: AxisConfig) => ({
    fontSize: axis.fontSize,
    fill: axis.fontColor,
    fontFamily: activeTheme.typography.fontFamily
  });

  const handleValueClick = (value?: string) => {
    if (!value || !onValueClick) return;
    onValueClick(value, widget);
  };

  try {
    if (!widget.dimension && widget.type !== 'kpi' && widget.type !== 'table') {
      return emptyState('Invalid widget: Missing dimension');
    }

    // Multi-series charts
    if (widget.series && widget.series.length > 0 && widget.type !== 'pie' && widget.type !== 'kpi' && widget.type !== 'wordcloud' && widget.type !== 'table') {
      const multiSeriesData = processMultiSeriesData(widget, filteredRows);
      if (!multiSeriesData || multiSeriesData.length === 0) {
        return emptyState('No Data');
      }

      const hasRightAxis = widget.series.some(s => s.yAxis === 'right');
      const legendConfig = resolveLegendConfig(widget, activeTheme);
      const xAxisConfig = ensureAxis(widget.xAxis, activeTheme);
      const leftYAxisConfig = ensureAxis(widget.leftYAxis, activeTheme);
      const rightYAxisConfig = ensureAxis(widget.rightYAxis, activeTheme);
      const dataLabelsConfig = resolveDataLabels(widget);
      const seriesTotals: Record<string, number> = {};
      widget.series.forEach((s) => {
        seriesTotals[s.id] = multiSeriesData.reduce((sum, row) => sum + (Number(row[s.id]) || 0), 0);
      });
      const barOrientation = widget.barOrientation || 'vertical';
      const showVerticalGrid = xAxisConfig.showGridlines !== false;
      const showHorizontalGrid = leftYAxisConfig.showGridlines !== false;
      const gridStroke =
        leftYAxisConfig.gridColor || xAxisConfig.gridColor || activeTheme.background.grid || '#f0f0f0';
      const legendLayout = getLegendLayout(legendConfig);

      return (
        <div className="h-full flex flex-col">
          {widget.chartTitle && (
            <div className="text-center mb-2" style={{ fontFamily: activeTheme.typography.fontFamily }}>
              <h3 className="text-base font-bold" style={{ color: activeTheme.typography.labelColor }}>{widget.chartTitle}</h3>
              {widget.subtitle && <p className="text-xs" style={{ color: activeTheme.typography.axisColor }}>{widget.subtitle}</p>}
            </div>
          )}
          <ResponsiveContainer width={containerWidth} height={containerHeight}>
            <ComposedChart
              data={multiSeriesData}
              layout={barOrientation === 'horizontal' ? 'vertical' : 'horizontal'}
              barCategoryGap={spacingConfig.barCategoryGap}
              barGap={spacingConfig.barGap}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                horizontal={showHorizontalGrid}
                vertical={showVerticalGrid}
                stroke={gridStroke}
              />
              {barOrientation === 'vertical' ? (
                <>
                  <XAxis
                    dataKey={widget.dimension}
                    angle={xAxisConfig.slant || 0}
                    textAnchor={xAxisConfig.slant ? 'end' : 'middle'}
                    height={xAxisConfig.slant === 90 ? 100 : xAxisConfig.slant === 45 ? 80 : 60}
                    tick={buildTickStyle(xAxisConfig)}
                    label={xAxisConfig.title ? { value: xAxisConfig.title, position: 'insideBottom', offset: -5 } : undefined}
                  />
                  <YAxis
                    yAxisId="left"
                    tick={buildTickStyle(leftYAxisConfig)}
                    tickFormatter={(val) => formatAxisValue(Number(val) || 0, leftYAxisConfig)}
                    label={leftYAxisConfig.title ? { value: leftYAxisConfig.title, angle: -90, position: 'insideLeft' } : undefined}
                    domain={[
                      leftYAxisConfig.min === 'auto' ? 'auto' : leftYAxisConfig.min,
                      leftYAxisConfig.max === 'auto' ? 'auto' : leftYAxisConfig.max
                    ]}
                  />
                  {hasRightAxis && (
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={buildTickStyle(rightYAxisConfig)}
                      tickFormatter={(val) => formatAxisValue(Number(val) || 0, rightYAxisConfig)}
                      label={rightYAxisConfig.title ? { value: rightYAxisConfig.title, angle: 90, position: 'insideRight' } : undefined}
                      domain={[
                        rightYAxisConfig.min === 'auto' ? 'auto' : rightYAxisConfig.min,
                        rightYAxisConfig.max === 'auto' ? 'auto' : rightYAxisConfig.max
                      ]}
                    />
                  )}
                </>
              ) : (
                <>
                  <XAxis
                    type="number"
                    tick={buildTickStyle(leftYAxisConfig)}
                    tickFormatter={(val) => formatAxisValue(Number(val) || 0, leftYAxisConfig)}
                    domain={getAxisDomain(leftYAxisConfig)}
                    label={leftYAxisConfig.title ? { value: leftYAxisConfig.title, position: 'bottom', offset: 0 } : undefined}
                  />
                  <YAxis
                    type="category"
                    dataKey={widget.dimension}
                    tick={buildTickStyle(xAxisConfig)}
                    label={xAxisConfig.title ? { value: xAxisConfig.title, position: 'insideLeft' } : undefined}
                  />
                </>
              )}
              <Tooltip
                contentStyle={tooltipStyle}
                cursor={{ fill: activeTheme.background.grid }}
                formatter={(val: any, name) => [formatWidgetValue(widget, Number(val) || 0), name as string]}
              />
              {legendConfig.enabled && (
                <RechartsLegend
                  wrapperStyle={{ fontSize: legendConfig.fontSize, color: legendConfig.fontColor, fontFamily: activeTheme.typography.fontFamily }}
                  {...legendLayout}
                />
              )}
                {widget.series.map(series => {
                  const Component = series.type === 'line' ? Line : series.type === 'area' ? Area : Bar;
                  const barProps = series.type === 'bar' && widget.type === 'stacked-bar' ? { stackId: 'stack' } : {};
                  const radius = getBarCornerRadii(barOrientation === 'horizontal' ? 'horizontal' : 'vertical', activeTheme);
                  const strokeWidth = series.type === 'bar' ? activeTheme.chart.barStrokeWidth : activeTheme.chart.lineStrokeWidth;
                  const fillOpacity = series.type === 'area' ? activeTheme.chart.areaOpacity : 1;
                  const seriesTotal = seriesTotals[series.id] || 0;
                  const sharedProps =
                    series.type === 'bar'
                      ? { barSize: resolvedBarSize, radius, strokeWidth }
                      : { strokeWidth };
                  return (
                    <Component
                    key={series.id}
                    yAxisId={barOrientation === 'vertical' ? series.yAxis : undefined}
                    type="monotone"
                    dataKey={series.id}
                    name={series.label}
                    fill={series.color}
                    stroke={series.color}
                    fillOpacity={fillOpacity}
                    onClick={(payload: any) => handleValueClick(payload?.[widget.dimension!])}
                      className="cursor-pointer"
                      {...barProps}
                      {...sharedProps}
                    >
                    {dataLabelsConfig?.enabled && (
                      <LabelList
                        dataKey={series.id}
                        position={dataLabelsConfig.position as any}
                        style={{
                          fontSize: dataLabelsConfig.fontSize,
                          fontWeight: dataLabelsConfig.fontWeight,
                          fill: dataLabelsConfig.color,
                          fontFamily: dataLabelsConfig.fontFamily || activeTheme.typography.fontFamily
                        }}
                        formatter={(val: number) => {
                          const percentValue = seriesTotal > 0 ? val / seriesTotal : null;
                          return formatDataLabelValue(Number(val) || 0, widget, dataLabelsConfig, percentValue);
                        }}
                      />
                    )}
                  </Component>
                );
              })}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      );
    }

    const { data: aggregatedData, isStack, stackKeys } = aggregateWidgetData(widget, filteredRows);

    if (!aggregatedData || aggregatedData.length === 0) {
      return emptyState('No Data');
    }

    switch (widget.type) {
      case 'column':
      case 'stacked-column':
      case '100-stacked-column':
      case 'bar':
      case 'stacked-bar':
      case '100-stacked-bar': {
        const isHorizontal = ['bar', 'stacked-bar', '100-stacked-bar'].includes(widget.type);
        const layout = isHorizontal ? 'vertical' : 'horizontal';
        const categoryAxisConfig = ensureAxis(widget.xAxis, activeTheme);
        const valueAxisConfig = ensureAxis(widget.leftYAxis, activeTheme);
        const legendConfig = resolveLegendConfig(widget, activeTheme);
        const dataLabelsConfig = resolveDataLabels(widget);
        const showLegend = legendConfig.enabled;
        const showValues = dataLabelsConfig?.enabled ?? widget.showValues !== false;
        const singleBarRadius = getBarCornerRadii(isHorizontal ? 'horizontal' : 'vertical', activeTheme);
        const barStrokeWidth = activeTheme.chart.barStrokeWidth || 0;
        const singleSeriesTotal =
          !stackKeys || stackKeys.length === 0
            ? (aggregatedData as any[]).reduce((sum, row: any) => sum + (row.value || 0), 0)
            : 0;
        const labelPosition = dataLabelsConfig?.position || (isHorizontal ? 'right' : 'top');
        const labelStyle = dataLabelsConfig
          ? {
              fontSize: dataLabelsConfig.fontSize,
              fontWeight: dataLabelsConfig.fontWeight,
              fill: dataLabelsConfig.color,
              fontFamily: dataLabelsConfig.fontFamily || activeTheme.typography.fontFamily
            }
          : {
              fontFamily: activeTheme.typography.fontFamily,
              fill: activeTheme.typography.labelColor
            };
        const showVerticalGrid = categoryAxisConfig.showGridlines !== false;
        const showHorizontalGrid = valueAxisConfig.showGridlines !== false;
        const gridStroke =
          valueAxisConfig.gridColor ||
          categoryAxisConfig.gridColor ||
          activeTheme.background.grid ||
          '#f3f4f6';
        const legendLayout = getLegendLayout(legendConfig);
        const isHundredStackedChart = ['100-stacked-column', '100-stacked-bar'].includes(widget.type);

        return (
          <ResponsiveContainer width={containerWidth} height={containerHeight}>
            <BarChart
              data={aggregatedData as any[]}
              layout={layout}
              barCategoryGap={spacingConfig.barCategoryGap}
              barGap={spacingConfig.barGap}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                horizontal={showHorizontalGrid}
                vertical={showVerticalGrid}
                stroke={gridStroke}
              />
              {isHorizontal ? (
                <>
                  <XAxis
                    type="number"
                    tick={buildTickStyle(valueAxisConfig)}
                    tickFormatter={(val) => formatAxisValue(Number(val) || 0, valueAxisConfig)}
                    domain={getAxisDomain(valueAxisConfig)}
                    label={valueAxisConfig.title ? { value: valueAxisConfig.title, offset: 0, position: 'bottom' } : undefined}
                  />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={120}
                    tick={buildTickStyle(categoryAxisConfig)}
                    label={categoryAxisConfig.title ? { value: categoryAxisConfig.title, angle: -90, position: 'insideLeft' } : undefined}
                  />
                </>
              ) : (
                <>
                  <XAxis
                    dataKey="name"
                    type="category"
                    tick={buildTickStyle(categoryAxisConfig)}
                    angle={categoryAxisConfig.slant || 0}
                    textAnchor={categoryAxisConfig.slant ? 'end' : 'middle'}
                    height={categoryAxisConfig.slant === 90 ? 100 : categoryAxisConfig.slant === 45 ? 80 : 60}
                    interval={0}
                    label={categoryAxisConfig.title ? { value: categoryAxisConfig.title, position: 'insideBottom', offset: -5 } : undefined}
                  />
                  <YAxis
                    type="number"
                    tick={buildTickStyle(valueAxisConfig)}
                    tickFormatter={(val) => formatAxisValue(Number(val) || 0, valueAxisConfig)}
                    domain={getAxisDomain(valueAxisConfig)}
                    width={80}
                    label={valueAxisConfig.title ? { value: valueAxisConfig.title, angle: -90, position: 'insideLeft' } : undefined}
                  />
                </>
              )}
              <Tooltip
                contentStyle={tooltipStyle}
                cursor={{ fill: activeTheme.background.grid }}
                formatter={(val: any, name: any) => [formatWidgetValue(widget, Number(val) || 0), name]}
              />
              {showLegend && (
                <RechartsLegend
                  {...legendLayout}
                  iconType="circle"
                  wrapperStyle={{ fontSize: legendConfig.fontSize, color: legendConfig.fontColor, fontFamily: activeTheme.typography.fontFamily }}
                />
              )}
              {stackKeys && stackKeys.length ? (
                stackKeys.map((key, idx) => (
                  <Bar
                    key={key}
                    dataKey={key}
                    stackId={isStack ? 'stack' : undefined}
                    fill={getWidgetColor(widget, key, idx, activeTheme)}
                    radius={singleBarRadius}
                    barSize={resolvedBarSize}
                    strokeWidth={barStrokeWidth}
                    onClick={(payload: any) => handleValueClick(payload?.name)}
                    className="cursor-pointer"
                  >
                    {showValues && (
                      <LabelList
                        dataKey={key}
                        position={labelPosition as any}
                        style={labelStyle}
                        formatter={(val: number, entry: any) => {
                          if (isHundredStackedChart) {
                            return formatDataLabelValue(Number(val) || 0, widget, dataLabelsConfig, val);
                          }
                          const payload = entry?.payload || {};
                          const rowTotal = stackKeys.reduce((sum, stackKey) => sum + (payload[stackKey] || 0), 0);
                          const percentShare = rowTotal > 0 ? (Number(val) || 0) / rowTotal : null;
                          return formatDataLabelValue(Number(val) || 0, widget, dataLabelsConfig, percentShare);
                        }}
                      />
                    )}
                  </Bar>
                ))
              ) : (
                <Bar
                  dataKey="value"
                  fill={widget.color || accentColor}
                  radius={singleBarRadius}
                  barSize={resolvedBarSize}
                  strokeWidth={barStrokeWidth}
                  className="cursor-pointer"
                  onClick={(payload: any) => handleValueClick(payload?.name)}
                >
                  {(aggregatedData as any[]).map((entry, idx) => (
                    <Cell key={entry.name} fill={getCategoryColor(widget, entry.name, idx, activeTheme)} />
                  ))}
                  {showValues && (
                    <LabelList
                      dataKey="value"
                      position={labelPosition as any}
                      style={labelStyle}
                      formatter={(val: number) =>
                        formatDataLabelValue(Number(val) || 0, widget, dataLabelsConfig, singleSeriesTotal > 0 ? (Number(val) || 0) / singleSeriesTotal : null)
                      }
                    />
                  )}
                </Bar>
              )}
            </BarChart>
          </ResponsiveContainer>
        );
      }
      case 'pie':
      case 'donut': {
        const legendConfig = resolveLegendConfig(widget, activeTheme);
        const showLegend = legendConfig.enabled;
        const legendLayout = getLegendLayout(legendConfig);
        const dataLabelsConfig = resolveDataLabels(widget);
        const showValues = dataLabelsConfig?.enabled ?? widget.showValues !== false;
        const pieTotal = (aggregatedData as any[]).reduce((sum, row: any) => sum + (row.value || 0), 0);

        return (
          <ResponsiveContainer width={containerWidth} height={containerHeight}>
            <PieChart>
              <Pie
                data={aggregatedData as any[]}
                cx="50%"
                cy="50%"
                innerRadius={widget.type === 'donut' ? (widget.innerRadius || 50) : 0}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
                className="cursor-pointer outline-none"
                onClick={(payload) => handleValueClick(payload?.name)}
                label={
                  showValues
                    ? ({ name, value }) => `${name}: ${formatDataLabelValue(Number(value) || 0, widget, dataLabelsConfig, pieTotal > 0 ? (Number(value) || 0) / pieTotal : null)}`
                    : false
                }
                labelLine={showValues}
              >
                {(aggregatedData as any[]).map((entry, idx) => (
                  <Cell key={`cell-${idx}`} fill={getCategoryColor(widget, entry.name, idx, activeTheme)} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(val: any, name: any) => [formatWidgetValue(widget, Number(val) || 0), name]}
              />
              {showLegend && (
                <RechartsLegend
                  {...legendLayout}
                  iconType="circle"
                  wrapperStyle={{ fontSize: legendConfig.fontSize, color: legendConfig.fontColor, fontFamily: activeTheme.typography.fontFamily }}
                />
              )}
            </PieChart>
          </ResponsiveContainer>
        );
      }
      case 'line':
      case 'smooth-line':
      case 'area':
      case 'stacked-area':
      case '100-stacked-area': {
        const sortedData = [...(aggregatedData as any[])].sort((a, b) => a.name.localeCompare(b.name));
        const isLineChart = widget.type === 'line' || widget.type === 'smooth-line';
        const ChartComp = isLineChart ? LineChart : AreaChart;
        const DataComp = isLineChart ? Line : Area;
        const primaryColor = widget.color || palette[0] || '#3B82F6';
        const xAxisConfig = ensureAxis(widget.xAxis, activeTheme);
        const yAxisConfig = ensureAxis(widget.leftYAxis, activeTheme);
        const legendConfig = resolveLegendConfig(widget, activeTheme);
        const legendLayout = getLegendLayout(legendConfig);
        const showLegend = legendConfig.enabled;
        const dataLabelsConfig = resolveDataLabels(widget);
        const showValues = dataLabelsConfig?.enabled ?? widget.showValues !== false;
        const labelStyle = dataLabelsConfig
          ? {
              fontSize: dataLabelsConfig.fontSize,
              fontWeight: dataLabelsConfig.fontWeight,
              fill: dataLabelsConfig.color,
              fontFamily: dataLabelsConfig.fontFamily || activeTheme.typography.fontFamily
            }
          : {
              fontFamily: activeTheme.typography.fontFamily,
              fill: activeTheme.typography.labelColor
            };
        const showVerticalGrid = xAxisConfig.showGridlines !== false;
        const showHorizontalGrid = yAxisConfig.showGridlines !== false;
        const gridStroke = yAxisConfig.gridColor || xAxisConfig.gridColor || activeTheme.background.grid || '#f3f4f6';
        const defaultStrokeWidth = widget.strokeWidth || activeTheme.chart.lineStrokeWidth;
        const areaOpacity = activeTheme.chart.areaOpacity;
        const seriesFillOpacity = isLineChart ? 0 : areaOpacity;
        const isHundredStackedArea = widget.type === '100-stacked-area';
        const singleSeriesLineTotal =
          !stackKeys || stackKeys.length === 0
            ? sortedData.reduce((sum, row: any) => sum + (row.value || 0), 0)
            : 0;

        return (
          <ResponsiveContainer width={containerWidth} height={containerHeight}>
            <ChartComp data={sortedData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} onClick={(e: any) => e && e.activeLabel && handleValueClick(e.activeLabel)}>
              <CartesianGrid
                strokeDasharray="3 3"
                horizontal={showHorizontalGrid}
                vertical={showVerticalGrid}
                stroke={gridStroke}
              />
              <XAxis
                dataKey="name"
                tick={buildTickStyle(xAxisConfig)}
                label={xAxisConfig.title ? { value: xAxisConfig.title, position: 'insideBottom', offset: -5 } : undefined}
              />
              <YAxis
                tick={buildTickStyle(yAxisConfig)}
                tickFormatter={(val) => formatAxisValue(Number(val) || 0, yAxisConfig)}
                domain={getAxisDomain(yAxisConfig)}
                label={yAxisConfig.title ? { value: yAxisConfig.title, angle: -90, position: 'insideLeft' } : undefined}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(val: any, name: any) => [formatWidgetValue(widget, Number(val) || 0), name]}
              />
              {stackKeys && stackKeys.length ? (
                stackKeys.map((key, idx) => (
                  <DataComp
                    key={key}
                    type={widget.type === 'smooth-line' ? 'monotone' : (widget.curveType || 'linear')}
                    dataKey={key}
                    name={key}
                    stackId={isStack ? 'stack' : undefined}
                    stroke={getWidgetColor(widget, key, idx, activeTheme)}
                    fill={getWidgetColor(widget, key, idx, activeTheme)}
                    fillOpacity={seriesFillOpacity}
                    strokeWidth={defaultStrokeWidth}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                    className="cursor-pointer"
                  >
                    {showValues && (
                      <LabelList
                        dataKey={key}
                        position={(dataLabelsConfig?.position as any) || 'top'}
                        style={labelStyle}
                        formatter={(val: number, entry: any) => {
                          if (isHundredStackedArea) {
                            return formatDataLabelValue(Number(val) || 0, widget, dataLabelsConfig, val);
                          }
                          const payload = entry?.payload || {};
                          const rowTotal = stackKeys.reduce((sum, stackKey) => sum + (payload[stackKey] || 0), 0);
                          const percent = rowTotal > 0 ? (Number(val) || 0) / rowTotal : null;
                          return formatDataLabelValue(Number(val) || 0, widget, dataLabelsConfig, percent);
                        }}
                      />
                    )}
                  </DataComp>
                ))
              ) : (
                <DataComp
                  type={widget.type === 'smooth-line' ? 'monotone' : (widget.curveType || 'linear')}
                  dataKey="value"
                  stroke={primaryColor}
                  fill={primaryColor}
                  fillOpacity={seriesFillOpacity}
                  strokeWidth={defaultStrokeWidth}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                  className="cursor-pointer"
                >
                  {showValues && (
                    <LabelList
                      dataKey="value"
                      position={(dataLabelsConfig?.position as any) || 'top'}
                      style={labelStyle}
                      formatter={(val: number) =>
                        formatDataLabelValue(
                          Number(val) || 0,
                          widget,
                          dataLabelsConfig,
                          singleSeriesLineTotal > 0 ? (Number(val) || 0) / singleSeriesLineTotal : null
                        )
                      }
                    />
                  )}
                </DataComp>
              )}
              {showLegend && (
                <RechartsLegend
                  {...legendLayout}
                  iconType="circle"
                  wrapperStyle={{ fontSize: legendConfig.fontSize, color: legendConfig.fontColor, fontFamily: activeTheme.typography.fontFamily }}
                />
              )}
            </ChartComp>
          </ResponsiveContainer>
        );
      }
      case 'scatter':
      case 'bubble': {
        const legendConfig = resolveLegendConfig(widget, activeTheme);
        const showLegend = legendConfig.enabled;
        const legendLayout = getLegendLayout(legendConfig);
        const xAxisConfig = ensureAxis(widget.xAxis, activeTheme);
        const yAxisConfig = ensureAxis(widget.leftYAxis, activeTheme);

        return (
          <ResponsiveContainer width={containerWidth} height={containerHeight}>
            <ScatterChart>
              <CartesianGrid
                strokeDasharray="3 3"
                horizontal={yAxisConfig.showGridlines !== false}
                vertical={xAxisConfig.showGridlines !== false}
                stroke={yAxisConfig.gridColor || xAxisConfig.gridColor || activeTheme.background.grid || '#f3f4f6'}
              />
              <XAxis
                dataKey="x"
                type="number"
                tick={buildTickStyle(xAxisConfig)}
                tickFormatter={(val) => formatAxisValue(Number(val) || 0, xAxisConfig)}
                domain={getAxisDomain(xAxisConfig)}
                label={{ value: xAxisConfig.title || widget.xDimension, position: 'bottom' }}
              />
              <YAxis
                dataKey="y"
                type="number"
                tick={buildTickStyle(yAxisConfig)}
                tickFormatter={(val) => formatAxisValue(Number(val) || 0, yAxisConfig)}
                domain={getAxisDomain(yAxisConfig)}
                label={{ value: yAxisConfig.title || widget.yDimension, angle: -90, position: 'left' }}
              />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                contentStyle={tooltipStyle}
                formatter={(val: any, name: any) => [formatWidgetValue(widget, Number(val) || 0), name]}
              />
              {showLegend && (
                <RechartsLegend
                  {...legendLayout}
                  iconType="circle"
                  wrapperStyle={{ fontSize: legendConfig.fontSize, color: legendConfig.fontColor, fontFamily: activeTheme.typography.fontFamily }}
                />
              )}
              <Line
                type="scatter"
                dataKey="y"
                stroke={accentColor}
                fill={accentColor}
                dot={(props: any) => {
                  const size = widget.type === 'bubble' ? Math.max(4, Math.min(20, props.payload.size)) : 6;
                  return <circle cx={props.cx} cy={props.cy} r={size} fill={accentColor} stroke="white" strokeWidth={1} />;
                }}
              />
            </ScatterChart>
          </ResponsiveContainer>
        );
      }
      case 'kpi': {
        const total = (aggregatedData as any[]).reduce((acc, curr) => acc + curr.value, 0);
        const formattedTotal = formatWidgetValue(widget, total);
        return (
          <div
            className="flex flex-col items-center justify-center h-full pb-4 text-center"
            style={{ fontFamily: activeTheme.typography.fontFamily, color: activeTheme.typography.labelColor }}
          >
            <span className="text-4xl font-bold" style={{ color: accentColor }}>{formattedTotal}</span>
            {widget.subtitle && <p className="mt-2 text-sm" style={{ color: activeTheme.typography.axisColor }}>{widget.subtitle}</p>}
          </div>
        );
      }
      case 'wordcloud': {
        const safeMax = Math.max(...(aggregatedData as any[]).map((item: any) => item.value)) || 1;
        return (
          <div className="flex flex-wrap gap-2 justify-center items-center h-full p-4">
            {(aggregatedData as any[]).map((item: any, idx: number) => {
              const size = 14 + (item.value / safeMax) * 24;
              const opacity = 0.6 + (item.value / safeMax) * 0.4;
              return (
                <span
                  key={idx}
                  onClick={(e) => handleValueClick(item.name)}
                  className="cursor-pointer hover:scale-110 transition-transform px-1 leading-none select-none"
                  style={{
                    fontSize: `${size}px`,
                    color: palette[idx % palette.length],
                    opacity,
                    fontFamily: activeTheme.typography.fontFamily
                  }}
                >
                  {item.name}
                </span>
              );
            })}
          </div>
        );
      }
      case 'table': {
        const headerStyle: React.CSSProperties = {
          backgroundColor: activeTheme.background.card,
          color: activeTheme.typography.labelColor,
          fontFamily: activeTheme.typography.fontFamily
        };
        const borderColor = activeTheme.background.grid || '#E5E7EB';
        const cellStyle: React.CSSProperties = {
          fontFamily: activeTheme.typography.fontFamily,
          color: activeTheme.typography.labelColor
        };
        const secondaryTextColor = activeTheme.typography.axisColor;
        return (
          <div className="overflow-auto max-h-full">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="text-xs uppercase sticky top-0 z-10 shadow-sm" style={headerStyle}>
                <tr>
                  {Object.keys((aggregatedData as RawRow[])[0] || {}).map(col => (
                    <th
                      key={col}
                      className="px-4 py-2"
                      style={{ borderBottom: `1px solid ${borderColor}`, color: secondaryTextColor }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(aggregatedData as RawRow[]).map((row, idx) => (
                  <tr
                    key={idx}
                    className="transition-colors hover:bg-gray-50/70"
                    style={{ borderTop: idx === 0 ? undefined : `1px solid ${borderColor}` }}
                  >
                    {Object.keys(row).map(col => (
                      <td key={col} className="px-4 py-2 truncate max-w-[150px]" style={cellStyle}>
                        {String(row[col] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      default:
        return emptyState('Unsupported chart type');
    }
  } catch (error) {
    console.error('[WidgetRenderer] failed to render widget', error);
    return emptyState('Unable to render chart');
  }
};

export default WidgetRenderer;
