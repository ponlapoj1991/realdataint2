
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Project, RawRow, AIPresets } from '../types';
import { 
    Bot, Download, Sparkles, ChevronRight,
    MessageSquare, PlayCircle,
    ArrowRight, CheckCircle2, X, Save, Loader2,
    Database, UploadCloud, Filter, Trash2, Settings, Edit3, Command,
    MousePointer2
} from 'lucide-react';
import { saveProject } from '../utils/storage-compat';
import { exportToExcel, parseExcelFile, inferColumns } from '../utils/excel';
import { processAiAgentAction, askAiAgent } from '../utils/ai';
import TableColumnFilter from '../components/TableColumnFilter';
import { useToast } from '../components/ToastProvider';

interface AiAgentProps {
  project: Project;
  onUpdateProject: (p: Project) => void;
}

// Types for Virtual Scroll
const ROW_HEIGHT = 40;
const HEADER_HEIGHT = 40; 
const BUFFER_ROWS = 10;

interface SelectionRange {
    startRow: number;
    startCol: string;
    endRow: number;
    endCol: string;
}

interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
    type?: 'text' | 'action_result';
}

// Extended row with original index for tracking
interface IndexedRow extends RawRow {
    _originalIndex: number;
}

type DataSourceMode = 'project' | 'upload';

const DEFAULT_PRESETS: AIPresets = {
    ask: [
        "สรุปข้อมูลจาก Rows ที่เลือก",
        "วิเคราะห์ Sentiment ของข้อความ",
        "หาความสัมพันธ์ของข้อมูล",
        "แปลความหมายเป็นภาษาไทย",
        "ค้นหา Insight ที่น่าสนใจ"
    ],
    action: [
        "จัดรูปแบบวันที่ให้เป็น YYYY-MM-DD",
        "ตัดคำหยาบคายออก",
        "แยก Category สินค้า",
        "แปลเป็นภาษาอังกฤษ",
        "สกัดเบอร์โทรศัพท์"
    ]
};

