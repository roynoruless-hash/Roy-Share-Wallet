import React, { useState } from 'react';
import { Search, X, User, Gift, Trophy, ArrowUpRight, Award, Link, Wallet } from 'lucide-react';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectUser?: (telegramId: string) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({ isOpen, onClose, onSelectUser }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    try {
      setLoading(true);
      let sessionToken = '';
      try {
        const raw = localStorage.getItem('royshare_admin_session') || sessionStorage.getItem('royshare_admin_session');
        if (raw) {
          sessionToken = JSON.parse(raw).sessionToken || '';
        }
      } catch (e) {}
      if (!sessionToken) {
        sessionToken = localStorage.getItem('adminSessionToken') || '';
      }

      const res = await fetch(`/api/admin/global-search?q=${encodeURIComponent(query.trim())}`, {
        headers: { 
          'x-admin-session-token': sessionToken,
          'Authorization': sessionToken ? `Bearer ${sessionToken}` : ''
        },
      });
      const data = await res.json();
      if (data.success) {
        setResults(data.results);
      }
    } catch (err) {
      console.error('Error conducting global search:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl relative text-white">
        {/* Search Header Input */}
        <form onSubmit={handleSearch} className="p-4 bg-slate-950 border-b border-slate-800 flex items-center gap-3">
          <Search className="w-5 h-5 text-amber-400" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search Telegram ID, Username, Wallet Address, Code, Withdrawal ID..."
            className="w-full bg-transparent border-none text-white text-sm outline-none placeholder-slate-500"
            autoFocus
          />
          <button
            type="submit"
            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs rounded-xl transition"
          >
            Search
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </form>

        {/* Results Container */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {loading && (
            <div className="p-8 text-center text-slate-400">
              <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              Searching platform databases...
            </div>
          )}

          {!loading && !results && (
            <div className="text-center py-8 text-slate-500 text-xs">
              Type a keyword or Telegram ID above and press Search.
            </div>
          )}

          {!loading && results && (
            <div className="space-y-6">
              {/* Users */}
              {results.users?.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" /> Users ({results.users.length})
                  </h4>
                  <div className="space-y-1.5">
                    {results.users.map((u: any) => (
                      <div
                        key={u.id}
                        onClick={() => {
                          if (onSelectUser) onSelectUser(u.telegramId || u.id);
                        }}
                        className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 hover:border-amber-500/50 transition cursor-pointer flex items-center justify-between text-xs"
                      >
                        <div>
                          <span className="font-bold text-white block">{u.userName || u.name || u.id}</span>
                          <span className="text-slate-400 font-mono">Telegram ID: {u.telegramId || u.id}</span>
                        </div>
                        <span className="text-amber-400 font-semibold flex items-center gap-1">
                          View Profile <ArrowUpRight className="w-3 h-3" />
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Events & Codes */}
              {results.events?.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Gift className="w-3.5 h-3.5" /> Redeem Events & Codes ({results.events.length})
                  </h4>
                  <div className="space-y-1.5">
                    {results.events.map((e: any) => (
                      <div
                        key={e.id}
                        className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-xs flex items-center justify-between"
                      >
                        <div>
                          <span className="font-mono font-bold text-emerald-400 block">Code: {e.code || e.id}</span>
                          <span className="text-slate-400">Winners: {e.winners?.length || 0}</span>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">
                          {e.eventStatus || 'COMPLETED'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Withdrawals */}
              {results.withdrawals?.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Wallet className="w-3.5 h-3.5" /> Withdrawals ({results.withdrawals.length})
                  </h4>
                  <div className="space-y-1.5">
                    {results.withdrawals.map((w: any) => (
                      <div
                        key={w.id}
                        className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-xs flex items-center justify-between"
                      >
                        <div>
                          <span className="font-bold text-white block">₹{w.amount} — {w.paymentMethod}</span>
                          <span className="text-slate-400 font-mono">ID: {w.telegramId || w.id}</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          w.status === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                        }`}>
                          {w.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {results.users?.length === 0 &&
                results.events?.length === 0 &&
                results.withdrawals?.length === 0 && (
                  <div className="text-center py-8 text-slate-500 text-xs">
                    No matching records found for "{query}".
                  </div>
                )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
