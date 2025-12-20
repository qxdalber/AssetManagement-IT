
import React, { useState, useMemo } from 'react';
import { Asset, AssetStatus } from '../types';
import { Search, Filter, Sparkles, Trash2, Download, Loader2 } from 'lucide-react';
import { generateAssetReport } from '../services/geminiService';

interface AssetListProps {
  assets: Asset[];
  onDelete: (ids: string[]) => void;
  onUpdateStatus: (assetId: string, siteId: string, newStatus: AssetStatus) => Promise<void>;
}

export const AssetList: React.FC<AssetListProps> = ({ assets, onDelete, onUpdateStatus }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [updatingAssetId, setUpdatingAssetId] = useState<string | null>(null);

  const filteredAssets = useMemo(() => {
    return assets.filter(asset => {
      const matchesSearch = 
        asset.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
        asset.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        asset.siteId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        asset.comments.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'All' || asset.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [assets, searchTerm, statusFilter]);

  const allSelected = filteredAssets.length > 0 && filteredAssets.every(a => selectedIds.has(a.id));
  const isIndeterminate = filteredAssets.some(a => selectedIds.has(a.id)) && !allSelected;

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const newSelected = new Set(selectedIds);
      filteredAssets.forEach(a => newSelected.add(a.id));
      setSelectedIds(newSelected);
    } else {
      const newSelected = new Set(selectedIds);
      filteredAssets.forEach(a => newSelected.delete(a.id));
      setSelectedIds(newSelected);
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleStatusChange = async (asset: Asset, newStatus: AssetStatus) => {
    if (asset.status === newStatus) return;
    
    setUpdatingAssetId(asset.id);
    try {
      await onUpdateStatus(asset.id, asset.siteId, newStatus);
    } catch (e) {
      // Revert if handled elsewhere or UI is already stale
    } finally {
      setUpdatingAssetId(null);
    }
  };

  const handleBulkDelete = () => {
    onDelete(Array.from(selectedIds));
    setSelectedIds(new Set()); 
  };

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setAnalysis(null);
    try {
      const report = await generateAssetReport(filteredAssets);
      setAnalysis(report);
    } catch (error) {
      console.error(error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const exportToCSV = () => {
    const headers = ["Model", "Serial Number", "Site ID", "Status", "Comments", "Date"];
    const rows = filteredAssets.map(a => [
      a.model,
      a.serialNumber,
      a.siteId,
      a.status,
      `"${a.comments.replace(/"/g, '""')}"`,
      new Date(a.createdAt).toLocaleDateString()
    ]);
    
    const csvContent = "data:text/csv;charset=utf-8," + 
      [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "assets_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusColorClass = (status: AssetStatus) => {
    switch (status) {
      case AssetStatus.Normal: return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case AssetStatus.RMARequested: return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case AssetStatus.RMAShipped: return 'bg-purple-50 text-purple-700 border-purple-200';
      case AssetStatus.RMAEligible: return 'bg-blue-50 text-blue-700 border-blue-200';
      case AssetStatus.RMANotEligible: return 'bg-orange-50 text-orange-700 border-orange-200';
      case AssetStatus.Deprecated: return 'bg-red-50 text-red-700 border-red-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Controls */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col xl:flex-row gap-4 justify-between items-center">
        <div className="flex flex-col md:flex-row items-center gap-4 w-full xl:w-auto">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search Model, Serial, Site ID..."
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
            <div className="relative w-full sm:w-auto">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <select
                className="w-full sm:w-auto pl-10 pr-8 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm appearance-none bg-white"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="All">All Statuses</option>
                {Object.values(AssetStatus).map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        
        <div className="flex gap-2 w-full xl:w-auto flex-wrap md:flex-nowrap">
          {selectedIds.size > 0 && (
            <button
              onClick={handleBulkDelete}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors w-full md:w-auto animate-fade-in"
            >
              <Trash2 className="h-4 w-4" />
              Delete Selected ({selectedIds.size})
            </button>
          )}
          
          <button
            onClick={exportToCSV}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors w-full md:w-auto"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing || filteredAssets.length === 0}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg text-sm font-medium hover:from-indigo-600 hover:to-purple-700 transition-all shadow-md w-full md:w-auto disabled:opacity-50"
          >
            <Sparkles className={`h-4 w-4 ${isAnalyzing ? 'animate-spin' : ''}`} />
            {isAnalyzing ? 'Analyzing...' : 'AI Insights'}
          </button>
        </div>
      </div>

      {analysis && (
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-6 rounded-xl border border-indigo-100 shadow-sm animate-fade-in">
          <h3 className="flex items-center gap-2 text-indigo-900 font-semibold mb-3">
            <Sparkles className="h-5 w-5 text-indigo-600" />
            AI Executive Summary
          </h3>
          <div className="prose prose-sm prose-indigo max-w-none text-slate-700">
            {analysis.split('\n').map((line, i) => (
              <p key={i} className="mb-1">{line}</p>
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 w-12 text-center">
                   <input 
                    type="checkbox" 
                    className="w-4 h-4 text-blue-600 bg-white border-slate-300 rounded focus:ring-blue-500 focus:ring-2 cursor-pointer"
                    checked={allSelected}
                    ref={input => {
                      if (input) input.indeterminate = isIndeterminate;
                    }}
                    onChange={handleSelectAll}
                   />
                </th>
                <th className="px-6 py-4">Model</th>
                <th className="px-6 py-4">Serial Number</th>
                <th className="px-6 py-4">Site ID</th>
                <th className="px-6 py-4">Status (Click to Edit)</th>
                <th className="px-6 py-4 w-1/4">Comments</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAssets.length > 0 ? (
                filteredAssets.map((asset) => (
                  <tr key={asset.id} className={`hover:bg-slate-50 transition-colors group ${selectedIds.has(asset.id) ? 'bg-blue-50/50' : ''}`}>
                    <td className="px-6 py-4 text-center">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 text-blue-600 bg-white border-slate-300 rounded focus:ring-blue-500 focus:ring-2 cursor-pointer"
                        checked={selectedIds.has(asset.id)}
                        onChange={() => toggleSelect(asset.id)}
                      />
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-900">{asset.model}</td>
                    <td className="px-6 py-4 text-slate-600 font-mono text-xs">{asset.serialNumber}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                        {asset.siteId}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {updatingAssetId === asset.id ? (
                        <div className="flex items-center gap-2 px-2 py-1 text-xs text-blue-600 font-medium italic">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Saving...
                        </div>
                      ) : (
                        <div className="relative group/status w-fit">
                          <select
                            value={asset.status}
                            onChange={(e) => handleStatusChange(asset, e.target.value as AssetStatus)}
                            className={`
                              appearance-none cursor-pointer px-3 py-1 pr-8 rounded-full text-xs font-bold border outline-none focus:ring-2 focus:ring-blue-500/20 transition-all
                              ${getStatusColorClass(asset.status)}
                            `}
                          >
                            {Object.values(AssetStatus).map(s => (
                              <option key={s} value={s} className="bg-white text-slate-900">{s}</option>
                            ))}
                          </select>
                          <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-50 group-hover/status:opacity-100 transition-opacity">
                            <svg className="h-3 w-3 fill-current" viewBox="0 0 20 20">
                              <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                            </svg>
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-600 max-w-xs truncate text-sm" title={asset.comments}>
                      {asset.comments || <span className="text-slate-300 italic">No comments</span>}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => onDelete([asset.id])}
                        className="text-slate-300 hover:text-red-500 transition-colors p-2 rounded-md hover:bg-red-50"
                        title="Delete Asset"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    <p className="mb-2 text-lg font-medium">No assets matched your search</p>
                    <p className="text-sm">Try adjusting filters or adding new assets.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="flex justify-between items-center text-[10px] uppercase tracking-wider font-bold text-slate-400 px-2">
         <div>
          {selectedIds.size > 0 ? `${selectedIds.size} Assets Selected` : ''}
         </div>
         <div>
           Inventory Count: {filteredAssets.length} / {assets.length}
         </div>
      </div>
    </div>
  );
};