const AiAgent: React.FC<AiAgentProps> = ({ project, onUpdateProject }) => {
  // --- Data State ---
  const [sourceMode, setSourceMode] = useState<DataSourceMode>('project');
  const [gridData, setGridData] = useState<RawRow[]>([]); // The Source of Truth
  const [columns, setColumns] = useState<string[]>([]);
  
  // --- Filtering State ---
  const [filters, setFilters] = useState<Record<string, string[] | null>>({});
  const [openFilterCol, setOpenFilterCol] = useState<string | null>(null);

  // --- UI State ---
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [chatMode, setChatMode] = useState<'ask' | 'action'>('ask');
  const [messages, setMessages] = useState<ChatMessage[]>([{
      id: 'welcome',
      role: 'assistant',
      content: 'สวัสดีครับ ผมคือ AI Agent ของคุณ เริ่มต้นด้วยการเลือก "Mode" และ "Command" ด้านล่างได้เลยครับ',
      timestamp: Date.now()
  }]);
  const [userInput, setUserInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const { showToast } = useToast();

  // --- Preset State ---
  const [presets, setPresets] = useState<AIPresets>(project.aiPresets || DEFAULT_PRESETS);
  const [showPresetConfig, setShowPresetConfig] = useState(false);
  const [editingPresets, setEditingPresets] = useState<AIPresets>(DEFAULT_PRESETS);

  // --- Selection State ---
  const [selection, setSelection] = useState<SelectionRange | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectionStart, setSelectionStart] = useState<{row: number, col: string} | null>(null);

  const [targetCol, setTargetCol] = useState<string | null>(null);
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [pendingActionPrompt, setPendingActionPrompt] = useState<string | null>(null);

  // --- Virtual Scroll State ---
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(600);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // --- Initialization ---
  useEffect(() => {
      // When project changes or mode switches to project, load project data
      if (sourceMode === 'project') {
          setGridData(project.data);
          if (project.columns.length > 0) {
              setColumns(project.columns.map(c => c.key));
          } else if (project.data.length > 0) {
              setColumns(Object.keys(project.data[0]));
          } else {
              setColumns([]);
          }
          setFilters({}); // Reset filters on source change
          setSelection(null);
          
          // Load presets
          if(project.aiPresets) {
              setPresets(project.aiPresets);
          }
      }
  }, [project, sourceMode]);

  useEffect(() => {
    // Auto scroll chat
    if (chatBottomRef.current) {
        chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isChatOpen]);

  // --- Computed Data (Filtered) ---
  const displayData = useMemo(() => {
      // 1. Attach original index
      const indexed = gridData.map((row, idx) => ({ ...row, _originalIndex: idx } as IndexedRow));

      // 2. Apply Filters
      return indexed.filter(row => {
          return Object.keys(filters).every(key => {
              const allowed = filters[key];
              if (!allowed) return true; // No filter on this col
              
              const val = row[key];
              const strVal = val === null || val === undefined ? '(Blank)' : String(val);
              return allowed.includes(strVal);
          });
      });
  }, [gridData, filters]);

  // --- Helpers ---
  const getFixedPresets = (list: string[]) => {
      const fixed = [...list];
      while(fixed.length < 5) fixed.push("");
      return fixed.slice(0, 5);
  };

  // --- Upload Handler ---
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsUploading(true);
      try {
          const newData = await parseExcelFile(file);
          if (newData.length > 0) {
              setGridData(newData);
              const newCols = inferColumns(newData[0]).map(c => c.key);
              setColumns(newCols);
              setFilters({});
              setSelection(null);
              setMessages(prev => [...prev, {
                  id: `sys-${Date.now()}`,
                  role: 'assistant',
                  content: `Uploaded "${file.name}" with ${newData.length} rows. Ready to analyze!`,
                  timestamp: Date.now()
              }]);
              showToast('File Loaded', `Loaded ${newData.length} rows from ${file.name}`, 'success');
          }
      } catch (err: any) {
          showToast('Upload Error', err.message || 'Failed to upload file', 'error');
      } finally {
          setIsUploading(false);
          // Clear input
          e.target.value = '';
      }
  };

  // --- Resize Handler ---
  useEffect(() => {
      const handleResize = () => {
          if (scrollContainerRef.current) {
              setContainerHeight(scrollContainerRef.current.clientHeight);
          }
      };
      window.addEventListener('resize', handleResize);
      handleResize();
      return () => window.removeEventListener('resize', handleResize);
  }, []);

  // --- Drag End Handler ---
  useEffect(() => {
      const handleGlobalMouseUp = () => {
          setIsDragging(false);
      };
      window.addEventListener('mouseup', handleGlobalMouseUp);
      return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  // --- Virtual Calculation ---
  const totalRows = displayData.length;
  const totalHeight = totalRows * ROW_HEIGHT + HEADER_HEIGHT;
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - BUFFER_ROWS);
  const endIndex = Math.min(totalRows, Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT) + BUFFER_ROWS);
  
  const visibleRows = useMemo(() => {
      return displayData.slice(startIndex, endIndex).map((row, index) => ({
          ...row,
          _visualIndex: startIndex + index
      }));
  }, [displayData, startIndex, endIndex]);

  // --- Helper Functions ---
  const safeRender = (val: any) => {
      if (typeof val === 'object' && val !== null) return JSON.stringify(val);
      if (val === null || val === undefined) return '';
      return String(val);
  };

  const getColIndex = (col: string) => columns.indexOf(col);
  
  const isSelected = (rowVisualIdx: number, col: string) => {
      if (!selection) return false;
      const cIdx = getColIndex(col);
      const startC = getColIndex(selection.startCol);
      const endC = getColIndex(selection.endCol);
      
      const minR = Math.min(selection.startRow, selection.endRow);
      const maxR = Math.max(selection.startRow, selection.endRow);
      const minC = Math.min(startC, endC);
      const maxC = Math.max(startC, endC);

      return rowVisualIdx >= minR && rowVisualIdx <= maxR && cIdx >= minC && cIdx <= maxC;
  };

  // --- Selection Logic (Visual Index Based) ---
  const handleMouseDown = (rowVisualIdx: number, col: string, e: React.MouseEvent) => {
      e.preventDefault(); // Prevent text select
      setIsDragging(true);
      setSelectionStart({ row: rowVisualIdx, col });
      
      if (e.shiftKey && selection) {
          setSelection({ ...selection, endRow: rowVisualIdx, endCol: col });
      } else {
          setSelection({ startRow: rowVisualIdx, startCol: col, endRow: rowVisualIdx, endCol: col });
      }
  };

  const handleMouseEnter = (rowVisualIdx: number, col: string) => {
      if (isDragging && selectionStart) {
          setSelection({
              startRow: selectionStart.row,
              startCol: selectionStart.col,
              endRow: rowVisualIdx,
              endCol: col
          });
      }
  };

  // --- AI Logic ---
  const getSelectedData = () => {
      if (!selection) return [];
      const minR = Math.min(selection.startRow, selection.endRow);
      const maxR = Math.max(selection.startRow, selection.endRow);
      
      // Get the actual data rows from displayData (Filtered view)
      const dataRange = displayData.slice(minR, maxR + 1);
      
      if (selection.startCol === selection.endCol) {
          return dataRange.map(row => String(row[selection.startCol] || ''));
      }
      
      return dataRange.map(row => {
          const startC = getColIndex(selection.startCol);
          const endC = getColIndex(selection.endCol);
          const minC = Math.min(startC, endC);
          const maxC = Math.max(startC, endC);
          
          const rowVals = [];
          for (let i = minC; i <= maxC; i++) {
              rowVals.push(row[columns[i]]);
          }
          return rowVals.join(" ");
      });
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!userInput.trim()) return;

      const currentInput = userInput;
      setUserInput('');
      
      setMessages(prev => [...prev, {
          id: `u-${Date.now()}`,
          role: 'user',
          content: currentInput,
          timestamp: Date.now()
      }]);

      if (!selection) {
          setMessages(prev => [...prev, {
              id: `sys-${Date.now()}`,
              role: 'assistant',
              content: 'Please select data in the grid first (Drag cells).',
              timestamp: Date.now()
          }]);
          showToast('No Selection', 'Please drag to select cells in the table first.', 'warning');
          return;
      }

      const contextData = getSelectedData();

      if (chatMode === 'ask') {
          setIsProcessing(true);
          const answer = await askAiAgent(contextData, currentInput, project.aiSettings);
          setIsProcessing(false);
          setMessages(prev => [...prev, {
              id: `a-${Date.now()}`,
              role: 'assistant',
              content: answer,
              timestamp: Date.now()
          }]);
      } else {
          // Action Mode
          setPendingActionPrompt(currentInput);
          setTargetCol(null);
          setShowTargetModal(true);
      }
  };

  const executeAction = async () => {
      if (!targetCol || !pendingActionPrompt || !selection) return;
      
      setShowTargetModal(false);
      setIsProcessing(true);

      const selectedCount = getSelectedData().length;
      const thinkingId = `t-${Date.now()}`;
      setMessages(prev => [...prev, {
          id: thinkingId,
          role: 'assistant',
          content: `Processing ${selectedCount} rows (Filtered View)...`,
          timestamp: Date.now()
      }]);

      try {
          const sourceData = getSelectedData();
          const results = await processAiAgentAction(sourceData, pendingActionPrompt, project.aiSettings);
          
          // Update Grid Data - MAPPING BACK TO ORIGINAL INDEX
          const minR = Math.min(selection.startRow, selection.endRow);
          
          const newGridData = [...gridData];
          let newColumns = [...columns];
          
          if (!columns.includes(targetCol)) {
              newColumns.push(targetCol);
              setColumns(newColumns);
          }
          
          let updateCount = 0;
          
          // Iterate through results and map to displayData's original indices
          for (let i = 0; i < results.length; i++) {
              const visualIdx = minR + i;
              const targetRow = displayData[visualIdx];
              
              if (targetRow) {
                  const originalIdx = targetRow._originalIndex;
                  newGridData[originalIdx] = {
                      ...newGridData[originalIdx],
                      [targetCol]: results[i]
                  };
                  updateCount++;
              }
          }
          
          setGridData(newGridData);

          setMessages(prev => prev.map(m => m.id === thinkingId ? {
              ...m,
              content: `Complete! Updated ${updateCount} rows in column "${targetCol}". (Hidden rows were skipped)`,
              type: 'action_result'
          } : m));
          showToast('AI Action Complete', `Successfully transformed ${updateCount} rows.`, 'success');

      } catch (err: any) {
          setMessages(prev => prev.map(m => m.id === thinkingId ? {
              ...m,
              content: `Error: ${err.message}`
          } : m));
          showToast('AI Error', err.message, 'error');
      } finally {
          setIsProcessing(false);
          setPendingActionPrompt(null);
      }
  };

  const handleSaveProject = async () => {
      if (sourceMode === 'upload') {
          if(window.confirm("Merge these uploaded rows into the main Project?")) {
              const updatedData = [...project.data, ...gridData];
              let updatedCols = project.columns;
              columns.forEach(c => {
                  if(!updatedCols.find(xc => xc.key === c)) {
                      updatedCols.push({ key: c, type: 'string', visible: true });
                  }
              });
              const updated = { ...project, data: updatedData, columns: updatedCols };
              onUpdateProject(updated);
              await saveProject(updated);
              setSourceMode('project'); // Switch back
              showToast('Data Merged', `Successfully merged external file.`, 'success');
          }
      } else {
          // Save updates to existing project including presets
          const updated = { ...project, data: gridData, aiPresets: presets };
          let updatedCols = project.columns;
          columns.forEach(c => {
              if(!updatedCols.find(xc => xc.key === c)) {
                  updatedCols.push({ key: c, type: 'string', visible: true, label: c });
              }
          });
          updated.columns = updatedCols;
          
          onUpdateProject(updated);
          await saveProject(updated);
          showToast('Project Saved', 'Data and AI Presets have been saved.', 'success');
      }
  };

  // --- Preset Handlers ---
  const openPresetConfig = () => {
      setEditingPresets(JSON.parse(JSON.stringify(presets)));
      setShowPresetConfig(true);
  };

  const savePresets = async () => {
      setPresets(editingPresets);
      setShowPresetConfig(false);
      // Auto-save project to persist presets
      const updated = { ...project, aiPresets: editingPresets };
      onUpdateProject(updated);
      await saveProject(updated);
      showToast('Configuration Saved', 'Command presets updated successfully.', 'success');
  };

  const updateEditingPreset = (mode: 'ask' | 'action', index: number, value: string) => {
      const newModePresets = [...editingPresets[mode]];
      while(newModePresets.length <= index) newModePresets.push("");
      newModePresets[index] = value;
      setEditingPresets({ ...editingPresets, [mode]: newModePresets });
  };

  return (
    <div className="flex h-full bg-gray-50 overflow-hidden font-sans">
        
        {/* LEFT: Spreadsheet Area */}
        <div className="flex-1 flex flex-col min-w-0">
            
            {/* Top Bar: Source & Actions */}
            <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm z-20">
                
                {/* Data Source Toggle */}
                <div className="flex items-center space-x-3">
                    <div className="font-bold text-gray-700 flex items-center mr-2">
                        <Bot className="w-5 h-5 mr-2 text-indigo-600" /> AI Agent
                    </div>
                    <div className="bg-gray-100 p-1 rounded-lg flex">
                        <button
                            onClick={() => setSourceMode('project')}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center ${sourceMode === 'project' ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-900'}`}
                        >
                            <Database className="w-3.5 h-3.5 mr-1.5" /> Project Data
                        </button>
                        <button
                            onClick={() => setSourceMode('upload')}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center ${sourceMode === 'upload' ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-900'}`}
                        >
                            <UploadCloud className="w-3.5 h-3.5 mr-1.5" /> External File
                        </button>
                    </div>
                </div>

                {/* File Upload Input (Only for Upload Mode) */}
                {sourceMode === 'upload' && (
                    <div className="flex-1 mx-4">
                        <label className="flex items-center cursor-pointer bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-4 py-1.5 rounded-lg text-xs font-medium transition-colors w-fit">
                            <UploadCloud className="w-3.5 h-3.5 mr-2" />
                            {isUploading ? 'Uploading...' : 'Choose Excel/CSV'}
                            <input type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} disabled={isUploading} />
                        </label>
                    </div>
                )}
                
                {/* Action Buttons */}
                <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-400 mr-2 hidden md:inline">
                        {selection 
                            ? `Selected: ${Math.abs(selection.endRow - selection.startRow) + 1} rows` 
                            : 'Select rows to start'}
                    </span>
                    <button onClick={handleSaveProject} className="flex items-center px-3 py-1.5 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg text-xs font-medium shadow-sm transition-colors">
                        <Save className="w-3.5 h-3.5 mr-2" /> {sourceMode === 'upload' ? 'Merge to Project' : 'Save'}
                    </button>
                    <button onClick={() => exportToExcel(displayData, `AiAgent_Export`)} className="flex items-center px-3 py-1.5 bg-green-600 text-white hover:bg-green-700 rounded-lg text-xs font-medium shadow-sm transition-colors">
                        <Download className="w-3.5 h-3.5 mr-2" /> Export
                    </button>
                    <button 
                        onClick={() => setIsChatOpen(!isChatOpen)}
                        className={`p-2 rounded-lg border ml-2 transition-all ${isChatOpen ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'}`}
                    >
                        {isChatOpen ? <ChevronRight className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
                    </button>
                </div>
            </div>

            {/* Info Bar for Filters */}
            {Object.values(filters).some(v => v !== null) && (
                 <div className="bg-yellow-50 px-4 py-1 border-b border-yellow-100 text-[10px] text-yellow-800 flex justify-between items-center">
                     <span>Active Filters Applied. AI Actions will only affect visible rows.</span>
                     <button onClick={() => setFilters({})} className="flex items-center hover:underline"><Trash2 className="w-3 h-3 mr-1"/> Clear All</button>
                 </div>
            )}

            {/* Grid Container (Virtualized) */}
            <div 
                className="flex-1 overflow-auto bg-gray-100 relative select-none" 
                ref={scrollContainerRef}
                onScroll={(e) => setScrollTop((e.target as HTMLDivElement).scrollTop)}
                onClick={() => setOpenFilterCol(null)} // Close filter on grid click
            >
                {/* Scroll Phantom Div */}
                <div style={{ height: totalHeight, position: 'relative' }}>
                    
                    {/* Sticky Header */}
                    <div 
                        className="sticky top-0 z-20 flex bg-gray-100 border-b border-gray-300 shadow-sm"
                        style={{ height: HEADER_HEIGHT }}
                    >
                        <div className="w-10 flex-shrink-0 bg-gray-200 border-r border-gray-300 flex items-center justify-center font-bold text-xs text-gray-500 h-full">
                            #
                        </div>
                        {columns.map((col) => {
                            const hasFilter = filters[col] !== undefined && filters[col] !== null;
                            return (
                                <div 
                                    key={col} 
                                    className="w-40 flex-shrink-0 bg-gray-50 border-r border-gray-300 px-2 flex items-center justify-between text-xs font-bold text-gray-700 h-full group relative"
                                >
                                    <span 
                                        className="truncate cursor-pointer flex-1"
                                        onClick={() => setSelection({ startRow: 0, startCol: col, endRow: totalRows - 1, endCol: col })}
                                        title={col}
                                    >
                                        {col}
                                    </span>
                                    
                                    {/* Filter Button */}
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setOpenFilterCol(openFilterCol === col ? null : col);
                                        }}
                                        className={`p-1 rounded hover:bg-gray-200 transition-colors ${hasFilter ? 'text-blue-600 bg-blue-50' : 'text-gray-400 opacity-0 group-hover:opacity-100'}`}
                                    >
                                        <Filter className="w-3 h-3" />
                                    </button>

                                    {/* Filter Dropdown Component */}
                                    {openFilterCol === col && (
                                        <TableColumnFilter 
                                            column={col}
                                            data={gridData} 
                                            activeFilters={filters[col] || null}
                                            onApply={(vals) => setFilters({ ...filters, [col]: vals })}
                                            onClose={() => setOpenFilterCol(null)}
                                        />
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Rendered Rows */}
                    {visibleRows.length === 0 ? (
                        <div className="absolute top-12 left-0 w-full text-center text-gray-400 text-sm">
                            {gridData.length === 0 ? "No data loaded." : "No records match your filters."}
                        </div>
                    ) : (
                        visibleRows.map((row) => {
                            const rowVisualIdx = row._visualIndex;
                            const top = rowVisualIdx * ROW_HEIGHT + HEADER_HEIGHT;
                            
                            return (
                                <div 
                                    key={row._originalIndex} // Use original index for key stability
                                    className="absolute left-0 right-0 flex border-b border-gray-200 bg-white hover:bg-gray-50"
                                    style={{ top, height: ROW_HEIGHT }}
                                >
                                    {/* Row Number */}
                                    <div className="w-10 flex-shrink-0 bg-gray-50 border-r border-gray-200 flex items-center justify-center text-[10px] text-gray-400 font-mono select-none">
                                        {rowVisualIdx + 1}
                                    </div>
                                    {/* Cells */}
                                    {columns.map((col) => {
                                        const selected = isSelected(rowVisualIdx, col);
                                        return (
                                            <div 
                                                key={`${row._originalIndex}-${col}`}
                                                onMouseDown={(e) => handleMouseDown(rowVisualIdx, col, e)}
                                                onMouseEnter={() => handleMouseEnter(rowVisualIdx, col)}
                                                className={`w-40 flex-shrink-0 border-r border-gray-100 px-2 flex items-center text-xs text-gray-700 truncate cursor-default border-b-0 h-full
                                                    ${selected ? 'bg-blue-100 ring-1 ring-inset ring-blue-500 z-10' : ''}`}
                                                title={safeRender(row[col])}
                                            >
                                                {safeRender(row[col])}
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>

        {/* RIGHT: AI Side Panel */}
        {isChatOpen && (
            <div className="w-96 bg-white border-l border-gray-200 flex flex-col shadow-xl z-30 transition-all duration-300">
                {/* Chat Header */}
                <div className="p-3 border-b border-gray-200 bg-gray-50 flex justify-between items-center shadow-sm">
                     <h3 className="font-bold text-gray-700 flex items-center text-sm">
                        <Command className="w-4 h-4 mr-2 text-indigo-500" />
                        AI Command Center
                    </h3>
                    <button 
                        onClick={openPresetConfig}
                        className="text-xs flex items-center text-gray-500 hover:text-indigo-600 bg-white border border-gray-200 px-2 py-1 rounded shadow-sm transition-colors"
                    >
                        <Settings className="w-3 h-3 mr-1" /> Config
                    </button>
                </div>

                {/* Chat History (Logs) */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
                    {messages.map((msg) => (
                        <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                                msg.role === 'user' 
                                    ? 'bg-indigo-600 text-white rounded-br-none' 
                                    : 'bg-white border border-gray-100 text-gray-700 rounded-bl-none'
                            }`}>
                                {msg.type === 'action_result' ? (
                                    <div className="flex items-center text-green-700 font-medium">
                                        <CheckCircle2 className="w-4 h-4 mr-2" /> {msg.content}
                                    </div>
                                ) : (
                                    msg.content
                                )}
                            </div>
                        </div>
                    ))}
                    {isProcessing && (
                         <div className="flex justify-start">
                             <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-none px-4 py-3 shadow-sm flex items-center space-x-2">
                                 <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                                 <span className="text-xs text-gray-500">AI is thinking...</span>
                             </div>
                         </div>
                    )}
                    <div ref={chatBottomRef}></div>
                </div>

                {/* WORKFLOW COMMAND CENTER (Fixed Bottom Panel) */}
                <div className="bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-40 flex flex-col">
                    
                    {/* Step 1: Mode & Step 2: Presets */}
                    <div className="p-4 pb-2 border-b border-gray-100">
                        
                        {/* Step 1: Mode Switch */}
                        <div className="mb-4">
                            <label className="text-[10px] font-bold text-gray-400 uppercase mb-1.5 block tracking-wider">Step 1: Select Mode</label>
                            <div className="flex bg-gray-100 p-1 rounded-lg">
                                <button 
                                    onClick={() => setChatMode('ask')}
                                    className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all flex items-center justify-center ${chatMode === 'ask' ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-black/5' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    <MessageSquare className="w-3.5 h-3.5 mr-1.5" /> Ask Data
                                </button>
                                <button 
                                    onClick={() => setChatMode('action')}
                                    className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all flex items-center justify-center ${chatMode === 'action' ? 'bg-white text-purple-600 shadow-sm ring-1 ring-black/5' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    <PlayCircle className="w-3.5 h-3.5 mr-1.5" /> Take Action
                                </button>
                            </div>
                        </div>

                        {/* Step 2: 5-Slot Command Grid */}
                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase mb-1.5 block tracking-wider">Step 2: Select Command</label>
                            <div className="space-y-1.5">
                                {getFixedPresets(presets[chatMode]).map((preset, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => {
                                            if (preset) setUserInput(preset);
                                        }}
                                        disabled={!preset}
                                        className={`w-full text-left px-3 py-2 rounded-md border text-xs font-medium transition-all flex items-center group ${
                                            preset 
                                            ? `bg-white border-gray-200 text-gray-700 hover:border-${chatMode === 'ask' ? 'indigo' : 'purple'}-300 hover:text-${chatMode === 'ask' ? 'indigo' : 'purple'}-600 hover:shadow-sm` 
                                            : 'bg-gray-50 border-transparent text-gray-300 cursor-not-allowed'
                                        }`}
                                    >
                                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold mr-2 transition-colors ${preset ? `bg-gray-100 group-hover:bg-${chatMode === 'ask' ? 'indigo' : 'purple'}-50 text-gray-500 group-hover:text-${chatMode === 'ask' ? 'indigo' : 'purple'}-600` : 'bg-gray-100 text-gray-300'}`}>
                                            {idx + 1}
                                        </span>
                                        <span className="truncate">{preset || "(Empty Slot)"}</span>
                                        {preset && <ChevronRight className={`w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 text-${chatMode === 'ask' ? 'indigo' : 'purple'}-400`} />}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Step 3: Refine & Run */}
                    <div className="p-4 bg-gray-50">
                        <label className="text-[10px] font-bold text-gray-400 uppercase mb-1.5 block tracking-wider">Step 3: Refine & Run</label>
                        <form onSubmit={handleSendMessage} className="relative">
                            <input
                                type="text"
                                value={userInput}
                                onChange={(e) => setUserInput(e.target.value)}
                                placeholder={chatMode === 'ask' ? "Refine question..." : "Refine command..."}
                                className={`w-full pl-3 pr-10 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${chatMode === 'ask' ? 'indigo' : 'purple'}-500 focus:border-${chatMode === 'ask' ? 'indigo' : 'purple'}-500 outline-none text-sm shadow-sm transition-colors`}
                                disabled={isProcessing}
                            />
                            <button 
                                type="submit"
                                disabled={!userInput.trim() || isProcessing}
                                className={`absolute right-1.5 top-1.5 p-1.5 text-white rounded-md disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors ${chatMode === 'ask' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-purple-600 hover:bg-purple-700'}`}
                            >
                                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        )}

        {/* Modal: Target Column Selection (Action Mode) */}
        {showTargetModal && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center bg-purple-50">
                        <h3 className="font-bold text-gray-800 flex items-center">
                            <PlayCircle className="w-4 h-4 mr-2 text-purple-600" /> Target Column
                        </h3>
                        <button onClick={() => setShowTargetModal(false)} className="text-gray-400 hover:text-gray-600">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="p-5">
                        <p className="text-sm text-gray-600 mb-4">
                            AI will process <strong>{getSelectedData().length} visible rows</strong>.<br/>
                            Hidden/Filtered rows will be ignored.
                            <br/><br/>
                            Command: <span className="font-medium text-purple-600">"{pendingActionPrompt}"</span>
                        </p>
                        
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Write results to:</label>
                        <div className="space-y-3">
                             <select 
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                                onChange={(e) => setTargetCol(e.target.value)}
                                value={targetCol || ''}
                             >
                                 <option value="">-- Select Existing Column --</option>
                                 {columns.map(c => <option key={c} value={c}>{c}</option>)}
                             </select>
                             
                             <input 
                                type="text" 
                                placeholder="Or create New Column..."
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                                onChange={(e) => setTargetCol(e.target.value)}
                             />
                        </div>
                    </div>
                    <div className="p-4 bg-gray-50 flex justify-end space-x-3">
                        <button onClick={() => setShowTargetModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium">Cancel</button>
                        <button 
                            onClick={executeAction}
                            disabled={!targetCol}
                            className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 shadow-sm"
                        >
                            Execute AI
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Modal: Preset Configuration */}
        {showPresetConfig && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                    <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                        <h3 className="font-bold text-lg text-gray-800 flex items-center">
                            <Edit3 className="w-5 h-5 mr-2 text-indigo-600" /> Configure Command Center
                        </h3>
                        <button onClick={() => setShowPresetConfig(false)} className="text-gray-400 hover:text-gray-600">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-6">
                        <p className="text-sm text-gray-500 mb-6 bg-blue-50 p-3 rounded-lg border border-blue-100">
                            Define exactly <strong>5 standard commands</strong> for each mode. This enforces team consistency and simplifies the workflow.
                        </p>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Ask Presets */}
                            <div>
                                <h4 className="font-bold text-indigo-700 mb-3 flex items-center text-sm border-b pb-2">
                                    <MessageSquare className="w-4 h-4 mr-2" /> Ask Mode (5 Slots)
                                </h4>
                                <div className="space-y-3">
                                    {[0, 1, 2, 3, 4].map((idx) => (
                                        <div key={`ask-${idx}`} className="flex items-center">
                                            <div className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs font-bold mr-2 flex-shrink-0">
                                                {idx + 1}
                                            </div>
                                            <input 
                                                type="text"
                                                value={editingPresets.ask[idx] || ''}
                                                onChange={(e) => updateEditingPreset('ask', idx, e.target.value)}
                                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                                placeholder={`Command Slot #${idx + 1}`}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Action Presets */}
                            <div>
                                <h4 className="font-bold text-purple-700 mb-3 flex items-center text-sm border-b pb-2">
                                    <PlayCircle className="w-4 h-4 mr-2" /> Action Mode (5 Slots)
                                </h4>
                                <div className="space-y-3">
                                    {[0, 1, 2, 3, 4].map((idx) => (
                                        <div key={`action-${idx}`} className="flex items-center">
                                            <div className="w-6 h-6 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center text-xs font-bold mr-2 flex-shrink-0">
                                                {idx + 1}
                                            </div>
                                            <input 
                                                type="text"
                                                value={editingPresets.action[idx] || ''}
                                                onChange={(e) => updateEditingPreset('action', idx, e.target.value)}
                                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                                                placeholder={`Command Slot #${idx + 1}`}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end space-x-3">
                        <button onClick={() => setShowPresetConfig(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium">Cancel</button>
                        <button 
                            onClick={savePresets}
                            className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm"
                        >
                            Save Configuration
                        </button>
                    </div>
                </div>
            </div>
        )}

    </div>
  );
};

export default AiAgent;
