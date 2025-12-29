import { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { AssetList } from './components/AssetList';
import { AssetForm } from './components/AssetForm';
import { Login } from './components/Login';
import { Asset } from './types';
import { fetchAssets, addAssets, deleteAssets, updateAsset } from './services/storageService';
import { Loader2, Database as DbIcon, DatabaseZap, ShieldCheck, PlusCircle, AlertCircle } from 'lucide-react';

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
    } catch (error: any) {
      console.error(error);
      setIsConnected(false);
      showNotification(error.message || 'DynamoDB Connection failed.', 'error');
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
    const duration = type === 'error' ? 8000 : 5000;
    setTimeout(() => setNotification(null), duration);
  };

  const handleAddAssets = async (newAssets: Asset[]) => {
    setIsSaving(true);
    try {
      await addAssets(newAssets);
      setAssets(prev => [...prev, ...newAssets]);
      setView('list');
      showNotification(`Saved ${newAssets.length} asset(s) to DynamoDB`, 'success');
    } catch (error: any) {
      console.error(error);
      showNotification(error.message || 'Save failed.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateAsset = async (assetId: string, updates: Partial<Asset>) => {
    try {
      await updateAsset(assetId, updates);
      setAssets(prev => prev.map(a => a.id === assetId ? { ...a, ...updates } : a));
      showNotification('Asset updated in DynamoDB', 'success');
    } catch (error: any) {
      console.error(error);
      showNotification(error.message || 'Update failed.', 'error');
      throw error; 
    }
  };

  const handleDeleteAssets = async (ids: string[]) => {
    setIsSaving(true);
    try {
      const assetsToDelete = assets.filter(a => ids.includes(a.id));
      await deleteAssets(assetsToDelete);
      setAssets(prev => prev.filter(a => !ids.includes(a.id)));
      showNotification('Assets removed from DynamoDB', 'success');
    } catch (error: any) {
      console.error(error);
      showNotification(error.message || 'Delete failed.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const tableName = (import.meta as any).env?.VITE_ASSET_DYNAMO_TABLE || 'Assets';
  const regionName = (import.meta as any).env?.VITE_ASSET_AWS_REGION || 'us-east-1';

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  if (isLoading && assets.length === 0 && isConnected === null) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
        <div className="loader ease-linear rounded-full border-4 border-t-4 border-slate-200 h-12 w-12 mb-4"></div>
        <p className="text-slate-500 font-medium">Connecting to DynamoDB Instance...</p>
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
              ? 'bg-blue-50 text-blue-700 border-blue-200' 
              : isConnected === false 
                ? 'bg-red-50 text-red-700 border-red-200'
                : 'bg-slate-50 text-slate-500 border-slate-200'
          }`}>
            {isConnected ? <DatabaseZap className="h-3 w-3" /> : <DbIcon className="h-3 w-3" />}
            {isConnected ? 'DynamoDB Active' : 'No Connection'}
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
                  <h3 className="font-bold text-slate-900">Synchronizing Data</h3>
                  <p className="text-xs text-slate-500 mt-1">AWS Cloud Operations in progress...</p>
                </div>
             </div>
          </div>
        )}

        {notification && (
          <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-4 rounded-2xl shadow-2xl z-50 animate-fade-in flex items-center gap-3 border max-w-[90vw] md:max-w-md ${
            notification.type === 'success' 
              ? 'bg-white text-emerald-700 border-emerald-100' 
              : 'bg-white text-red-700 border-red-100'
          }`}>
            {notification.type === 'success' ? <ShieldCheck className="h-5 w-5 flex-shrink-0" /> : <AlertCircle className="h-5 w-5 flex-shrink-0" />}
            <span className="font-bold text-xs tracking-tight">{notification.message}</span>
          </div>
        )}

        {view === 'list' ? (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Inventory</h2>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-sm font-medium text-slate-400">Database:</span>
                  <code className="text-[10px] font-bold bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{tableName}</code>
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
              <p className="text-slate-500 mt-2 font-medium">Manual entry, bulk upload, or Gemini AI extraction.</p>
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
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-blue-500' : 'bg-red-500'}`}></div>
              <span className="font-semibold">{regionName.toUpperCase()}</span>
            </div>
            <div className="h-4 w-px bg-slate-200"></div>
            <div className="font-mono opacity-60">v1.4-DYNAMODB</div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;