
import { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { AssetList } from './components/AssetList';
import { AssetForm } from './components/AssetForm';
import { Login } from './components/Login';
import { Asset } from './types';
import { fetchAssets, addAssets, deleteAssets, updateAsset } from './services/storageService';
// Added PlusCircle to the lucide-react imports
import { Loader2, Cloud, CloudOff, ShieldCheck, PlusCircle } from 'lucide-react';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem('portal_auth') === 'true';
  });
  const [view, setView] = useState<'list' | 'add'>('list');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isConnected, setIsConnected] = useState<boolean | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await fetchAssets();
      setAssets(data);
      setIsConnected(true);
    } catch (error) {
      console.error(error);
      setIsConnected(false);
      showNotification('S3 Connection failed. Verify S3 variables.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (user: string, pass: string): Promise<boolean> => {
    const validUser = (import.meta as any).env?.VITE_PORTAL_USERNAME || 'admin';
    const validPass = (import.meta as any).env?.VITE_PORTAL_PASSWORD || 'password123';
    
    if (user === validUser && pass === validPass) {
      setIsAuthenticated(true);
      sessionStorage.setItem('portal_auth', 'true');
      return true;
    }
    return false;
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('portal_auth');
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

  const handleUpdateAsset = async (assetId: string, siteId: string, updates: Partial<Asset>) => {
    try {
      await updateAsset(assetId, siteId, updates);
      setAssets(prev => prev.map(a => a.id === assetId ? { ...a, ...updates } : a));
      showNotification('Asset updated in S3', 'success');
    } catch (error) {
      console.error(error);
      showNotification('Update failed.', 'error');
      throw error; 
    }
  };

  const handleDeleteAssets = async (ids: string[]) => {
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
  };

  const bucketName = (import.meta as any).env?.VITE_ASSET_S3_BUCKET || 'Not Configured';
  const regionName = (import.meta as any).env?.VITE_ASSET_S3_REGION || 'us-east-1';

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

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
      <Header 
        currentView={view} 
        onNavigate={setView} 
        onLogout={handleLogout} 
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 relative">
        
        <div className="mb-4 flex justify-end items-center">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider border shadow-sm ${
            isConnected 
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
              : isConnected === false 
                ? 'bg-red-50 text-red-700 border-red-200'
                : 'bg-slate-50 text-slate-500 border-slate-200'
          }`}>
            {isConnected ? <Cloud className="h-3 w-3" /> : <CloudOff className="h-3 w-3" />}
            {isConnected ? 'S3 Online' : 'S3 Offline'}
            {isConnected && <ShieldCheck className="h-3 w-3 ml-1" />}
          </div>
        </div>

        {isSaving && (
          <div className="fixed inset-0 bg-slate-900/10 backdrop-blur-sm z-[200] flex items-center justify-center">
             <div className="bg-white px-8 py-6 rounded-2xl shadow-2xl flex flex-col items-center gap-4 border border-slate-100 animate-fade-in">
                <div className="bg-blue-50 p-3 rounded-full">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                </div>
                <div className="text-center">
                  <h3 className="font-bold text-slate-900">Syncing Data</h3>
                  <p className="text-xs text-slate-500 mt-1">Updating secure AWS S3 storage...</p>
                </div>
             </div>
          </div>
        )}

        {notification && (
          <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-4 rounded-2xl shadow-2xl z-50 animate-fade-in flex items-center gap-3 border ${
            notification.type === 'success' 
              ? 'bg-white text-emerald-700 border-emerald-100' 
              : 'bg-white text-red-700 border-red-100'
          }`}>
            {notification.type === 'success' ? <ShieldCheck className="h-5 w-5" /> : <CloudOff className="h-5 w-5" />}
            <span className="font-bold text-sm tracking-tight">{notification.message}</span>
          </div>
        )}

        {view === 'list' ? (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Inventory</h2>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-sm font-medium text-slate-400">Environment:</span>
                  <code className="text-[10px] font-bold bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{bucketName}</code>
                </div>
              </div>
              <button
                onClick={() => setView('add')}
                className="bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 active:scale-95 flex items-center justify-center gap-2"
              >
                <PlusCircle className="h-4 w-4" />
                Register Asset
              </button>
            </div>
            <AssetList 
              assets={assets} 
              onDelete={handleDeleteAssets} 
              onUpdateAsset={handleUpdateAsset}
            />
          </div>
        ) : (
          <div className="space-y-8 max-w-4xl mx-auto">
            <div className="text-center">
              <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Add New Assets</h2>
              <p className="text-slate-500 mt-2 font-medium">Choose between manual entry, bulk upload, or Gemini AI extraction.</p>
            </div>
            <AssetForm onAddAssets={handleAddAssets} onCancel={() => setView('list')} />
          </div>
        )}
      </main>
      
      <footer className="bg-white border-t border-slate-200 py-8 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-4 text-slate-400 text-xs">
          <div className="font-bold uppercase tracking-widest">&copy; {new Date().getFullYear()} EU_EF IT ASSET PORTAL</div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
              <span className="font-semibold">{regionName.toUpperCase()}</span>
            </div>
            <div className="h-4 w-px bg-slate-200"></div>
            <div className="font-mono opacity-60">v1.3-PRODUCTION</div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
