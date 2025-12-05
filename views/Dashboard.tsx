import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Edit3, LayoutDashboard, Plus, Trash2 } from 'lucide-react';
import Analytics from './Analytics';
import EmptyState from '../components/EmptyState';
import { Project, ProjectDashboard, DashboardWidget } from '../types';
import {
  addDashboard,
  ensureDashboards,
  removeDashboard,
  renameDashboard,
  setActiveDashboard,
  updateDashboardWidgets,
} from '../utils/dashboards';
import { PPTIST_CHART_THEME } from '../constants/chartTheme';
import { saveProject } from '../utils/storage-compat';

interface DashboardViewProps {
  project: Project;
  onUpdateProject?: (project: Project) => void;
}

const DashboardView: React.FC<DashboardViewProps> = ({ project, onUpdateProject }) => {
  const { project: normalizedProject, dashboards, activeDashboard, changed } = useMemo(
    () => ensureDashboards(project),
    [project]
  );

  const [mode, setMode] = useState<'list' | 'editor'>('list');
  const [selectedDashboardId, setSelectedDashboardId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newDashboardName, setNewDashboardName] = useState('');

  useEffect(() => {
    if (changed && onUpdateProject) {
      onUpdateProject(normalizedProject);
      saveProject(normalizedProject);
    }
  }, [changed, normalizedProject, onUpdateProject]);

  useEffect(() => {
    if (dashboards.length === 0) {
      setMode('list');
      setSelectedDashboardId(null);
    }
  }, [dashboards.length]);

  const editingDashboard =
    dashboards.find((d) => d.id === (selectedDashboardId || normalizedProject.activeDashboardId)) || activeDashboard;

  const handleCreateDashboard = async () => {
    if (!onUpdateProject || !newDashboardName.trim()) return;
    const { project: updated, dashboard } = addDashboard(normalizedProject, newDashboardName.trim());
    onUpdateProject(updated);
    await saveProject(updated);
    setNewDashboardName('');
    setIsCreateOpen(false);
    setSelectedDashboardId(dashboard.id);
    setMode('editor');
  };

  const handleOpenDashboard = async (dashboardId: string) => {
    if (!onUpdateProject) return;
    const updated = setActiveDashboard(normalizedProject, dashboardId);
    onUpdateProject(updated);
    await saveProject(updated);
    setSelectedDashboardId(dashboardId);
    setMode('editor');
  };

  const handleDeleteDashboard = async (dashboardId: string) => {
    if (!onUpdateProject) return;
    const target = dashboards.find((d) => d.id === dashboardId);
    if (!target) return;
    if (!window.confirm(`Delete dashboard "${target.name}"?`)) return;
    const updated = removeDashboard(normalizedProject, dashboardId);
    onUpdateProject(updated);
    await saveProject(updated);
    setMode('list');
    setSelectedDashboardId(null);
  };

  const handleRenameDashboard = async (dashboard: ProjectDashboard) => {
    if (!onUpdateProject) return;
    const nextName = prompt('Rename dashboard', dashboard.name);
    if (!nextName || nextName.trim() === dashboard.name) return;
    const updated = renameDashboard(normalizedProject, dashboard.id, nextName.trim());
    onUpdateProject(updated);
    await saveProject(updated);
  };

  const handleSaveWidgets = async (widgets: DashboardWidget[]) => {
    if (!onUpdateProject || !editingDashboard) return;
    const updated = updateDashboardWidgets(normalizedProject, editingDashboard.id, widgets);
    onUpdateProject(updated);
    await saveProject(updated);
  };

  const renderListView = () => (
    <div className="h-full overflow-y-auto bg-[#F8F9FA] p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600 mb-2">Dashboard</p>
            <h1 className="text-3xl font-bold text-gray-900">Visual Dashboards</h1>
            <p className="text-sm text-gray-500 mt-1">
              Create multiple dashboard variations per project and jump back into any configuration instantly.
            </p>
          </div>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Create Dashboard</span>
          </button>
        </div>

        {dashboards.length === 0 ? (
          <EmptyState
            icon={LayoutDashboard}
            title="No dashboards yet"
            description="Start by creating your first dashboard for this project."
            actionLabel="Create Dashboard"
            onAction={() => setIsCreateOpen(true)}
          />
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-6 py-3 text-left font-semibold">Name</th>
                  <th className="px-6 py-3 text-left font-semibold">Charts</th>
                  <th className="px-6 py-3 text-left font-semibold">Last updated</th>
                  <th className="px-6 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {dashboards.map((dashboard) => (
                  <tr key={dashboard.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{dashboard.name}</div>
                      {dashboard.description && <div className="text-xs text-gray-500">{dashboard.description}</div>}
                    </td>
                    <td className="px-6 py-4 text-gray-600">{dashboard.widgets.length}</td>
                    <td className="px-6 py-4 text-gray-600">
                      {new Date(dashboard.updatedAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleRenameDashboard(dashboard)}
                          className="inline-flex items-center px-2 py-1 text-xs text-gray-500 hover:text-gray-800 border border-gray-200 rounded-md"
                        >
                          <Edit3 className="w-3.5 h-3.5 mr-1" />
                          Rename
                        </button>
                        <button
                          onClick={() => handleOpenDashboard(dashboard.id)}
                          className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm"
                        >
                          Open
                        </button>
                        <button
                          onClick={() => handleDeleteDashboard(dashboard.id)}
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

  const renderEditorView = () => {
    if (!editingDashboard) {
      return renderListView();
    }

    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-white shadow-sm z-10">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => {
                setMode('list');
                setSelectedDashboardId(null);
              }}
              className="inline-flex items-center px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-md bg-white"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-2" />
              Back to dashboards
            </button>
            <div>
              <h2 className="text-lg font-bold text-gray-900">{editingDashboard.name}</h2>
              <p className="text-xs text-gray-500">
                Last updated {new Date(editingDashboard.updatedAt).toLocaleString()}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleRenameDashboard(editingDashboard)}
              className="inline-flex items-center px-3 py-1.5 text-xs text-gray-600 hover:text-gray-900 border border-gray-200 rounded-md bg-white"
            >
              <Edit3 className="w-3.5 h-3.5 mr-1" />
              Rename
            </button>
            <button
              onClick={() => handleDeleteDashboard(editingDashboard.id)}
              className="inline-flex items-center px-3 py-1.5 text-xs text-red-600 hover:text-red-700 border border-red-100 rounded-md bg-white"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              Delete
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          <Analytics
            project={project}
            chartTheme={PPTIST_CHART_THEME}
            initialWidgets={editingDashboard.widgets}
            onSaveWidgets={handleSaveWidgets}
          />
        </div>
      </div>
    );
  };

  return (
    <>
      {mode === 'list' ? renderListView() : renderEditorView()}

      {isCreateOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Create Dashboard</h3>
            <p className="text-sm text-gray-500">
              Organize charts into separate dashboards for each audience or presentation.
            </p>
            <div>
              <label className="text-xs font-semibold text-gray-600">Dashboard Name</label>
              <input
                autoFocus
                value={newDashboardName}
                onChange={(e) => setNewDashboardName(e.target.value)}
                className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Executive Summary"
              />
            </div>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  setIsCreateOpen(false);
                  setNewDashboardName('');
                }}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateDashboard}
                className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DashboardView;
