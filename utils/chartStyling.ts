import { DashboardWidget } from '../types';
import { ChartTheme, CLASSIC_ANALYTICS_THEME } from '../constants/chartTheme';

export const DEFAULT_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#6366F1', '#84cc16', '#14b8a6'];

const getSentimentColor = (key: string, index: number) => {
  const lower = key.toLowerCase();
  if (lower.includes('positive') || lower.includes('good') || lower.includes('happy')) return '#10B981';
  if (lower.includes('negative') || lower.includes('bad') || lower.includes('angry')) return '#EF4444';
  if (lower.includes('neutral') || lower.includes('average')) return '#9CA3AF';
  return DEFAULT_COLORS[index % DEFAULT_COLORS.length];
};

export const getPalette = (widget: DashboardWidget, theme: ChartTheme = CLASSIC_ANALYTICS_THEME) => {
  if (widget.palette && widget.palette.length > 0) return widget.palette;
  if (theme?.palette?.length) return theme.palette;
  return DEFAULT_COLORS;
};

export const getWidgetColor = (
  widget: DashboardWidget,
  key: string,
  index: number,
  theme: ChartTheme = CLASSIC_ANALYTICS_THEME
) => {
  if ((widget as any).seriesColors && (widget as any).seriesColors[key]) {
    return (widget as any).seriesColors[key];
  }
  if (widget.stackBy) return getSentimentColor(key, index);
  const palette = getPalette(widget, theme);
  return palette[index % palette.length] || widget.color || palette[0] || DEFAULT_COLORS[0];
};

export const getCategoryColor = (
  widget: DashboardWidget,
  key: string,
  index: number,
  theme: ChartTheme = CLASSIC_ANALYTICS_THEME
) => {
  return widget.categoryConfig?.[key]?.color || getWidgetColor(widget, key, index, theme);
};
