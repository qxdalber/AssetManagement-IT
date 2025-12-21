import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Asset, AssetStatus, HistoryEntry } from '../types';
import { Search, Filter, Sparkles, Trash2, Download, Loader2, Globe, Edit3, AlertTriangle, X, History as HistoryIcon, ArrowRight } from 'lucide-react';
import { generateAssetReport } from '../services/geminiService';

interface AssetListProps {
  assets: Asset[];
  onDelete: (ids: string[]) => void;
  onUpdateAsset: (assetId: string, siteId: string, updates: Partial<Asset>) => Promise<void>;
}

export const AssetList: React.FC<AssetListProps> = ({ assets, onDelete, onUpdateAsset }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [updatingAssetId, setUpdatingAssetId] = useState<string | null>(null);
  
  // Inline edit state
  const [editing, setEditing] = useState<{ id: string, field: 'model' | 'serialNumber', value: string } | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  // Deletion Modal State
  const [assetsToDelete, setAssetsToDelete] = useState<Asset[] | null>(null);

  // History Modal State
  const [viewingHistory, setViewingHistory] = useState<Asset | null>(null);

  useEffect(() => {
    if (editing && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editing]);

  const filteredAssets = useMemo(() => {
    return assets.filter(asset => {
      const matchesSearch = 
        asset.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
        asset.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        asset.siteId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        asset.country.toLowerCase().includes(searchTerm.toLowerCase());
      
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
      await onUpdateAsset(asset.id, asset.siteId, { status: newStatus });
    } catch (e) {
      // Handled in App
    } finally {
      setUpdatingAssetId(null);
    }
  };

  const startEditing = (asset: Asset, field: 'model' | 'serialNumber') => {
    setEditing({ id: asset.id, field, value: asset[field] });
  };

  const saveEdit = async () => {
    if (!editing) return;
    
    const asset = assets.find(a => a.id === editing.id);
    if (!asset || asset[editing.field] === editing.value) {
      setEditing(null);
      return;
    }

    setUpdatingAssetId(asset.id);
    const updates = { [editing.field]: editing.value };
    setEditing(null); // Close input immediately for UX

    try {
      await onUpdateAsset(asset.id, asset.siteId, updates);
    } catch (e) {
      // Handled in App
    } finally {
      setUpdatingAssetId(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') saveEdit();
    if (e.key === 'Escape') setEditing(null);
  };

  const initiateSingleDelete = (asset: Asset) => {
    setAssetsToDelete([asset]);
  };

  const initiateBulkDelete = () => {
    const targets = assets.filter(a => selectedIds.has(a.id));
    if (targets.length > 0) {
      setAssetsToDelete(targets);
    }
  };

  const confirmDelete = () => {
    if (assetsToDelete) {
      const ids = assetsToDelete.map(a => a.id);
      onDelete(ids);
      setSelectedIds(prev => {
        const next = new Set(prev);
        ids.forEach(id => next.delete(id));
        return next;
      });
      setAssetsToDelete(null);
    }
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
    const headers = ["Model", "Serial Number", "Site ID", "Country", "Status", "Date"];
    const rows = filteredAssets.map(a => [
      a.model,
      a.serialNumber,
      a.siteId,
      a.country,
      a.status,
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
      {/* Deletion Confirmation Modal */}
      {assetsToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
            <div className="p-6 pb-4 flex items-center justify-between border-b border-slate-100">
              <div className="flex items-center gap-3 text-red-600">
                <div className="p-2 bg-red-50 rounded-full">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold">Confirm Deletion</h3>
              </div>
              <button 
                onClick={() => setAssetsToDelete(null)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <p className="text-slate-600 mb-4">
                Are you sure you want to delete the following <span className="font-bold text-slate-900">{assetsToDelete.length}</span> asset(s)? 
                This action is permanent and cannot be undone in S3.
              </p>
              
              <div className="bg-slate-50 rounded-xl border border-slate-200 divide-y divide-slate-200 max-h-60 overflow-y-auto">
                {assetsToDelete.map(asset => (
                  <div key={asset.id} className="p-3 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-slate-900 text-sm">{asset.model}</div>
                      <div className="text-xs text-slate-500 font-mono">{asset.serialNumber}</div>
                    </div>
                    <div className="text-xs font-medium text-slate-400 bg-slate-200 px-2 py-0.5 rounded uppercase">
                      {asset.siteId}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 bg-slate-50 flex gap-3">
              <button
                onClick={() => setAssetsToDelete(null)}
                className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors shadow-lg shadow-red-200"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Log Modal */}
      {viewingHistory && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
            <div className="p-6 pb-4 flex items-center justify-between border-b border-slate-100">
              <div className="flex items-center gap-3 text-blue-600">
                <div className="p-2 bg-blue-50 rounded-full">
                  <HistoryIcon className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Asset History</h3>
                  <p className="text-xs text-slate-500 font-mono">{viewingHistory.serialNumber}</p>
                </div>
              </div>
              <button 
                onClick={() => setViewingHistory(null)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto bg-slate-50/50">
              <div className="space-y-4">
                {viewingHistory.history && viewingHistory.history.length > 0 ? (
                  viewingHistory.history.slice().reverse().map((entry, idx) => (
                    <div key={idx} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                          {entry.field} Change
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {new Date(entry.timestamp).toLocaleString()}
                        </span>
                      </div>
                      
                      {entry.oldValue === null ? (
                        <div className="text-sm font-medium text-emerald-600">
                          {entry.newValue}
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <div className="flex-1 bg-slate-50 p-2 rounded border border-slate-100 line-through text-slate-400 text-xs">
                            {String(entry.oldValue)}
                          </div>
                          <ArrowRight className="h-4 w-4 text-slate-300 flex-shrink-0" />
                          <div className="flex-1 bg-blue-50 p-2 rounded border border-blue-100 text-blue-700 text-xs font-semibold">
                            {String(entry.newValue)}
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 text-slate-400 italic">
                    No history recorded for this asset yet.
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setViewingHistory(null)}
                className="px-6 py-2 rounded-xl font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
              >
                Close Log
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col xl:flex-row gap-4 justify-between items-center">
        <div className="flex flex-col md:flex-row items-center gap-4 w-full xl:w-auto">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search Model, Serial, Site, Country..."
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
              onClick={initiateBulkDelete}
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
                <th className="px-6 py-4 text-center">Site ID</th>
                <th className="px-6 py-4 text-center">Country</th>
                <th className="px-6 py-4">Status</th>
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
                    <td className="px-6 py-4 relative group/field">
                      {editing?.id === asset.id && editing.field === 'model' ? (
                        <input
                          ref={editInputRef}
                          type="text"
                          value={editing.value}
                          onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                          onBlur={saveEdit}
                          onKeyDown={handleKeyDown}
                          className="w-full px-2 py-1 border border-blue-400 rounded outline-none focus:ring-2 focus:ring-blue-100"
                        />
                      ) : (
                        <div 
                          className="flex items-center gap-2 cursor-pointer hover:bg-slate-100/50 p-1 -m-1 rounded transition-colors"
                          onClick={() => startEditing(asset, 'model')}
                        >
                          <span className="font-medium text-slate-900">{asset.model}</span>
                          <Edit3 className="h-3 w-3 text-slate-300 opacity-0 group-hover/field:opacity-100 transition-opacity" />
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 relative group/field">
                      {editing?.id === asset.id && editing.field === 'serialNumber' ? (
                        <input
                          ref={editInputRef}
                          type="text"
                          value={editing.value}
                          onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                          onBlur={saveEdit}
                          onKeyDown={handleKeyDown}
                          className="w-full px-2 py-1 border border-blue-400 rounded outline-none focus:ring-2 focus:ring-blue-100 font-mono text-xs"
                        />
                      ) : (
                        <div 
                          className="flex items-center gap-2 cursor-pointer hover:bg-slate-100/50 p-1 -m-1 rounded transition-colors"
                          onClick={() => startEditing(asset, 'serialNumber')}
                        >
                          <span className="text-slate-600 font-mono text-xs">{asset.serialNumber}</span>
                          <Edit3 className="h-3 w-3 text-slate-300 opacity-0 group-hover/field:opacity-100 transition-opacity" />
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                        {asset.siteId}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-1.5 text-slate-600">
                        <Globe className="h-3.5 w-3.5 text-slate-400" />
                        <span className="font-medium">{asset.country || 'N/A'}</span>
                      </div>
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
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setViewingHistory(asset)}
                          className="text-slate-300 hover:text-blue-500 transition-colors p-2 rounded-md hover:bg-blue-50"
                          title="View History"
                        >
                          <HistoryIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => initiateSingleDelete(asset)}
                          className="text-slate-300 hover:text-red-500 transition-colors p-2 rounded-md hover:bg-red-50"
                          title="Delete Asset"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
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