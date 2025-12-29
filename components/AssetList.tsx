import React, { useState, useMemo } from 'react';
import { Asset, AssetStatus } from '../types';
import { Search, Sparkles, Trash2, Loader2, Globe, AlertTriangle, X, History as HistoryIcon } from 'lucide-react';
import { generateAssetReport } from '../services/geminiService';

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
  const [itemsPerPage] = useState<number>(25);
  const [currentPage] = useState<number>(1);
  const [assetsToDelete, setAssetsToDelete] = useState<Asset[] | null>(null);
  const [viewingHistory, setViewingHistory] = useState<Asset | null>(null);

  const filtered = useMemo(() => assets.filter(a => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = a.model.toLowerCase().includes(term) || a.serialNumber.toLowerCase().includes(term) || a.siteID.toLowerCase().includes(term) || (a.comments || '').toLowerCase().includes(term);
    return matchesSearch && (statusFilter === 'All' || a.status === statusFilter);
  }), [assets, searchTerm, statusFilter]);

  const currentItems = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const allSelected = currentItems.length > 0 && currentItems.every(a => selectedSerials.has(a.serialNumber));

  const toggleSelect = (s: string) => {
    const next = new Set(selectedSerials);
    next.has(s) ? next.delete(s) : next.add(s);
    setSelectedSerials(next);
  };

  return (
    <div className="space-y-6">
      {assetsToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-red-600 mb-4 flex items-center gap-2"><AlertTriangle /> Delete Assets?</h3>
            <p className="text-sm text-slate-600 mb-6">Permanently remove {assetsToDelete.length} assets from DynamoDB?</p>
            <div className="flex gap-3"><button onClick={() => setAssetsToDelete(null)} className="flex-1 py-2 border rounded-xl">Cancel</button><button onClick={() => { onDelete(assetsToDelete.map(a => a.serialNumber)); setAssetsToDelete(null); setSelectedSerials(new Set()); }} className="flex-1 py-2 bg-red-600 text-white rounded-xl font-bold">Delete</button></div>
          </div>
        </div>
      )}

      {viewingHistory && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold flex items-center gap-2 text-blue-600"><HistoryIcon /> History: {viewingHistory.serialNumber}</h3>
              <button onClick={() => setViewingHistory(null)}><X /></button>
            </div>
            <div className="space-y-4">{(viewingHistory.history || []).slice().reverse().map((h, i) => <div key={i} className="p-3 border rounded-lg bg-slate-50"><div className="text-[10px] font-bold text-slate-400 uppercase mb-1">{h.field} - {new Date(h.timestamp).toLocaleString()}</div><div className="text-sm font-semibold">{h.oldValue !== null && <span className="line-through text-slate-300 mr-2">{h.oldValue}</span>}{h.newValue}</div></div>)}</div>
          </div>
        </div>
      )}

      <div className="bg-white p-4 rounded-xl border flex flex-col md:flex-row gap-4 items-center justify-between shadow-sm">
        <div className="flex gap-4 w-full md:w-auto">
          <div className="relative flex-1 md:w-80"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" /><input type="text" placeholder="Search inventory..." className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <select className="px-3 py-2 border rounded-lg text-sm" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="All">All Statuses</option>{Object.values(AssetStatus).map(s => <option key={s} value={s}>{s}</option>)}</select>
          <button onClick={async () => { setIsAnalyzing(true); try { setAnalysis(await generateAssetReport(filtered)); } finally { setIsAnalyzing(false); } }} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold">{isAnalyzing ? <Loader2 className="animate-spin h-4 w-4" /> : <Sparkles className="h-4 w-4" />} AI Analysis</button>
        </div>
      </div>

      {analysis && <div className="p-6 bg-indigo-50 rounded-xl border border-indigo-100 relative"><button onClick={() => setAnalysis(null)} className="absolute top-4 right-4 text-slate-400"><X /></button><div className="prose prose-sm text-slate-700">{analysis.split('\n').map((l, i) => <p key={i}>{l}</p>)}</div></div>}

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 border-b text-[10px] font-bold uppercase text-slate-500 tracking-wider">
            <tr>
              <th className="px-6 py-4 w-10 text-center"><input type="checkbox" checked={allSelected} onChange={(e) => { const next = new Set(selectedSerials); currentItems.forEach(a => e.target.checked ? next.add(a.serialNumber) : next.delete(a.serialNumber)); setSelectedSerials(next); }} /></th>
              <th className="px-6 py-4">Model</th>
              <th className="px-6 py-4">Serial Number (PK)</th>
              <th className="px-6 py-4">SiteID</th>
              <th className="px-6 py-4">Country</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Comments</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {currentItems.map(a => (
              <tr key={a.serialNumber} className={`hover:bg-slate-50/50 ${selectedSerials.has(a.serialNumber) ? 'bg-blue-50/30' : ''}`}>
                <td className="px-6 py-4 text-center"><input type="checkbox" checked={selectedSerials.has(a.serialNumber)} onChange={() => toggleSelect(a.serialNumber)} /></td>
                <td className="px-6 py-4 font-bold">{a.model}</td>
                <td className="px-6 py-4 font-mono text-xs text-blue-600 font-bold">{a.serialNumber}</td>
                <td className="px-6 py-4 font-semibold">{a.siteID}</td>
                <td className="px-6 py-4 text-slate-500"><Globe className="inline h-3 w-3 mr-1" />{a.country}</td>
                <td className="px-6 py-4">
                  {updatingId === a.serialNumber ? <Loader2 className="h-4 w-4 animate-spin text-blue-600" /> : (
                    <select value={a.status} onChange={(e) => onUpdateAsset(a.serialNumber, { status: e.target.value as AssetStatus })} className="px-2 py-1 border rounded-full text-[10px] font-bold uppercase tracking-wider">{Object.values(AssetStatus).map(s => <option key={s} value={s}>{s}</option>)}</select>
                  )}
                </td>
                <td className="px-6 py-4 text-slate-500 italic max-w-xs truncate">{a.comments || '-'}</td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setViewingHistory(a)} className="p-2 hover:text-blue-600" title="History"><HistoryIcon className="h-4 w-4" /></button>
                    <button onClick={() => setAssetsToDelete([a])} className="p-2 hover:text-red-600" title="Delete"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="p-12 text-center text-slate-400 font-bold">No assets found in DynamoDB.</div>}
      </div>
    </div>
  );
};