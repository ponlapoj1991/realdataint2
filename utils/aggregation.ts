/**
 * Incremental Aggregation Engine
 *
 * Purpose: Efficiently aggregate large datasets
 * - Processes data in chunks
 * - Uses caching
 * - Supports filters
 * - Memory efficient (doesn't load all data at once)
 *
 * Supports: count, sum, avg aggregations
 */

import { RawRow, AggregateMethod, DashboardFilter } from '../types';
import { getProjectMetadata, getDataChunk, getCachedResult, setCachedResult } from './storage-v2';

// --- Types ---

export interface AggregationConfig {
  dimension: string;        // Group by column
  measure: AggregateMethod; // count, sum, avg
  measureCol?: string;      // Column to sum/avg (required for sum/avg)
  stackBy?: string;         // Optional: Stack by another dimension
  limit?: number;           // Limit results (Top N)
  filters?: DashboardFilter[]; // Filters to apply
}

export interface AggregationResult {
  [key: string]: number | Record<string, number>; // key -> value OR key -> { stack -> value }
}

// --- Helper: Apply Filters ---

const matchesFilters = (row: RawRow, filters: DashboardFilter[]): boolean => {
  if (!filters || filters.length === 0) return true;

  return filters.every(filter => {
    const value = row[filter.column];
    const filterValue = filter.value;

    if (value === null || value === undefined) return false;

    // String comparison (case-insensitive)
    return String(value).toLowerCase() === String(filterValue).toLowerCase();
  });
};

// --- Core Aggregation Function ---

/**
 * Aggregate data incrementally (chunk by chunk)
 */
export const aggregateData = async (
  projectId: string,
  config: AggregationConfig
): Promise<AggregationResult> => {
  const { dimension, measure, measureCol, stackBy, limit, filters } = config;

  // Generate cache key
  const cacheKey = JSON.stringify({ dimension, measure, measureCol, stackBy, limit, filters });

  // Try cache first
  const cached = await getCachedResult(projectId, cacheKey);
  if (cached) {
    console.log('[Aggregation] Cache hit');
    return cached;
  }

  console.log('[Aggregation] Cache miss, computing...');

  // Get metadata
  const metadata = await getProjectMetadata(projectId);
  if (!metadata) {
    throw new Error('Project not found');
  }

  // Initialize result
  const result: Record<string, any> = {};
  const counts: Record<string, number> = {}; // For averaging

  // Process each chunk
  for (let i = 0; i < metadata.chunkCount; i++) {
    const chunk = await getDataChunk(projectId, i);

    // Apply filters
    const filteredChunk = chunk.filter(row => matchesFilters(row, filters || []));

    // Aggregate chunk
    filteredChunk.forEach(row => {
      const dimValue = String(row[dimension] || 'N/A');

      if (stackBy) {
        // Stacked aggregation
        const stackValue = String(row[stackBy] || 'N/A');

        if (!result[dimValue]) {
          result[dimValue] = {};
          counts[dimValue] = {};
        }

        const stackResult = result[dimValue];
        const stackCount = counts[dimValue];

        switch (measure) {
          case 'count':
            stackResult[stackValue] = (stackResult[stackValue] || 0) + 1;
            break;

          case 'sum':
            if (measureCol) {
              const value = parseFloat(String(row[measureCol])) || 0;
              stackResult[stackValue] = (stackResult[stackValue] || 0) + value;
            }
            break;

          case 'avg':
            if (measureCol) {
              const value = parseFloat(String(row[measureCol])) || 0;
              stackResult[stackValue] = (stackResult[stackValue] || 0) + value;
              stackCount[stackValue] = (stackCount[stackValue] || 0) + 1;
            }
            break;
        }
      } else {
        // Simple aggregation
        switch (measure) {
          case 'count':
            result[dimValue] = (result[dimValue] || 0) + 1;
            break;

          case 'sum':
            if (measureCol) {
              const value = parseFloat(String(row[measureCol])) || 0;
              result[dimValue] = (result[dimValue] || 0) + value;
            }
            break;

          case 'avg':
            if (measureCol) {
              const value = parseFloat(String(row[measureCol])) || 0;
              result[dimValue] = (result[dimValue] || 0) + value;
              counts[dimValue] = (counts[dimValue] || 0) + 1;
            }
            break;
        }
      }
    });
  }

  // Finalize averaging
  if (measure === 'avg') {
    if (stackBy) {
      Object.keys(result).forEach(dimKey => {
        Object.keys(result[dimKey]).forEach(stackKey => {
          const count = counts[dimKey][stackKey];
          if (count > 0) {
            result[dimKey][stackKey] = result[dimKey][stackKey] / count;
          }
        });
      });
    } else {
      Object.keys(result).forEach(key => {
        const count = counts[key];
        if (count > 0) {
          result[key] = result[key] / count;
        }
      });
    }
  }

  // Sort by value (descending)
  let sortedEntries: [string, any][];

  if (stackBy) {
    // For stacked, sort by total across all stacks
    sortedEntries = Object.entries(result).sort((a, b) => {
      const sumA = Object.values(a[1] as Record<string, number>).reduce((acc, v) => acc + v, 0);
      const sumB = Object.values(b[1] as Record<string, number>).reduce((acc, v) => acc + v, 0);
      return sumB - sumA;
    });
  } else {
    sortedEntries = Object.entries(result).sort((a, b) => (b[1] as number) - (a[1] as number));
  }

  // Apply limit
  if (limit && limit > 0) {
    sortedEntries = sortedEntries.slice(0, limit);
  }

  // Convert back to object
  const finalResult: AggregationResult = Object.fromEntries(sortedEntries);

  // Cache result
  await setCachedResult(projectId, cacheKey, finalResult);

  return finalResult;
};

/**
 * Get unique values for a column (for filters/dropdowns)
 */
export const getUniqueValues = async (
  projectId: string,
  columnKey: string,
  limit: number = 100
): Promise<string[]> => {
  // Check cache
  const cacheKey = `unique_${columnKey}_${limit}`;
  const cached = await getCachedResult(projectId, cacheKey);
  if (cached) {
    return cached;
  }

  const metadata = await getProjectMetadata(projectId);
  if (!metadata) return [];

  const uniqueSet = new Set<string>();

  // Process chunks
  for (let i = 0; i < metadata.chunkCount; i++) {
    const chunk = await getDataChunk(projectId, i);

    chunk.forEach(row => {
      const value = String(row[columnKey] || '');
      if (value) {
        uniqueSet.add(value);
      }

      // Early exit if we have enough
      if (uniqueSet.size >= limit * 2) return;
    });

    if (uniqueSet.size >= limit * 2) break;
  }

  const uniqueValues = Array.from(uniqueSet).slice(0, limit);

  // Cache result
  await setCachedResult(projectId, cacheKey, uniqueValues);

  return uniqueValues;
};

/**
 * Get filtered data (for drill-down)
 */
export const getFilteredData = async (
  projectId: string,
  filters: DashboardFilter[],
  limit: number = 1000
): Promise<RawRow[]> => {
  const metadata = await getProjectMetadata(projectId);
  if (!metadata) return [];

  const result: RawRow[] = [];

  for (let i = 0; i < metadata.chunkCount; i++) {
    const chunk = await getDataChunk(projectId, i);
    const filtered = chunk.filter(row => matchesFilters(row, filters));

    result.push(...filtered);

    if (result.length >= limit) break;
  }

  return result.slice(0, limit);
};
