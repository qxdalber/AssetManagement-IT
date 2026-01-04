import React, { useState, useRef } from 'react';
import { Asset, AssetStatus } from '../types.ts';
import { parseAssetsFromText } from '../services/geminiService.ts';
import { Save, AlertCircle, Upload, Info, Sparkles, FileText, CheckCircle2, RefreshCw, X, Loader2 } from 'lucide-react';
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

  const isValidSiteID = (id: string) => /^[a-zA-Z][a-zA-Z0-9]*$/.test(id);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!manualForm.model || !manualForm.serialNumber || !manualForm.siteID) {
      setError("Please fill in required fields (Model, Serial, SiteID).");
      return;
    }
    if (!isValidSiteID(manualForm.siteID)) {
      setError("Invalid SiteID. It must start with a letter.");
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
          }
        });
        setBulkPreview(validAssets);
        if (validAssets.length === 0) setError("Found data but SiteIDs were invalid (must start with letter).");
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
        if (assets.length === 0) setError("No valid assets found. Headers must include Model, Serial, SiteID.");
        else setBulkPreview(assets);
      } catch (err) { setError("File parsing failed."); }
    };
    file.name.endsWith('.csv') ? reader.readAsText(file) : reader.readAsBinaryString(file);
  };

  return (
    <div className="max-w-6xl mx-auto animate-fade-in">
      <div className="mb-8 flex gap-2 p-1 bg-slate-200/50 rounded-xl justify-center w-fit mx-auto border border-slate-200">
        {['manual', 'bulk', 'ai'].map((m) => (
          <button key={m} onClick={() => { setMode(m as any); setBulkPreview([]); setError(null); }} className={`px-6 py-2 rounded-lg text-sm font-bold capitalize transition-all ${mode === m ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {m === 'ai' ? 'AI Intelligence' : `${m} entry`}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden">
        {error && (
          <div className="p-4 bg-red-50 text-red-700 flex items-center gap-3 text-sm border-b border-red-100">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span className="font-semibold">{error}</span>
            <button onClick={() => setError(null)} className="ml-auto p-1 hover:bg-red-100 rounded-md"><X className="h-4 w-4"/></button>
          </div>
        )}

        <div className={`grid grid-cols-1 ${mode !== 'manual' ? 'md:grid-cols-2' : ''} divide-x divide-slate-100`}>
          {/* Left Column: Input */}
          <div className="p-8 lg:p-10 space-y-8">
            {mode === 'manual' && (
              <form onSubmit={handleManualSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Asset Model *</label>
                    <input type="text" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" placeholder="e.g. Dell Latitude 5420" value={manualForm.model} onChange={e => setManualForm({...manualForm, model: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Serial Number *</label>
                    <input type="text" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-mono" placeholder="e.g. ABC123XYZ" value={manualForm.serialNumber} onChange={e => setManualForm({...manualForm, serialNumber: e.target.value})} />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">SiteID *</label>
                    <input 
                      type="text" 
                      required 
                      className={`w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none transition-all ${manualForm.siteID && !isValidSiteID(manualForm.siteID) ? 'border-red-500 ring-1 ring-red-500' : 'focus:ring-2 focus:ring-blue-500'}`} 
                      placeholder="e.g. LDN01" 
                      value={manualForm.siteID} 
                      onChange={e => setManualForm({...manualForm, siteID: e.target.value})} 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Country</label>
                    <input type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" placeholder="e.g. UK" value={manualForm.country} onChange={e => setManualForm({...manualForm, country: e.target.value})} />
                  </div>
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Comments</label>
                   <textarea className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl h-32 focus:ring-2 focus:ring-blue-500 outline-none transition-all" placeholder="Additional notes..." value={manualForm.comments} onChange={e => setManualForm({...manualForm, comments: e.target.value})} />
                </div>
                <div className="flex gap-4 pt-4">
                  <button type="submit" disabled={!isValidSiteID(manualForm.siteID)} className="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50">
                    <Save className="h-5 w-5" />Register Asset
                  </button>
                  <button type="button" onClick={onCancel} className="px-8 py-4 border border-slate-200 rounded-2xl hover:bg-slate-50 transition-colors font-bold text-slate-600">Cancel</button>
                </div>
              </form>
            )}

            {mode === 'bulk' && (
              <div className="space-y-8">
                <div className="space-y-4">
                  <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <FileText className="h-5 w-5 text-blue-600" /> Data Source
                  </h3>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    Upload your formatted inventory file. Our system will automatically map common column headers like 
                    <span className="font-mono text-blue-600 px-1 bg-blue-50 rounded mx-1">S/N</span> and 
                    <span className="font-mono text-blue-600 px-1 bg-blue-50 rounded mx-1">Asset Model</span>.
                  </p>
                </div>

                <div className="border-2 border-dashed border-slate-200 rounded-3xl p-10 text-center hover:bg-blue-50/30 transition-all cursor-pointer group relative" onClick={() => fileInputRef.current?.click()}>
                  <input type="file" accept=".csv,.xlsx,.xls" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
                  <div className="bg-blue-100 p-4 rounded-2xl w-fit mx-auto mb-4 group-hover:scale-110 transition-transform text-blue-600">
                    <Upload className="h-8 w-8" />
                  </div>
                  <h4 className="font-bold text-slate-800">Drop your file here</h4>
                  <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest font-bold">.CSV, .XLSX, or .XLS</p>
                </div>

                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-4">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Requirements</h4>
                  <ul className="space-y-2 text-xs font-medium text-slate-600">
                    <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Model, Serial, SiteID columns required</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> SiteID must start with a letter</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Max 250 assets per batch</li>
                  </ul>
                </div>
                
                <button onClick={onCancel} className="w-full py-4 border border-slate-200 rounded-2xl hover:bg-slate-50 transition-colors font-bold text-slate-600">Cancel Registration</button>
              </div>
            )}

            {mode === 'ai' && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-indigo-600" /> Intelligence Extraction
                    </h3>
                    <div className="px-2 py-1 bg-indigo-50 rounded text-[10px] font-black text-indigo-600 border border-indigo-100 uppercase">Gemini 3 Flash</div>
                  </div>
                  <p className="text-sm text-slate-500">Paste text from emails, shipping logs, or IM conversations below.</p>
                </div>

                <textarea 
                  className="w-full px-6 py-5 bg-slate-50 border border-slate-200 rounded-3xl h-64 font-mono text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-inner placeholder:text-slate-300" 
                  value={aiInput} 
                  onChange={e => setAiInput(e.target.value)} 
                  placeholder="Example: We received 5 Dell 5420 units (Serials: SN1, SN2...) for PHX01 site today." 
                />

                <div className="flex gap-4">
                  <button 
                    onClick={handleAiParse} 
                    disabled={isProcessing || !aiInput.trim()} 
                    className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-bold disabled:opacity-50 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2"
                  >
                    {isProcessing ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
                    {isProcessing ? "Analyzing..." : "Process Text"}
                  </button>
                  <button onClick={onCancel} className="px-8 py-4 border border-slate-200 rounded-2xl hover:bg-slate-50 transition-colors font-bold text-slate-600">Cancel</button>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Preview (Only shown for AI/Bulk) */}
          {(mode === 'bulk' || mode === 'ai') && (
            <div className="bg-slate-50/50 p-8 lg:p-10 flex flex-col h-full min-h-[500px]">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                   <CheckCircle2 className="h-5 w-5 text-emerald-600" /> Validation Preview
                </h3>
                {bulkPreview.length > 0 && (
                  <span className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
                    {bulkPreview.length} assets identified
                  </span>
                )}
              </div>

              {bulkPreview.length > 0 ? (
                <div className="flex-1 flex flex-col space-y-6">
                  <div className="flex-1 overflow-y-auto border border-slate-200 rounded-2xl bg-white shadow-sm scrollbar-thin">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead className="bg-slate-50 sticky top-0 z-10 border-b">
                        <tr>
                          <th className="px-4 py-3 font-black text-slate-400 uppercase tracking-widest border-r">Model</th>
                          <th className="px-4 py-3 font-black text-slate-400 uppercase tracking-widest border-r">Serial</th>
                          <th className="px-4 py-3 font-black text-slate-400 uppercase tracking-widest">Site</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {bulkPreview.map((a, i) => (
                          <tr key={i} className="hover:bg-slate-50 transition-colors group">
                            <td className="px-4 py-3 font-bold text-slate-700 border-r">{a.model}</td>
                            <td className="px-4 py-3 font-mono text-[10px] text-blue-600 border-r">{a.serialNumber}</td>
                            <td className="px-4 py-3 font-black text-slate-900">{a.siteID}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <button 
                    onClick={() => onAddAssets(bulkPreview)} 
                    className="w-full bg-emerald-600 text-white py-5 rounded-2xl font-black text-lg hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-600/20 hover:scale-[1.02] active:scale-100"
                  >
                    Commit {bulkPreview.length} Assets to Cloud
                  </button>
                  <p className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                    Data will be synced with Amazon DynamoDB instantly
                  </p>
                </div>
              ) : (
                <div className="flex-1 border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center p-10 text-center space-y-4">
                  <div className="p-5 bg-white rounded-2xl shadow-sm border border-slate-100">
                    <RefreshCw className="h-10 w-10 text-slate-200" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-bold text-slate-400">Waiting for Input</h4>
                    <p className="text-xs text-slate-400 max-w-[200px]">Data will appear here once processed from the left panel.</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
