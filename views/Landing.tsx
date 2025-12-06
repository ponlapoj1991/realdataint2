
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Plus,
  FolderOpen,
  Clock,
  Trash2,
  Search,
  LayoutGrid,
  PieChart,
  Settings,
  Database,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  Download,
  Upload,
  X,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { Project } from '../types';
import { getProjects, deleteProject, saveProject } from '../utils/storage-compat';
import Skeleton from '../components/Skeleton';
import EmptyState from '../components/EmptyState';
import {
  exportProject,
  importProject,
  validateBackupFile,
  type ExportProgress,
  type ImportProgress
} from '../utils/projectBackup';

interface LandingProps {
  onSelectProject: (project: Project) => void;
}

const Landing: React.FC<LandingProps> = ({ onSelectProject }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [activeMenu, setActiveMenu] = useState('overview');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Export/Import state
  const [exportingProjectId, setExportingProjectId] = useState<string | null>(null);
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load projects asynchronously
  const loadProjects = async () => {
    setIsLoading(true);
    try {
      const data = await getProjects();
      setProjects(data);
    } catch (error) {
      console.error("Failed to load projects:", error);
    } finally {
      // Add slight artificial delay to prevent flicker and show off skeleton
      setTimeout(() => setIsLoading(false), 600);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const stats = useMemo(() => {
    const totalProjects = projects.length;
    const totalRows = projects.reduce((acc, p) => acc + p.data.length, 0);
    const lastActive = projects.length > 0 
        ? new Date(Math.max(...projects.map(p => p.lastModified))).toLocaleDateString() 
        : '-';
    return { totalProjects, totalRows, lastActive };
  }, [projects]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    const newProject: Project = {
      id: crypto.randomUUID(),
      name: newProjectName,
      description: newProjectDesc,
      lastModified: Date.now(),
      data: [],
      columns: [],
    };

    await saveProject(newProject);
    await loadProjects(); // Refresh list
    setIsCreating(false);
    setNewProjectName('');
    setNewProjectDesc('');
    onSelectProject(newProject);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // Prevent card click
    e.preventDefault(); // Prevent any default behavior

    if (window.confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      await deleteProject(id);
      await loadProjects();
    }
  };

  // Export project to .zip file
  const handleExport = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    e.preventDefault();

    setExportingProjectId(projectId);
    setExportProgress({ phase: 'preparing', percent: 0, message: 'Preparing export...' });

    try {
      await exportProject(projectId, (progress) => {
        setExportProgress(progress);
      });

      // Show success briefly before closing
      setTimeout(() => {
        setExportingProjectId(null);
        setExportProgress(null);
      }, 1500);
    } catch (error) {
      console.error('Export failed:', error);
      alert(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setExportingProjectId(null);
      setExportProgress(null);
    }
  };

  // Handle file selection for import
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset file input for next selection
    e.target.value = '';

    setIsImporting(true);
    setImportError(null);
    setImportSuccess(false);
    setImportProgress({ phase: 'reading', percent: 0, message: 'Reading backup file...' });

    try {
      // Validate file first
      const validation = await validateBackupFile(file);
      if (!validation.valid) {
        throw new Error(validation.error || 'Invalid backup file');
      }

      // Show validation info
      setImportProgress({
        phase: 'validating',
        percent: 15,
        message: `Found: ${validation.manifest?.projectName} (${validation.manifest?.rowCount} rows)`
      });

      // Proceed with import
      await importProject(file, {}, (progress) => {
        setImportProgress(progress);
      });

      setImportSuccess(true);
      setImportProgress({ phase: 'done', percent: 100, message: 'Import complete!' });

      // Reload projects list
      await loadProjects();

      // Close modal after delay
      setTimeout(() => {
        setIsImporting(false);
        setImportProgress(null);
        setImportSuccess(false);
      }, 2000);
    } catch (error) {
      console.error('Import failed:', error);
      setImportError(error instanceof Error ? error.message : 'Unknown error occurred');
      setImportProgress(null);
    }
  };

  const closeImportModal = () => {
    setIsImporting(false);
    setImportProgress(null);
    setImportError(null);
    setImportSuccess(false);
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex font-sans text-gray-900">
      
      {/* Global Navigation Sidebar */}
      <aside 
        className={`${isSidebarCollapsed ? 'w-20' : 'w-64'} bg-white border-r border-gray-200 flex flex-col fixed h-full z-10 transition-all duration-300 ease-in-out`}
      >
        <div className={`h-16 flex items-center ${isSidebarCollapsed ? 'justify-center' : 'px-6'} border-b border-gray-100 relative`}>
          <div className="w-8 h-8 bg-blue-600 rounded-md flex items-center justify-center text-white font-bold flex-shrink-0">
            R
          </div>
          <span className={`font-semibold text-lg ml-3 transition-opacity duration-200 ${isSidebarCollapsed ? 'opacity-0 w-0 hidden' : 'opacity-100'}`}>
            RealData
          </span>
          
          <button 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className={`absolute ${isSidebarCollapsed ? '-right-3 top-12 bg-white border shadow-sm rounded-full p-1' : 'right-4 text-gray-400 hover:text-gray-600'}`}
          >
             {isSidebarCollapsed ? <PanelLeftOpen className="w-4 h-4 text-gray-600" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        </div>

        <nav className="flex-1 py-6 px-3 space-y-1">
          <button 
            onClick={() => setActiveMenu('overview')}
            title={isSidebarCollapsed ? "Overview" : undefined}
            className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : 'px-3'} py-2 rounded-lg text-sm font-medium transition-colors ${activeMenu === 'overview' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <LayoutGrid className="w-5 h-5 flex-shrink-0" />
            {!isSidebarCollapsed && <span className="ml-3">Overview</span>}
          </button>
          <button 
            onClick={() => setActiveMenu('projects')}
            title={isSidebarCollapsed ? "All Projects" : undefined}
            className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : 'px-3'} py-2 rounded-lg text-sm font-medium transition-colors ${activeMenu === 'projects' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <FolderOpen className="w-5 h-5 flex-shrink-0" />
            {!isSidebarCollapsed && <span className="ml-3">All Projects</span>}
          </button>
          <button 
            title={isSidebarCollapsed ? "Global Reports" : undefined}
            className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : 'px-3'} py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors`}
          >
            <PieChart className="w-5 h-5 flex-shrink-0" />
            {!isSidebarCollapsed && <span className="ml-3">Global Reports</span>}
          </button>
        </nav>

        <div className="p-4 border-t border-gray-100">
          <button 
            title={isSidebarCollapsed ? "Settings" : undefined}
            className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : 'px-3'} py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors`}
          >
            <Settings className="w-5 h-5 flex-shrink-0" />
            {!isSidebarCollapsed && <span className="ml-3">System Settings</span>}
          </button>
        </div>
      </aside>

      {/* Main Dashboard Area */}
      <main 
        className={`flex-1 p-8 lg:p-12 transition-all duration-300 ease-in-out`}
        style={{ marginLeft: isSidebarCollapsed ? '5rem' : '16rem' }}
      >
        <div className="max-w-7xl mx-auto">
          
          {/* Hidden file input for import */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept=".zip"
            className="hidden"
          />

          {/* Header Section */}
          <div className="flex justify-between items-end mb-10">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Dashboard</h1>
              <p className="text-gray-500 mt-2">Welcome back. Here's what's happening with your data today.</p>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={handleImportClick}
                className="bg-white hover:bg-gray-50 text-gray-700 px-5 py-2.5 rounded-lg font-medium flex items-center space-x-2 border border-gray-300 shadow-sm transition-all transform hover:scale-105 active:scale-95"
              >
                <Upload className="w-5 h-5" />
                <span>Import Backup</span>
              </button>
              <button
                onClick={() => setIsCreating(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium flex items-center space-x-2 shadow-sm transition-all transform hover:scale-105 active:scale-95"
              >
                <Plus className="w-5 h-5" />
                <span>Create Project</span>
              </button>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <FolderOpen className="w-6 h-6 text-blue-600" />
                </div>
                <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">Active</span>
              </div>
              <p className="text-gray-500 text-sm font-medium">Total Projects</p>
              <h3 className="text-3xl font-bold text-gray-900 mt-1">
                {isLoading ? <Skeleton className="h-9 w-12" /> : stats.totalProjects}
              </h3>
            </div>

            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-indigo-50 rounded-lg">
                  <Database className="w-6 h-6 text-indigo-600" />
                </div>
                <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full">IndexedDB</span>
              </div>
              <p className="text-gray-500 text-sm font-medium">Total Processed Rows</p>
              <h3 className="text-3xl font-bold text-gray-900 mt-1">
                {isLoading ? <Skeleton className="h-9 w-24" /> : stats.totalRows.toLocaleString()}
              </h3>
            </div>

            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-orange-50 rounded-lg">
                  <Clock className="w-6 h-6 text-orange-600" />
                </div>
                <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full">System</span>
              </div>
              <p className="text-gray-500 text-sm font-medium">Last Activity</p>
              <h3 className="text-3xl font-bold text-gray-900 mt-1">
                 {isLoading ? <Skeleton className="h-9 w-32" /> : stats.lastActive}
              </h3>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex items-center space-x-4 mb-6">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search projects..." 
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
            </div>
          </div>

          {/* Projects Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               {[1,2,3].map(i => (
                 <div key={i} className="bg-white rounded-xl border border-gray-200 p-6 h-[180px] flex flex-col">
                    <div className="flex items-center mb-4">
                        <Skeleton className="w-12 h-12 rounded-xl" />
                    </div>
                    <Skeleton className="h-5 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-full mb-auto" />
                    <div className="flex justify-between mt-4 border-t border-gray-50 pt-4">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-4 w-16" />
                    </div>
                 </div>
               ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {projects.length === 0 && !isCreating && (
                    <div className="col-span-full">
                        <EmptyState 
                            icon={FolderOpen}
                            title="No projects found"
                            description="Get started by creating your first project workspace to analyze your social listening data."
                            actionLabel="Create Project"
                            onAction={() => setIsCreating(true)}
                        />
                    </div>
                )}
                
                {projects.map((project) => (
                <div
                    key={project.id}
                    onClick={() => onSelectProject(project)}
                    className="group bg-white rounded-xl border border-gray-200 p-6 cursor-pointer transition-all hover:shadow-lg hover:border-blue-200 relative overflow-hidden"
                >
                    {/* Action Buttons: Export and Delete */}
                    <div className="absolute top-2 right-2 z-20 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-all duration-200 flex items-center space-x-1">
                        <button
                            onClick={(e) => handleExport(e, project.id)}
                            disabled={exportingProjectId === project.id}
                            className="bg-white/90 backdrop-blur-sm p-2 rounded-full text-gray-400 hover:text-blue-600 hover:bg-blue-50 border border-gray-200 shadow-sm transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Export Project"
                        >
                            {exportingProjectId === project.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Download className="w-4 h-4" />
                            )}
                        </button>
                        <button
                            onClick={(e) => handleDelete(e, project.id)}
                            className="bg-white/90 backdrop-blur-sm p-2 rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50 border border-gray-200 shadow-sm transition-all transform hover:scale-105"
                            title="Delete Project"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="flex items-start mb-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform duration-300">
                            <FolderOpen className="w-6 h-6" />
                        </div>
                    </div>

                    <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors truncate pr-6">
                    {project.name}
                    </h3>
                    <p className="text-gray-500 text-sm mb-6 h-10 line-clamp-2 leading-relaxed">
                    {project.description || 'No description provided.'}
                    </p>

                    <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                    <div className="flex items-center text-xs text-gray-400 font-medium">
                        <Clock className="w-3.5 h-3.5 mr-1.5" />
                        {new Date(project.lastModified).toLocaleDateString()}
                    </div>
                    <div className="flex items-center text-xs text-blue-600 font-medium bg-blue-50 px-2 py-1 rounded-md">
                        {project.data.length} rows
                    </div>
                    </div>
                </div>
                ))}
            </div>
          )}

          {/* New Project Modal */}
          {isCreating && (
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white w-full max-w-lg rounded-xl shadow-xl border border-gray-100 p-6 animate-in fade-in zoom-in duration-200">
                <h3 className="text-xl font-bold mb-1 text-gray-900">Create New Project</h3>
                <p className="text-gray-500 text-sm mb-6">Setup a new workspace for data analysis.</p>

                <form onSubmit={handleCreate} className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Project Name</label>
                    <input
                      type="text"
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                      placeholder="e.g. Q3 Competitor Analysis"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Description</label>
                    <textarea
                      value={newProjectDesc}
                      onChange={(e) => setNewProjectDesc(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none h-24"
                      placeholder="Briefly describe the goal of this analysis..."
                    />
                  </div>
                  <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100 mt-6">
                    <button
                      type="button"
                      onClick={() => setIsCreating(false)}
                      className="px-5 py-2.5 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm transition-colors"
                    >
                      Create Project
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Import Progress Modal */}
          {isImporting && (
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white w-full max-w-md rounded-xl shadow-xl border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-gray-900">
                    {importError ? 'Import Failed' : importSuccess ? 'Import Complete' : 'Importing Project'}
                  </h3>
                  {(importError || importSuccess) && (
                    <button
                      onClick={closeImportModal}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>

                {importError ? (
                  <div className="flex items-start space-x-3 p-4 bg-red-50 rounded-lg border border-red-100">
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-red-800">Error importing backup</p>
                      <p className="text-sm text-red-600 mt-1">{importError}</p>
                    </div>
                  </div>
                ) : importSuccess ? (
                  <div className="flex items-center space-x-3 p-4 bg-green-50 rounded-lg border border-green-100">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <p className="text-sm font-medium text-green-800">Project imported successfully!</p>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center space-x-3 mb-4">
                      <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                      <p className="text-sm text-gray-600">{importProgress?.message || 'Processing...'}</p>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${importProgress?.percent || 0}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-2 text-right">{importProgress?.percent || 0}%</p>
                  </div>
                )}

                {importError && (
                  <div className="flex justify-end mt-4">
                    <button
                      onClick={closeImportModal}
                      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                    >
                      Close
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Export Progress Modal */}
          {exportingProjectId && exportProgress && (
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white w-full max-w-md rounded-xl shadow-xl border border-gray-100 p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">
                  {exportProgress.phase === 'done' ? 'Export Complete' : 'Exporting Project'}
                </h3>

                {exportProgress.phase === 'done' ? (
                  <div className="flex items-center space-x-3 p-4 bg-green-50 rounded-lg border border-green-100">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <p className="text-sm font-medium text-green-800">Your backup file is downloading...</p>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center space-x-3 mb-4">
                      <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                      <p className="text-sm text-gray-600">{exportProgress.message}</p>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${exportProgress.percent}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-2 text-right">{exportProgress.percent}%</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Landing;
