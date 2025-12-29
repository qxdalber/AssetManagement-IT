import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Asset, AssetStatus } from '../types';
import { Search, Sparkles, Trash2, Loader2, Globe, Edit3, AlertTriangle, X, History as HistoryIcon, ArrowRight, Hash, ChevronLeft, ChevronRight } from 'lucide-react';
import { generateAssetReport } from '../services/geminiService';

interface AssetListProps {
  assets: Asset[];
  onDelete: (ids: string[]) => void;
  onUpdateAsset: (assetId: string, updates: Partial<Asset>) => Promise<void>;
}

export const AssetList: React.FC<AssetListProps> = ({ assets, onDelete, onUpdateAsset }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [updatingAssetId, setUpdatingAssetId] = useState<string | null>(null);
  
  // Pagination State
  const [itemsPerPage, setItemsPerPage] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);
  
  const [editing, setEditing] = useState<{ id: string, field: 'model' | 'serialNumber', value: string } | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const [assetsToDelete, setAssetsToDelete] = useState<Asset[] | null>(null);
  const [viewingHistory, setViewingHistory] = useState<Asset | null>(null);

  useEffect(() => {
    if (editing && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editing]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, itemsPerPage]);

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

  // Pagination Logic
  const totalItems = filteredAssets.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const currentItems = filteredAssets.slice(startIndex, endIndex);

  const allSelectedOnPage = currentItems.length > 0 && currentItems.every(a => selectedIds.has(a.id));
  const isIndeterminateOnPage = currentItems.some(a => selectedIds.has(a.id)) && !allSelectedOnPage;

  const handleSelectAllOnPage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSelected = new Set(selectedIds);
    if (e.target.checked) currentItems.forEach(a => newSelected.add(a.id));
    else currentItems.forEach(a => newSelected.delete(a.id));
    setSelectedIds(newSelected);
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedIds(newSelected);
  };

  const handleStatusChange = async (asset: Asset, newStatus: AssetStatus) => {
    if (asset.status === newStatus) return;
    setUpdatingAssetId(asset.id);
    try {
      await onUpdateAsset(asset.id, { status: newStatus });
    } finally {
      setUpdatingAssetId(null);
    }
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
    setEditing(null);
    try {
      await onUpdateAsset(asset.id, updates);
    } finally {
      setUpdatingAssetId(null);
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

  const getStatusColor = (status: AssetStatus) => {
    switch (status) {
      case AssetStatus.Normal: return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case AssetStatus.RMARequested: return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case AssetStatus.RMAShipped: return 'bg-purple-50 text-purple-700 border-purple-200';
      case AssetStatus.RMAEligible: return 'bg-blue-50 text-blue-700 border-blue-200';
      case AssetStatus.Deprecated: return 'bg-red-50 text-red-700 border-red-200';
      default: return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Modals */}
      {assetsToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden scale-100 transition-transform">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3 text-red-600">
                <AlertTriangle className="h-6 w-6" />
                <h3 className="text-xl font-bold">Delete Assets?</h3>
              </div>
              <button onClick={() => setAssetsToDelete(null)} className="text-slate-400 hover:text-slate-600"><X /></button>
            </div>
            <div className="p-6">
              <p className="text-slate-600 mb-4">Deleting <strong>{assetsToDelete.length}</strong> asset(s) will permanently remove them from the cloud database.</p>
              <div className="max-h-40 overflow-y-auto bg-slate-50 rounded-lg p-3 space-y-2 border border-slate-200">
                {assetsToDelete.map(a => (
                  <div key={a.id} className="text-xs font-medium text-slate-700 flex justify-between">
                    <span>{a.model}</span> <span className="text-slate-400">{a.serialNumber}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-6 bg-slate-50 flex gap-3">
              <button onClick={() => setAssetsToDelete(null)} className="flex-1 py-2 rounded-xl border border-slate-200 bg-white font-semibold">Cancel</button>
              <button onClick={confirmDelete} className="flex-1 py-2 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700">Confirm Delete</button>
            </div>
          </div>
        </div>
      )}

      {viewingHistory && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 flex flex-col max-h-[85vh]">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3 text-blue-600 font-bold">
                <HistoryIcon className="h-5 w-5" />
                <span>Modification History: {viewingHistory.serialNumber}</span>
              </div>
              <button onClick={() => setViewingHistory(null)} className="text-slate-400 hover:text-slate-600"><X /></button>
            </div>
            <div className="p-6 overflow-y-auto bg-slate-50 flex-1">
              <div className="space-y-4">
                {(viewingHistory.history || []).slice().reverse().map((entry, i) => (
                  <div key={i} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase mb-2">
                      <span>{entry.field}</span>
                      <span>{new Date(entry.timestamp).toLocaleString()}</span>
                    </div>
                    {entry.oldValue === null ? (
                      <div className="text-sm text-emerald-600 font-semibold">{entry.newValue}</div>
                    ) : (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-slate-400 line-through">{String(entry.oldValue)}</span>
                        <ArrowRight className="h-3 w-3 text-slate-300" />
                        <span className="text-blue-700 font-bold">{String(entry.newValue)}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Table UI Controls */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col lg:flex-row gap-4 items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto items-center">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by model, SN, site or country..." 
              className="w-full pl-10 pr-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">View:</label>
            <select 
              className="px-3 py-2 border rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500"
              value={itemsPerPage}
              onChange={e => setItemsPerPage(Number(e.target.value))}
            >
              {[25, 50, 100, 125, 150].map(val => (
                <option key={val} value={val}>{val} per page</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full lg:w-auto justify-end">
          <select 
            className="px-3 py-2 border rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="All">All Statuses</option>
            {Object.values(AssetStatus).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          {selectedIds.size > 0 && (
            <button onClick={() => setAssetsToDelete(assets.filter(a => selectedIds.has(a.id)))} className="p-2 text-red-600 bg-red-50 border border-red-100 rounded-lg hover:bg-red-100 transition-colors">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <button onClick={async () => {
            setIsAnalyzing(true);
            try {
              const r = await generateAssetReport(filteredAssets);
              setAnalysis(r);
            } finally {
              setIsAnalyzing(false);
            }
          }} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow-md hover:bg-indigo-700 transition-all active:scale-95">
            {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            AI Insights
          </button>
        </div>
      </div>

      {analysis && (
        <div className="p-6 bg-gradient-to-br from-indigo-50 to-white rounded-2xl border border-indigo-100 shadow-sm relative animate-fade-in">
          <button onClick={() => setAnalysis(null)} className="absolute top-4 right-4 text-slate-300 hover:text-slate-500 transition-colors"><X className="h-4 w-4" /></button>
          <div className="prose prose-sm max-w-none text-slate-700 leading-relaxed">
            {analysis.split('\n').map((l, i) => <p key={i} className="mb-2">{l}</p>)}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden overflow-x-auto flex flex-col">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
            <tr>
              <th className="px-6 py-4 w-10 text-center">
                <input 
                  type="checkbox" 
                  checked={allSelectedOnPage} 
                  ref={el => { if (el) { el.indeterminate = isIndeterminateOnPage; } }} 
                  onChange={handleSelectAllOnPage} 
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" 
                />
              </th>
              <th className="px-6 py-4">Model</th>
              <th className="px-6 py-4">Serial Number</th>
              <th className="px-6 py-4">Site ID</th>
              <th className="px-6 py-4">Country</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {currentItems.map(asset => (
              <tr key={asset.id} className={`hover:bg-slate-50/50 transition-colors ${selectedIds.has(asset.id) ? 'bg-blue-50/30' : ''}`}>
                <td className="px-6 py-4 text-center">
                  <input 
                    type="checkbox" 
                    checked={selectedIds.has(asset.id)} 
                    onChange={() => toggleSelect(asset.id)} 
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" 
                  />
                </td>
                <td className="px-6 py-4">
                  <div className="group/edit">
                    {editing?.id === asset.id && editing.field === 'model' ? (
                      <input 
                        ref={editInputRef} 
                        value={editing.value} 
                        onChange={e => setEditing({...editing, value: e.target.value})} 
                        onBlur={saveEdit} 
                        onKeyDown={e => e.key === 'Enter' && saveEdit()} 
                        className="border-b border-blue-500 outline-none w-full bg-transparent font-bold text-slate-900" 
                      />
                    ) : (
                      <div className="flex items-center gap-2 font-bold text-slate-900 cursor-pointer" onClick={() => setEditing({id: asset.id, field: 'model', value: asset.model})}>
                        {asset.model} <Edit3 className="h-3 w-3 opacity-0 group-hover/edit:opacity-100 text-slate-300 transition-opacity" />
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="group/edit">
                    {editing?.id === asset.id && editing.field === 'serialNumber' ? (
                      <input 
                        ref={editInputRef} 
                        value={editing.value} 
                        onChange={e => setEditing({...editing, value: e.target.value})} 
                        onBlur={saveEdit} 
                        onKeyDown={e => e.key === 'Enter' && saveEdit()} 
                        className="border-b border-blue-500 outline-none w-full bg-transparent font-mono text-xs text-slate-600" 
                      />
                    ) : (
                      <div className="flex items-center gap-2 font-mono text-xs text-slate-600 cursor-pointer" onClick={() => setEditing({id: asset.id, field: 'serialNumber', value: asset.serialNumber})}>
                        <Hash className="h-3 w-3 text-slate-300" />
                        {asset.serialNumber} 
                        <Edit3 className="h-3 w-3 opacity-0 group-hover/edit:opacity-100 text-slate-300 transition-opacity" />
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="font-semibold text-slate-600">{asset.siteId}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <Globe className="h-3.5 w-3.5 text-slate-400" />
                    {asset.country}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="relative group/status min-w-[120px]">
                    {updatingAssetId === asset.id ? (
                      <div className="flex items-center gap-2 text-blue-600 text-xs font-semibold">
                        <Loader2 className="h-3 w-3 animate-spin" /> Updating...
                      </div>
                    ) : (
                      <select 
                        value={asset.status}
                        onChange={(e) => handleStatusChange(asset, e.target.value as AssetStatus)}
                        className={`px-3 py-1 rounded-full text-xs font-bold border transition-all appearance-none outline-none cursor-pointer ${getStatusColor(asset.status)}`}
                      >
                        {Object.values(AssetStatus).map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button 
                      onClick={() => setViewingHistory(asset)}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                      title="View History"
                    >
                      <HistoryIcon className="h-4 w-4" />
                    </button>
                    <button 
                      onClick={() => setAssetsToDelete([asset])}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                      title="Delete Asset"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {currentItems.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-slate-400 font-medium">
                  {totalItems > 0 ? "Adjust pagination or filters to see more results." : "No assets found matching your criteria."}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Pagination Footer */}
        {totalItems > 0 && (
          <div className="bg-slate-50 border-t border-slate-100 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs font-medium text-slate-500">
              Showing <span className="text-slate-900 font-bold">{startIndex + 1}</span> to <span className="text-slate-900 font-bold">{endIndex}</span> of <span className="text-slate-900 font-bold">{totalItems}</span> assets
            </div>
            
            <div className="flex items-center gap-1">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              
              <div className="flex items-center gap-1 px-2">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum = i + 1;
                  // Basic slider for many pages
                  if (totalPages > 5 && currentPage > 3) {
                    pageNum = currentPage - 3 + i + 1;
                    if (pageNum > totalPages) pageNum = totalPages - (4 - i);
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`min-w-[32px] h-8 text-xs font-bold rounded-lg transition-all ${
                        currentPage === pageNum 
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' 
                          : 'text-slate-600 hover:bg-white hover:border-slate-300 border border-transparent'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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