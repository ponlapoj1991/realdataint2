
import React, { useState, useEffect } from 'react';
import Landing from './views/Landing';
import Sidebar from './components/Sidebar';
import DataIngest from './views/DataIngest';
import PrepLanding from './views/PrepLanding';
import CleansingData from './views/CleansingData';
import BuildStructure from './views/BuildStructure';
import DashboardView from './views/Dashboard';
import ReportBuilder from './views/ReportBuilder';
import AiAgent from './views/AiAgent';
import Settings from './views/Settings';
import ManagementLanding from './views/ManagementLanding';
import { Project, AppView, ProjectTab } from './types';
import { saveLastState } from './utils/storage-compat';
import { ToastProvider } from './components/ToastProvider';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.LANDING);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [activeTab, setActiveTab] = useState<ProjectTab>(ProjectTab.UPLOAD);

  // On Load, check for previous state (Optional - keeping simple for now)
  useEffect(() => {
    // We could impl init logic here
  }, []);

  const handleSelectProject = (project: Project) => {
    setCurrentProject(project);
    setCurrentView(AppView.PROJECT);
    setActiveTab(ProjectTab.UPLOAD); // Default start at management landing
    saveLastState(project.id, ProjectTab.UPLOAD);
  };

  const handleTabChange = (tab: ProjectTab) => {
    setActiveTab(tab);
    if (currentProject) {
        saveLastState(currentProject.id, tab);
    }
  };

  const handleBackToLanding = () => {
    setCurrentView(AppView.LANDING);
    setCurrentProject(null);
    saveLastState('', ProjectTab.UPLOAD); // Clear state
  };

  const updateProject = (updated: Project) => {
      setCurrentProject(updated);
  };

  // Render Logic
  if (currentView === AppView.LANDING) {
    return <Landing onSelectProject={handleSelectProject} />;
  }

  if (currentView === AppView.PROJECT && currentProject) {
    return (
      <ToastProvider>
        <div className="flex h-screen overflow-hidden bg-gray-50 font-sans text-gray-900">
          <Sidebar 
              activeTab={activeTab} 
              onTabChange={handleTabChange} 
              onBackToLanding={handleBackToLanding}
              projectName={currentProject.name}
          />
          
          <div className="flex-1 flex flex-col overflow-hidden feature-compact">
              {/* Top Bar */}
              <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-8 shadow-sm flex-shrink-0 z-10">
                  <span className="text-sm text-gray-500 font-medium">
                      {activeTab === ProjectTab.UPLOAD && 'Management Data'}
                      {activeTab === ProjectTab.INGESTION && 'Ingestion Data'}
                      {activeTab === ProjectTab.PREPARATION && 'Preparation Data'}
                      {activeTab === ProjectTab.PREP_TOOLS && 'Preparation Tools'}
                      {activeTab === ProjectTab.CLEANSING && 'Cleansing Data'}
                      {activeTab === ProjectTab.BUILD_STRUCTURE && 'Build Structure'}
                      {activeTab === ProjectTab.DASHBOARD && 'Dashboard'}
                      {activeTab === ProjectTab.AI_AGENT && 'AI Enrichment'}
                      {activeTab === ProjectTab.REPORT && 'Presentation Slide'}
                      {activeTab === ProjectTab.SETTINGS && 'Configuration'}
                  </span>
                  <div className="flex items-center space-x-2">
                      <span className="w-2 h-2 rounded-full bg-green-500"></span>
                      <span className="text-xs text-gray-400">Auto-saved (IndexedDB)</span>
                  </div>
              </header>

              <main className="flex-1 overflow-hidden relative">
                  {activeTab === ProjectTab.UPLOAD && <ManagementLanding />}
                  {activeTab === ProjectTab.INGESTION && (
                    <div className="h-full overflow-y-auto">
                      <DataIngest
                        project={currentProject}
                        onUpdateProject={updateProject}
                        kind="ingestion"
                      />
                    </div>
                  )}
                  {activeTab === ProjectTab.PREPARATION && (
                    <div className="h-full overflow-y-auto">
                      <DataIngest project={currentProject} onUpdateProject={updateProject} kind="prepared" />
                    </div>
                  )}
                  {activeTab === ProjectTab.PREP_TOOLS && <PrepLanding />}
                  {activeTab === ProjectTab.CLEANSING && (
                    <CleansingData project={currentProject} onUpdateProject={updateProject} />
                  )}
                  {activeTab === ProjectTab.BUILD_STRUCTURE && (
                    <BuildStructure project={currentProject} onUpdateProject={updateProject} />
                  )}
                  {activeTab === ProjectTab.DASHBOARD && (
                      <div className="h-full overflow-y-auto">
                        <DashboardView project={currentProject} onUpdateProject={updateProject} />
                      </div>
                  )}
                  {activeTab === ProjectTab.AI_AGENT && (
                      <AiAgent project={currentProject} onUpdateProject={updateProject} />
                  )}
                  {activeTab === ProjectTab.REPORT && (
                      <ReportBuilder project={currentProject} onUpdateProject={updateProject} />
                  )}
                  {activeTab === ProjectTab.SETTINGS && (
                      <Settings project={currentProject} onUpdateProject={updateProject} />
                  )}
              </main>
          </div>
        </div>
      </ToastProvider>
    );
  }

  return <div>Loading...</div>;
};

export default App;
