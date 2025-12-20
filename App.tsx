
import { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { AssetList } from './components/AssetList';
import { AssetForm } from './components/AssetForm';
import { Asset, AssetStatus } from './types';
import { fetchAssets, addAssets, deleteAssets, updateAssetStatus } from './services/storageService';
import { Loader2, Cloud, CloudOff, ShieldCheck } from 'lucide-react';

function App() {
  const [view, setView] = useState<'list' | 'add'>('list');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isConnected, setIsConnected] = useState<boolean | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await fetchAssets();
      setAssets(data);
      setIsConnected(true);
    } catch (error) {
      console.error(error);
      setIsConnected(false);
      showNotification('S3 Connection failed. Verify VITE_ASSET_S3 variables.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const showNotification = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleAddAssets = async (newAssets: Asset[]) => {
    setIsSaving(true);
    try {
      await addAssets(newAssets);
      setAssets(prev => [...prev, ...newAssets]);
      setView('list');
      showNotification(`Saved ${newAssets.length} asset(s) to S3`, 'success');
    } catch (error) {
      console.error(error);
      showNotification('Save failed. Check S3 CORS/Permissions.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateAssetStatus = async (assetId: string, siteId: string, newStatus: AssetStatus) => {
    try {
      await updateAssetStatus(assetId, siteId, newStatus);
      setAssets(prev => prev.map(a => a.id === assetId ? { ...a, status: newStatus } : a));
      showNotification('Status updated in S3', 'success');
    } catch (error) {
      console.error(error);
      showNotification('Update failed.', 'error');
      throw error; // Let the component handle local UI rollback if needed
    }
  };

  const handleDeleteAssets = async (ids: string[]) => {
    const count = ids.length;
    if (window.confirm(count === 1 ? 'Delete this asset?' : `Delete ${count} assets?`)) {
      setIsSaving(true);
      try {
        const assetsToDelete = assets.filter(a => ids.includes(a.id));
        await deleteAssets(assetsToDelete);
        setAssets(prev => prev.filter(a => !ids.includes(a.id)));
        showNotification('Assets removed from S3', 'success');
      } catch (error) {
        console.error(error);
        showNotification('Delete failed.', 'error');
      } finally {
        setIsSaving(false);
      }
    }
  };

  if (isLoading && assets.length === 0 && isConnected === null) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
        <div className="loader ease-linear rounded-full border-4 border-t-4 border-slate-200 h-12 w-12 mb-4"></div>
        <p className="text-slate-500 font-medium">Initializing Cloud Environment...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header currentView={view} onNavigate={setView} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 relative">
        
        <div className="mb-4 flex justify-end">
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border ${
            isConnected 
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
              : isConnected === false 
                ? 'bg-red-50 text-red-700 border-red-200'
                : 'bg-slate-50 text-slate-500 border-slate-200'
          }`}>
            {isConnected ? <Cloud className="h-3 w-3" /> : <CloudOff className="h-3 w-3" />}
            {isConnected ? 'S3 Active' : 'S3 Offline'}
            {isConnected && <ShieldCheck className="h-3 w-3 ml-1" />}
          </div>
        </div>

        {isSaving && (
          <div className="fixed inset-0 bg-white/50 backdrop-blur-sm z-40 flex items-center justify-center">
             <div className="bg-white px-6 py-4 rounded-lg shadow-xl flex items-center gap-3 border border-slate-200">
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                <span className="font-medium text-slate-700">Syncing with AWS S3...</span>
             </div>
          </div>
        )}

        {notification && (
          <div className={`fixed top-20 right-4 px-6 py-4 rounded-lg shadow-lg z-50 animate-fade-in text-white font-medium ${
            notification.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
          }`}>
            {notification.message}
          </div>
        )}

        {view === 'list' ? (
          <div>
            <div className="mb-6 flex justify-between items-end">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Live Asset Inventory</h2>
                <p className="text-slate-500 mt-1">
                  Connected to: <strong>{(import.meta as any).env.VITE_ASSET_S3_BUCKET || 'Not Found'}</strong>
                </p>
              </div>
              <button
                onClick={() => setView('add')}
                className="hidden md:flex bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors items-center gap-2"
              >
                + Register New Asset
              </button>
            </div>
            <AssetList 
              assets={assets} 
              onDelete={handleDeleteAssets} 
              onUpdateStatus={handleUpdateAssetStatus}
            />
          </div>
        ) : (
          <div>
            <div className="mb-6 text-center">
              <h2 className="text-2xl font-bold text-slate-900">Add New Assets</h2>
              <p className="text-slate-500 mt-1">Manual, Bulk CSV, or Gemini AI Import</p>
            </div>
            <AssetForm onAddAssets={handleAddAssets} onCancel={() => setView('list')} />
          </div>
        )}
      </main>
      
      <footer className="bg-white border-t border-slate-200 py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex justify-between items-center text-slate-500 text-sm">
          <div>&copy; {new Date().getFullYear()} EU_EF IT AssetTrack Portal</div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
              Region: {(import.meta as any).env.VITE_ASSET_S3_REGION || 'us-east-1'}
            </div>
            <div className="text-slate-300">|</div>
            <div className="font-mono text-[10px] opacity-50">v1.2-LIVE-EDIT</div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
