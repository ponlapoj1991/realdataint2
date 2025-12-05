import React, { useMemo, useState } from 'react';
import {
  X,
  BarChart3, BarChartHorizontal, Layers, Percent,
  LineChart, TrendingUp, AreaChart,
  PieChart, Circle,
  Combine, Table, Hash, Cloud
} from 'lucide-react';
import { ChartType } from '../types';
import {
  getChartsByCategory,
  CATEGORY_LABELS,
  CATEGORY_ORDER
} from '../constants/chartDefinitions';

interface ChartTypeSelectorProps {
  isOpen: boolean;
  onSelect: (chartType: ChartType) => void;
  onClose: () => void;
}

// Map icon names to Lucide components
const ICON_MAP: Record<string, React.ComponentType<any>> = {
  'BarChart3': BarChart3,
  'BarChartHorizontal': BarChartHorizontal,
  'Layers': Layers,
  'Percent': Percent,
  'LineChart': LineChart,
  'TrendingUp': TrendingUp,
  'AreaChart': AreaChart,
  'PieChart': PieChart,
  'Circle': Circle,
  'Scatter': Circle, // Using Circle for scatter
  'Combine': Combine,
  'Table': Table,
  'Hash': Hash,
  'Cloud': Cloud
};

const ChartTypeSelector: React.FC<ChartTypeSelectorProps> = ({
  isOpen,
  onSelect,
  onClose
}) => {
  const [activeCategory, setActiveCategory] = useState(CATEGORY_ORDER[0]);
  const charts = useMemo(() => getChartsByCategory(activeCategory), [activeCategory]);

  if (!isOpen) return null;

  const handleSelect = (chartType: ChartType) => {
    onSelect(chartType);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-white">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Choose a chart type</h2>
            <p className="text-sm text-gray-500 mt-1">Pick the visual that best communicates your data.</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex flex-1">
          <div className="w-52 border-r border-gray-200 bg-gray-50 p-4 space-y-1">
            {CATEGORY_ORDER.map(category => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`w-full text-left px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeCategory === category
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {CATEGORY_LABELS[category]}
              </button>
            ))}
          </div>

          <div className="flex-1 p-6 overflow-y-auto">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {charts.map(chart => {
                const IconComponent = ICON_MAP[chart.icon] || BarChart3;
                return (
                  <button
                    key={chart.type}
                    onClick={() => handleSelect(chart.type)}
                    className="group flex flex-col items-start gap-3 p-4 border border-gray-200 rounded-xl hover:border-blue-500 hover:shadow-lg transition-all duration-200 bg-white"
                  >
                    <div className="w-full h-20 rounded-md bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
                      <IconComponent className="w-7 h-7 text-blue-600" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-gray-900">{chart.label}</p>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{chart.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChartTypeSelector;
