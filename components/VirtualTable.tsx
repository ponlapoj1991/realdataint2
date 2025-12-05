/**
 * Virtual Table Component
 *
 * Purpose: Render large datasets efficiently
 * - Uses react-window for virtual scrolling
 * - Supports 1M+ rows smoothly
 * - Column filtering
 * - Row selection
 * - Customizable row height
 *
 * Usage: Replace regular table rendering in DataPrep, AiAgent, etc.
 */

import React, { useMemo, CSSProperties } from 'react';
import { FixedSizeList as List } from 'react-window';
import { RawRow, ColumnConfig } from '../types';

interface VirtualTableProps {
  data: RawRow[];
  columns: ColumnConfig[];
  height?: number;
  rowHeight?: number;
  selectedRows?: Set<number>;
  onRowClick?: (index: number, row: RawRow) => void;
  onRowDoubleClick?: (index: number, row: RawRow) => void;
  renderCell?: (row: RawRow, column: ColumnConfig, rowIndex: number) => React.ReactNode;
  emptyMessage?: string;
}

const VirtualTable: React.FC<VirtualTableProps> = ({
  data,
  columns,
  height = 600,
  rowHeight = 40,
  selectedRows = new Set(),
  onRowClick,
  onRowDoubleClick,
  renderCell,
  emptyMessage = 'No data available'
}) => {
  // Filter visible columns
  const visibleColumns = useMemo(() => {
    return columns.filter(col => col.visible !== false);
  }, [columns]);

  // Column width calculation (equal width for simplicity)
  const columnWidth = useMemo(() => {
    if (visibleColumns.length === 0) return 100;
    return Math.max(150, Math.floor(100 / visibleColumns.length));
  }, [visibleColumns]);

  // Default cell renderer
  const defaultRenderCell = (row: RawRow, column: ColumnConfig, rowIndex: number) => {
    const value = row[column.key];

    if (value === null || value === undefined || value === '') {
      return <span className="text-gray-400">—</span>;
    }

    // Handle arrays
    if (Array.isArray(value)) {
      return (
        <span className="text-xs">
          {value.slice(0, 3).join(', ')}
          {value.length > 3 && ` +${value.length - 3}`}
        </span>
      );
    }

    // Truncate long text
    const strValue = String(value);
    if (strValue.length > 50) {
      return (
        <span title={strValue} className="truncate">
          {strValue.substring(0, 47)}...
        </span>
      );
    }

    return <span>{strValue}</span>;
  };

  const cellRenderer = renderCell || defaultRenderCell;

  // Row renderer
  const Row = ({ index, style }: { index: number; style: CSSProperties }) => {
    const row = data[index];
    const isSelected = selectedRows.has(index);

    return (
      <div
        style={style}
        className={`flex border-b border-gray-100 cursor-pointer hover:bg-blue-50 transition-colors ${
          isSelected ? 'bg-blue-100' : 'bg-white'
        }`}
        onClick={() => onRowClick?.(index, row)}
        onDoubleClick={() => onRowDoubleClick?.(index, row)}
      >
        {/* Row number */}
        <div
          className="flex-shrink-0 w-12 flex items-center justify-center text-xs text-gray-500 border-r border-gray-100 bg-gray-50"
        >
          {index + 1}
        </div>

        {/* Cells */}
        {visibleColumns.map((column, colIndex) => (
          <div
            key={column.key}
            className="flex-shrink-0 px-3 flex items-center text-sm border-r border-gray-100 overflow-hidden"
            style={{ width: `${columnWidth}%` }}
          >
            {cellRenderer(row, column, index)}
          </div>
        ))}
      </div>
    );
  };

  // Empty state
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="text-center">
          <p className="text-gray-500">{emptyMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
      {/* Header */}
      <div className="flex bg-gray-50 border-b border-gray-200 font-semibold text-sm text-gray-700 sticky top-0 z-10">
        <div className="flex-shrink-0 w-12 flex items-center justify-center border-r border-gray-200">
          #
        </div>
        {visibleColumns.map(column => (
          <div
            key={column.key}
            className="flex-shrink-0 px-3 py-2 border-r border-gray-200 truncate"
            style={{ width: `${columnWidth}%` }}
            title={column.label || column.key}
          >
            {column.label || column.key}
          </div>
        ))}
      </div>

      {/* Virtual List */}
      <List
        height={height}
        itemCount={data.length}
        itemSize={rowHeight}
        width="100%"
        overscanCount={5}
      >
        {Row}
      </List>

      {/* Footer Stats */}
      <div className="bg-gray-50 border-t border-gray-200 px-4 py-2 text-xs text-gray-600">
        {data.length.toLocaleString()} rows × {visibleColumns.length} columns
      </div>
    </div>
  );
};

export default VirtualTable;
