
import React, { useState, useEffect } from 'react';
import { Project, AISettings, AIProvider } from '../types';
import { saveProject } from '../utils/storage-compat';
import { Save, CheckCircle2, Key, Cpu, Sliders, AlertTriangle, Eye, EyeOff, Loader2 } from 'lucide-react';

interface SettingsProps {
  project: Project;
  onUpdateProject: (p: Project) => void;
}

const PROVIDERS = [
  { id: AIProvider.GEMINI, label: 'Google Gemini', icon: '💎' },
  { id: AIProvider.OPENAI, label: 'OpenAI GPT', icon: '🟢' },
  { id: AIProvider.CLAUDE, label: 'Anthropic Claude', icon: '🟠' },
];

const MODELS: Record<AIProvider, string[]> = {
  [AIProvider.GEMINI]: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-1.5-flash', 'gemini-1.5-pro'],
  [AIProvider.OPENAI]: ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  [AIProvider.CLAUDE]: ['claude-3-5-sonnet-20240620', 'claude-3-opus-20240229', 'claude-3-sonnet-20240229'],
};

const DEFAULT_SETTINGS: AISettings = {
  provider: AIProvider.GEMINI,
  apiKey: '',
  model: 'gemini-2.5-flash',
  temperature: 0.7,
  maxTokens: 2000,
};

const Settings: React.FC<SettingsProps> = ({ project, onUpdateProject }) => {
  const [settings, setSettings] = useState<AISettings>(project.aiSettings || DEFAULT_SETTINGS);
  const [showKey, setShowKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Sync local state if project changes (e.g. reload)
  useEffect(() => {
      if (project.aiSettings) {
          setSettings(project.aiSettings);
      }
  }, [project.aiSettings]);

  const handleChange = (field: keyof AISettings, value: any) => {
    setSettings(prev => ({ ...prev, [field]: value }));
    setSaveSuccess(false); // Reset success message on change
  };

  const handleProviderChange = (provider: AIProvider) => {
      setSettings(prev => ({
          ...prev,
          provider,
          model: MODELS[provider][0] // Default to first model of new provider
      }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    const updatedProject = { ...project, aiSettings: settings };
    onUpdateProject(updatedProject);
    await saveProject(updatedProject);
    setIsSaving(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Project Settings</h2>
        <p className="text-gray-500">Configure AI provider and parameters for this specific project.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="px-8 py-6 border-b border-gray-100 bg-gray-50">
            <h3 className="font-bold text-gray-800 flex items-center">
                <Cpu className="w-5 h-5 mr-2 text-blue-600" />
                AI Configuration
            </h3>
            <p className="text-sm text-gray-500 mt-1">These settings apply to Auto-Transform, Analytics, and AI Agent features.</p>
        </div>

        <div className="p-8 space-y-8">
            
            {/* 1. Provider Selection */}
            <div>
                <label className="block text-sm font-bold text-gray-700 mb-3">Select AI Provider</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {PROVIDERS.map((prov) => (
                        <button
                            key={prov.id}
                            onClick={() => handleProviderChange(prov.id)}
                            className={`flex items-center p-4 rounded-xl border-2 transition-all ${
                                settings.provider === prov.id 
                                ? 'border-blue-500 bg-blue-50/50 ring-1 ring-blue-500' 
                                : 'border-gray-200 hover:border-gray-300 bg-white'
                            }`}
                        >
                            <span className="text-2xl mr-3">{prov.icon}</span>
                            <div className="text-left">
                                <div className={`font-bold text-sm ${settings.provider === prov.id ? 'text-blue-700' : 'text-gray-700'}`}>{prov.label}</div>
                                <div className="text-[10px] text-gray-400">
                                    {prov.id === AIProvider.GEMINI ? 'Best for Analysis' : prov.id === AIProvider.CLAUDE ? 'Best for Writing' : 'Balanced'}
                                </div>
                            </div>
                            {settings.provider === prov.id && <CheckCircle2 className="w-5 h-5 ml-auto text-blue-500" />}
                        </button>
                    ))}
                </div>
            </div>

            {/* 2. API Key */}
            <div className="bg-gray-50 p-6 rounded-xl border border-gray-100">
                <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center">
                    <Key className="w-4 h-4 mr-2 text-gray-500" />
                    API Key
                    <span className="ml-2 text-xs font-normal text-red-500">* Required</span>
                </label>
                <div className="relative">
                    <input 
                        type={showKey ? "text" : "password"}
                        value={settings.apiKey}
                        onChange={(e) => handleChange('apiKey', e.target.value)}
                        placeholder={`Enter your ${settings.provider} API Key...`}
                        className="w-full pl-4 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                    />
                    <button 
                        onClick={() => setShowKey(!showKey)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                        {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                </div>
                <p className="text-xs text-gray-400 mt-2 flex items-center">
                    <AlertTriangle className="w-3 h-3 mr-1 text-amber-500" />
                    Key is stored locally in your browser (IndexedDB) and never sent to our servers.
                </p>
            </div>

            {/* 3. Model Parameters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-3">Model Version</label>
                    <select 
                        value={settings.model}
                        onChange={(e) => handleChange('model', e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-sm"
                    >
                        {MODELS[settings.provider].map(m => (
                            <option key={m} value={m}>{m}</option>
                        ))}
                    </select>
                </div>
                
                <div className="space-y-6">
                     <div>
                        <div className="flex justify-between mb-2">
                            <label className="text-sm font-bold text-gray-700 flex items-center">
                                <Sliders className="w-3.5 h-3.5 mr-2" /> Temperature
                            </label>
                            <span className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded">{settings.temperature}</span>
                        </div>
                        <input 
                            type="range" 
                            min="0" max="1" step="0.1" 
                            value={settings.temperature}
                            onChange={(e) => handleChange('temperature', parseFloat(e.target.value))}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                        <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                            <span>Precise</span>
                            <span>Creative</span>
                        </div>
                     </div>

                     <div>
                        <div className="flex justify-between mb-2">
                            <label className="text-sm font-bold text-gray-700">Max Tokens</label>
                            <span className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded">{settings.maxTokens}</span>
                        </div>
                        <input 
                            type="number" 
                            value={settings.maxTokens}
                            onChange={(e) => handleChange('maxTokens', parseInt(e.target.value))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                        />
                     </div>
                </div>
            </div>

        </div>

        {/* Footer Actions */}
        <div className="bg-gray-50 px-8 py-4 border-t border-gray-200 flex justify-end items-center">
            {saveSuccess && (
                <span className="text-green-600 text-sm font-medium mr-4 flex items-center animate-fade-in">
                    <CheckCircle2 className="w-4 h-4 mr-1" /> Settings Saved
                </span>
            )}
            <button 
                onClick={handleSave}
                disabled={isSaving || !settings.apiKey}
                className="flex items-center px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 shadow-sm transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                Save Configuration
            </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
