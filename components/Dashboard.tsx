
import React, { useMemo } from 'react';
import { Asset, AssetStatus } from '../types';
import { 
  BarChart3, 
  Package, 
  Globe2, 
  MapPin, 
  Activity, 
  TrendingUp,
  Box,
  Layers
} from 'lucide-react';

interface DashboardProps {
  assets: Asset[];
}

export const Dashboard: React.FC<DashboardProps> = ({ assets }) => {
  const stats = useMemo(() => {
    const total = assets.length;
    const statusCounts: Record<string, number> = {};
    const siteCounts: Record<string, number> = {};
    const countryCounts: Record<string, number> = {};
    const modelStatusCounts: Record<string, Record<string, number>> = {};

    Object.values(AssetStatus).forEach(s => statusCounts[s] = 0);

    assets.forEach(a => {
      // General status, site, country counts
      statusCounts[a.status] = (statusCounts[a.status] || 0) + 1;
      siteCounts[a.siteID] = (siteCounts[a.siteID] || 0) + 1;
      countryCounts[a.country] = (countryCounts[a.country] || 0) + 1;

      // Model based status counts
      if (!modelStatusCounts[a.model]) {
        modelStatusCounts[a.model] = {};
        Object.values(AssetStatus).forEach(s => modelStatusCounts[a.model][s] = 0);
      }
      modelStatusCounts[a.model][a.status]++;
    });

    // Sort breakdowns
    const sortedSites = Object.entries(siteCounts).sort((a, b) => b[1] - a[1]);
    const sortedCountries = Object.entries(countryCounts).sort((a, b) => b[1] - a[1]);
    const sortedModels = Object.entries(modelStatusCounts).sort((a, b) => {
      // Fix: Explicitly type reduce accumulators and current values to avoid unknown arithmetic errors
      const totalA = Object.values(a[1]).reduce((sum: number, val: number) => sum + val, 0);
      const totalB = Object.values(b[1]).reduce((sum: number, val: number) => sum + val, 0);
      return totalB - totalA;
    });

    return { total, statusCounts, sortedSites, sortedCountries, sortedModels };
  }, [assets]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case AssetStatus.Normal: return 'bg-emerald-500';
      case AssetStatus.RMARequested: return 'bg-amber-500';
      case AssetStatus.RMAShipped: return 'bg-blue-500';
      case AssetStatus.RMAEligible: return 'bg-indigo-500';
      case AssetStatus.RMANotEligible: return 'bg-rose-500';
      case AssetStatus.Deprecated: return 'bg-slate-500';
      default: return 'bg-slate-400';
    }
  };

  const getStatusTextColor = (status: string) => {
    switch (status) {
      case AssetStatus.Normal: return 'text-emerald-600';
      case AssetStatus.RMARequested: return 'text-amber-600';
      case AssetStatus.RMAShipped: return 'text-blue-600';
      case AssetStatus.RMAEligible: return 'text-indigo-600';
      case AssetStatus.RMANotEligible: return 'text-rose-600';
      case AssetStatus.Deprecated: return 'text-slate-600';
      default: return 'text-slate-500';
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Asset Overview</h2>
        <div className="px-3 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-full border border-blue-100 flex items-center gap-2">
          <Activity className="h-3 w-3" /> Live Data
        </div>
      </div>

      {/* Main Stats Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="bg-blue-100 p-3 rounded-xl text-blue-600">
              <Package className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Assets</p>
              <p className="text-3xl font-black text-slate-900">{stats.total}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="bg-emerald-100 p-3 rounded-xl text-emerald-600">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Active/Normal</p>
              <p className="text-3xl font-black text-slate-900">{stats.statusCounts[AssetStatus.Normal]}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="bg-amber-100 p-3 rounded-xl text-amber-600">
              <BarChart3 className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total RMAs</p>
              <p className="text-3xl font-black text-slate-900">
                {stats.statusCounts[AssetStatus.RMARequested] + stats.statusCounts[AssetStatus.RMAShipped]}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="bg-indigo-100 p-3 rounded-xl text-indigo-600">
              <Globe2 className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Countries</p>
              <p className="text-3xl font-black text-slate-900">{stats.sortedCountries.length}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Status Distribution Visual Bars */}
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
            <Box className="h-5 w-5 text-blue-600" /> Status Distribution
          </h3>
          <div className="space-y-5">
            {Object.entries(stats.statusCounts).map(([status, count]) => {
              // Fix: Cast count as number to resolve arithmetic operation type errors
              const percentage = stats.total > 0 ? ((count as number) / stats.total) * 100 : 0;
              if (count === 0 && status === AssetStatus.Unknown) return null;
              return (
                <div key={status} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-bold text-slate-600">{status}</span>
                    <span className="font-mono font-bold text-slate-900">{count}</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-1000 ease-out ${getStatusColor(status)}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Geographic Breakdown Site List */}
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
            <MapPin className="h-5 w-5 text-blue-600" /> Site Breakdown
          </h3>
          <div className="grid grid-cols-1 gap-4 overflow-y-auto max-h-[400px] pr-2">
            {stats.sortedSites.map(([site, count]) => (
              <div key={site} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 bg-white rounded-lg flex items-center justify-center text-xs font-black text-blue-600 border shadow-sm">
                    {site.substring(0, 3).toUpperCase()}
                  </div>
                  <span className="font-bold text-slate-700">{site}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400 uppercase">Assets</span>
                  <span className="bg-white px-3 py-1 rounded-lg border text-sm font-black text-slate-900">{count}</span>
                </div>
              </div>
            ))}
            {stats.sortedSites.length === 0 && (
              <p className="text-center py-10 text-slate-400 font-medium">No site data available</p>
            )}
          </div>
        </div>
      </div>

      {/* Model-Based Status Breakdown Table */}
      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Layers className="h-5 w-5 text-blue-600" /> Status by Model
          </h3>
          <span className="text-xs text-slate-400 font-bold uppercase tracking-widest">Quantity of each status</span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-bold uppercase text-slate-400 tracking-wider border-b">
                <th className="pb-4 pr-4">Asset Model</th>
                <th className="pb-4 px-2 text-center">Total</th>
                {Object.values(AssetStatus).filter(s => s !== AssetStatus.Unknown).map(s => (
                  <th key={s} className="pb-4 px-2 text-center">{s}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {stats.sortedModels.map(([model, statusObj]) => {
                // Fix: Explicitly type reduce arguments to fix 'unknown' type and '+' operator application errors
                const totalModel = Object.values(statusObj).reduce((sum: number, val: number) => sum + val, 0);
                return (
                  <tr key={model} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 pr-4 font-bold text-slate-700">{model}</td>
                    <td className="py-4 px-2 text-center">
                      <span className="inline-block bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs font-black">
                        {totalModel}
                      </span>
                    </td>
                    {Object.values(AssetStatus).filter(s => s !== AssetStatus.Unknown).map(s => (
                      <td key={s} className="py-4 px-2 text-center">
                        {statusObj[s] > 0 ? (
                          <span className={`text-xs font-black ${getStatusTextColor(s)}`}>
                            {statusObj[s]}
                          </span>
                        ) : (
                          <span className="text-slate-200 text-xs">-</span>
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
              {stats.sortedModels.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-slate-400 font-medium">No model data available</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Country List Footprint */}
      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
          <Globe2 className="h-5 w-5 text-blue-600" /> Country Footprint
        </h3>
        <div className="flex flex-wrap gap-4">
          {stats.sortedCountries.map(([country, count]) => (
            <div key={country} className="flex items-center gap-3 px-4 py-3 bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
              <span className="font-bold text-slate-800">{country}</span>
              <span className="h-6 w-px bg-slate-100"></span>
              <span className="text-blue-600 font-black">{count}</span>
            </div>
          ))}
          {stats.sortedCountries.length === 0 && (
            <p className="text-slate-400 font-medium">No country data available</p>
          )}
        </div>
      </div>
    </div>
  );
};
