import { useState, useRef } from 'react';
import { Asset, AssetStatus } from '../types';
import { parseAssetsFromText } from '../services/geminiService';
import { Save, AlertCircle, Upload } from 'lucide-react';
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

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualForm.model || !manualForm.serialNumber || !manualForm.siteID) {
      setError("Please fill in required fields (Model, Serial, SiteID).");
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
        const newAssets: Asset[] = parsedData.map(p => ({
          serialNumber: p.serialNumber || 'UNKNOWN-' + Date.now(),
          model: p.model || 'Unknown',
          siteID: (p as any).siteID || (p as any).siteId || 'Unknown',
          country: p.country || '',
          comments: (p as any).comments || '',
          status: (p.status as AssetStatus) || AssetStatus.Normal,
          createdAt: Date.now()
        }));
        onAddAssets(newAssets);
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
      return {
        serialNumber: String(serial).trim(),
        model: String(model).trim(),
        siteID: String(site).trim(),
        country: country ? String(country).trim() : '',
        comments: comments ? String(comments).trim() : '',
        status: AssetStatus.Normal,
        createdAt: Date.now()
      };
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
        if (assets.length === 0) setError("No valid assets found. Headers must include Model, Serial Number, and SiteID.");
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
        {error && <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg flex items-center gap-2 text-sm border border-red-100"><AlertCircle className="h-5 w-5" />{error}</div>}

        {mode === 'manual' && (
          <form onSubmit={handleManualSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <input type="text" required className="w-full px-4 py-2 border rounded-lg" placeholder="Asset Model *" value={manualForm.model} onChange={e => setManualForm({...manualForm, model: e.target.value})} />
              <input type="text" required className="w-full px-4 py-2 border rounded-lg" placeholder="Serial Number *" value={manualForm.serialNumber} onChange={e => setManualForm({...manualForm, serialNumber: e.target.value})} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <input type="text" required className="w-full px-4 py-2 border rounded-lg" placeholder="SiteID *" value={manualForm.siteID} onChange={e => setManualForm({...manualForm, siteID: e.target.value})} />
              <input type="text" className="w-full px-4 py-2 border rounded-lg" placeholder="Country" value={manualForm.country} onChange={e => setManualForm({...manualForm, country: e.target.value})} />
              <select className="w-full px-4 py-2 border rounded-lg" value={manualForm.status} onChange={e => setManualForm({...manualForm, status: e.target.value as AssetStatus})}>
                {Object.values(AssetStatus).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <textarea className="w-full px-4 py-2 border rounded-lg" placeholder="Comments / RMA Info" value={manualForm.comments} onChange={e => setManualForm({...manualForm, comments: e.target.value})} />
            <div className="flex gap-4"><button type="submit" className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2"><Save className="h-5 w-5" />Save</button><button type="button" onClick={onCancel} className="px-6 py-3 border rounded-lg">Cancel</button></div>
          </form>
        )}

        {mode === 'bulk' && (
          <div className="space-y-6 text-center">
            {bulkPreview.length === 0 ? (
              <>
                <div className="border-2 border-dashed border-slate-300 rounded-xl p-12 hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                  <input type="file" accept=".csv,.xlsx,.xls" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
                  <Upload className="h-12 w-12 text-blue-600 mx-auto mb-4" />
                  <h3 className="text-lg font-bold">Upload Excel or CSV</h3>
                  <p className="text-slate-500 text-sm">Required columns: Model, Serial Number, SiteID</p>
                </div>
                <button onClick={onCancel} className="text-slate-500 font-bold">Back</button>
              </>
            ) : (
              <div className="space-y-4">
                <div className="max-h-60 overflow-y-auto border rounded-lg"><table className="w-full text-xs text-left"><thead className="bg-slate-50"><tr><th className="p-2">Model</th><th className="p-2">Serial</th><th className="p-2">SiteID</th></tr></thead><tbody>{bulkPreview.map((a, i) => <tr key={i}><td className="p-2">{a.model}</td><td className="p-2">{a.serialNumber}</td><td className="p-2">{a.siteID}</td></tr>)}</tbody></table></div>
                <div className="flex gap-4"><button onClick={() => onAddAssets(bulkPreview)} className="flex-1 bg-emerald-600 text-white py-3 rounded-lg font-bold">Import {bulkPreview.length} Assets</button><button onClick={() => setBulkPreview([])} className="px-6 py-3 border rounded-lg">Reset</button></div>
              </div>
            )}
          </div>
        )}

        {mode === 'ai' && (
          <div className="space-y-6">
            <textarea className="w-full px-4 py-3 border rounded-lg h-48 font-mono text-sm" value={aiInput} onChange={e => setAiInput(e.target.value)} placeholder="Paste asset details here..." />
            <div className="flex gap-4"><button onClick={handleAiParse} disabled={isProcessing || !aiInput.trim()} className="flex-1 bg-purple-600 text-white py-3 rounded-lg font-bold disabled:opacity-50">{isProcessing ? "Processing..." : "AI Extract & Save"}</button><button onClick={onCancel} className="px-6 py-3 border rounded-lg">Cancel</button></div>
          </div>
        )}
      </div>
    </div>
  );
};