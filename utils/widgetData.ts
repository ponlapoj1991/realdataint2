import { DashboardWidget, RawRow, DashboardFilter } from '../types';

export interface AggregatedWidgetData {
  data: any[];
  isStack: boolean;
  stackKeys?: string[];
}

const MAX_TOP_N = 500;

const clampTopN = (value?: number | null) => {
  if (!value || value <= 0) return null;
  return Math.min(Math.max(1, value), MAX_TOP_N);
};

const normalizeLimit = (value?: number | null) => {
  if (!value || value <= 0) return null;
  return Math.min(Math.max(1, value), MAX_TOP_N);
};

export const toDate = (value: any): Date | null => {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed);
};

export const normalizeDateStart = (value?: string | null) => {
  if (!value) return null;
  const date = toDate(value);
  if (!date) return null;
  date.setHours(0, 0, 0, 0);
  return date;
};

export const normalizeDateEnd = (value?: string | null) => {
  if (!value) return null;
  const date = toDate(value);
  if (!date) return null;
  date.setHours(23, 59, 59, 999);
  return date;
};

export const applyWidgetFilters = (rows: RawRow[], filters?: DashboardFilter[]) => {
  if (!filters || filters.length === 0) return rows;
  return rows.filter(row =>
    filters.every(filter => {
      if (!filter.column) return true;
      const val = row[filter.column];
      if (filter.dataType === 'date') {
        const rowDate = toDate(val);
        if (!rowDate) return false;
        const start = normalizeDateStart(filter.value);
        const end = normalizeDateEnd(filter.endValue);
        if (start && rowDate < start) return false;
        if (end && rowDate > end) return false;
        if (!start && !end) return true;
        return true;
      }
      if (filter.value === undefined || filter.value === '') return true;
      if (val === null || val === undefined) return false;
      return String(val).toLowerCase() === filter.value.toLowerCase();
    })
  );
};

const applySorting = (data: any[], order: string | undefined, valueKey: string) => {
  const sortBy = order || 'value-desc';
  switch (sortBy) {
    case 'value-desc':
      return [...data].sort((a, b) => (b[valueKey] || 0) - (a[valueKey] || 0));
    case 'value-asc':
      return [...data].sort((a, b) => (a[valueKey] || 0) - (b[valueKey] || 0));
    case 'name-asc':
      return [...data].sort((a, b) => String(a.name).localeCompare(String(b.name)));
    case 'name-desc':
      return [...data].sort((a, b) => String(b.name).localeCompare(String(a.name)));
    default:
      return data;
  }
};

const applyTopNLimiter = (
  rows: any[],
  widget: DashboardWidget,
  buildOthersRow?: (overflow: any[]) => any
) => {
  const limit = clampTopN(widget.topN);
  if (!limit || rows.length <= limit) return rows;

  const kept = rows.slice(0, limit);
  if (widget.groupOthers !== false && buildOthersRow) {
    const overflow = rows.slice(limit);
    if (overflow.length > 0) {
      const others = buildOthersRow(overflow);
      if (others) kept.push(others);
    }
  }
  return kept;
};

const sortMultiSeriesRows = (rows: any[], widget: DashboardWidget) => {
  if (!rows || rows.length === 0 || !widget.series || widget.series.length === 0) return rows;
  const specified = widget.sortSeriesId && widget.series.find(s => s.id === widget.sortSeriesId);
  const fallback = widget.series.find(s => s.type === 'bar') || widget.series[0];
  const target = specified || fallback;
  if (!target) return rows;
  return applySorting(rows, widget.sortBy, target.id);
};

