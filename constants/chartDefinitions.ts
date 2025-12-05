import { ChartDefinition, ChartCategory } from '../types';

/**
 * Chart Definitions - Complete chart type catalog with metadata
 * Organized by category following Google Sheets standards
 */

export const CHART_DEFINITIONS: ChartDefinition[] = [
  // ========================================
  // COLUMN CHARTS (Vertical)
  // ========================================
  {
    type: 'column',
    category: 'column',
    label: 'Clustered Column',
    icon: 'BarChart3',
    description: 'Compare values across categories with side-by-side columns'
  },
  {
    type: 'stacked-column',
    category: 'column',
    label: 'Stacked Column',
    icon: 'Layers',
    description: 'Show column composition stacked vertically per category'
  },
  {
    type: '100-stacked-column',
    category: 'column',
    label: '100% Stacked Column',
    icon: 'Percent',
    description: 'Normalize each column to 100% to compare proportions'
  },

  // ========================================
  // BAR CHARTS (Horizontal)
  // ========================================
  {
    type: 'bar',
    category: 'bar',
    label: 'Clustered Bar',
    icon: 'BarChartHorizontal',
    description: 'Horizontal version of clustered column for ranking'
  },
  {
    type: 'stacked-bar',
    category: 'bar',
    label: 'Stacked Bar',
    icon: 'Layers',
    description: 'Compare composition across categories with horizontal stacks'
  },
  {
    type: '100-stacked-bar',
    category: 'bar',
    label: '100% Stacked Bar',
    icon: 'Percent',
    description: 'Normalized stacked bars – focus on proportion rather than totals'
  },

  // ========================================
  // LINE CHARTS
  // ========================================
  {
    type: 'line',
    category: 'line',
    label: 'Line',
    icon: 'LineChart',
    description: 'Basic line chart - show trends over time'
  },
  {
    type: 'smooth-line',
    category: 'line',
    label: 'Smooth Line',
    icon: 'TrendingUp',
    description: 'Smooth line chart - show trends with curve interpolation'
  },

  // ========================================
  // AREA CHARTS
  // ========================================
  {
    type: 'area',
    category: 'area',
    label: 'Area',
    icon: 'AreaChart',
    description: 'Area chart - emphasize magnitude of change over time'
  },
  {
    type: 'stacked-area',
    category: 'area',
    label: 'Stacked Area',
    icon: 'Layers',
    description: 'Stacked area - show composition over time'
  },
  {
    type: '100-stacked-area',
    category: 'area',
    label: '100% Stacked Area',
    icon: 'Percent',
    description: 'Normalized stacked area - compare proportions over time'
  },

  // ========================================
  // PIE CHARTS
  // ========================================
  {
    type: 'pie',
    category: 'pie',
    label: 'Pie',
    icon: 'PieChart',
    description: 'Pie chart - show parts of a whole'
  },
  {
    type: 'donut',
    category: 'pie',
    label: 'Donut',
    icon: 'Circle',
    description: 'Donut chart - pie chart with center hole for additional info'
  },

  // ========================================
  // SCATTER
  // ========================================
  {
    type: 'scatter',
    category: 'scatter',
    label: 'Scatter',
    icon: 'Scatter',
    description: 'Scatter plot - show relationship between two variables'
  },
  {
    type: 'bubble',
    category: 'scatter',
    label: 'Bubble',
    icon: 'Circle',
    description: 'Bubble chart - scatter with third dimension shown as size'
  },

  // ========================================
  // COMBO
  // ========================================
  {
    type: 'combo',
    category: 'combo',
    label: 'Combo',
    icon: 'Combine',
    description: 'Combination chart - mix different chart types (column + line)'
  },

  // ========================================
  // OTHER
  // ========================================
  {
    type: 'table',
    category: 'other',
    label: 'Table',
    icon: 'Table',
    description: 'Data table - show detailed raw data'
  },
  {
    type: 'kpi',
    category: 'other',
    label: 'KPI',
    icon: 'Hash',
    description: 'Key Performance Indicator - single large number'
  },
  {
    type: 'wordcloud',
    category: 'other',
    label: 'Word Cloud',
    icon: 'Cloud',
    description: 'Word cloud - visualize text frequency'
  }
];

/**
 * Get chart definition by type
 */
export const getChartDefinition = (type: string): ChartDefinition | undefined => {
  return CHART_DEFINITIONS.find(def => def.type === type);
};

/**
 * Get all charts in a category
 */
export const getChartsByCategory = (category: ChartCategory): ChartDefinition[] => {
  return CHART_DEFINITIONS.filter(def => def.category === category);
};

/**
 * Category labels for UI
 */
export const CATEGORY_LABELS: Record<ChartCategory, string> = {
  column: 'Column Charts',
  bar: 'Bar Charts',
  line: 'Line Charts',
  area: 'Area Charts',
  pie: 'Pie & Donut',
  scatter: 'Scatter & Bubble',
  combo: 'Combination',
  other: 'Other Visuals'
};

/**
 * Category order for display
 */
export const CATEGORY_ORDER: ChartCategory[] = [
  'column',
  'bar',
  'line',
  'area',
  'pie',
  'scatter',
  'combo',
  'other'
];
