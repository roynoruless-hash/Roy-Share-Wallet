import React, { useState, useEffect } from 'react';
import { db } from '../../services/firebase';
import { doc, collection, getDocs, getDoc, setDoc, query, orderBy, limit, onSnapshot, where } from 'firebase/firestore';
import { AdminConfig } from '../../types';
import {
  Gift,
  Plus,
  Play,
  Pause,
  RefreshCw,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Users,
  Timer,
  Trophy,
  Coins,
  ShieldAlert,
  Sliders,
  Sparkles,
  Download,
  Calendar,
  Layers,
  Search
} from 'lucide-react';

interface LuckyGiveawaysViewProps {
  config: AdminConfig;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const LuckyGiveawaysView: React.FC<LuckyGiveawaysViewProps> = ({ config, showToast }) => {
  // Get Admin session token from storage
  const getSessionToken = (): string => {
    try {
      const raw = localStorage.getItem('royshare_admin_session') || sessionStorage.getItem('royshare_admin_session');
      if (raw) {
        const parsed = JSON.parse(raw);
        return parsed?.sessionToken || '';
      }
    } catch (e) {}
    return localStorage.getItem('adminSessionToken') || '';
  };

  // Stats
  const [totalCount, setTotalCount] = useState(0);
  const [activeGiveaway, setActiveGiveaway] = useState<any>(null);
  const [entries, setEntries] = useState<any[]>([]);
  const [pastGiveaways, setPastGiveaways] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form States
  const [title, setTitle] = useState('Lucky Speed Drop');
  const [description, setDescription] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [prizeAmount, setPrizeAmount] = useState('100');
  const [walletReward, setWalletReward] = useState('100');
  const [numberRange, setNumberRange] = useState('1-100');
  const [maxPlayers, setMaxPlayers] = useState('500');
  const [entryTimer, setEntryTimer] = useState('5');
  const [winnerCount, setWinnerCount] = useState('5');
  const [startMode, setStartMode] = useState<'auto' | 'manual' | 'scheduled'>('auto');
  const [winnerMode, setWinnerMode] = useState<'fair' | 'manual' | 'ai'>('fair');
  const [manualWinningNumber, setManualWinningNumber] = useState('');
  const [entryType, setEntryType] = useState<'free' | 'coins' | 'balance'>('free');
  const [entryFee, setEntryFee] = useState('0');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [registrationDeadline, setRegistrationDeadline] = useState('');
  const [maxEntriesPerAccount, setMaxEntriesPerAccount] = useState('1');
  const [autoSelectWinners, setAutoSelectWinners] = useState(true);
  const [autoCreditPrize, setAutoCreditPrize] = useState(true);

  // Local Countdown Timer State
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  // Audit Log State
  const [selectedAuditGiveaway, setSelectedAuditGiveaway] = useState<any>(null);
  const [auditEntries, setAuditEntries] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditSearchQuery, setAuditSearchQuery] = useState('');

  // Load Initial Data
  useEffect(() => {
    fetchHistory();
    // Realtime listener for active giveaway
    const activeRef = doc(db, 'giveaways', 'active');
    const unsubscribeActive = onSnapshot(activeRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setActiveGiveaway(data);

        // Calculate time left
        if (data.status === 'active' && data.expiresAt) {
          const diff = Math.max(0, Math.floor((data.expiresAt - Date.now()) / 1000));
          setTimeLeft(diff);
        } else if (data.status === 'paused') {
          setTimeLeft(data.remainingSecondsAtPause || 0);
        } else {
          setTimeLeft(null);
        }
      } else {
        setActiveGiveaway(null);
        setTimeLeft(null);
      }
    }, (err) => {
      console.error('Error listening to active giveaway:', err);
    });

