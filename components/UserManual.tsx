import React from 'react';
import { 
  BookOpen, 
  Search, 
  Upload, 
  Sparkles, 
  Shield, 
  Database, 
  Table, 
  History,
  Info,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export const UserManual: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-12 animate-fade-in pb-20">
      <div className="text-center space-y-4">
        <div className="inline-flex p-3 bg-blue-100 rounded-2xl text-blue-600 mb-2">
          <BookOpen className="h-8 w-8" />
        </div>
        <h1 className="text-4xl font-black text-slate-900 tracking-tight">Portal User Manual</h1>
        <p className="text-slate-500 font-medium max-w-2xl mx-auto">
          Comprehensive guide for External Fulfilment IT Equipment management, 
          tracking, and RMA lifecycle operations.
        </p>
      </div>

      {/* Quick Start Section */}
      <section className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
          <Shield className="h-5 w-5 text-blue-600" /> System Authentication
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-3">
            <h3 className="font-bold text-slate-800">Authorized Access</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              The portal is restricted to authorized personnel. Use the system username 
              <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-blue-600 ml-1">amplify_asset</code> 
              to gain entry. 
            </p>
          </div>
          <div className="space-y-3">
            <h3 className="font-bold text-slate-800">Data Persistence</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              All changes are synced in real-time to Amazon DynamoDB. The connection status 
              is visible in the top right corner of the application.
            </p>
          </div>
        </div>
      </section>

      {/* Feature Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Inventory Management */}
        <section className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
            <Table className="h-5 w-5 text-emerald-600" /> Inventory Control
          </h2>
          <ul className="space-y-4">
            <li className="flex gap-3">
              <Search className="h-5 w-5 text-slate-400 shrink-0" />
              <div>
                <p className="text-sm font-bold text-slate-800">Global Search</p>
                <p className="text-xs text-slate-500">Instantly filter by Serial, Model, or SiteID.</p>
              </div>
            </li>
            <li className="flex gap-3">
              <History className="h-5 w-5 text-slate-400 shrink-0" />
              <div>
                <p className="text-sm font-bold text-slate-800">Audit Trails</p>
                <p className="text-xs text-slate-500">Every status change or field edit is logged with a timestamp.</p>
              </div>
            </li>
            <li className="flex gap-3">
              <Upload className="h-5 w-5 text-slate-400 shrink-0" />
              <div>
                <p className="text-sm font-bold text-slate-800">Data Exports</p>
                <p className="text-xs text-slate-500">Download filtered inventory as high-quality Excel or CSV files.</p>
              </div>
            </li>
          </ul>
        </section>

        {/* AI Capabilities */}
        <section className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-indigo-600" /> AI-Powered Entry
          </h2>
          <div className="space-y-4">
            <p className="text-sm text-slate-600 leading-relaxed">
              Our integrated Gemini AI can process "messy" data like emails or chat logs.
            </p>
            <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100">
              <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-2">Example Input</p>
              <p className="text-xs font-mono text-indigo-700 italic">
                "Hi Team, please register 5 units of Latitude 5420 for our London site (LDN01). 
                Serials are ABC1, ABC2, ABC3, ABC4, and ABC5. All are normal status."
              </p>
            </div>
            <p className="text-xs text-slate-500 italic">
              AI automatically extracts Model, Serial, and SiteID accurately.
            </p>
          </div>
        </section>
      </div>

      {/* Registration Methods */}
      <section className="bg-slate-900 text-white rounded-3xl p-10 shadow-2xl overflow-hidden relative">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <Database className="h-32 w-32" />
        </div>
        <h2 className="text-2xl font-bold mb-8 flex items-center gap-3">
          <Upload className="h-6 w-6 text-blue-400" /> Bulk Import Requirements
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="space-y-4">
            <div className="h-10 w-10 bg-white/10 rounded-xl flex items-center justify-center font-bold text-blue-400">1</div>
            <h3 className="font-bold">File Formats</h3>
            <p className="text-sm text-slate-400">Supported: .csv, .xlsx, .xls</p>
          </div>
          <div className="space-y-4">
            <div className="h-10 w-10 bg-white/10 rounded-xl flex items-center justify-center font-bold text-blue-400">2</div>
            <h3 className="font-bold">Column Headers</h3>
            <p className="text-sm text-slate-400">Must include: Model, Serial Number, SiteID</p>
          </div>
          <div className="space-y-4">
            <div className="h-10 w-10 bg-white/10 rounded-xl flex items-center justify-center font-bold text-blue-400">3</div>
            <h3 className="font-bold">SiteID Rule</h3>
            <p className="text-sm text-slate-400">Must start with a letter (e.g., PHX01, not 01PHX)</p>
          </div>
        </div>
      </section>

      {/* Validation & Rules */}
      <section className="bg-amber-50 rounded-3xl border border-amber-200 p-8">
        <h2 className="text-xl font-bold text-amber-800 mb-6 flex items-center gap-2">
          <AlertCircle className="h-5 w-5" /> Data Integrity Rules
        </h2>
        <div className="space-y-4">
          <div className="flex gap-4">
            <CheckCircle2 className="h-5 w-5 text-amber-600 shrink-0" />
            <p className="text-sm text-amber-900">
              <strong>Serial Number Uniqueness:</strong> The Serial Number is the primary key. 
              Adding an existing serial will update the existing record rather than duplicate it.
            </p>
          </div>
          <div className="flex gap-4">
            <CheckCircle2 className="h-5 w-5 text-amber-600 shrink-0" />
            <p className="text-sm text-amber-900">
              <strong>Status Lifecycle:</strong> Use "RMA Requested" immediately upon failure detection 
              to ensure accurate dashboard tracking.
            </p>
          </div>
          <div className="flex gap-4">
            <Info className="h-5 w-5 text-amber-600 shrink-0" />
            <p className="text-sm text-amber-900">
              <strong>Editing:</strong> You can edit Model, SiteID, and Country inline directly 
              from the Inventory table using the pencil icon.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};