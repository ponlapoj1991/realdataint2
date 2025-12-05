import { Project, ReportPresentation, ReportSlide } from '../types';

const now = () => Date.now();

const normalizePresentation = (presentation: ReportPresentation): ReportPresentation => ({
  ...presentation,
  name: presentation.name?.trim() || 'Untitled Presentation',
  slides: presentation.slides || [],
  createdAt: presentation.createdAt || now(),
  updatedAt: presentation.updatedAt || now(),
});

const createPresentation = (name: string, slides: ReportSlide[] = []): ReportPresentation => ({
  id: crypto.randomUUID(),
  name: name?.trim() || 'Untitled Presentation',
  slides,
  createdAt: now(),
  updatedAt: now(),
});

const syncLegacySlides = (project: Project, active?: ReportPresentation): Project => {
  if (!active) return project;
  return {
    ...project,
    reportConfig: active.slides,
  };
};

export const ensurePresentations = (
  project: Project
): {
  project: Project;
  presentations: ReportPresentation[];
  activePresentation?: ReportPresentation;
  changed: boolean;
} => {
  let presentations = (project.reportPresentations || []).map(normalizePresentation);
  let changed = !project.reportPresentations;

  if (presentations.length === 0 && project.reportConfig && project.reportConfig.length > 0) {
    presentations = [
      {
        id: `${project.id}-legacy-presentation`,
        name: 'Legacy Presentation',
        slides: project.reportConfig,
        createdAt: project.lastModified || now(),
        updatedAt: project.lastModified || now(),
      },
    ];
    changed = true;
  }

  const activePresentationId =
    presentations.length === 0
      ? undefined
      : presentations.find((p) => p.id === project.activePresentationId)
        ? project.activePresentationId
        : presentations[0].id;

  if (activePresentationId !== project.activePresentationId) {
    changed = true;
  }

  let normalized = project;
  if (changed) {
    normalized = {
      ...project,
      reportPresentations: presentations,
      activePresentationId,
    };
    if (activePresentationId) {
      const active = presentations.find((p) => p.id === activePresentationId);
      normalized = syncLegacySlides(normalized, active);
    }
  }

  const activePresentation =
    presentations.find((p) => p.id === (normalized.activePresentationId || presentations[0]?.id)) || presentations[0];

  return {
    project: normalized,
    presentations,
    activePresentation,
    changed,
  };
};

export const addPresentation = (project: Project, name: string): { project: Project; presentation: ReportPresentation } => {
  const { project: normalized } = ensurePresentations(project);
  const presentation = createPresentation(name);
  const presentations = [...(normalized.reportPresentations || []), presentation];

  const updated: Project = syncLegacySlides(
    {
      ...normalized,
      reportPresentations: presentations,
      activePresentationId: presentation.id,
      lastModified: now(),
    },
    presentation
  );

  return { project: updated, presentation };
};

export const renamePresentation = (project: Project, presentationId: string, name: string): Project => {
  const { project: normalized } = ensurePresentations(project);
  const presentations = (normalized.reportPresentations || []).map((p) =>
    p.id === presentationId ? { ...p, name: name.trim() || p.name, updatedAt: now() } : p
  );
  return {
    ...normalized,
    reportPresentations: presentations,
    lastModified: now(),
  };
};

export const updatePresentationSlides = (
  project: Project,
  presentationId: string,
  slides: ReportSlide[]
): Project => {
  const { project: normalized } = ensurePresentations(project);
  const presentations = (normalized.reportPresentations || []).map((p) =>
    p.id === presentationId ? { ...p, slides, updatedAt: now() } : p
  );

  const updated: Project = {
    ...normalized,
    reportPresentations: presentations,
    lastModified: now(),
  };

  if (normalized.activePresentationId === presentationId) {
    return syncLegacySlides(updated, presentations.find((p) => p.id === presentationId));
  }

  return updated;
};

export const setActivePresentation = (project: Project, presentationId: string): Project => {
  const { project: normalized } = ensurePresentations(project);
  const target = (normalized.reportPresentations || []).find((p) => p.id === presentationId);
  if (!target) return normalized;
  return syncLegacySlides(
    {
      ...normalized,
      activePresentationId: presentationId,
      lastModified: now(),
    },
    target
  );
};

export const removePresentation = (project: Project, presentationId: string): Project => {
  const { project: normalized } = ensurePresentations(project);
  const presentations = (normalized.reportPresentations || []).filter((p) => p.id !== presentationId);
  let activePresentationId = normalized.activePresentationId;

  if (presentationId === normalized.activePresentationId) {
    activePresentationId = presentations[0]?.id;
  }

  const updated: Project = {
    ...normalized,
    reportPresentations: presentations,
    activePresentationId,
    lastModified: now(),
  };

  return syncLegacySlides(updated, presentations.find((p) => p.id === activePresentationId));
};