    return () => {
      unsubscribeActive();
    };
  }, []);

  // Countdown clock effect
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0 || !activeGiveaway || activeGiveaway.status !== 'active') return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev !== null && prev > 0) {
          return prev - 1;
        } else {
          clearInterval(timer);
          return 0;
        }
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, activeGiveaway]);

  // Listen to entries of active giveaway in real-time
  useEffect(() => {
    if (!activeGiveaway) {
      setEntries([]);
      return;
    }

    const entriesCol = collection(db, 'entries');
    const q = query(entriesCol, orderBy('timestamp', 'desc'));
    const unsubscribeEntries = onSnapshot(q, (snapshot) => {
      const allEntries: any[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        if (data.giveawayId === activeGiveaway.id && data.selectedNumber !== undefined) {
          allEntries.push(data);
        }
      });
      setEntries(allEntries);
    }, (err) => {
      console.error('Error listening to entries:', err);
    });

    return () => {
      unsubscribeEntries();
    };
  }, [activeGiveaway]);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const sessionToken = getSessionToken();
      const res = await fetch('/api/giveaway/history', {
        headers: { 
          'x-admin-session-token': sessionToken,
          'Authorization': sessionToken ? `Bearer ${sessionToken}` : ''
        },
      });
      const data = await res.json();
      if (data.success) {
        setPastGiveaways(data.history);
        setTotalCount(data.history.length);
      }
    } catch (err) {
      console.error('Error fetching history:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAuditModal = async (giveaway: any) => {
    setSelectedAuditGiveaway(giveaway);
    setAuditLoading(true);
    setAuditSearchQuery('');
    setAuditEntries([]);
    try {
      const q = query(collection(db, 'entries'), where('giveawayId', '==', giveaway.id));
      const snap = await getDocs(q);
      const list: any[] = [];
      snap.forEach(d => {
        const data = d.data();
        if (data.selectedNumber !== undefined) {
          list.push(data);
        }
      });
      list.sort((a, b) => a.selectedNumber - b.selectedNumber);
      setAuditEntries(list);
    } catch (err) {
      console.error('Error fetching audit entries:', err);
      showToast('Failed to load player entry ledger', 'error');
    } finally {
      setAuditLoading(false);
    }
  };

  const handlePrintAudit = (giveaway: any, entries: any[]) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast('Popup blocker prevented opening the print view', 'error');
      return;
    }

    const winnersText = giveaway.winners && giveaway.winners.length > 0
      ? giveaway.winners.map((w: any) => 
          '<tr style="border-bottom: 1px solid #e2e8f0;">' +
            '<td style="padding: 10px; font-weight: bold;">' + w.firstName + '</td>' +
            '<td style="padding: 10px; font-family: monospace;">' + w.telegramId + '</td>' +
            '<td style="padding: 10px; font-weight: bold; color: #d97706; font-family: monospace;">' + w.selectedNumber + '</td>' +
            '<td style="padding: 10px; font-family: monospace; color: #16a34a; font-weight: bold;">' + (w.transactionId || 'Ledger Credit Success') + '</td>' +
          '</tr>'
        ).join('')
      : '<tr><td colspan="4" style="padding: 20px; text-align: center; color: #64748b;">No matching winners found for this draw.</td></tr>';

    const entriesText = entries.map((e: any) => {
      const isWinner = giveaway.winners?.some((w: any) => String(w.telegramId) === String(e.telegramId));
      return '<tr style="border-bottom: 1px solid #f1f5f9; background-color: ' + (isWinner ? '#fef3c7' : 'transparent') + ';">' +
        '<td style="padding: 8px; font-weight: ' + (isWinner ? 'bold' : 'normal') + ';">' + e.firstName + '</td>' +
        '<td style="padding: 8px; font-family: monospace; color: #475569;">' + e.telegramId + '</td>' +
        '<td style="padding: 8px; font-family: monospace; font-weight: bold;">' + e.selectedNumber + '</td>' +
        '<td style="padding: 8px; font-family: monospace; font-size: 11px;">' + new Date(e.timestamp).toLocaleTimeString() + '</td>' +
        '<td style="padding: 8px; font-weight: bold; color: ' + (isWinner ? '#b45309' : '#64748b') + ';">' + (isWinner ? 'WINNER 🏆' : 'No Match') + '</td>' +
      '</tr>';
    }).join('');

    const html = [
      '<html>',
      '  <head>',
      '    <title>Giveaway Draw Audit Report - ' + giveaway.title + '</title>',
      '    <style>',
      '      body { font-family: system-ui, -apple-system, sans-serif; color: #1e293b; padding: 40px; line-height: 1.5; }',
      '      .header { border-bottom: 3px solid #f59e0b; padding-bottom: 20px; margin-bottom: 30px; }',
      '      .title { font-size: 24px; font-weight: 800; margin: 0; color: #1e293b; }',
      '      .subtitle { font-size: 14px; color: #64748b; margin: 5px 0 0 0; }',
      '      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }',
      '      .card { background: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 12px; }',
      '      .card h3 { margin: 0 0 10px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; color: #475569; }',
      '      table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }',
      '      th { text-align: left; padding: 10px 8px; background: #f1f5f9; font-weight: 700; color: #475569; border-bottom: 2px solid #e2e8f0; }',
      '      .provably-fair { background: #fafaf9; border: 1px solid #e7e5e4; padding: 15px; border-radius: 12px; font-family: monospace; font-size: 11px; margin-bottom: 30px; }',
      '      .provably-fair h3 { font-family: sans-serif; margin-top: 0; color: #78350f; font-size: 12px; }',
      '      @media print { .no-print { display: none; } body { padding: 0; } }',
      '    </style>',
      '  </head>',
      '  <body>',
      '    <div class="no-print" style="margin-bottom: 20px; text-align: right;">',
      '      <button onclick="window.print()" style="background: #f59e0b; color: white; border: none; padding: 10px 20px; font-weight: bold; border-radius: 8px; cursor: pointer; font-size: 14px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">Print Report / Save as PDF</button>',
      '    </div>',
      '    <div class="header">',
      '      <h1 class="title">🏆 GIVEAWAY DRAW AUDIT REPORT</h1>',
      '      <p class="subtitle">Official verification document generated from Roy Share Wallet Ledger</p>',
      '    </div>',
      '    <div class="grid">',
      '      <div class="card">',
      '        <h3>Giveaway Details</h3>',
      '        <p><strong>Title:</strong> ' + giveaway.title + '</p>',
      '        <p><strong>Status:</strong> <span style="text-transform: uppercase; font-weight: bold; color: #16a34a;">' + giveaway.status + '</span></p>',
      '        <p><strong>Draw Completed:</strong> ' + new Date(giveaway.endedAt || Date.now()).toLocaleString() + '</p>',
      '        <p><strong>Total Jackpot:</strong> ₹' + giveaway.prizeAmount + '</p>',
      '      </div>',
      '      <div class="card">',
      '        <h3>Entrant Statistics</h3>',
      '        <p><strong>Total Entrants:</strong> ' + entries.length + ' slots claimed</p>',
      '        <p><strong>Winning Slots Allocated:</strong> ' + (giveaway.winnerCount || 1) + ' slots</p>',
      '        <p><strong>Number Range:</strong> ' + (giveaway.numberRange || "1-24") + '</p>',
      '        <p><strong>Selection Mode:</strong> <span style="text-transform: uppercase;">' + (giveaway.winnerMode || "fair") + '</span></p>',
      '      </div>',
      '    </div>',
      '    <div class="provably-fair">',
      '      <h3>🛡️ PROVABLY FAIR DRAW VERIFICATION</h3>',
      '      <p><strong>DRAW ID:</strong> ' + (giveaway.drawId || "N/A") + '</p>',
      '      <p><strong>DRAW SEED (ENTROPY):</strong> ' + (giveaway.drawSeed || "N/A") + '</p>',
      '      <p><strong>WINNING HASH SIGNATURE (SHA-256):</strong> ' + (giveaway.winnerHash || "N/A") + '</p>',
      '      <p><strong>TIMESTAMP:</strong> ' + (giveaway.drawTimestamp ? new Date(giveaway.drawTimestamp).toISOString() : "N/A") + '</p>',
      '      <p style="margin-top: 15px; font-family: sans-serif; font-size: 11px; color: #64748b; line-height: 1.4;">',
      '        <i>Verification Proof: The Winner Hash is a SHA-256 digest of the secret draw seed combined with the winning numbers drawn. The server generated this hash before the 15-second casino reel stop. Enter seed + winning numbers in any independent SHA-256 verification tool to confirm mathematical consensus.</i>',
      '      </p>',
      '    </div>',
      '    <div style="margin-bottom: 30px;">',
      '      <h3 style="font-size: 16px; font-weight: 800; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 12px; color: #1e293b;">',
      '        🎉 WINNERS SPOTLIGHT & WALLET CREDIT RECEIPTS',
      '      </h3>',
      '      <table>',
      '        <thead>',
      '          <tr>',
      '            <th>Player Name</th>',
      '            <th>Telegram ID</th>',
      '            <th>Winning Number</th>',
      '            <th>Ledger Transaction ID (Auto Credit Receipt)</th>',
      '          </tr>',
      '        </thead>',
      '        <tbody>',
      winnersText,
      '        </tbody>',
      '      </table>',
      '    </div>',
      '    <div>',
      '      <h3 style="font-size: 16px; font-weight: 800; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 12px; color: #1e293b;">',
      '        📋 FULL PLAYER ENTRANTS RECORD (' + entries.length + ')',
      '      </h3>',
      '      <table>',
      '        <thead>',
      '          <tr>',
      '            <th>Player Name</th>',
      '            <th>Telegram ID</th>',
      '            <th>Selected Number</th>',
      '            <th>Lock Time</th>',
      '            <th>Result</th>',
      '          </tr>',
      '        </thead>',
      '        <tbody>',
      entriesText,
      '        </tbody>',
      '      </table>',
      '    </div>',
      '    <div style="margin-top: 50px; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 20px; font-size: 11px; color: #94a3b8;">',
      '      <p>Roy Share Wallet Admin Dashboard Ledger • Verification ID: ' + giveaway.id + '</p>',
      '      <p>© 2026 Roy Share Wallet System. All server signatures cryptographically signed on-chain.</p>',
      '    </div>',
      '  </body>',
      '</html>'
    ].join('\n');

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleExportAuditCSV = (giveaway: any, entries: any[]) => {
    const lines = [
      'ROY SHARE WALLET - GIVEAWAY FULL DRAW AUDIT LOG',
      'Giveaway: ' + giveaway.title,
      'Draw ID: ' + (giveaway.drawId || ''),
      'Draw Seed: ' + (giveaway.drawSeed || ''),
      'Winner Hash: ' + (giveaway.winnerHash || ''),
      'Drawn At: ' + new Date(giveaway.endedAt || Date.now()).toLocaleString(),
      'Winning Numbers: ' + (giveaway.winningNumbers?.join(' | ') || ''),
      '----------------------------------------',
      'Telegram ID,Username,First Name,Selected Number,Lock Timestamp,Is Winner,Transaction ID'
    ];

    entries.forEach(e => {
      const isWinner = giveaway.winners?.some((w: any) => String(w.telegramId) === String(e.telegramId));
      const winnerDetails = giveaway.winners?.find((w: any) => String(w.telegramId) === String(e.telegramId));
      lines.push(
        e.telegramId + ',' +
        (e.username || '') + ',' +
        e.firstName.replace(/,/g, '') + ',' +
        e.selectedNumber + ',' +
        e.timestamp + ',' +
        (isWinner ? 'YES' : 'NO') + ',' +
        (winnerDetails?.transactionId || '')
      );
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Audit_Report_' + giveaway.title.replace(/\s+/g, '_') + '_' + giveaway.id + '.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Full audit log CSV downloaded!', 'success');
  };

  const handleCreateGiveaway = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !prizeAmount || !numberRange || !maxPlayers || !entryTimer || !winnerCount) {
      showToast('All fields are required', 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      const sessionToken = getSessionToken();
      const res = await fetch('/api/giveaway/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-session-token': sessionToken,
          'Authorization': sessionToken ? `Bearer ${sessionToken}` : ''
        },
        body: JSON.stringify({
          title,
          description,
          bannerUrl,
          prizeAmount: Number(prizeAmount),
          walletReward: Number(walletReward),
          numberRange,
          maxPlayers: Number(maxPlayers),
          entryTimer: Number(entryTimer),
          winnerCount: Number(winnerCount),
          startMode,
          winnerMode,
          manualWinningNumber: winnerMode === 'manual' ? manualWinningNumber : null,
          entryType,
          entryFee: Number(entryFee),
          startTime: startTime || null,
          endTime: endTime || null,
          registrationDeadline: registrationDeadline || null,
          maxEntriesPerAccount: Number(maxEntriesPerAccount),
          autoSelectWinners,
          autoCreditPrize
        }),
      });

      const data = await res.json();
      if (data.success) {
        showToast(`🎁 Giveaway "${title}" created successfully!`, 'success');
        fetchHistory();
      } else {
        showToast(data.error || 'Failed to create giveaway', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error creating giveaway', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleControlAction = async (action: 'start' | 'pause' | 'resume' | 'draw' | 'cancel' | 'restart') => {
    if (!activeGiveaway) return;
    try {
      const sessionToken = getSessionToken();
      const res = await fetch('/api/giveaway/control', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-session-token': sessionToken,
          'Authorization': sessionToken ? `Bearer ${sessionToken}` : ''
        },
        body: JSON.stringify({
          giveawayId: activeGiveaway.id,
          action,
        }),
      });

      const data = await res.json();
      if (data.success) {
        showToast(`Action "${action.toUpperCase()}" triggered successfully.`, 'success');
        fetchHistory();
      } else {
        showToast(data.error || 'Action failed', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Control action error', 'error');
    }
  };

  const handleExportWinners = () => {
    if (!activeGiveaway || !activeGiveaway.winners || activeGiveaway.winners.length === 0) {
      showToast('No winners found to export', 'error');
      return;
    }

    const lines = [
      'ROY SHARE WALLET - LUCKY NUMBER GIVEAWAY WINNERS',
      `Giveaway Title: ${activeGiveaway.title}`,
      `Date: ${new Date(activeGiveaway.endedAt || Date.now()).toLocaleString()}`,
      `Winning Numbers: ${activeGiveaway.winningNumbers?.join(', ')}`,
      '--------------------------------------------------',
      'Telegram ID,Username,First Name,Selected Number',
    ];

    activeGiveaway.winners.forEach((w: any) => {
      lines.push(`${w.telegramId},${w.username || 'None'},${w.firstName},${w.selectedNumber}`);
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Giveaway_Winners_${activeGiveaway.id}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Winners exported successfully as CSV!', 'success');
  };

  const formatTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6 text-white font-sans animate-fade-in">
      {/* Top Banner Action Hub */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Gift className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <h1 className="text-xl font-black tracking-tight">Lucky Number Giveaway V2</h1>
            </div>
            <p className="text-xs text-slate-400">
              Server-driven, duplicate protected, live drawing with instant wallet reward credits.
            </p>
          </div>
        </div>

        <button
          onClick={fetchHistory}
          className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition flex items-center gap-2 text-xs font-bold"
        >
          <RefreshCw className="w-4 h-4" /> Refresh Lists
        </button>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: Create Giveaway Form (lg:col-span-5) */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800/80">
            <Sliders className="w-5 h-5 text-amber-400" />
            <h2 className="text-md font-bold text-slate-200">Giveaway Parameters</h2>
          </div>

          <form onSubmit={handleCreateGiveaway} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs text-slate-400 font-bold uppercase">Giveaway Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Weekly Golden Drop"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500 font-bold"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-400 font-bold uppercase">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter description..."
                rows={2}
                className="w-full px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500 font-bold resize-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-400 font-bold uppercase">Banner Image URL</label>
              <input
                type="text"
                value={bannerUrl}
                onChange={(e) => setBannerUrl(e.target.value)}
                placeholder="https://example.com/banner.jpg"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500 font-bold"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs text-slate-400 font-bold uppercase">Prize Amount (₹)</label>
                <input
                  type="number"
                  value={prizeAmount}
                  onChange={(e) => {
                    setPrizeAmount(e.target.value);
                    setWalletReward(e.target.value);
                  }}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500 font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-400 font-bold uppercase">Wallet Reward (₹)</label>
                <input
                  type="number"
                  value={walletReward}
                  onChange={(e) => setWalletReward(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500 font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs text-slate-400 font-bold uppercase">Number Range</label>
                <select
                  value={numberRange}
                  onChange={(e) => setNumberRange(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-amber-500 font-bold"
                >
                  <option value="1-6">1 - 6 (Super Fast)</option>
                  <option value="1-10">1 - 10 (Fast)</option>
                  <option value="1-24">1 - 24 (Default)</option>
                  <option value="1-50">1 - 50 (Medium)</option>
                  <option value="1-100">1 - 100 (Grand)</option>
                  <option value="1-500">1 - 500 (Mega)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-400 font-bold uppercase">Max Players</label>
                <input
                  type="number"
                  value={maxPlayers}
                  onChange={(e) => setMaxPlayers(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500 font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs text-slate-400 font-bold uppercase">Timer (Minutes)</label>
                <input
                  type="number"
                  value={entryTimer}
                  onChange={(e) => setEntryTimer(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500 font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-400 font-bold uppercase">Winner Count</label>
                <input
                  type="number"
                  value={winnerCount}
                  onChange={(e) => setWinnerCount(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500 font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs text-slate-400 font-bold uppercase">Entry Fee Type</label>
                <select
                  value={entryType}
                  onChange={(e) => setEntryType(e.target.value as any)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-amber-500 font-bold"
                >
                  <option value="free">Free Entry</option>
                  <option value="coins">Wallet Coins</option>
                  <option value="balance">Wallet Balance</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-400 font-bold uppercase">Entry Fee Amount</label>
                <input
                  type="number"
                  disabled={entryType === 'free'}
                  value={entryFee}
                  onChange={(e) => setEntryFee(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500 font-bold disabled:opacity-40"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs text-slate-400 font-bold uppercase">Max Slots Per Player</label>
                <input
                  type="number"
                  value={maxEntriesPerAccount}
                  onChange={(e) => setMaxEntriesPerAccount(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500 font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-400 font-bold uppercase">Start Mode</label>
                <select
                  value={startMode}
                  onChange={(e) => setStartMode(e.target.value as any)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-amber-500 font-bold"
                >
                  <option value="auto">Auto Start</option>
                  <option value="manual">Manual Start</option>
                  <option value="scheduled">Scheduled Start</option>
                </select>
              </div>
            </div>

            {startMode === 'scheduled' && (
              <div className="space-y-3 p-4 bg-slate-950 rounded-2xl border border-slate-800 animate-fade-in">
                <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider block">📅 Scheduled Timings</span>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-400 font-bold uppercase">Start Date/Time</label>
                    <input
                      type="datetime-local"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-[10px] text-white focus:outline-none focus:border-amber-500 font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-400 font-bold uppercase">End Date/Time</label>
                    <input
                      type="datetime-local"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-[10px] text-white focus:outline-none focus:border-amber-500 font-bold"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-slate-400 font-bold uppercase">Registration Deadline</label>
                  <input
                    type="datetime-local"
                    value={registrationDeadline}
                    onChange={(e) => setRegistrationDeadline(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-[10px] text-white focus:outline-none focus:border-amber-500 font-bold"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2 p-4 bg-slate-950 rounded-2xl border border-slate-800">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">⚙️ Draw Control Preferences</span>
              <div className="flex items-center justify-between py-1">
                <span className="text-xs text-slate-300 font-medium">Auto Draw Winners</span>
                <input
                  type="checkbox"
                  checked={autoSelectWinners}
                  onChange={(e) => setAutoSelectWinners(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-800 bg-slate-950 text-amber-500 focus:ring-amber-500"
                />
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-xs text-slate-300 font-medium">Auto Credit Prize Wallets</span>
                <input
                  type="checkbox"
                  checked={autoCreditPrize}
                  onChange={(e) => setAutoCreditPrize(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-800 bg-slate-950 text-amber-500 focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-400 font-bold uppercase">Winner Mode</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setWinnerMode('fair')}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl transition border ${
                    winnerMode === 'fair'
                      ? 'bg-amber-500 border-amber-500 text-slate-950'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  Fair Random
                </button>
                <button
                  type="button"
                  onClick={() => setWinnerMode('manual')}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl transition border ${
                    winnerMode === 'manual'
                      ? 'bg-amber-500 border-amber-500 text-slate-950'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  Manual
                </button>
                <button
                  type="button"
                  onClick={() => setWinnerMode('ai')}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl transition border ${
                    winnerMode === 'ai'
                      ? 'bg-amber-500 border-amber-500 text-slate-950 animate-pulse'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  🤖 AI Mode
                </button>
              </div>
            </div>

            {winnerMode === 'manual' && (
              <div className="space-y-1 animate-fade-in bg-amber-500/10 border border-amber-500/20 p-3 rounded-2xl">
                <label className="text-xs text-amber-300 font-bold uppercase flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5" /> Manual Winning Numbers
                </label>
                <input
                  type="text"
                  value={manualWinningNumber}
                  onChange={(e) => setManualWinningNumber(e.target.value)}
                  placeholder="e.g. 17 or 17,23"
                  className="w-full px-4 py-2.5 mt-1 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500 font-bold font-mono"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Enter single or multiple comma-separated winning numbers. The system will force matching slots to win.
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black text-xs rounded-xl transition shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Plus className="w-4 h-4" /> Create &amp; Initialize Giveaway
                </>
              )}
            </button>
          </form>
        </div>

        {/* RIGHT COLUMN: Live Dashboard & Controls (lg:col-span-7) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Active Giveaway Section */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-sky-400 animate-pulse" />
                <h2 className="text-md font-bold text-slate-200">Live Active Monitor</h2>
              </div>
              {activeGiveaway && (
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                  activeGiveaway.status === 'active' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                  activeGiveaway.status === 'paused' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold' :
                  activeGiveaway.status === 'drawing' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' :
                  'bg-slate-800 text-slate-400 border border-slate-700'
                }`}>
                  {activeGiveaway.status}
                </span>
              )}
            </div>

            {activeGiveaway ? (
              <div className="space-y-4">
                {/* Details card */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Prize Pool</span>
                    <span className="text-md font-black text-amber-400">₹{activeGiveaway.prizeAmount}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Joined Players</span>
                    <span className="text-md font-black text-sky-400">{entries.length} / {activeGiveaway.maxPlayers}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Time Remaining</span>
                    <span className="text-md font-black text-rose-400 font-mono">
                      {timeLeft !== null ? formatTime(timeLeft) : 'Closed'}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Mode</span>
                    <span className="text-xs font-bold text-slate-300 uppercase">{activeGiveaway.winnerMode}</span>
                  </div>
                </div>

                {/* Giveaway controls */}
                <div className="flex flex-wrap gap-2 pt-2">
                  {activeGiveaway.status === 'draft' && (
                    <button
                      onClick={() => handleControlAction('start')}
                      className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black rounded-xl transition flex items-center gap-1.5"
                    >
                      <Play className="w-3.5 h-3.5" /> Start Now
                    </button>
                  )}

                  {activeGiveaway.status === 'active' && (
                    <button
                      onClick={() => handleControlAction('pause')}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl transition flex items-center gap-1.5"
                    >
                      <Pause className="w-3.5 h-3.5" /> Pause
                    </button>
                  )}

                  {activeGiveaway.status === 'paused' && (
                    <button
                      onClick={() => handleControlAction('resume')}
                      className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black rounded-xl transition flex items-center gap-1.5"
                    >
                      <Play className="w-3.5 h-3.5" /> Resume
                    </button>
                  )}

                  {(activeGiveaway.status === 'active' || activeGiveaway.status === 'paused') && (
                    <button
                      onClick={() => handleControlAction('draw')}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-black rounded-xl transition flex items-center gap-1.5"
                    >
                      <Trophy className="w-3.5 h-3.5" /> Draw Now
                    </button>
                  )}

                  {activeGiveaway.status !== 'completed' && activeGiveaway.status !== 'cancelled' && (
                    <button
                      onClick={() => handleControlAction('cancel')}
                      className="px-4 py-2 bg-rose-500/20 hover:bg-rose-500 text-rose-400 hover:text-slate-950 text-xs font-black rounded-xl transition border border-rose-500/30 flex items-center gap-1.5"
                    >
                      Cancel Giveaway
                    </button>
                  )}

                  {(activeGiveaway.status === 'completed' || activeGiveaway.status === 'cancelled') && (
                    <button
                      onClick={() => handleControlAction('restart')}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-black rounded-xl transition flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Restart Draw
                    </button>
                  )}

                  {activeGiveaway.status === 'completed' && activeGiveaway.winners && (
                    <button
                      onClick={handleExportWinners}
                      className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-black rounded-xl transition flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" /> Export Winners
                    </button>
                  )}
                </div>

                {/* Live Entry Stream */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase">Live Entry List ({entries.length})</span>
                    <span className="text-[10px] text-slate-500 font-bold">Updated Realtime</span>
                  </div>

                  <div className="bg-slate-950 rounded-2xl border border-slate-800/80 max-h-56 overflow-y-auto divide-y divide-slate-900">
                    {entries.length === 0 ? (
                      <div className="p-8 text-center text-xs text-slate-500">
                        Waiting for players to select numbers...
                      </div>
                    ) : (
                      entries.map((entry, idx) => (
                        <div key={idx} className="p-3 flex items-center justify-between text-xs hover:bg-slate-900/50">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-400" />
                            <span className="font-bold text-slate-200">{entry.firstName}</span>
                            {entry.username && (
                              <span className="text-slate-500 text-[10px]">@{entry.username}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="px-2.5 py-1 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20 font-black font-mono">
                              Number: {entry.selectedNumber}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Show winners if drawing or completed */}
                {activeGiveaway.status === 'completed' && activeGiveaway.winners && (
                  <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-2">
                    <h3 className="text-xs font-bold text-emerald-400 uppercase flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" /> Draw Completed Successfully
                    </h3>
                    <p className="text-xs text-slate-300">
                      Winning Numbers: <strong className="text-amber-400 font-mono font-black">{activeGiveaway.winningNumbers?.join(', ')}</strong>
                    </p>
                    <div className="space-y-1.5">
                      <span className="text-[10px] text-slate-400 font-bold block">Winners Ledger Updated:</span>
                      {activeGiveaway.winners.length === 0 ? (
                        <p className="text-xs text-slate-500">No matching user entries found for drawn numbers.</p>
                      ) : (
                        activeGiveaway.winners.map((w: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between text-xs text-slate-200">
                            <span>🏆 {w.firstName} (@{w.username || 'None'})</span>
                            <span className="font-black text-emerald-400">Chosen: {w.selectedNumber} (Credited ₹{activeGiveaway.prizeAmount})</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-2xl">
                No active or recent giveaway loaded. Use the left panel to initialize one.
              </div>
            )}
          </div>

          {/* History / Past Giveaways Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800/80">
              <Calendar className="w-5 h-5 text-slate-400" />
              <h2 className="text-md font-bold text-slate-200">Past Giveaway History ({totalCount})</h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left text-slate-300">
                <thead className="text-[10px] text-slate-500 uppercase font-bold border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Title</th>
                    <th className="py-2.5 px-3">Prize</th>
                    <th className="py-2.5 px-3">Mode</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Winners</th>
                    <th className="py-2.5 px-3">Numbers</th>
                    <th className="py-2.5 px-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">
                        Loading histories...
                      </td>
                    </tr>
                  ) : pastGiveaways.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">
                        No past giveaways on record.
                      </td>
                    </tr>
                  ) : (
                    pastGiveaways.map((g, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/20">
                        <td className="py-3 px-3 font-bold text-white">{g.title}</td>
                        <td className="py-3 px-3 font-black text-amber-400">₹{g.prizeAmount}</td>
                        <td className="py-3 px-3 uppercase text-[10px]">{g.winnerMode}</td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            g.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                          }`}>
                            {g.status}
                          </span>
                        </td>
                        <td className="py-3 px-3">{g.winners?.length || 0} Winners</td>
                        <td className="py-3 px-3 font-mono font-bold text-slate-400">{g.winningNumbers?.join(', ') || '-'}</td>
                        <td className="py-3 px-3">
                          <button
                            onClick={() => handleOpenAuditModal(g)}
                            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold rounded-lg border border-slate-700/60 text-[10px] transition flex items-center gap-1"
                          >
                            🔍 Audit Details
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>

      {/* AUDIT DETAILS LEDGER MODAL */}
      {selectedAuditGiveaway && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl text-white">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
              <div>
                <span className="text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full font-black uppercase tracking-wider block w-fit mb-1">
                  Verified Draw Record
                </span>
                <h3 className="text-md font-black text-white">{selectedAuditGiveaway.title}</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Draw date: {new Date(selectedAuditGiveaway.endedAt || Date.now()).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => setSelectedAuditGiveaway(null)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition font-black"
              >
                ✕ Close
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              
              {/* Summary Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800/80">
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Jackpot Pool</span>
                  <span className="text-sm font-black text-amber-400">₹{selectedAuditGiveaway.prizeAmount}</span>
                </div>
                <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800/80">
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Winner slots</span>
                  <span className="text-sm font-black text-sky-400">{selectedAuditGiveaway.winnerCount || 1} slots</span>
                </div>
                <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800/80">
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Total players</span>
                  <span className="text-sm font-black text-white">{auditEntries.length} players</span>
                </div>
                <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800/80">
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Selection Mode</span>
                  <span className="text-sm font-black text-slate-300 uppercase">{selectedAuditGiveaway.winnerMode || 'fair'}</span>
                </div>
              </div>

              {/* Provably Fair Block */}
              {selectedAuditGiveaway.drawSeed && (
                <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2 text-white">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                      🛡️ Provably Fair Draw Cryptographic Proof
                    </h4>
                    <span className="text-[8px] bg-slate-800 text-slate-400 font-mono px-2 py-0.5 rounded border border-slate-700">SHA256 SIGNED</span>
                  </div>
                  <div className="text-[9px] font-mono space-y-1 text-slate-400 divide-y divide-slate-900">
                    <div className="py-1 flex justify-between gap-4">
                      <span className="text-slate-500">DRAW ID:</span>
                      <span className="text-slate-200 select-all">{selectedAuditGiveaway.drawId}</span>
                    </div>
                    <div className="py-1 flex justify-between gap-4">
                      <span className="text-slate-500">SECRET SEED:</span>
                      <span className="text-slate-200 select-all truncate max-w-[400px]">{selectedAuditGiveaway.drawSeed}</span>
                    </div>
                    <div className="py-1 flex justify-between gap-4 text-left">
                      <span className="text-slate-500">WINNING HASH:</span>
                      <span className="text-slate-200 select-all truncate max-w-[400px]">{selectedAuditGiveaway.winnerHash}</span>
                    </div>
                    <div className="py-1 flex justify-between gap-4">
                      <span className="text-slate-500">Drawn Numbers:</span>
                      <span className="text-amber-400 font-black tracking-widest">{selectedAuditGiveaway.winningNumbers?.join(', ') || '-'}</span>
                    </div>
                  </div>
                  <p className="text-[8px] text-slate-500 leading-normal">
                    Provably Fair mechanism verification: The server generates a random 16-byte cryptographically secure seed. The seed and winning numbers are hashed using SHA-256 before the draw completes. To verify, concatenate seed and winning numbers separated by hyphen (e.g. `seed-1,12`) and hash with any SHA-256 tool.
                  </p>
                </div>
              )}

              {/* Action Buttons for download / print */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handlePrintAudit(selectedAuditGiveaway, auditEntries)}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl transition flex items-center gap-1.5 shadow-md shadow-amber-500/10"
                >
                  <Download className="w-4 h-4" /> Print Report / Save as PDF
                </button>
                <button
                  onClick={() => handleExportAuditCSV(selectedAuditGiveaway, auditEntries)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition flex items-center gap-1.5 border border-slate-700"
                >
                  <Download className="w-4 h-4" /> Export CSV (Full Ledger)
                </button>
              </div>

              {/* Winners section with ledger receipts */}
              <div className="space-y-2">
                <h4 className="text-xs font-black text-slate-300 uppercase tracking-wider">
                  🎉 Winners &amp; Wallet Transfer Ledger Receipts
                </h4>
                <div className="space-y-1.5">
                  {selectedAuditGiveaway.winners && selectedAuditGiveaway.winners.length > 0 ? (
                    selectedAuditGiveaway.winners.map((w: any, idx: number) => (
                      <div key={idx} className="p-3 bg-emerald-500/5 rounded-xl border border-emerald-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-white">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                          <span className="text-xs font-black text-slate-200">{w.firstName}</span>
                          {w.username && (
                            <span className="text-[10px] text-slate-500">@{w.username}</span>
                          )}
                          <span className="text-[10px] text-slate-400">({w.telegramId})</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-black text-amber-400">Slot Chosen: {w.selectedNumber}</span>
                          {w.transactionId && (
                            <span className="text-[8px] font-mono font-bold bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 rounded text-sky-400">
                              TXN ID: {w.transactionId}
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-[10px] text-slate-600 font-semibold bg-slate-950/10 border border-slate-800 rounded-xl">
                      No matching user slots for this drawing. Roll-over occurred.
                    </div>
                  )}
                </div>
              </div>

              {/* Search Player Ledger */}
              <div className="space-y-3 pt-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-slate-800/80 pt-4">
                  <h4 className="text-xs font-black text-slate-300 uppercase tracking-wider">
                    📋 Full Player Entrant Grid ({auditEntries.length} slots)
                  </h4>
                  <div className="relative w-full sm:max-w-xs">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Search player name or selected slot..."
                      value={auditSearchQuery}
                      onChange={(e) => setAuditSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-semibold text-white bg-slate-950"
                    />
                  </div>
                </div>

                {auditLoading ? (
                  <div className="p-12 text-center text-xs text-slate-500">
                    Loading participants database...
                  </div>
                ) : (
                  <div className="bg-slate-950 rounded-2xl border border-slate-800 max-h-64 overflow-y-auto divide-y divide-slate-900 text-white">
                    {(() => {
                      const filtered = auditEntries.filter(e => {
                        const qLower = auditSearchQuery.toLowerCase();
                        return (
                          e.firstName?.toLowerCase().includes(qLower) ||
                          e.username?.toLowerCase().includes(qLower) ||
                          String(e.selectedNumber).includes(qLower) ||
                          String(e.telegramId).includes(qLower)
                        );
                      });

                      if (filtered.length === 0) {
                        return (
                          <div className="p-8 text-center text-xs text-slate-500">
                            No entrants matching "{auditSearchQuery}"
                          </div>
                        );
                      }

                      return filtered.map((e, idx) => {
                        const isWinner = selectedAuditGiveaway.winners?.some((w: any) => String(w.telegramId) === String(e.telegramId));
                        return (
                          <div key={idx} className="p-3 flex items-center justify-between text-xs hover:bg-slate-900/40 text-white">
                            <div className="flex items-center gap-2">
                              <span className={`w-1.5 h-1.5 rounded-full ${isWinner ? 'bg-amber-400' : 'bg-slate-600'}`} />
                              <span className="font-bold text-slate-300">{e.firstName}</span>
                              {e.username && (
                                <span className="text-[10px] text-slate-500">@{e.username}</span>
                              )}
                              <span className="text-[10px] text-slate-600">({e.telegramId})</span>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className={`px-2 py-0.5 rounded-lg text-xs font-mono font-black border ${
                                isWinner
                                  ? 'bg-amber-400/10 text-amber-400 border-amber-400/20'
                                  : 'bg-slate-900 text-slate-400 border-slate-800/80'
                              }`}>
                                Slot: {e.selectedNumber}
                              </span>
                              <span className={`text-[10px] font-black ${isWinner ? 'text-amber-400 font-black' : 'text-slate-500'}`}>
                                {isWinner ? 'Winner 🏆' : 'No Match'}
                              </span>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
};
