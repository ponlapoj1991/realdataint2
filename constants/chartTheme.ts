export interface ChartTheme {
  id: string;
  name: string;
  description?: string;
  palette: string[];
  background: {
    canvas: string;
    card: string;
    grid: string;
  };
  typography: {
    fontFamily: string;
    labelColor: string;
    axisColor: string;
  };
  chart: {
    barRadius: number;
    barBaseRadius?: number;
    barStrokeWidth: number;
    lineStrokeWidth: number;
    areaOpacity: number;
  };
}

export const CLASSIC_ANALYTICS_THEME: ChartTheme = {
  id: 'classic',
  name: 'Classic Analytics',
  palette: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#6366F1', '#84CC16', '#14B8A6'],
  background: {
    canvas: '#F8F9FA',
    card: '#FFFFFF',
    grid: '#E5E7EB',
  },
  typography: {
    fontFamily: 'Inter, "Segoe UI", sans-serif',
    labelColor: '#4B5563',
    axisColor: '#9CA3AF',
  },
  chart: {
    barRadius: 4,
    barBaseRadius: 0,
    barStrokeWidth: 0,
    lineStrokeWidth: 2,
    areaOpacity: 0.25,
  },
};

export const PPTIST_CHART_THEME: ChartTheme = {
  id: 'pptist',
  name: 'Deck Ready',
  description: 'PowerPoint-inspired palette with crisp outlines',
  palette: ['#3563AE', '#E46C0B', '#7F7F7F', '#4BACC6', '#9BBB59', '#C0504D', '#8064A2', '#0096C7', '#FFB703', '#EE6C4D'],
  background: {
    canvas: '#F5F6FA',
    card: '#FFFFFF',
    grid: '#E2E6ED',
  },
  typography: {
    fontFamily: '"Segoe UI", Calibri, sans-serif',
    labelColor: '#30323D',
    axisColor: '#5C6270',
  },
  chart: {
    barRadius: 2,
    barBaseRadius: 2,
    barStrokeWidth: 1,
    lineStrokeWidth: 3,
    areaOpacity: 0.35,
  },
};

export const CHART_THEMES: ChartTheme[] = [CLASSIC_ANALYTICS_THEME, PPTIST_CHART_THEME];
