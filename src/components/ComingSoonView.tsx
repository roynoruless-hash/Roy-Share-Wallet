import React from 'react';
import { Compass, ArrowLeft, Sparkles, Clock, ShieldCheck } from 'lucide-react';

interface ComingSoonViewProps {
  path?: string;
  onGoHome?: () => void;
}

export const ComingSoonView: React.FC<ComingSoonViewProps> = ({ path, onGoHome }) => {
  const handleReturn = () => {
    if (onGoHome) {
      onGoHome();
    } else {
      window.history.pushState({}, '', '/');
      window.location.reload();
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="p-8 rounded-3xl bg-slate-900/90 border border-slate-800 max-w-md w-full text-center space-y-6 shadow-2xl relative overflow-hidden backdrop-blur-md">
        <div className="absolute -right-12 -top-12 w-32 h-32 bg-sky-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -left-12 -bottom-12 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-sky-500/20 via-blue-500/10 to-amber-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400 mx-auto shadow-lg shadow-sky-500/10">
          <Compass className="w-8 h-8 animate-spin-slow" />
        </div>

        <div className="space-y-2">
          <span className="px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-[11px] font-bold uppercase tracking-wider inline-flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            Module In Development
          </span>
          <h2 className="text-2xl font-black text-white">Feature Coming Soon</h2>
          <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
            The requested page <code className="text-sky-300 font-mono bg-slate-800 px-1.5 py-0.5 rounded">{path || window.location.pathname}</code> is being prepared with full real-time capabilities.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-800 text-left space-y-2 text-xs">
          <div className="flex items-center gap-2 text-slate-300 font-semibold">
            <Clock className="w-4 h-4 text-amber-400" />
            <span>Expected Release: Next System Update</span>
          </div>
          <div className="flex items-center gap-2 text-slate-400 text-[11px]">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>All existing Giveaway War & Wallet features are 100% active.</span>
          </div>
        </div>

        <button
          onClick={handleReturn}
          className="w-full py-3 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-black text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-sky-500/20"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Admin Dashboard</span>
        </button>
      </div>
    </div>
  );
};
