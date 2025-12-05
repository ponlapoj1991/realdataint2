import { DashboardWidget, RawRow } from '../types';
import { applyWidgetFilters, aggregateWidgetData, processMultiSeriesData } from './widgetData';
import { ChartTheme, CLASSIC_ANALYTICS_THEME } from '../constants/chartTheme';
import { getCategoryColor, getPalette, getWidgetColor } from './chartStyling';

type PptChartType = 'bar' | 'column' | 'line' | 'pie' | 'ring' | 'area' | 'radar' | 'scatter' | 'combo';
type SeriesVisualType = 'bar' | 'line' | 'area';
type Orientation = 'vertical' | 'horizontal';

export interface DashboardChartInsertPayload {
  chartType: PptChartType;
  data: {
    labels: string[];
    legends: string[];
    series: number[][];
    seriesColors?: string[];
    dataColors?: string[];
  };
  options?: {
    stack?: boolean;
    lineSmooth?: boolean;
    seriesTypes?: SeriesVisualType[];
    pointSizes?: number[];
    orientation?: Orientation;
    barWidth?: number;
    barCategoryGap?: string;
  };
  theme: {
    colors: string[];
    textColor?: string;
    lineColor?: string;
  };
  meta: {
    widgetId: string;
    widgetType: DashboardWidget['type'];
    widgetTitle?: string;
    sourceDashboardId?: string;
  };
}

const mapWidgetType = (widget: DashboardWidget): PptChartType | null => {
  switch (widget.type) {
    case 'column':
    case 'stacked-column':
    case '100-stacked-column':
      return 'column';
    case 'bar':
    case 'stacked-bar':
    case '100-stacked-bar':
      return 'bar';
    case 'line':
    case 'smooth-line':
      return 'line';
    case 'area':
    case 'stacked-area':
    case '100-stacked-area':
      return 'area';
    case 'pie':
      return 'pie';
    case 'donut':
      return 'ring';
    case 'scatter':
    case 'bubble':
      return 'scatter';
    case 'combo':
      return 'combo';
    default:
      return null;
  }
};

const resolveBarOrientation = (widget: DashboardWidget): Orientation => {
  if (widget.barOrientation) return widget.barOrientation;
  const isBarFamily = widget.type.includes('bar') && !widget.type.includes('column');
  return isBarFamily ? 'horizontal' : 'vertical';
};

const clampBarSize = (value?: number) => {
  if (typeof value !== 'number') return undefined;
  return Math.max(4, Math.min(value, 120));
};

const toCategoryGap = (value?: number) => {
  if (typeof value !== 'number') return undefined;
  const normalized = Math.max(0, Math.min(value, 80));
  return `${normalized}%`;
};

const buildStackedSeries = (rows: any[], stackKeys: string[]) => {
  const legends = stackKeys;
  const series = stackKeys.map(key => rows.map(row => Number(row[key]) || 0));
  const labels = rows.map(row => String(row.name ?? row.label ?? ''));
  return { labels, legends, series };
};

const buildSingleSeries = (rows: any[], title?: string) => {
  const labels = rows.map(row => String(row.name ?? row.label ?? ''));
  const legends = [title || 'Values'];
  const series = [rows.map(row => Number(row.value) || 0)];
  return { labels, legends, series };
};

const buildScatterSeries = (rows: any[]) => {
  const labels = rows.map(row => row.name || '');
  const legends = ['X', 'Y'];
  const xSeries = rows.map(row => Number(row.x) || 0);
  const ySeries = rows.map(row => Number(row.y) || 0);
  const pointSizes = rows.map(row => Number(row.size) || 6);
  return { labels, legends, series: [xSeries, ySeries], pointSizes };
};

const buildComboSeries = (widget: DashboardWidget, rows: any[], theme: ChartTheme) => {
  if (!widget.series || widget.series.length === 0) return null;
  const labels = rows.map(row => String(row.name ?? row[widget.dimension!] ?? ''));
  const legends = widget.series.map(series => series.label || series.id);
  const palette = getPalette(widget, theme);
  const colors = widget.series.map((series, idx) => series.color || palette[idx % palette.length]);
  const seriesData = widget.series.map(series => rows.map(row => Number(row[series.id]) || 0));
  const seriesTypes = widget.series.map(series => series.type) as SeriesVisualType[];
  return { labels, legends, series: seriesData, colors, seriesTypes };
};

