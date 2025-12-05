import { ChartType, SeriesConfig } from '../types';

/**
 * Helper functions to determine chart configuration requirements
 */

export type ChartSupports = {
  dimension: boolean;
  stackBy: boolean;
  multiSeries: boolean;
  measure: boolean;
  bubble: boolean;
  pie: boolean;
  line: boolean;
  area: boolean;
  axes: boolean;
  legend: boolean;
  dataLabels: boolean;
  sort: boolean;
  categoryFilter: boolean;
  categoryConfig: boolean;
};

const SUPPORT_MATRIX: Record<ChartType, ChartSupports> = {
  column:        { dimension: true, stackBy: false, multiSeries: false, measure: true,  bubble: false, pie: false, line: false, area: false, axes: true,  legend: true, dataLabels: true, sort: true, categoryFilter: true, categoryConfig: true },
  'stacked-column':     { dimension: true, stackBy: true,  multiSeries: false, measure: true,  bubble: false, pie: false, line: false, area: false, axes: true,  legend: true, dataLabels: true, sort: true, categoryFilter: true, categoryConfig: true },
  '100-stacked-column': { dimension: true, stackBy: true,  multiSeries: false, measure: true,  bubble: false, pie: false, line: false, area: false, axes: true,  legend: true, dataLabels: true, sort: true, categoryFilter: true, categoryConfig: true },
  bar:           { dimension: true, stackBy: false, multiSeries: false, measure: true,  bubble: false, pie: false, line: false, area: false, axes: true,  legend: true, dataLabels: true, sort: true, categoryFilter: true, categoryConfig: true },
  'stacked-bar':       { dimension: true, stackBy: true,  multiSeries: false, measure: true,  bubble: false, pie: false, line: false, area: false, axes: true,  legend: true, dataLabels: true, sort: true, categoryFilter: true, categoryConfig: true },
  '100-stacked-bar':   { dimension: true, stackBy: true,  multiSeries: false, measure: true,  bubble: false, pie: false, line: false, area: false, axes: true,  legend: true, dataLabels: true, sort: true, categoryFilter: true, categoryConfig: true },
  line:          { dimension: true, stackBy: false, multiSeries: false, measure: true,  bubble: false, pie: false, line: true,  area: false, axes: true,  legend: true, dataLabels: true, sort: true, categoryFilter: true, categoryConfig: true },
  'smooth-line': { dimension: true, stackBy: false, multiSeries: false, measure: true,  bubble: false, pie: false, line: true,  area: false, axes: true,  legend: true, dataLabels: true, sort: true, categoryFilter: true, categoryConfig: true },
  area:          { dimension: true, stackBy: false, multiSeries: false, measure: true,  bubble: false, pie: false, line: false, area: true, axes: true,  legend: true, dataLabels: true, sort: true, categoryFilter: true, categoryConfig: true },
  'stacked-area':     { dimension: true, stackBy: true,  multiSeries: false, measure: true,  bubble: false, pie: false, line: false, area: true, axes: true,  legend: true, dataLabels: true, sort: true, categoryFilter: true, categoryConfig: true },
  '100-stacked-area': { dimension: true, stackBy: true,  multiSeries: false, measure: true,  bubble: false, pie: false, line: false, area: true, axes: true,  legend: true, dataLabels: true, sort: true, categoryFilter: true, categoryConfig: true },
  pie:           { dimension: true, stackBy: false, multiSeries: false, measure: true,  bubble: false, pie: true,  line: false, area: false, axes: false, legend: true, dataLabels: true, sort: true, categoryFilter: false, categoryConfig: true },
  donut:         { dimension: true, stackBy: false, multiSeries: false, measure: true,  bubble: false, pie: true,  line: false, area: false, axes: false, legend: true, dataLabels: true, sort: true, categoryFilter: false, categoryConfig: true },
  scatter:       { dimension: false, stackBy: false, multiSeries: false, measure: false, bubble: true,  pie: false, line: false, area: false, axes: true,  legend: false, dataLabels: false, sort: false, categoryFilter: false, categoryConfig: false },
  bubble:        { dimension: false, stackBy: false, multiSeries: false, measure: false, bubble: true,  pie: false, line: false, area: false, axes: true,  legend: false, dataLabels: false, sort: false, categoryFilter: false, categoryConfig: false },
  combo:         { dimension: true, stackBy: false, multiSeries: true,  measure: false, bubble: false, pie: false, line: false, area: false, axes: true,  legend: true, dataLabels: true, sort: true, categoryFilter: true, categoryConfig: true },
  table:         { dimension: false, stackBy: false, multiSeries: false, measure: false, bubble: false, pie: false, line: false, area: false, axes: false, legend: false, dataLabels: false, sort: false, categoryFilter: false, categoryConfig: false },
  kpi:           { dimension: false, stackBy: false, multiSeries: false, measure: false, bubble: false, pie: false, line: false, area: false, axes: false, legend: false, dataLabels: false, sort: false, categoryFilter: false, categoryConfig: false },
  wordcloud:     { dimension: true, stackBy: false, multiSeries: false, measure: true,  bubble: false, pie: false, line: false, area: false, axes: false, legend: false, dataLabels: false, sort: false, categoryFilter: false, categoryConfig: false }
};

