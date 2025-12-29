import React, { useState, useMemo, useEffect } from 'react';
import { Asset, AssetStatus } from '../types';
import { 
  Search, 
  Sparkles, 
  Trash2, 
  Loader2, 
  Globe, 
  AlertTriangle, 
  X, 
  History as HistoryIcon,
  ChevronLeft,
  ChevronRight,
  Rows,
  FileDown,
  FileText,
  Table as TableIcon
} from 'lucide-react';
import { generateAssetReport } from '../services/geminiService';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

interface AssetListProps {
  assets: Asset[];
  onDelete: (ids: string[]) => void;
  onUpdateAsset: (serialNumber: string, updates: Partial<Asset>) => Promise<void>;
}

export const AssetList: React.FC<AssetListProps> = ({ assets, onDelete, onUpdateAsset }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedSerials, setSelectedSerials] = useState<Set<string>>(new Set());
  const [updatingId] = useState<string | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  
  // Pagination State
  const [itemsPerPage, setItemsPerPage] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);
  
  const [assetsToDelete, setAssetsToDelete] = useState<Asset[] | null>(null);
  const [viewingHistory, setViewingHistory] = useState<Asset | null>(null);

  // Helper for status colors
  const getStatusClasses = (status: AssetStatus) => {
    switch (status) {
      case AssetStatus.Normal: 
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case AssetStatus.RMARequested: 
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case AssetStatus.RMAShipped: 
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case AssetStatus.RMAEligible: 
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case AssetStatus.RMANotEligible: 
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case AssetStatus.Deprecated: 
        return 'bg-slate-100 text-slate-600 border-slate-200';
      default: 
        return 'bg-slate-50 text-slate-500 border-slate-200';
    }
  };

  // Reset page on search or filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, itemsPerPage]);

  const filtered = useMemo(() => assets.filter(a => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = 
      a.model.toLowerCase().includes(term) || 
      a.serialNumber.toLowerCase().includes(term) || 
      a.siteID.toLowerCase().includes(term) || 
      (a.comments || '').toLowerCase().includes(term);
    return matchesSearch && (statusFilter === 'All' || a.status === statusFilter);
  }), [assets, searchTerm, statusFilter]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentItems = filtered.slice(startIndex, startIndex + itemsPerPage);
  const allSelected = currentItems.length > 0 && currentItems.every(a => selectedSerials.has(a.serialNumber));

  const toggleSelect = (s: string) => {
    const next = new Set(selectedSerials);
    next.has(s) ? next.delete(s) : next.add(s);
    setSelectedSerials(next);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const prepareExportData = () => {
    return filtered.map(a => ({
      'Model': a.model,
      'Serial Number': a.serialNumber,
      'Site ID': a.siteID,
      'Country': a.country,
      'Status': a.status,
      'Comments': a.comments || '',
      'Created At': new Date(a.createdAt).toLocaleString(),
      'History Events': (a.history || []).length
    }));
  };

  const exportCSV = () => {
    const data = prepareExportData();
    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `AssetTrack_Export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowExportMenu(false);
  };

  const exportExcel = () => {
    const data = prepareExportData();
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Assets");
    XLSX.writeFile(workbook, `AssetTrack_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
    setShowExportMenu(false);
  };

  return (
    <div className="space-y-6">
      {assetsToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-red-600 mb-4 flex items-center gap-2"><AlertTriangle /> Delete Assets?</h3>
            <p className="text-sm text-slate-600 mb-6">Permanently remove {assetsToDelete.length} assets from DynamoDB?</p>
            <div className="flex gap-3">
              <button onClick={() => setAssetsToDelete(null)} className="flex-1 py-2 border rounded-xl">Cancel</button>
              <button 
                onClick={() => { 
                  onDelete(assetsToDelete.map(a => a.serialNumber)); 
                  setAssetsToDelete(null); 
                  setSelectedSerials(new Set()); 
                }} 
                className="flex-1 py-2 bg-red-600 text-white rounded-xl font-bold"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {viewingHistory && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold flex items-center gap-2 text-blue-600"><HistoryIcon /> History: {viewingHistory.serialNumber}</h3>
              <button onClick={() => setViewingHistory(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X className="h-5 w-5"/></button>
            </div>
            <div className="space-y-4">
              {(viewingHistory.history || []).slice().reverse().map((h, i) => (
                <div key={i} className="p-3 border rounded-lg bg-slate-50">
                  <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">{h.field} - {new Date(h.timestamp).toLocaleString()}</div>
                  <div className="text-sm font-semibold">
                    {h.oldValue !== null && <span className="line-through text-slate-300 mr-2">{h.oldValue}</span>}
                    {h.newValue}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Control Bar */}
      <div className="bg-white p-4 rounded-xl border flex flex-col lg:flex-row gap-4 items-center justify-between shadow-sm">
        <div className="flex flex-col md:flex-row gap-4 w-full lg:w-auto">
          <div className="relative flex-1 md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search inventory..." 
              className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)} 
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase whitespace-nowrap">Show</span>
            <div className="relative">
              <Rows className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <select 
                className="pl-8 pr-4 py-2 border rounded-lg text-sm appearance-none bg-white font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                value={itemsPerPage}
                onChange={e => setItemsPerPage(Number(e.target.value))}
              >
                {[50, 100, 150, 200, 250].map(val => (
                  <option key={val} value={val}>{val} entries</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        
        <div className="flex gap-3 w-full lg:w-auto">
          <select 
            className="flex-1 lg:flex-none px-3 py-2 border rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none" 
            value={statusFilter} 
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="All">All Statuses</option>
            {Object.values(AssetStatus).map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          {/* Export Dropdown */}
          <div className="relative">
            <button 
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-bold hover:bg-slate-200 transition-colors"
            >
              <FileDown className="h-4 w-4" /> 
              Export
            </button>
            {showExportMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)}></div>
                <div className="absolute right-0 mt-2 w-48 bg-white border rounded-xl shadow-xl z-20 py-1 overflow-hidden animate-fade-in">
                  <button onClick={exportCSV} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
                    <FileText className="h-4 w-4 text-slate-400" /> Export as CSV
                  </button>
                  <button onClick={exportExcel} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors border-t border-slate-50">
                    <TableIcon className="h-4 w-4 text-emerald-500" /> Export as Excel
                  </button>
                </div>
              </>
            )}
          </div>

          <button 
            onClick={async () => { 
              setIsAnalyzing(true); 
              try { setAnalysis(await generateAssetReport(filtered)); } 
              finally { setIsAnalyzing(false); } 
            }} 
            className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {isAnalyzing ? <Loader2 className="animate-spin h-4 w-4" /> : <Sparkles className="h-4 w-4" />} 
            AI Analysis
          </button>
        </div>
      </div>

      {analysis && (
        <div className="p-6 bg-indigo-50 rounded-xl border border-indigo-100 relative animate-fade-in">
          <button onClick={() => setAnalysis(null)} className="absolute top-4 right-4 text-slate-400 hover:text-indigo-600 transition-colors">
            <X className="h-5 w-5"/>
          </button>
          <div className="prose prose-sm text-slate-700">
            {analysis.split('\n').map((l, i) => <p key={i}>{l}</p>)}
          </div>
        </div>
      )}

      {/* Table Container */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-slate-50 border-b text-[10px] font-bold uppercase text-slate-500 tracking-wider">
              <tr>
                <th className="px-6 py-4 w-10 text-center">
                  <input 
                    type="checkbox" 
                    checked={allSelected} 
                    onChange={(e) => { 
                      const next = new Set(selectedSerials); 
                      currentItems.forEach(a => e.target.checked ? next.add(a.serialNumber) : next.delete(a.serialNumber)); 
                      setSelectedSerials(next); 
                    }} 
                    className="rounded border-slate-300"
                  />
                </th>
                <th className="px-6 py-4">Model</th>
                <th className="px-6 py-4">Serial Number (PK)</th>
                <th className="px-6 py-4">SiteID</th>
                <th className="px-6 py-4">Country</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {currentItems.map(a => (
                <tr key={a.serialNumber} className={`hover:bg-slate-50/50 transition-colors ${selectedSerials.has(a.serialNumber) ? 'bg-blue-50/30' : ''}`}>
                  <td className="px-6 py-4 text-center">
                    <input 
                      type="checkbox" 
                      checked={selectedSerials.has(a.serialNumber)} 
                      onChange={() => toggleSelect(a.serialNumber)} 
                      className="rounded border-slate-300"
                    />
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-900">{a.model}</td>
                  <td className="px-6 py-4 font-mono text-xs text-blue-600 font-bold">{a.serialNumber}</td>
                  <td className="px-6 py-4 font-semibold text-slate-700">{a.siteID}</td>
                  <td className="px-6 py-4 text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <Globe className="h-3 w-3 text-slate-400" />
                      {a.country}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {updatingId === a.serialNumber ? (
                      <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                    ) : (
                      <select 
                        value={a.status} 
                        onChange={(e) => onUpdateAsset(a.serialNumber, { status: e.target.value as AssetStatus })} 
                        className={`px-3 py-1 border rounded-full text-[10px] font-extrabold uppercase tracking-wider transition-all appearance-none cursor-pointer text-center min-w-[120px] ${getStatusClasses(a.status)}`}
                      >
                        {Object.values(AssetStatus).map(s => <option key={s} value={s} className="bg-white text-slate-900">{s}</option>)}
                      </select>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-1">
                      <button 
                        onClick={() => setViewingHistory(a)} 
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" 
                        title="View History"
                      >
                        <HistoryIcon className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => setAssetsToDelete([a])} 
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" 
                        title="Delete Asset"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-2">
              <Database className="h-10 w-10 opacity-20 mb-2" />
              <p className="font-bold">No assets found matching your criteria.</p>
            </div>
          )}
        </div>

        {/* Pagination Footer */}
        {filtered.length > 0 && (
          <div className="px-6 py-4 border-t bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs font-semibold text-slate-500">
              Showing <span className="text-slate-900">{startIndex + 1}</span> to{' '}
              <span className="text-slate-900">{Math.min(startIndex + itemsPerPage, filtered.length)}</span> of{' '}
              <span className="text-slate-900">{filtered.length}</span> entries
            </div>
            
            <div className="flex items-center gap-1">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-2 border rounded-lg bg-white shadow-sm hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white transition-all"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              
              <div className="flex items-center px-4 py-2 bg-white border rounded-lg shadow-sm">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mr-2">Page</span>
                <span className="text-sm font-bold text-blue-600">{currentPage}</span>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-2">of {totalPages || 1}</span>
              </div>

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages || totalPages === 0}
                className="p-2 border rounded-lg bg-white shadow-sm hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white transition-all"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Helper component for empty state
const Database = ({ className }: { className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M3 5V19A9 3 0 0 0 21 19V5" />
    <path d="M3 12A9 3 0 0 0 21 12" />
  </svg>
);