export const buildDashboardChartPayload = (
  widget: DashboardWidget,
  rows: RawRow[],
  opts?: {
    theme?: ChartTheme;
    sourceDashboardId?: string;
  }
): DashboardChartInsertPayload | null => {
  const chartType = mapWidgetType(widget);
  if (!chartType) return null;

  const theme = opts?.theme ?? CLASSIC_ANALYTICS_THEME;
  const palette = getPalette(widget, theme);
  const filteredRows = applyWidgetFilters(rows, widget.filters);
  if (!filteredRows.length) return null;

  if (chartType === 'combo') {
    const multiSeriesData = processMultiSeriesData(widget, filteredRows);
    if (!multiSeriesData.length) return null;
    const combo = buildComboSeries(widget, multiSeriesData, theme);
    if (!combo) return null;
    return {
      chartType: 'combo',
      data: {
        labels: combo.labels,
        legends: combo.legends,
        series: combo.series,
        seriesColors: combo.colors,
      },
      options: {
        seriesTypes: combo.seriesTypes,
        lineSmooth: widget.curveType === 'monotone' || widget.type === 'smooth-line',
        stack: widget.barMode === 'stacked' || widget.barMode === 'percent',
      },
      theme: {
        colors: combo.colors || getPalette(widget, theme),
        textColor: theme.typography.axisColor,
        lineColor: theme.background.grid
      },
      meta: {
        widgetId: widget.id,
        widgetTitle: widget.title,
        widgetType: widget.type,
        sourceDashboardId: opts?.sourceDashboardId
      }
    };
  }

  const aggregated = aggregateWidgetData(widget, filteredRows);
  if (!aggregated.data || aggregated.data.length === 0) return null;

  let labels: string[] = [];
  let legends: string[] = [];
  let series: number[][] = [];
  let pointSizes: number[] | undefined;

  if (chartType === 'scatter') {
    const scatter = buildScatterSeries(aggregated.data);
    labels = scatter.labels;
    legends = scatter.legends;
    series = scatter.series;
    pointSizes = widget.type === 'bubble' ? scatter.pointSizes : undefined;
  } else if (aggregated.stackKeys && aggregated.stackKeys.length) {
    const result = buildStackedSeries(aggregated.data, aggregated.stackKeys);
    labels = result.labels;
    legends = result.legends;
    series = result.series;
  } else {
    const single = buildSingleSeries(aggregated.data, widget.title || widget.chartTitle);
    labels = single.labels;
    legends = single.legends;
    series = single.series;
  }

  let seriesColors: string[] | undefined;
  let dataColors: string[] | undefined;

  if (aggregated.stackKeys && aggregated.stackKeys.length) {
    seriesColors = aggregated.stackKeys.map((key, idx) =>
      getWidgetColor(widget, key, idx, theme)
    );
  } else if (widget.series && widget.series.length > 0) {
    const palette = getPalette(widget, theme);
    seriesColors = widget.series.map((seriesCfg, idx) => seriesCfg.color || palette[idx % palette.length]);
  } else if (chartType !== 'pie' && chartType !== 'ring') {
    dataColors = aggregated.data.map((row: any, idx: number) =>
      getCategoryColor(widget, String(row.name ?? row.label ?? idx), idx, theme)
    );
  } else {
    dataColors = aggregated.data.map((row: any, idx: number) =>
      getCategoryColor(widget, String(row.name ?? row.label ?? idx), idx, theme)
    );
  }

  const orientation =
    chartType === 'bar' || chartType === 'column' ? resolveBarOrientation(widget) : undefined;
  const barWidth = clampBarSize(widget.barSize);
  const barCategoryGap = toCategoryGap(widget.categoryGap);

  return {
    chartType,
    data: { labels, legends, series, seriesColors, dataColors },
    options: {
      stack: aggregated.isStack,
      lineSmooth: widget.type === 'smooth-line' || widget.curveType === 'monotone',
      pointSizes,
      orientation,
      barWidth,
      barCategoryGap
    },
    theme: {
      colors: palette,
      textColor: theme.typography.axisColor,
      lineColor: theme.background.grid
    },
    meta: {
      widgetId: widget.id,
      widgetType: widget.type,
      widgetTitle: widget.title,
      sourceDashboardId: opts?.sourceDashboardId
    }
  };
};
