

export enum AppView {
  LANDING = 'LANDING',
  PROJECT = 'PROJECT',
}

export enum ProjectTab {
  UPLOAD = 'UPLOAD',
  INGESTION = 'INGESTION',
  PREPARATION = 'PREPARATION',
  PREP_TOOLS = 'PREP_TOOLS',
  CLEANSING = 'CLEANSING',
  BUILD_STRUCTURE = 'BUILD_STRUCTURE',
  DASHBOARD = 'DASHBOARD',
  REPORT = 'REPORT',
  BUILD_REPORTS = 'BUILD_REPORTS',
  AI_AGENT = 'AI_AGENT',
  SETTINGS = 'SETTINGS', // New Tab
}

export enum AIProvider {
  GEMINI = 'GEMINI',
  OPENAI = 'OPENAI',
  CLAUDE = 'CLAUDE'
}

export interface AISettings {
  provider: AIProvider;
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

export interface AIPresets {
  ask: string[];
  action: string[];
}

// --- Toast Types ---
export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

export interface ToastContextType {
  showToast: (title: string, message?: string, type?: ToastType) => void;
}

export type CellValue = string | number | boolean | null;

export interface RawRow {
  [key: string]: CellValue;
}

export interface ColumnConfig {
  key: string;
  type: 'string' | 'number' | 'date' | 'tag_array' | 'sentiment' | 'channel';
  visible: boolean;
  label?: string;
}


export type DataSourceKind = 'ingestion' | 'prepared';

export interface DataSource {
  id: string;
  name: string;
  kind: DataSourceKind;
  rows: RawRow[];
  columns: ColumnConfig[];
  createdAt: number;
  updatedAt: number;
}

// --- New Transformation Types ---

export type TransformMethod = 
  | 'copy'              // Direct copy
  | 'array_count'       // Count items in array string
  | 'array_join'        // Join items "A, B"
  | 'array_extract'     // Extract specific item (e.g., Index 0)
  | 'array_includes'    // Boolean if contains X
  | 'date_extract'      // Extract specific date part (Date only, Time only, Year, Month)
  | 'date_format';      // Re-format date

export interface TransformationRule {
  id: string;
  targetName: string;   // Name of the new column
  sourceKey: string;    // Key from RawRow
  method: TransformMethod;
  params?: any;         // e.g. { delimiter: ',', index: 0, keyword: 'Service', datePart: 'date' }
  valueMap?: Record<string, string>; // New: Map result values to new labels (e.g. 'isComment' -> 'Comment')
}

export interface StructureRule extends TransformationRule {
  sourceId: string;
}

export interface BuildStructureConfig {
  id: string;
  name: string;
  sourceIds: string[];
  rules: StructureRule[];
  createdAt: number;
  updatedAt: number;
}

// --- Dashboard & Widget Types (Phase 2 & 3 & 4) ---

// Chart Type - แยกชัดเจนตามมาตรฐาน Google Sheets
export type ChartType =
  // Column Charts (vertical)
  | 'column'
  | 'stacked-column'
  | '100-stacked-column'

  // Bar Charts (horizontal)
  | 'bar'
  | 'stacked-bar'
  | '100-stacked-bar'

  // Line Charts
  | 'line'
  | 'smooth-line'
  | 'area'
  | 'stacked-area'
  | '100-stacked-area'

  // Pie Charts
  | 'pie'
  | 'donut'

  // Scatter
  | 'scatter'
  | 'bubble'

  // Combo
  | 'combo'

