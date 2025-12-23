import React from 'react';
import { LayoutDashboard, PlusCircle, Database, LogOut } from 'lucide-react';

interface HeaderProps {
  currentView: 'list' | 'add';
  onNavigate: (view: 'list' | 'add') => void;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({ currentView, onNavigate, onLogout }) => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => onNavigate('list')}>
            <div className="bg-blue-600 p-1.5 rounded-lg">
              <Database className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 tracking-tight leading-none">AssetTrack IT</h1>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">Global Portal</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 md:gap-6">
            <nav className="flex gap-1 md:gap-2">
              <button
                onClick={() => onNavigate('list')}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                  currentView === 'list'
                    ? 'bg-blue-50 text-blue-700 shadow-sm'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <LayoutDashboard className="h-4 w-4" />
                <span className="hidden sm:inline">Inventory</span>
              </button>
              <button
                onClick={() => onNavigate('add')}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                  currentView === 'add'
                    ? 'bg-blue-50 text-blue-700 shadow-sm'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <PlusCircle className="h-4 w-4" />
                <span className="hidden sm:inline">Register</span>
              </button>
            </nav>

            <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>

            <button
              onClick={onLogout}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold text-slate-500 hover:text-red-600 hover:bg-red-50 transition-all group"
              title="Logout"
            >
              <LogOut className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              <span className="hidden md:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};