import { ColumnConfig, DataSource, DataSourceKind, Project, RawRow } from '../types';

const createDefaultSource = (project: Project): DataSource => ({
  id: project.id + '-primary',
  name: 'Primary Table',
  kind: 'ingestion',
  rows: project.data || [],
  columns: project.columns || [],
  createdAt: project.lastModified || Date.now(),
  updatedAt: project.lastModified || Date.now(),
});

export const ensureDataSources = (project: Project): { project: Project; active: DataSource } => {
  const existing = project.dataSources?.length ? project.dataSources : undefined;
  const sources = existing ?? [createDefaultSource(project)];
  const activeId = project.activeDataSourceId || sources[0].id;
  const active = sources.find((s) => s.id === activeId) || sources[0];
  const synced: Project = {
    ...project,
    dataSources: sources,
    activeDataSourceId: active.id,
    data: active.rows,
    columns: active.columns,
  };
  return { project: synced, active };
};

export const setActiveDataSource = (project: Project, sourceId: string): Project => {
  const { project: normalized } = ensureDataSources(project);
  const nextActive = normalized.dataSources!.find((s) => s.id === sourceId);
  if (!nextActive) return normalized;
  return {
    ...normalized,
    activeDataSourceId: nextActive.id,
    data: nextActive.rows,
    columns: nextActive.columns,
  };
};

export const upsertDataSource = (
  project: Project,
  source: DataSource,
  options: { setActive?: boolean } = {}
): Project => {
  const { project: normalized } = ensureDataSources(project);
  const existingIndex = normalized.dataSources!.findIndex((s) => s.id === source.id);
  const dataSources = [...(normalized.dataSources || [])];
  if (existingIndex >= 0) {
    dataSources[existingIndex] = { ...source, updatedAt: Date.now() };
  } else {
    dataSources.push({ ...source, createdAt: Date.now(), updatedAt: Date.now() });
  }

  const activeId = options.setActive ? source.id : normalized.activeDataSourceId || source.id;
  const active = dataSources.find((s) => s.id === activeId) || dataSources[0];

  return {
    ...normalized,
    dataSources,
    activeDataSourceId: active.id,
    data: active.rows,
    columns: active.columns,
    lastModified: Date.now(),
  };
};

export const updateDataSourceRows = (
  project: Project,
  sourceId: string,
  rows: RawRow[],
  columns: ColumnConfig[],
  mode: 'replace' | 'append' = 'replace'
): Project => {
  const { project: normalized } = ensureDataSources(project);
  const dataSources = (normalized.dataSources || []).map((s) => {
    if (s.id !== sourceId) return s;
    const nextRows = mode === 'append' ? [...s.rows, ...rows] : rows;
    const mergedColumns = mergeColumns(s.columns, columns);
    return {
      ...s,
      rows: nextRows,
      columns: mergedColumns,
      updatedAt: Date.now(),
    };
  });

  const active = dataSources.find((s) => s.id === normalized.activeDataSourceId) || dataSources[0];

  return {
    ...normalized,
    dataSources,
    data: active.rows,
    columns: active.columns,
    lastModified: Date.now(),
  };
};

export const removeDataSource = (project: Project, sourceId: string): Project => {
  const { project: normalized } = ensureDataSources(project);
  const dataSources = (normalized.dataSources || []).filter((s) => s.id !== sourceId);

  if (!dataSources.length) {
    return {
      ...normalized,
      dataSources: [],
      activeDataSourceId: undefined,
      data: [],
      columns: [],
      lastModified: Date.now(),
    };
  }

  const activeId = normalized.activeDataSourceId === sourceId ? dataSources[0].id : normalized.activeDataSourceId;
  const active = dataSources.find((s) => s.id === activeId) || dataSources[0];

  return {
    ...normalized,
    dataSources,
    activeDataSourceId: active.id,
    data: active.rows,
    columns: active.columns,
    lastModified: Date.now(),
  };
};

const mergeColumns = (current: ColumnConfig[], incoming: ColumnConfig[]) => {
  const map: Record<string, ColumnConfig> = {};
  [...current, ...incoming].forEach((col) => {
    map[col.key] = { ...map[col.key], ...col, key: col.key, visible: col.visible ?? true };
  });
  return Object.values(map);
};

export const addDerivedDataSource = (
  project: Project,
  name: string,
  rows: RawRow[],
  columns: ColumnConfig[],
  kind: DataSourceKind = 'prepared'
): Project => {
  const source: DataSource = {
    id: crypto.randomUUID(),
    name,
    kind,
    rows,
    columns,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  return upsertDataSource(project, source);
};

export const getDataSourcesByKind = (project: Project, kind: DataSourceKind) => {
  const { project: normalized } = ensureDataSources(project);
  return (normalized.dataSources || []).filter((s) => s.kind === kind);
};