  // Other
  | 'table'
  | 'kpi'
  | 'wordcloud';

// Chart Category - สำหรับจัดกลุ่ม
export type ChartCategory = 'column' | 'bar' | 'line' | 'area' | 'pie' | 'scatter' | 'combo' | 'other';

// Chart Definition - metadata สำหรับแต่ละ chart type
export interface ChartDefinition {
  type: ChartType;
  category: ChartCategory;
  label: string;
  icon: string; // Lucide icon name
  description: string;
}

export type AggregateMethod = 'count' | 'sum' | 'avg';
export type SortOrder = 'value-desc' | 'value-asc' | 'name-asc' | 'name-desc' | 'original';

export type FilterDataType = 'text' | 'number' | 'date';

export interface DashboardFilter {
  id: string;
  column: string;
  value: string;
  endValue?: string;
  dataType?: FilterDataType;
}

// Data Labels Configuration
export interface DataLabelConfig {
  enabled: boolean;
  position: 'top' | 'center' | 'bottom' | 'inside' | 'outside' | 'end';
  fontSize: number;
  fontWeight: 'normal' | 'bold';
  color: string;
  showPercent?: boolean;
  percentPlacement?: 'prefix' | 'suffix';
  percentDecimals?: number;
}

// Series Configuration (Google Sheets style)
export interface SeriesConfig {
  id: string;
  label: string;
  type: 'bar' | 'line' | 'area';
  measure: AggregateMethod;
  measureCol?: string;
  filters?: DashboardFilter[];  // Per-series filters for time comparison
  yAxis: 'left' | 'right';
  color: string;
  dataLabels?: DataLabelConfig;
}

// Axis Configuration
export interface AxisConfig {
  title?: string;
  min?: number | 'auto';
  max?: number | 'auto';
  fontSize?: number;
  fontColor?: string;
  format?: string;  // '#,##0' | '#,##0.00' | '0%' | '$#,##0'
  slant?: 0 | 45 | 90;
  showGridlines?: boolean;
  gridColor?: string;
}

// Gridlines Configuration
export interface GridlineConfig {
  majorColor?: string;
  minorColor?: string;
  style?: 'solid' | 'dashed' | 'dotted';
}

// Legend Configuration
export interface LegendConfig {
  enabled: boolean;
  position: 'top' | 'bottom' | 'left' | 'right';
  fontSize: number;
  fontColor?: string;
  alignment?: 'left' | 'center' | 'right';
}

// Per-Category Configuration (for bar charts)
export interface CategoryConfig {
  color?: string;
  label?: string;  // Override label
  hidden?: boolean; // Hide this category
}

export interface DashboardWidget {
  id: string;
  title: string;
  type: ChartType;

  // Data Configuration
  dimension: string;      // X-Axis (Group By)

  // Multiple Series Support (NEW - Google Sheets style)
  series?: SeriesConfig[];  // Multiple series for comparison

  // Legacy single-series support (for backward compatibility)
  measure?: AggregateMethod;
  measureCol?: string;
  stackBy?: string;       // For stacked charts (stacked-column, stacked-bar, stacked-area)
  filters?: DashboardFilter[];

  // Bubble Chart Specific
  xDimension?: string;    // X-axis dimension for bubble/scatter
  yDimension?: string;    // Y-axis dimension for bubble/scatter
  sizeDimension?: string; // Size dimension for bubble chart
  colorBy?: string;       // Color grouping dimension

  // Pie/Donut Chart Specific
  innerRadius?: number;   // 0-80 for donut effect
  startAngle?: number;    // 0-360 degrees

  // Line Chart Specific
  curveType?: 'linear' | 'monotone' | 'step';
  strokeWidth?: number;

  limit?: number;         // Limit rows (Top 10, 20, etc)
  sortBy?: SortOrder;     // Sort order for data
  categoryFilter?: string[]; // Selected categories to show (empty = show all)

  // Titles & Subtitles (NEW)
  chartTitle?: string;
  subtitle?: string;

  // Axes Configuration (NEW)
  xAxis?: AxisConfig;
  leftYAxis?: AxisConfig;
  rightYAxis?: AxisConfig;

  // Gridlines (NEW)
  gridlines?: GridlineConfig;

  // Legend (UPDATED)
  legend?: LegendConfig;

  // Data Labels (NEW)
  dataLabels?: DataLabelConfig;

  // Per-Category Configuration (NEW)
  categoryConfig?: Record<string, CategoryConfig>;  // { 'Facebook': { color: '#1877F2' } }

  // Legacy Visual Options (for backward compatibility)
  showValues?: boolean;
  showLegend?: boolean;
  legendPosition?: 'top' | 'bottom' | 'left' | 'right';
  valueFormat?: 'number' | 'compact' | 'percent' | 'currency';
  sortSeriesId?: string;
  barSize?: number;
  categoryGap?: number;
  barOrientation?: 'horizontal' | 'vertical';
  barMode?: 'grouped' | 'stacked' | 'percent';
  showGrid?: boolean;