export const aggregateWidgetData = (
  widget: DashboardWidget,
  rows: RawRow[]
): AggregatedWidgetData => {
  if (widget.type === 'table') {
    let processed = [...rows];
    if (widget.measureCol) {
      processed.sort((a, b) => {
        const valA = a[widget.measureCol!];
        const valB = b[widget.measureCol!];
        if (typeof valA === 'number' && typeof valB === 'number') return (valB as number) - (valA as number);
        return String(valB).localeCompare(String(valA));
      });
    }
    const limit = normalizeLimit(widget.limit) ?? 20;
    return { data: processed.slice(0, limit), isStack: false };
  }

  if (widget.type === 'scatter' || widget.type === 'bubble') {
    const result = rows.map((row, idx) => ({
      name: `Point ${idx + 1}`,
      x: parseFloat(String(row[widget.xDimension!])) || 0,
      y: parseFloat(String(row[widget.yDimension!])) || 0,
      size: widget.type === 'bubble' ? (parseFloat(String(row[widget.sizeDimension!])) || 1) : 1,
      color: widget.colorBy ? String(row[widget.colorBy]) : 'default'
    }));
    return { data: result, isStack: false };
  }

  const isStackedChart = [
    'stacked-column', '100-stacked-column',
    'stacked-bar', '100-stacked-bar',
    'stacked-area', '100-stacked-area'
  ].includes(widget.type);

  const is100Stacked = [
    '100-stacked-column', '100-stacked-bar', '100-stacked-area'
  ].includes(widget.type);

  if (isStackedChart && widget.stackBy) {
    const stackKeys = new Set<string>();
    const groups: Record<string, Record<string, number>> = {};

    rows.forEach(row => {
      const dimVal = String(row[widget.dimension] || '(Empty)');
      const stackVal = String(row[widget.stackBy!] || '(Other)');

      if (widget.categoryFilter && widget.categoryFilter.length > 0 && !widget.categoryFilter.includes(dimVal)) {
        return;
      }

      stackKeys.add(stackVal);
      if (!groups[dimVal]) groups[dimVal] = {};
      if (!groups[dimVal][stackVal]) groups[dimVal][stackVal] = 0;

      if (widget.measure === 'count') {
        groups[dimVal][stackVal]++;
      } else if (widget.measure === 'sum' && widget.measureCol) {
        const val = Number(row[widget.measureCol]) || 0;
        groups[dimVal][stackVal] += val;
      } else if (widget.measure === 'avg' && widget.measureCol) {
        groups[dimVal][stackVal] += Number(row[widget.measureCol]) || 0;
      }
    });

    const result = Object.keys(groups).map(dim => {
      const row: any = { name: dim };
      let total = 0;
      Object.keys(groups[dim]).forEach(stack => {
        row[stack] = groups[dim][stack];
        total += groups[dim][stack];
      });
      row.__total = total;
      return row;
    });

    const stackKeyList = Array.from(stackKeys);

    let finalRows = applySorting(result, widget.sortBy, '__total');
    finalRows = applyTopNLimiter(finalRows, widget, (overflow) => {
      if (overflow.length === 0) return null;
      const othersRow: any = { name: 'Others', __total: 0 };
      stackKeyList.forEach(key => {
        const value = overflow.reduce((sum, row) => sum + (row[key] || 0), 0);
        othersRow[key] = value;
        othersRow.__total += value;
      });
      return othersRow;
    });

    if (is100Stacked) {
      finalRows = finalRows.map(row => {
        const total = row.__total || 0;
        const normalized: any = { name: row.name };
        stackKeyList.forEach(key => {
          normalized[key] = total === 0 ? 0 : (row[key] || 0) / total;
        });
        return normalized;
      });
    } else {
      finalRows = finalRows.map(row => {
        const clone = { ...row };
        delete clone.__total;
        return clone;
      });
    }

    return { data: finalRows, isStack: isStackedChart, stackKeys: stackKeyList };
  }

  const groups: Record<string, number> = {};
  rows.forEach(row => {
    const key = String(row[widget.dimension] || '(Empty)');
    if (widget.categoryFilter && widget.categoryFilter.length > 0 && !widget.categoryFilter.includes(key)) return;
    if (!groups[key]) groups[key] = 0;
    if (widget.measure === 'count') {
      groups[key]++;
    } else if (widget.measure === 'sum' && widget.measureCol) {
      groups[key] += Number(row[widget.measureCol]) || 0;
    } else if (widget.measure === 'avg' && widget.measureCol) {
      groups[key] += Number(row[widget.measureCol]) || 0;
    }
  });

  let result = Object.keys(groups).map(key => ({
    name: key,
    value: groups[key]
  }));

  if (widget.measure === 'avg' && widget.measureCol) {
    result = result.map(item => ({
      ...item,
      value: item.value / (rows.filter(row => String(row[widget.dimension] || '(Empty)') === item.name).length || 1)
    }));
  }

  result = applySorting(result, widget.sortBy, 'value');

  result = applyTopNLimiter(result, widget, (overflow) => {
    const total = overflow.reduce((acc, curr) => acc + (curr.value || 0), 0);
    return total > 0 ? { name: 'Others', value: total } : null;
  });

  if (!widget.topN) {
    const limit = normalizeLimit(widget.limit) ?? 20;
    if (!widget.categoryFilter && result.length > limit && widget.type !== 'wordcloud') {
      const others = result.slice(limit).reduce((acc, curr) => acc + curr.value, 0);
      result = result.slice(0, limit);
      result.push({ name: 'Others', value: others });
    }
  }

  return { data: result, isStack: false };
};

