import React, { useState, useRef } from 'react';
import { Asset, AssetStatus } from '../types';
import { parseAssetsFromText } from '../services/geminiService';
import { Bot, Save, AlertCircle, CheckCircle, Upload, FileSpreadsheet, Download, X } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import Papa from 'papaparse';

interface AssetFormProps {
  onAddAssets: (assets: Asset[]) => void;
  onCancel: () => void;
}

export const AssetForm: React.FC<AssetFormProps> = ({ onAddAssets, onCancel }) => {
  const [mode, setMode] = useState<'manual' | 'ai' | 'bulk'>('manual');
  
  // Manual State
  const [manualForm, setManualForm] = useState({
    model: '',
    serialNumber: '',
    siteId: '',
    comments: '',
    status: AssetStatus.Normal
  });

  // AI State
  const [aiInput, setAiInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bulk State
  const [bulkPreview, setBulkPreview] = useState<Asset[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualForm.model || !manualForm.serialNumber || !manualForm.siteId) {
      setError("Please fill in all required fields.");
      return;
    }
    
    const newAsset: Asset = {
      id: uuidv4(),
      ...manualForm,
      createdAt: Date.now()
    };
    
    onAddAssets([newAsset]);
  };

  const handleAiParse = async () => {
    if (!aiInput.trim()) return;
    
    setIsProcessing(true);
    setError(null);
    try {
      const parsedData = await parseAssetsFromText(aiInput);
      
      if (parsedData.length === 0) {
        setError("AI couldn't find any assets in the text. Try rephrasing or use manual entry.");
      } else {
        const newAssets: Asset[] = parsedData.map(p => ({
          id: uuidv4(),
          model: p.model || 'Unknown',
          serialNumber: p.serialNumber || 'Unknown',
          siteId: p.siteId || 'Unknown',
          comments: p.comments || '',
          status: (p.status as AssetStatus) || AssetStatus.Normal,
          createdAt: Date.now()
        }));
        onAddAssets(newAssets);
      }
    } catch (err) {
      setError("Failed to process text. Check your API connection.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const assets: Asset[] = [];
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const errors: string[] = [];

        results.data.forEach((row: any) => {
          // Normalize keys to lowercase to be more forgiving
          const normalizedRow: Record<string, string> = {};
          Object.keys(row).forEach(key => {
            normalizedRow[key.toLowerCase().trim()] = row[key];
          });

          // Try to map common variations of headers
          const model = normalizedRow['model'] || normalizedRow['asset model'] || normalizedRow['product'];
          const serial = normalizedRow['serial number'] || normalizedRow['serial'] || normalizedRow['sn'] || normalizedRow['serial no'];
          const site = normalizedRow['site id'] || normalizedRow['site'] || normalizedRow['location'];
          const status = normalizedRow['status'] || normalizedRow['rma status'] || normalizedRow['rma'];
          const comments = normalizedRow['comments'] || normalizedRow['comment'] || normalizedRow['description'] || normalizedRow['notes'];

          if (model && serial && site) {
            // Validate/Map Status
            let assetStatus = AssetStatus.Normal;
            if (status) {
              const s = status.trim();
              const foundStatus = Object.values(AssetStatus).find(
                enumVal => enumVal.toLowerCase() === s.toLowerCase()
              );
              if (foundStatus) {
                assetStatus = foundStatus;
              } else if (s.toLowerCase().includes('request')) {
                assetStatus = AssetStatus.RMARequested;
              } else if (s.toLowerCase().includes('ship')) {
                assetStatus = AssetStatus.RMAShipped;
              } else if (s.toLowerCase().includes('not eligible')) {
                assetStatus = AssetStatus.RMANotEligible;
              } else if (s.toLowerCase().includes('eligible')) {
                assetStatus = AssetStatus.RMAEligible;
              } else if (s.toLowerCase().includes('deprecated')) {
                assetStatus = AssetStatus.Deprecated;
              } else {
                assetStatus = AssetStatus.Unknown;
              }
            }

            assets.push({
              id: uuidv4(),
              model: model.trim(),
              serialNumber: serial.trim(),
              siteId: site.trim(),
              comments: comments ? comments.trim() : '',
              status: assetStatus,
              createdAt: Date.now()
            });
          }
        });

        if (assets.length === 0) {
          setError("No valid assets found in CSV. Please check the column headers (Model, Serial Number, Site ID).");
        } else {
          setBulkPreview(assets);
          setError(null);
        }
      },
      error: (err) => {
        setError(`Failed to parse CSV: ${err.message}`);
      }
    });

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const downloadTemplate = () => {
    const csvContent = "Model,Serial Number,Site ID,Status,Comments\nCisco Catalyst 9200,FOC12345678,NYC-01,Normal,Installed in server room 3\nLenovo ThinkPad X1,PF123456,LON-HQ,RMA Requested,Screen flickering";
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "asset_template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const confirmBulkUpload = () => {
    onAddAssets(bulkPreview);
    setBulkPreview([]);
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8 flex flex-wrap gap-2 md:gap-4 p-1 bg-slate-100 rounded-lg w-full md:w-fit mx-auto justify-center">
        <button
          onClick={() => setMode('manual')}
          className={`flex-1 md:flex-none px-4 py-2 rounded-md text-sm font-medium transition-all ${
            mode === 'manual' 
              ? 'bg-white text-blue-700 shadow-sm' 
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Manual Entry
        </button>
        <button
          onClick={() => setMode('bulk')}
          className={`flex-1 md:flex-none px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 ${
            mode === 'bulk' 
              ? 'bg-white text-emerald-700 shadow-sm' 
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileSpreadsheet className="h-4 w-4" />
          Bulk Upload (CSV)
        </button>
        <button
          onClick={() => setMode('ai')}
          className={`flex-1 md:flex-none px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 ${
            mode === 'ai' 
              ? 'bg-white text-purple-700 shadow-sm' 
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Bot className="h-4 w-4" />
          AI Import
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:p-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg flex items-center gap-2 text-sm border border-red-100">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            {error}
          </div>
        )}

        {mode === 'manual' && (
          <form onSubmit={handleManualSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Asset Model *</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  value={manualForm.model}
                  onChange={e => setManualForm({...manualForm, model: e.target.value})}
                  placeholder="e.g. Zebra MC33K"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Serial Number *</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  value={manualForm.serialNumber}
                  onChange={e => setManualForm({...manualForm, serialNumber: e.target.value})}
                  placeholder="e.g. S2000003454354"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Site ID *</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  value={manualForm.siteId}
                  onChange={e => setManualForm({...manualForm, siteId: e.target.value})}
                  placeholder="e.g. XDT3"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
                <select
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                  value={manualForm.status}
                  onChange={e => setManualForm({...manualForm, status: e.target.value as AssetStatus})}
                >
                  {Object.values(AssetStatus).map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Comments / Description</label>
              <textarea
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none h-24 resize-none"
                value={manualForm.comments}
                onChange={e => setManualForm({...manualForm, comments: e.target.value})}
                placeholder="Describe the condition or reason for RMA..."
              />
            </div>

            <div className="flex gap-4 pt-4">
              <button
                type="submit"
                className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                <Save className="h-5 w-5" />
                Save Asset
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="px-6 py-3 rounded-lg font-medium text-slate-600 hover:bg-slate-50 border border-slate-300"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {mode === 'bulk' && (
           <div className="space-y-6">
             {bulkPreview.length === 0 ? (
               <>
                <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-100">
                  <h3 className="text-emerald-900 font-semibold mb-2 flex items-center gap-2">
                    <FileSpreadsheet className="h-5 w-5" />
                    Bulk Upload (CSV)
                  </h3>
                  <p className="text-sm text-emerald-800">
                    Upload a CSV file to import multiple assets at once. 
                    Ensure your CSV has headers like <strong>Model</strong>, <strong>Serial Number</strong>, and <strong>Site ID</strong>.
                  </p>
                </div>

                <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:bg-slate-50 transition-colors cursor-pointer"
                     onClick={() => fileInputRef.current?.click()}>
                  <input 
                    type="file" 
                    accept=".csv" 
                    className="hidden" 
                    ref={fileInputRef} 
                    onChange={handleFileUpload}
                  />
                  <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Upload className="h-8 w-8" />
                  </div>
                  <h3 className="text-lg font-medium text-slate-900">Click to upload or drag and drop</h3>
                  <p className="text-slate-500 text-sm mt-1">CSV files only (max 5MB)</p>
                </div>

                <div className="flex justify-center">
                  <button 
                    onClick={downloadTemplate}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                  >
                    <Download className="h-4 w-4" />
                    Download CSV Template
                  </button>
                </div>
                
                <div className="flex justify-end pt-4">
                  <button
                    type="button"
                    onClick={onCancel}
                    className="px-6 py-3 rounded-lg font-medium text-slate-600 hover:bg-slate-50 border border-slate-300"
                  >
                    Cancel
                  </button>
                </div>
               </>
             ) : (
               <div className="space-y-4">
                 <div className="flex items-center justify-between">
                   <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                     <CheckCircle className="h-5 w-5 text-emerald-600" />
                     {bulkPreview.length} assets ready to import
                   </h3>
                   <button 
                    onClick={() => setBulkPreview([])}
                    className="text-slate-400 hover:text-red-500"
                   >
                     <X className="h-5 w-5" />
                   </button>
                 </div>
                 
                 <div className="border border-slate-200 rounded-lg overflow-hidden max-h-80 overflow-y-auto">
                   <table className="w-full text-sm text-left">
                     <thead className="bg-slate-50 text-slate-600 font-medium sticky top-0">
                       <tr>
                         <th className="px-4 py-2">Model</th>
                         <th className="px-4 py-2">Serial</th>
                         <th className="px-4 py-2">Site</th>
                         <th className="px-4 py-2">Status</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100">
                       {bulkPreview.map((asset, i) => (
                         <tr key={i}>
                           <td className="px-4 py-2">{asset.model}</td>
                           <td className="px-4 py-2 font-mono text-xs">{asset.serialNumber}</td>
                           <td className="px-4 py-2">{asset.siteId}</td>
                           <td className="px-4 py-2">{asset.status}</td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                 </div>

                 <div className="flex gap-4 pt-2">
                   <button
                     onClick={confirmBulkUpload}
                     className="flex-1 bg-emerald-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
                   >
                     <Save className="h-5 w-5" />
                     Import {bulkPreview.length} Assets
                   </button>
                   <button
                     type="button"
                     onClick={() => setBulkPreview([])}
                     className="px-6 py-3 rounded-lg font-medium text-slate-600 hover:bg-slate-50 border border-slate-300"
                   >
                     Cancel
                   </button>
                 </div>
               </div>
             )}
           </div>
        )}

        {mode === 'ai' && (
          <div className="space-y-6">
            <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
              <h3 className="text-purple-900 font-semibold mb-2 flex items-center gap-2">
                <Bot className="h-5 w-5" />
                AI Smart Import
              </h3>
              <p className="text-sm text-purple-800">
                Paste any unstructured text below (e.g., email threads, chat logs, or messy Excel copy-pastes). 
                Gemini will automatically extract models, serial numbers, sites, and infer the status.
              </p>
            </div>

            <div>
              <textarea
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none h-48 resize-none font-mono text-sm"
                value={aiInput}
                onChange={e => setAiInput(e.target.value)}
                placeholder={`Example:\nHi team, the switch at Site LA-05 (Model: C9300-24T, SN: FCW2345L0) is eligible for RMA. \nAlso, received a new Router ISR4331 at NY-02, SN: FDO2451X, working normally.`}
              />
            </div>

            <div className="flex gap-4">
              <button
                onClick={handleAiParse}
                disabled={isProcessing || !aiInput.trim()}
                className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-3 rounded-lg font-medium hover:from-purple-700 hover:to-indigo-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-md"
              >
                {isProcessing ? (
                  <>Processing...</>
                ) : (
                  <>
                    <SparklesIcon className="h-5 w-5" />
                    Extract & Save
                  </>
                )}
              </button>
               <button
                type="button"
                onClick={onCancel}
                className="px-6 py-3 rounded-lg font-medium text-slate-600 hover:bg-slate-50 border border-slate-300"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const SparklesIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
  </svg>
);