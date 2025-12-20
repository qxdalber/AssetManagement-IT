import React from 'react';
import { LayoutDashboard, PlusCircle, Database } from 'lucide-react';

interface HeaderProps {
  currentView: 'list' | 'add';
  onNavigate: (view: 'list' | 'add') => void;
}

export const Header: React.FC<HeaderProps> = ({ currentView, onNavigate }) => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => onNavigate('list')}>
            <Database className="h-8 w-8 text-blue-600" />
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">AssetTrack IT</h1>
              <p className="text-xs text-slate-500 font-medium">Open Asset Portal</p>
            </div>
          </div>
          <nav className="flex gap-4">
            <button
              onClick={() => onNavigate('list')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                currentView === 'list'
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <LayoutDashboard className="h-4 w-4" />
              Asset List
            </button>
            <button
              onClick={() => onNavigate('add')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                currentView === 'add'
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <PlusCircle className="h-4 w-4" />
              Add Assets
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
};