export const processMultiSeriesData = (widget: DashboardWidget, rows: RawRow[]) => {
  if (!widget.series || widget.series.length === 0 || !widget.dimension) return [];

  const result: Record<string, any> = {};

  widget.series.forEach(series => {
    let seriesRows = applyWidgetFilters(rows, widget.filters);
    if (series.filters && series.filters.length > 0) {
      seriesRows = applyWidgetFilters(seriesRows, series.filters);
    }

    seriesRows.forEach(row => {
      const dimValue = String(row[widget.dimension!] || 'N/A');
      if (widget.categoryFilter && widget.categoryFilter.length > 0 && !widget.categoryFilter.includes(dimValue)) {
        return;
      }

      if (!result[dimValue]) {
        result[dimValue] = { [widget.dimension!]: dimValue, name: dimValue };
      }

      if (series.measure === 'count') {
        result[dimValue][series.id] = (result[dimValue][series.id] || 0) + 1;
      } else if (series.measure === 'sum' && series.measureCol) {
        const val = parseFloat(String(row[series.measureCol])) || 0;
        result[dimValue][series.id] = (result[dimValue][series.id] || 0) + val;
      } else if (series.measure === 'avg' && series.measureCol) {
        if (!result[dimValue][`${series.id}_sum`]) {
          result[dimValue][`${series.id}_sum`] = 0;
          result[dimValue][`${series.id}_count`] = 0;
        }
        const val = parseFloat(String(row[series.measureCol])) || 0;
        result[dimValue][`${series.id}_sum`] += val;
        result[dimValue][`${series.id}_count`] += 1;
      }
    });
  });

  Object.values(result).forEach(item => {
    widget.series!.forEach(series => {
      if (series.measure === 'avg') {
        const count = item[`${series.id}_count`] || 0;
        if (count > 0) {
          item[series.id] = item[`${series.id}_sum`] / count;
        }
      }
    });
  });

  const rowEntries = Object.values(result);
  const sorted = sortMultiSeriesRows(rowEntries, widget);
  const dimensionKey = widget.dimension!;
  const limited = applyTopNLimiter(sorted, widget, (overflow) => {
    if (!overflow.length) return null;
    const othersRow: any = { [dimensionKey]: 'Others', name: 'Others' };
    widget.series!.forEach(series => {
      if (series.measure === 'avg') {
        const sumKey = `${series.id}_sum`;
        const countKey = `${series.id}_count`;
        const totalSum = overflow.reduce((sum, row) => sum + (row[sumKey] || 0), 0);
        const totalCount = overflow.reduce((sum, row) => sum + (row[countKey] || 0), 0);
        othersRow[sumKey] = totalSum;
        othersRow[countKey] = totalCount;
        othersRow[series.id] = totalCount === 0 ? 0 : totalSum / totalCount;
      } else {
        othersRow[series.id] = overflow.reduce((sum, row) => sum + (row[series.id] || 0), 0);
      }
    });
    return othersRow;
  });
  return limited.map(row => {
    const clean = { ...row };
    widget.series!.forEach(series => {
      delete clean[`${series.id}_sum`];
      delete clean[`${series.id}_count`];
    });
    return clean;
  });
};
