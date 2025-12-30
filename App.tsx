import { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { AssetList } from './components/AssetList';
import { AssetForm } from './components/AssetForm';
import { Dashboard } from './components/Dashboard';
import { UserManual } from './components/UserManual';
import { Login } from './components/Login';
import { Asset } from './types';
import { fetchAssets, addAssets, deleteAssets, updateAsset } from './services/storageService';
import { DatabaseZap, PlusCircle, RotateCw } from 'lucide-react';

type ViewType = 'dashboard' | 'list' | 'add' | 'manual';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => sessionStorage.getItem('portal_auth') === 'true');
  const [view, setView] = useState<ViewType>('dashboard');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isConnected, setIsConnected] = useState<boolean | null>(null);

  useEffect(() => { if (isAuthenticated) loadData(); }, [isAuthenticated]);

  const loadData = async (isManual = false) => {
    setIsLoading(true);
    try {
      const data = await fetchAssets();
      setAssets(data);
      setIsConnected(true);
      if (isManual) {
        showNotification('Inventory updated successfully', 'success');
      }
    } catch (error: any) {
      setIsConnected(false);
      if (isAuthenticated || isManual) {
        showNotification(error.message || 'DynamoDB Connection failed. Check AWS credentials.', 'error');
      }
    } finally { 
      setIsLoading(false); 
    }
  };

  const handleLogin = async (user: string, _pass: string): Promise<boolean> => {
    if (user.trim() === 'amplify_asset') {
      setIsAuthenticated(true);
      sessionStorage.setItem('portal_auth', 'true');
      return true;
    }
    return false;
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
      showNotification(`Saved ${newAssets.length} asset(s) to DynamoDB`, 'success');
    } catch (error: any) { 
      showNotification(error.message, 'error'); 
    } finally { 
      setIsSaving(false); 
    }
  };

  const handleUpdateAsset = async (serialNumber: string, updates: Partial<Asset>) => {
    try {
      await updateAsset(serialNumber, updates);
      setAssets(prev => prev.map(a => {
        if (a.serialNumber === serialNumber) {
          return { ...a, ...updates };
        }
        return a;
      }));
      showNotification('Asset updated', 'success');
    } catch (error: any) { 
      showNotification(error.message, 'error'); 
    }
  };

  const handleDeleteAssets = async (serials: string[]) => {
    setIsSaving(true);
    try {
      const assetsToDelete = assets.filter(a => serials.includes(a.serialNumber));
      await deleteAssets(assetsToDelete);
      setAssets(prev => prev.filter(a => !serials.includes(a.serialNumber)));
      showNotification('Assets removed', 'success');
    } catch (error: any) { 
      showNotification(error.message, 'error'); 
    } finally { 
      setIsSaving(false); 
    }
  };

  if (!isAuthenticated) return <Login onLogin={handleLogin} />;
  
  if (isLoading && assets.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
        <RotateCw className="h-8 w-8 text-blue-600 animate-spin" />
        <p className="font-bold text-slate-400">Loading Cloud Inventory...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header currentView={view} onNavigate={setView} onLogout={() => { setIsAuthenticated(false); sessionStorage.removeItem('portal_auth'); }} />
      <main className="flex-1 max-w-7xl mx-auto px-4 py-8 w-full">
        <div className="mb-4 flex justify-end">
          <div className={`px-3 py-1 rounded-full text-[10px] font-bold border flex items-center gap-2 ${isConnected ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700'}`}>
            <DatabaseZap className="h-3 w-3" /> {isConnected ? 'DynamoDB Linked' : 'Disconnected'}
          </div>
        </div>
        
        {notification && (
          <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-4 rounded-xl shadow-2xl z-50 border bg-white flex items-center gap-3 animate-fade-in ${notification.type === 'success' ? 'text-emerald-700 border-emerald-100 shadow-emerald-500/10' : 'text-red-700 border-red-100 shadow-red-500/10'}`}>
            <div className={`h-2 w-2 rounded-full ${notification.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`} />
            <span className="font-semibold">{notification.message}</span>
          </div>
        )}

        {isSaving && (
          <div className="fixed inset-0 bg-white/60 backdrop-blur-sm z-[200] flex flex-col items-center justify-center gap-4">
            <RotateCw className="h-10 w-10 text-blue-600 animate-spin" />
            <p className="font-extrabold text-slate-800">Syncing with AWS...</p>
          </div>
        )}

        {view === 'dashboard' && <Dashboard assets={assets} />}
        {view === 'manual' && <UserManual />}

        {view === 'list' && (
          <div className="space-y-6">
            <div className="flex justify-between items-end">
              <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Inventory</h2>
              <div className="flex gap-2">
                 <button 
                  onClick={() => loadData(true)} 
                  disabled={isLoading}
                  className="px-4 py-2 border rounded-lg text-sm font-bold text-slate-600 bg-white hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm disabled:opacity-50"
                 >
                   <RotateCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                   {isLoading ? 'Updating...' : 'Refresh'}
                 </button>
                 <button 
                  onClick={() => setView('add')} 
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
                 >
                   <PlusCircle className="h-4 w-4" /> Add Asset
                 </button>
              </div>
            </div>
            <AssetList assets={assets} onDelete={handleDeleteAssets} onUpdateAsset={handleUpdateAsset} />
          </div>
        )}

        {view === 'add' && <AssetForm onAddAssets={handleAddAssets} onCancel={() => setView('list')} />}
      </main>
    </div>
  );
}

export default App;