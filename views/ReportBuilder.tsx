import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Edit3, Trash2, ArrowLeft, Loader2, Save, X, LayoutDashboard } from 'lucide-react';
import { Project, DashboardWidget, RawRow, Slide } from '../types';
import { useToast } from '../components/ToastProvider';
import {
  ensurePresentations,
  addPresentation,
  renamePresentation,
  removePresentation,
  setActivePresentation,
  updatePresentationSlides,
} from '../utils/reportPresentations';
import { saveProject } from '../utils/storage-compat';
import BuildReports from './BuildReports';
import { CLASSIC_ANALYTICS_THEME } from '../constants/chartTheme';
import { applyTransformation } from '../utils/transform';
import { buildDashboardChartPayload } from '../utils/dashboardChartPayload';

interface ReportBuilderProps {
  project: Project;
  onUpdateProject: (project: Project) => void;
}

type ViewMode = 'list' | 'editor';

const ReportBuilder: React.FC<ReportBuilderProps> = ({ project, onUpdateProject }) => {
  const { project: normalizedProject, presentations, activePresentation, changed } = useMemo(
    () => ensurePresentations(project),
    [project]
  );

  const [mode, setMode] = useState<ViewMode>('list');
  const [selectedPresentationId, setSelectedPresentationId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newPresentationName, setNewPresentationName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [pendingSaveIntent, setPendingSaveIntent] = useState<'stay' | 'close' | null>(null);
  const [isInsertDrawerOpen, setInsertDrawerOpen] = useState(false);
  const [insertingWidgetId, setInsertingWidgetId] = useState<string | null>(null);
  const [selectedDashboardId, setSelectedDashboardId] = useState<string | null>(
    project.activeDashboardId || project.dashboards?.[0]?.id || null
  );
  const [iframeWindow, setIframeWindow] = useState<Window | null>(null);
  const [isEditorReady, setIsEditorReady] = useState(false);
  const { showToast } = useToast();
  const dashboardsForInsert = project.dashboards || [];
  const finalData = useMemo<RawRow[]>(() => {
    if (project.transformRules && project.transformRules.length > 0) {
      return applyTransformation(project.data, project.transformRules);
    }
    return project.data;
  }, [project]);

  useEffect(() => {
    if (changed) {
      onUpdateProject(normalizedProject);
      saveProject(normalizedProject);
    }
  }, [changed, normalizedProject, onUpdateProject]);

  useEffect(() => {
    if (presentations.length === 0) {
      setMode('list');
      setSelectedPresentationId(null);
    }
  }, [presentations.length]);

  useEffect(() => {
    if (!dashboardsForInsert.length) {
      setSelectedDashboardId(null);
      return;
    }
    if (!selectedDashboardId || !dashboardsForInsert.find((dash) => dash.id === selectedDashboardId)) {
      setSelectedDashboardId(dashboardsForInsert[0].id);
    }
  }, [dashboardsForInsert, selectedDashboardId]);

  const persistProject = async (next: Project) => {
    onUpdateProject(next);
    await saveProject(next);
  };

  const editingPresentation =
    presentations.find((p) => p.id === (selectedPresentationId || normalizedProject.activePresentationId)) ||
    activePresentation;
  const selectedDashboard =
    dashboardsForInsert.find((dash) => dash.id === selectedDashboardId) || dashboardsForInsert[0];

  const persistSlidesFromExport = useCallback(
    async (slides: Slide[], exitAfter?: boolean) => {
      if (!editingPresentation) {
        showToast('Save failed', 'No active presentation to update.', 'error');
        setIsSaving(false);
        setPendingSaveIntent(null);
        return;
      }
      try {
        const updatedProject = updatePresentationSlides(normalizedProject, editingPresentation.id, slides);
        await persistProject(updatedProject);
        showToast('Saved', `"${editingPresentation.name}" updated.`, 'success');
        if (exitAfter) {
          setMode('list');
          setSelectedPresentationId(null);
        }
      } catch (error) {
        console.error('Failed to persist presentation', error);
        showToast('Save failed', 'Unable to persist presentation slides.', 'error');
      } finally {
        setIsSaving(false);
        setPendingSaveIntent(null);
      }
    },
    [editingPresentation, normalizedProject, persistProject, showToast]
  );

  const executeExportRequest = useCallback(
    (intentOverride?: 'stay' | 'close') => {
      const intentToUse = intentOverride ?? pendingSaveIntent;
      if (!intentToUse) return false;
      if (!iframeWindow) {
        showToast('Editor unavailable', 'Unable to communicate with PPTist.', 'error');
        setPendingSaveIntent(null);
        setIsSaving(false);
        return false;
      }
      if (!isEditorReady) {
        showToast('Editor still loading', 'Waiting for PPTist to finish initializing.', 'info');
        return false;
      }
      setIsSaving(true);
      iframeWindow.postMessage(
        {
          source: 'realdata-host',
          type: 'request-presentation-export',
        },
        '*'
      );
      return true;
    },
    [iframeWindow, isEditorReady, pendingSaveIntent, showToast]
  );

  const requestPresentationExport = useCallback(
    (intent: 'stay' | 'close') => {
      setPendingSaveIntent(intent);
      executeExportRequest(intent);
    },
    [executeExportRequest]
  );

  const handleCreatePresentation = async () => {
    if (!newPresentationName.trim()) {
      showToast('Name required', 'Please provide a presentation name.', 'warning');
      return;
    }
    const { project: updated, presentation } = addPresentation(normalizedProject, newPresentationName.trim());
    await persistProject(updated);
    setNewPresentationName('');
    setIsCreateOpen(false);
    setSelectedPresentationId(presentation.id);
    setMode('editor');
    showToast('Presentation created', presentation.name, 'success');
  };

  const handleOpenPresentation = async (presentationId: string) => {
    const updated = setActivePresentation(normalizedProject, presentationId);
    await persistProject(updated);
    setSelectedPresentationId(presentationId);
    setMode('editor');
  };

  const handleDeletePresentation = async (presentationId: string) => {
    const target = presentations.find((p) => p.id === presentationId);
    if (!target) return;
    if (!window.confirm(`Delete "${target.name}"? This cannot be undone.`)) return;
    const updated = removePresentation(normalizedProject, presentationId);
    await persistProject(updated);
    showToast('Presentation deleted', target.name, 'success');
    if (selectedPresentationId === presentationId) {
      setSelectedPresentationId(null);
      setMode('list');
    }
  };

  const handleRenamePresentation = async (presentationId: string) => {
    const target = presentations.find((p) => p.id === presentationId);
    if (!target) return;
    const nextName = prompt('Rename presentation', target.name);
    if (!nextName || nextName.trim() === target.name) return;
    const updated = renamePresentation(normalizedProject, presentationId, nextName.trim());
    await persistProject(updated);
    showToast('Presentation renamed', nextName.trim(), 'success');
  };

  const handleInsertChart = useCallback(
    async (widget: DashboardWidget) => {
      if (!iframeWindow) {
        showToast('Editor not ready', 'Waiting for PPTist to finish loading.', 'warning');
        return;
      }
      setInsertingWidgetId(widget.id);
      try {
        const payload = buildDashboardChartPayload(widget, finalData, {
          theme: CLASSIC_ANALYTICS_THEME,
          sourceDashboardId: selectedDashboard?.id,
        });
        if (!payload) {
          showToast('Nothing to insert', 'This chart has no data after filters.', 'warning');
          return;
        }
        iframeWindow.postMessage(
          {
            source: 'realdata-host',
            type: 'insert-dashboard-chart',
            payload,
          },
          '*'
        );
        setInsertDrawerOpen(false);
        showToast('Chart inserted', widget.title || 'Dashboard chart added to slide.', 'success');
      } catch (error) {
        console.error('Failed to prepare dashboard chart payload', error);
        showToast('Insert failed', 'Unable to serialize chart data.', 'error');
      } finally {
        setInsertingWidgetId(null);
      }
    },
    [finalData, iframeWindow, selectedDashboard?.id, showToast]
  );

  const handleIframeLoad = useCallback((iframe: HTMLIFrameElement | null) => {
    setIframeWindow(iframe?.contentWindow ?? null);
    setIsEditorReady(false);
  }, []);

  const handlePptistMessage = useCallback(
    (event: MessageEvent) => {
      if (typeof event.data !== 'object' || !event.data) return;
      if (event.data.source !== 'pptist') return;
      if (event.data.type === 'open-dashboard-insert') {
        if (!dashboardsForInsert.length) {
          showToast('No dashboards', 'Create a dashboard in Dashboard before inserting charts.', 'info');
          return;
        }
        setInsertDrawerOpen(true);
      }
      if (event.data.type === 'ready') {
        setIsEditorReady(true);
      }
      if (event.data.type === 'request-save') {
        requestPresentationExport('stay');
      }
      if (event.data.type === 'presentation-export') {
        const payload = event.data.payload;
        if (!payload?.slides || !Array.isArray(payload.slides)) {
          showToast('Save failed', 'No slide data received from editor.', 'error');
          setIsSaving(false);
          setPendingSaveIntent(null);
          return;
        }
        persistSlidesFromExport(payload.slides, pendingSaveIntent === 'close');
      }
    },
    [dashboardsForInsert.length, pendingSaveIntent, persistSlidesFromExport, requestPresentationExport, showToast]
  );

  useEffect(() => {
    window.addEventListener('message', handlePptistMessage);
    return () => window.removeEventListener('message', handlePptistMessage);
  }, [handlePptistMessage]);

  useEffect(() => {
    if (mode !== 'editor') {
      setIsEditorReady(false);
    }
  }, [mode]);

  useEffect(() => {
    if (!iframeWindow || !isEditorReady || !pendingSaveIntent || isSaving) {
      return;
    }
    executeExportRequest();
  }, [iframeWindow, isEditorReady, pendingSaveIntent, isSaving, executeExportRequest]);

  useEffect(() => {
    if (!iframeWindow || mode !== 'editor' || !editingPresentation || !isEditorReady) return;
    iframeWindow.postMessage(
      {
        source: 'realdata-host',
        type: 'load-presentation',
        payload: {
          slides: editingPresentation.slides || [],
          title: editingPresentation.name,
        },
      },
      '*'
    );
  }, [editingPresentation, iframeWindow, mode, isEditorReady]);

  const renderListView = () => (
    <div className="h-full overflow-y-auto bg-[#F8F9FA] p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600 mb-2">Presentation Slide</p>
            <h1 className="text-3xl font-bold text-gray-900">Presentation Library</h1>
            <p className="text-sm text-gray-500 mt-1">
              Create multiple decks per project and jump back into PPTist instantly.
            </p>
          </div>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Create Slide</span>
          </button>
        </div>

        {presentations.length === 0 ? (
          <div className="bg-white border border-dashed border-gray-300 rounded-xl p-12 text-center text-gray-500">
            <p className="text-lg font-semibold text-gray-700 mb-2">No presentation yet</p>
            <p className="text-sm">
              Start by creating your first slide deck for this project.
            </p>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="mt-6 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm"
            >
              Create Presentation
            </button>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-6 py-3 text-left font-semibold">Name</th>
                  <th className="px-6 py-3 text-left font-semibold">Last updated</th>
                  <th className="px-6 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {presentations.map((presentation) => (
                  <tr key={presentation.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{presentation.name}</div>
                      <div className="text-xs text-gray-500">
                        Created {new Date(presentation.createdAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {new Date(presentation.updatedAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleRenamePresentation(presentation.id)}
                          className="inline-flex items-center px-2 py-1 text-xs text-gray-500 hover:text-gray-800 border border-gray-200 rounded-md"
                        >
                          <Edit3 className="w-3.5 h-3.5 mr-1" />
                          Rename
                        </button>
                        <button
                          onClick={() => handleOpenPresentation(presentation.id)}
                          className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm"
                        >
                          Open
                        </button>
                        <button
                          onClick={() => handleDeletePresentation(presentation.id)}
                          className="inline-flex items-center px-2 py-1 text-xs text-red-600 hover:text-red-700 border border-red-100 rounded-md"
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1" />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  const renderCreateModal = () =>
    isCreateOpen && (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40 p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
          <h3 className="text-lg font-bold text-gray-900">Create Presentation</h3>
          <p className="text-sm text-gray-500">
            Give this deck a clear name so you can find it later.
          </p>
          <div>
            <label className="text-xs font-semibold text-gray-600">Presentation Name</label>
            <input
              autoFocus
              value={newPresentationName}
              onChange={(e) => setNewPresentationName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreatePresentation();
              }}
              className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Executive Review"
            />
          </div>
          <div className="flex justify-end space-x-2">
            <button
              onClick={() => {
                setIsCreateOpen(false);
                setNewPresentationName('');
              }}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
            >
              Cancel
            </button>
            <button
              onClick={handleCreatePresentation}
              className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
            >
              Create
            </button>
          </div>
        </div>
      </div>
    );

  const renderInsertDrawer = () => {
    if (!isInsertDrawerOpen || !selectedDashboard) return null;
    const widgets = selectedDashboard.widgets || [];
    return (
      <div className="absolute top-0 right-0 bottom-0 w-80 bg-white border-l border-gray-200 shadow-2xl z-20 flex flex-col">
        <div className="h-12 border-b border-gray-100 flex items-center justify-between px-3 bg-gray-50">
          <div>
            <p className="text-[10px] uppercase text-gray-400">Insert dashboard</p>
            <p className="text-sm font-semibold text-gray-800 flex items-center space-x-2">
              <LayoutDashboard className="w-4 h-4 text-blue-500" />
              <span>{selectedDashboard.name}</span>
            </p>
          </div>
          <button
            onClick={() => setInsertDrawerOpen(false)}
            className="text-gray-400 hover:text-gray-600 rounded-full p-1"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-3 border-b border-gray-100">
          <label className="text-xs text-gray-500 block mb-1">Dashboard</label>
          <select
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={selectedDashboardId || ''}
            onChange={(e) => setSelectedDashboardId(e.target.value)}
          >
            {dashboardsForInsert.map((dash) => (
              <option key={dash.id} value={dash.id}>
                {dash.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {widgets.length === 0 ? (
            <div className="text-xs text-gray-500">This dashboard has no charts yet.</div>
          ) : (
            widgets.map((widget) => (
              <div key={widget.id} className="border border-gray-200 rounded-lg p-3 bg-white shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 truncate">{widget.title || widget.type}</p>
                    <p className="text-xs text-gray-500 capitalize">Type: {widget.type}</p>
                  </div>
                  <button
                    onClick={() => handleInsertChart(widget)}
                    disabled={!!insertingWidgetId}
                    className={`px-3 py-1 text-xs font-semibold rounded ${
                      insertingWidgetId
                        ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {insertingWidgetId === widget.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Insert'}
                  </button>
                </div>
                <div className="text-[11px] text-gray-500">
                  {widget.description || 'Chart from dashboard'}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  if (mode === 'editor' && editingPresentation) {
    return (
      <div className="flex flex-col h-full bg-gray-900">
        <header className="h-12 bg-white border-b border-gray-200 flex items-center justify-between px-4 shadow-sm">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => {
                setMode('list');
                setSelectedPresentationId(null);
              }}
              className="inline-flex items-center px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-md bg-white"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </button>
            <div>
              <p className="text-sm font-semibold text-gray-900">{project.name}</p>
              <p className="text-xs text-gray-500">{editingPresentation.name}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => requestPresentationExport('stay')}
              disabled={isSaving}
              className={`inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md border ${
                isSaving
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'border-blue-600 text-blue-600 hover:bg-blue-50'
              }`}
            >
              {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save
            </button>
            <button
              onClick={() => requestPresentationExport('close')}
              disabled={isSaving}
              className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700"
            >
              Save & Close
            </button>
          </div>
        </header>
        <div className="flex-1 relative">
          <BuildReports
            key={editingPresentation.id}
            project={project}
            onMessage={handlePptistMessage}
            onIframeLoad={handleIframeLoad}
          />
          {renderInsertDrawer()}
        </div>
      </div>
    );
  }

  return (
    <>
      {renderListView()}
      {renderCreateModal()}
    </>
  );
};

export default ReportBuilder;
