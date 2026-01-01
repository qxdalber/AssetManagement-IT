
// Add React import for types and namespace access
import React, { useState, useRef } from 'react';
import { Asset, AssetStatus } from '../types';
import { parseAssetsFromText } from '../services/geminiService';
// Added Sparkles to the imported icons from lucide-react
import { Save, AlertCircle, Upload, Info, Sparkles } from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

interface AssetFormProps {
  onAddAssets: (assets: Asset[]) => void;
  onCancel: () => void;
}

export const AssetForm: React.FC<AssetFormProps> = ({ onAddAssets, onCancel }) => {
  const [mode, setMode] = useState<'manual' | 'ai' | 'bulk'>('manual');
  const [manualForm, setManualForm] = useState({
    model: '',
    serialNumber: '',
    siteID: '',
    country: '',
    comments: '',
    status: AssetStatus.Normal
  });

  const [aiInput, setAiInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bulkPreview, setBulkPreview] = useState<Asset[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Validation Logic
  const isValidSiteID = (id: string) => /^[a-zA-Z][a-zA-Z0-9]*$/.test(id);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!manualForm.model || !manualForm.serialNumber || !manualForm.siteID) {
      setError("Please fill in required fields (Model, Serial, SiteID).");
      return;
    }

    if (!isValidSiteID(manualForm.siteID)) {
      setError("Invalid SiteID. It must start with a letter and contain only letters and numbers.");
      return;
    }

    onAddAssets([{ ...manualForm, createdAt: Date.now() }]);
  };

  const handleAiParse = async () => {
    if (!aiInput.trim()) return;
    setIsProcessing(true);
    setError(null);
    try {
      const parsedData = await parseAssetsFromText(aiInput);
      if (parsedData.length === 0) {
        setError("No assets found in text.");
      } else {
        const validAssets: Asset[] = [];
        const invalidSites: string[] = [];

        parsedData.forEach(p => {
          const siteID = ((p as any).siteID || (p as any).siteId || 'Unknown').trim();
          if (isValidSiteID(siteID)) {
            validAssets.push({
              serialNumber: p.serialNumber || 'UNKNOWN-' + Date.now(),
              model: p.model || 'Unknown',
              siteID: siteID,
              country: p.country || '',
              comments: (p as any).comments || '',
              status: (p.status as AssetStatus) || AssetStatus.Normal,
              createdAt: Date.now()
            });
          } else {
            invalidSites.push(siteID);
          }
        });

        if (validAssets.length === 0 && invalidSites.length > 0) {
          setError(`Found ${invalidSites.length} assets but all had invalid SiteID formats (must start with letter).`);
        } else {
          if (invalidSites.length > 0) {
            console.warn(`Skipped ${invalidSites.length} assets due to invalid SiteID format:`, invalidSites);
          }
          onAddAssets(validAssets);
        }
      }
    } catch (err) {
      setError("AI Processing failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  const processRowToAsset = (row: any): Asset | null => {
    const normalized: Record<string, any> = {};
    Object.keys(row).forEach(k => normalized[k.toLowerCase().trim().replace(/[^a-z0-9]/g, '')] = row[k]);

    const model = normalized['model'] || normalized['assetmodel'] || normalized['product'];
    const serial = normalized['serialnumber'] || normalized['serial'] || normalized['sn'];
    const site = normalized['siteid'] || normalized['site'];
    const country = normalized['country'] || normalized['region'];
    const comments = normalized['comments'] || normalized['rmastatus'] || normalized['notes'];

    if (model && serial && site) {
      const siteIDStr = String(site).trim();
      if (isValidSiteID(siteIDStr)) {
        return {
          serialNumber: String(serial).trim(),
          model: String(model).trim(),
          siteID: siteIDStr,
          country: country ? String(country).trim() : '',
          comments: comments ? String(comments).trim() : '',
          status: AssetStatus.Normal,
          createdAt: Date.now()
        };
      }
    }
    return null;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = file.name.endsWith('.csv') 
          ? Papa.parse(evt.target?.result as string, { header: true }).data
          : XLSX.utils.sheet_to_json(XLSX.read(evt.target?.result, { type: 'binary' }).Sheets[XLSX.read(evt.target?.result, { type: 'binary' }).SheetNames[0]]);
        
        const assets = data.map(processRowToAsset).filter((a): a is Asset => a !== null);
        if (assets.length === 0) setError("No valid assets found. SiteID must start with a letter and headers must include Model, Serial Number, and SiteID.");
        else setBulkPreview(assets);
      } catch (err) { setError("File parsing failed."); }
    };
    file.name.endsWith('.csv') ? reader.readAsText(file) : reader.readAsBinaryString(file);
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8 flex gap-2 p-1 bg-slate-100 rounded-lg justify-center">
        {['manual', 'bulk', 'ai'].map((m) => (
          <button key={m} onClick={() => setMode(m as any)} className={`px-4 py-2 rounded-md text-sm font-medium capitalize ${mode === m ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600'}`}>
            {m} entry
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
        {error && <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg flex items-center gap-2 text-sm border border-red-100 animate-fade-in"><AlertCircle className="h-5 w-5 flex-shrink-0" />{error}</div>}

        {mode === 'manual' && (
          <form onSubmit={handleManualSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Asset Model *</label>
                <input type="text" required className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all" placeholder="e.g. Dell Latitude 5420" value={manualForm.model} onChange={e => setManualForm({...manualForm, model: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Serial Number *</label>
                <input type="text" required className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all font-mono" placeholder="e.g. ABC123XYZ" value={manualForm.serialNumber} onChange={e => setManualForm({...manualForm, serialNumber: e.target.value})} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">SiteID *</label>
                <input 
                  type="text" 
                  required 
                  className={`w-full px-4 py-2 border rounded-lg outline-none transition-all ${manualForm.siteID && !isValidSiteID(manualForm.siteID) ? 'border-red-500 bg-red-50 focus:ring-red-500' : 'focus:ring-blue-500'}`} 
                  placeholder="e.g. LDN01" 
                  value={manualForm.siteID} 
                  onChange={e => setManualForm({...manualForm, siteID: e.target.value})} 
                />
                {manualForm.siteID && !isValidSiteID(manualForm.siteID) && (
                  <p className="text-[10px] text-red-600 font-bold mt-1 ml-1 flex items-center gap-1">
                    <Info className="h-3 w-3" /> Must start with a letter (A-Z)
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Country</label>
                <input type="text" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all" placeholder="e.g. UK" value={manualForm.country} onChange={e => setManualForm({...manualForm, country: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Initial Status</label>
                <select className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all" value={manualForm.status} onChange={e => setManualForm({...manualForm, status: e.target.value as AssetStatus})}>
                  {Object.values(AssetStatus).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-1">
               <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Comments</label>
               <textarea className="w-full px-4 py-2 border rounded-lg h-24 focus:ring-2 focus:ring-blue-500 outline-none transition-all" placeholder="Additional notes or RMA details..." value={manualForm.comments} onChange={e => setManualForm({...manualForm, comments: e.target.value})} />
            </div>
            <div className="flex gap-4">
              <button 
                type="submit" 
                disabled={!isValidSiteID(manualForm.siteID)}
                className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="h-5 w-5" />Save Asset
              </button>
              <button type="button" onClick={onCancel} className="px-6 py-3 border rounded-lg hover:bg-slate-50 transition-colors font-bold text-slate-600">Cancel</button>
            </div>
          </form>
        )}

        {mode === 'bulk' && (
          <div className="space-y-6 text-center">
            {bulkPreview.length === 0 ? (
              <>
                <div className="border-2 border-dashed border-slate-300 rounded-xl p-12 hover:bg-slate-50 transition-colors cursor-pointer group" onClick={() => fileInputRef.current?.click()}>
                  <input type="file" accept=".csv,.xlsx,.xls" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
                  <Upload className="h-12 w-12 text-blue-600 mx-auto mb-4 group-hover:scale-110 transition-transform" />
                  <h3 className="text-lg font-bold text-slate-800">Upload Excel or CSV</h3>
                  <p className="text-slate-500 text-sm mt-2">Required: Model, Serial Number, SiteID</p>
                  <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest mt-4">SiteID must start with a letter</p>
                </div>
                <button onClick={onCancel} className="text-slate-500 font-bold hover:text-slate-800 transition-colors">Back</button>
              </>
            ) : (
              <div className="space-y-4 animate-fade-in">
                <div className="flex justify-between items-center px-1">
                  <h3 className="font-bold text-slate-800">Preview: {bulkPreview.length} Valid Assets</h3>
                  <button onClick={() => setBulkPreview([])} className="text-xs text-red-600 font-bold hover:underline">Clear</button>
                </div>
                <div className="max-h-60 overflow-y-auto border rounded-lg shadow-inner">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        <th className="p-3 border-b">Model</th>
                        <th className="p-3 border-b">Serial</th>
                        <th className="p-3 border-b">SiteID</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {bulkPreview.map((a, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="p-3">{a.model}</td>
                          <td className="p-3 font-mono text-[10px]">{a.serialNumber}</td>
                          <td className="p-3 font-semibold text-blue-600">{a.siteID}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex gap-4">
                  <button onClick={() => onAddAssets(bulkPreview)} className="flex-1 bg-emerald-600 text-white py-3 rounded-lg font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20">
                    Import {bulkPreview.length} Assets
                  </button>
                  <button onClick={() => setBulkPreview([])} className="px-6 py-3 border rounded-lg hover:bg-slate-50 transition-colors font-bold text-slate-600">Cancel</button>
                </div>
              </div>
            )}
          </div>
        )}

        {mode === 'ai' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center px-1">
               <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Unstructured Text Input</label>
               <span className="text-[10px] text-indigo-500 font-bold flex items-center gap-1"><Sparkles className="h-3 w-3" /> AI Engine Active</span>
            </div>
            <textarea 
              className="w-full px-4 py-3 border rounded-lg h-48 font-mono text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-inner" 
              value={aiInput} 
              onChange={e => setAiInput(e.target.value)} 
              placeholder="Paste email, logs, or chat messages here...&#10;e.g. 'Laptop S/N ABC123 LDN-01 is shipped to London'" 
            />
            <div className="flex gap-4">
              <button 
                onClick={handleAiParse} 
                disabled={isProcessing || !aiInput.trim()} 
                className="flex-1 bg-indigo-600 text-white py-3 rounded-lg font-bold disabled:opacity-50 hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2"
              >
                {isProcessing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
                {isProcessing ? "Analyzing..." : "AI Extract & Save"}
              </button>
              <button onClick={onCancel} className="px-6 py-3 border rounded-lg hover:bg-slate-50 transition-colors font-bold text-slate-600">Cancel</button>
            </div>
            <p className="text-[10px] text-slate-400 text-center italic">Only assets with SiteIDs starting with a letter will be saved.</p>
          </div>
        )}
      </div>
    </div>
  );
};

const Loader2 = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
);
