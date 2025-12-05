
import React, { useMemo, useState } from 'react';
import { Database, FileSpreadsheet, ArrowLeft, ChevronRight, FileOutput, Bot, Settings, PanelLeftClose, PanelLeftOpen, FolderOpen, LineChart } from 'lucide-react';
import { ProjectTab } from '../types';

interface SidebarProps {
  activeTab: ProjectTab;
  onTabChange: (tab: ProjectTab) => void;
  onBackToLanding: () => void;
  projectName: string;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange, onBackToLanding, projectName }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const menuItems = useMemo(
    () => [
      {
        id: ProjectTab.UPLOAD,
        label: 'Management Data',
        icon: Database,
        children: [
          { id: ProjectTab.INGESTION, label: 'Ingestion Data' },
          { id: ProjectTab.PREPARATION, label: 'Preparation Data' },
        ],
      },
      {
        id: ProjectTab.PREP_TOOLS,
        label: 'Preparation Tools',
        icon: FileSpreadsheet,
        children: [
          { id: ProjectTab.CLEANSING, label: 'Cleansing Data' },
          { id: ProjectTab.BUILD_STRUCTURE, label: 'Build Structure' },
        ],
      },
      { id: ProjectTab.DASHBOARD, label: 'Dashboard', icon: LineChart },
      { id: ProjectTab.AI_AGENT, label: 'AI Agent', icon: Bot },
      { 
        id: ProjectTab.REPORT, 
        label: 'Presentation Slide', 
        icon: FileOutput
      },
    ],
    []
  );

  return (
    <div 
      className={`${isCollapsed ? 'w-20' : 'w-64'} h-screen bg-white border-r border-gray-200 flex flex-col flex-shrink-0 z-20 transition-all duration-300 ease-in-out relative`}
    >
      {/* Header */}
      <div className={`h-16 flex items-center ${isCollapsed ? 'justify-center' : 'px-5'} border-b border-gray-100 relative`}>
         <button 
          onClick={onBackToLanding}
          className="flex items-center text-gray-500 hover:text-gray-900 transition-colors"
          title="Back to Landing"
         >
            <ArrowLeft className="w-5 h-5" />
            {!isCollapsed && <span className="font-bold text-lg text-gray-800 ml-2 whitespace-nowrap">Studio</span>}
         </button>

         <button 
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={`absolute ${isCollapsed ? '-right-3 top-12 bg-white border shadow-sm rounded-full p-1' : 'right-4 text-gray-400 hover:text-gray-600'}`}
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
         >
            {isCollapsed ? <PanelLeftOpen className="w-4 h-4 text-gray-600" /> : <PanelLeftClose className="w-4 h-4" />}
         </button>
      </div>

      {/* Project Context */}
      <div className={`py-4 border-b border-gray-100 ${isCollapsed ? 'px-2 text-center' : 'px-5'}`}>
        {!isCollapsed && <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 animate-in fade-in duration-200">Active Project</p>}
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} group cursor-default`}>
            {isCollapsed ? (
                <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600" title={projectName}>
                   <FolderOpen className="w-5 h-5" />
                </div>
            ) : (
                <h3 className="font-bold text-gray-800 truncate pr-2" title={projectName}>{projectName}</h3>
            )}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 py-4 px-3 space-y-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isSectionActive = activeTab === item.id || item.children?.some((child) => child.id === activeTab);
          const hasChildren = !!item.children?.length;
          return (
            <div key={item.id} className="space-y-1">
              <button
                onClick={() => onTabChange(item.id)}
                title={isCollapsed ? item.label : undefined}
                className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'justify-between px-3'} py-2.5 rounded-lg transition-all text-sm font-medium group relative ${
                  isSectionActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <div className={`flex items-center ${isCollapsed ? '' : 'space-x-3'}`}>
                  <Icon className={`w-5 h-5 ${isSectionActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-500'}`} />
                  {!isCollapsed && <span className="whitespace-nowrap">{item.label}</span>}
                </div>
                {!isCollapsed && isSectionActive && <ChevronRight className="w-3 h-3 text-blue-500" />}

                {isCollapsed && isSectionActive && (
                  <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-1 h-8 bg-blue-600 rounded-r-full"></div>
                )}
              </button>

              {!isCollapsed && hasChildren && isSectionActive && (
                <div className="pl-10 space-y-1">
                  {item.children?.map((child) => {
                    const childActive = activeTab === child.id;
                    return (
                      <button
                        key={child.id}
                        onClick={() => onTabChange(child.id)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                          childActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                        }`}
                      >
                        <span className="whitespace-nowrap">{child.label}</span>
                        {childActive && <ChevronRight className="w-3 h-3 text-blue-500" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Settings Section */}
      <div className="px-3 py-2 mt-auto">
          {!isCollapsed && <div className="h-px bg-gray-100 mb-2"></div>}
          <button
              onClick={() => onTabChange(ProjectTab.SETTINGS)}
              title={isCollapsed ? "Project Settings" : undefined}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} px-3 py-2.5 rounded-lg transition-all text-sm font-medium group ${
                activeTab === ProjectTab.SETTINGS
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <div className={`flex items-center ${isCollapsed ? '' : 'space-x-3'}`}>
                <Settings className={`w-5 h-5 ${activeTab === ProjectTab.SETTINGS ? 'text-gray-700' : 'text-gray-400 group-hover:text-gray-500'}`} />
                {!isCollapsed && <span className="whitespace-nowrap">Project Settings</span>}
              </div>
          </button>
      </div>

      {/* Footer (Only Need Help when expanded) */}
      {!isCollapsed && (
        <div className="p-3 border-t border-gray-100 flex flex-col items-center">
             <div className="bg-gray-50 rounded-lg p-3 w-full mb-3 animate-in fade-in duration-200">
                <p className="text-xs text-gray-500 font-medium">Need Help?</p>
                <p className="text-[10px] text-gray-400 mt-1">Check docs for guides.</p>
             </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;