  width: 'half' | 'full'; // Grid span
  topN?: number;
  groupOthers?: boolean;
}

export interface ProjectDashboard {
  id: string;
  name: string;
  description?: string;
  widgets: DashboardWidget[];
  createdAt: number;
  updatedAt: number;
}

export interface DrillDownState {
  isOpen: boolean;
  title: string;
  filterCol: string;
  filterVal: string;
  data: RawRow[];
}

// --- Report Builder Types (Phase 5) ---

export type ShapeType = 'rect' | 'circle' | 'triangle' | 'line' | 'arrow' | 'star';
export type ElementType = 'widget' | 'text' | 'image' | 'shape' | 'table' | 'chart';

// Table Cell Data
export interface TableCell {
  text: string;
  rowSpan?: number;
  colSpan?: number;
  style?: ReportElementStyle;
}

// Table Data Structure
export interface TableData {
  rows: TableCell[][];
  columnWidths?: number[];
  rowHeights?: number[];
}

// Chart Data (for embedded charts from PPTX)
export interface ChartData {
  chartType: 'bar' | 'line' | 'pie' | 'area';
  data: any[];
  title?: string;
}

export interface ReportElementStyle {
  // Typography
  fontSize?: string;
  fontFamily?: string;
  fontWeight?: string;
  fontStyle?: string;
  textDecoration?: string;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  color?: string; // Text color
  lineHeight?: string;
  letterSpacing?: string;

  // Appearance
  backgroundColor?: string;
  fill?: string; // Shape fill
  stroke?: string; // Border color
  strokeWidth?: number;
  borderRadius?: number;
  opacity?: number;
  rotation?: number;
  shadow?: boolean;
}

export interface ReportElement {
  id: string;
  name?: string;
  type: ElementType;
  shapeType?: ShapeType; // Only if type === 'shape'
  widgetId?: string;     // Only if type === 'widget'
  dashboardId?: string;  // Keep source dashboard reference for widgets
  content?: string;      // Text content or Image Base64
  tableData?: TableData; // Only if type === 'table'
  chartData?: ChartData; // Only if type === 'chart'
  style?: ReportElementStyle;

  locked?: boolean;
  hidden?: boolean;

  // Positioning
  x: number;
  y: number;
  w: number;
  h: number;
  zIndex?: number;
}

export interface ReportSlide {
  id: string;
  background?: string; // Hex color or Base64 image
  elements: ReportElement[];
}

export interface ReportPresentation {
  id: string;
  name: string;
  description?: string;
  slides: ReportSlide[];
  createdAt: number;
  updatedAt: number;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  lastModified: number;
  data: RawRow[];          // Legacy active data snapshot
  columns: ColumnConfig[]; // Legacy active schema

  dataSources?: DataSource[]; // Multi-table support
  activeDataSourceId?: string; // Which table powers features

  transformRules?: TransformationRule[];
  buildStructureConfigs?: BuildStructureConfig[];
  activeBuildConfigId?: string;
  dashboard?: DashboardWidget[]; // Saved Dashboard Config
  dashboards?: ProjectDashboard[];
  activeDashboardId?: string;
  
  reportConfig?: ReportSlide[]; // Legacy single presentation config
  reportPresentations?: ReportPresentation[];
  activePresentationId?: string;
  
  aiSettings?: AISettings; // New: Per-project AI Settings
  aiPresets?: AIPresets; // New: Saved Prompt Presets
}

// Interface for the globally available XLSX object from CDN
export interface XLSXLibrary {
  read: (data: any, options?: any) => any;
  utils: {
    sheet_to_json: (worksheet: any, options?: any) => any[];
    json_to_sheet: (data: any[]) => any;
    book_new: () => any;
    book_append_sheet: (workbook: any, worksheet: any, name: string) => void;
  };
  writeFile: (workbook: any, filename: string) => void;
}

declare global {
  interface Window {
    XLSX: XLSXLibrary;
    html2canvas: any;
    PptxGenJS: any;
    JSZip: any;
  }
}