export const getChartSupports = (type: ChartType): ChartSupports => {
  return SUPPORT_MATRIX[type];
};

export const isStackedChart = (type: ChartType): boolean => {
  return [
    'stacked-column',
    '100-stacked-column',
    'stacked-bar',
    '100-stacked-bar',
    'stacked-area',
    '100-stacked-area'
  ].includes(type);
};

export const is100StackedChart = (type: ChartType): boolean => {
  return [
    '100-stacked-column',
    '100-stacked-bar',
    '100-stacked-area'
  ].includes(type);
};

export const isVerticalChart = (type: ChartType): boolean => {
  return [
    'column',
    'stacked-column',
    '100-stacked-column'
  ].includes(type);
};

export const isHorizontalChart = (type: ChartType): boolean => {
  return [
    'bar',
    'stacked-bar',
    '100-stacked-bar'
  ].includes(type);
};

export const isMultiSeriesChart = (type: ChartType): boolean => {
  return getChartSupports(type).multiSeries;
};

export const isLineChart = (type: ChartType): boolean => {
  return [
    'line',
    'smooth-line'
  ].includes(type);
};

export const isAreaChart = (type: ChartType): boolean => {
  return [
    'area',
    'stacked-area',
    '100-stacked-area'
  ].includes(type);
};

export const isPieChart = (type: ChartType): boolean => {
  return [
    'pie',
    'donut'
  ].includes(type);
};

/**
 * Get default orientation for chart type
 */
export const getDefaultOrientation = (type: ChartType): 'vertical' | 'horizontal' => {
  if (isHorizontalChart(type)) return 'horizontal';
  return 'vertical';
};

/**
 * Validate chart configuration with context-aware rules
 */
export const validateChartConfig = (type: ChartType, config: any): string[] => {
  const supports = getChartSupports(type);
  const errors: string[] = [];

  // Dimension requirements
  if (supports.bubble) {
    if (!config.xDimension) errors.push('กรุณาเลือก X-Axis Dimension');
    if (!config.yDimension) errors.push('กรุณาเลือก Y-Axis Dimension');
    if (type === 'bubble' && !config.sizeDimension) errors.push('Bubble chart ต้องเลือก Size Dimension');
  } else if (supports.dimension && !config.dimension) {
    errors.push('กรุณาเลือก Dimension');
  }

  // Stack By
  if (supports.stackBy && !config.stackBy) {
    errors.push('กรุณาเลือก Stack By');
  }

  // Series vs Measure
  if (supports.multiSeries) {
    if (!config.series || config.series.length === 0) {
      errors.push('กรุณาเพิ่มอย่างน้อย 1 Series');
    } else {
      config.series.forEach((s: SeriesConfig, idx: number) => {
        if ((s.measure === 'sum' || s.measure === 'avg') && !s.measureCol) {
          errors.push(`Series #${idx + 1} (${s.label || 'Untitled'}) ต้องเลือก Column สำหรับ ${s.measure}`);
        }
      });
    }
  } else if (supports.measure) {
    if (!config.measure) errors.push('กรุณาเลือก Measure');
    if ((config.measure === 'sum' || config.measure === 'avg') && !config.measureCol) {
      errors.push('กรุณาเลือก Column สำหรับ Measure');
    }
  }

  return errors;
};
