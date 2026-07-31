import React, { useState, useEffect } from 'react';
import { 
  Trophy, 
  User, 
  Calendar, 
  FileText, 
  Upload, 
  CheckCircle, 
  AlertTriangle, 
  Loader2, 
  X, 
  ChevronLeft,
  Share2
} from 'lucide-react';
import { getContests, saveContestant } from '../services/contestService';
import { Contest } from '../types';

interface ContestRegistrationViewProps {
  contestId: string;
  botUsername?: string;
}

export const ContestRegistrationView: React.FC<ContestRegistrationViewProps> = ({
  contestId,
  botUsername = 'RoyShareWalletBot',
}) => {
  const [contest, setContest] = useState<Contest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [telegramId, setTelegramId] = useState('');
  const [username, setUsername] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [registeredContestantId, setRegisteredContestantId] = useState('');

  useEffect(() => {
    // 1. Fetch contest details
    const fetchContestDetails = async () => {
      try {
        setIsLoading(true);
        const contestsList = await getContests();
        const found = contestsList.find(c => c.id === contestId);
        
        if (!found) {
          setError('Contest not found. Please double-check the URL.');
          return;
        }

        setContest(found);

        // 2. Pre-populate Telegram WebApp info if available
        const tg = (window as any).Telegram;
        const tgUser = tg?.WebApp?.initDataUnsafe?.user;
        if (tgUser) {
          const fullName = `${tgUser.first_name || ''} ${tgUser.last_name || ''}`.trim();
          setName(fullName);
          setTelegramId(tgUser.id ? tgUser.id.toString() : '');
          setUsername(tgUser.username ? `@${tgUser.username}` : '');
        }
      } catch (err) {
        console.error('Error fetching contest details:', err);
        setError('Failed to load contest details.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchContestDetails();
  }, [contestId]);

  // Handle Drag Events for File Upload
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setImageError('Please upload an image file (PNG/JPG/WEBP).');
      return;
    }
    // Limit to 150KB for Base64 storage in firestore
    if (file.size > 150 * 1024) {
      setImageError('Please select a smaller image (under 150KB) to ensure quick loading.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setImageUrl(reader.result as string);
      setImageError(null);
    };
    reader.onerror = () => {
      setImageError('Failed to read image file.');
    };
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    setImageUrl('');
    setImageError(null);
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contest) return;

    if (!name.trim()) {
      setImageError('Full Name is required.');
      return;
    }

    if (!telegramId.trim()) {
      setImageError('Telegram Chat ID is required so we can send your voting link.');
      return;
    }

    setIsSubmitting(true);
    setImageError(null);

    try {
      const cleanUsername = username.trim().startsWith('@') ? username.trim() : username.trim() ? `@${username.trim()}` : '';

      const contestantId = await saveContestant({
        contestId: contest.id,
        contestTitle: contest.title,
        name: name.trim(),
        telegramId: telegramId.trim(),
        username: cleanUsername,
        description: description.trim(),
        imageUrl: imageUrl,
        votesCount: 0,
        status: 'pending', // Requirement 3: Every participant goes into "Pending Approval"
        createdAt: new Date().toISOString()
      });

      setRegisteredContestantId(contestantId);
      setIsSuccess(true);
    } catch (err: any) {
      console.error('Error registering contestant:', err);
      setImageError(err.message || 'Failed to submit registration. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeWebApp = () => {
    const tg = (window as any).Telegram;
    if (tg?.WebApp?.close) {
      try {
        tg.WebApp.close();
      } catch (e) {
        window.location.href = `https://t.me/${botUsername}`;
      }
    } else {
      window.location.href = `https://t.me/${botUsername}`;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 font-sans">
        <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 mb-4">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
        <p className="text-sm font-medium text-slate-400">Loading Contest Registration...</p>
      </div>
    );
  }

  if (error || !contest) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 font-sans">
        <div className="w-16 h-16 rounded-3xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mb-6">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-200 mb-2">Registration Unavailable</h2>
        <p className="text-sm text-slate-400 text-center max-w-sm mb-6">{error || 'Unable to retrieve contest information.'}</p>
        <button
          onClick={closeWebApp}
          className="px-6 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold hover:bg-slate-850 text-slate-300 transition-all cursor-pointer"
        >
          Return to Telegram Bot
        </button>
      </div>
    );
  }

  // Check scheduling
  const now = new Date();
  const regStartDate = contest.registrationStartDate
    ? new Date(contest.registrationStartDate + (contest.registrationStartDate.includes('T') ? '' : 'T00:00:00'))
    : null;

  const isBeforeReg = regStartDate ? now < regStartDate : false;
  const isRegClosed = contest.registrationClosedProcessed || contest.votingStarted || contest.status === 'completed' || contest.status === 'paused';

  let scheduleMessage = '';
  if (isBeforeReg && regStartDate) {
    scheduleMessage = `Registration opens on ${regStartDate.toLocaleDateString()} at ${regStartDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`;
  } else if (isRegClosed) {
    if (contest.status === 'paused') {
      scheduleMessage = 'This contest is temporarily paused by the moderator.';
    } else if (contest.status === 'completed') {
      scheduleMessage = 'This contest has already completed.';
    } else {
      scheduleMessage = 'Registration for this contest is now closed by the moderator.';
    }
  }

  if (isRegClosed || isBeforeReg) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-sky-600/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-2xl relative z-10 text-center space-y-6">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Trophy className="w-8 h-8" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-xl font-bold text-slate-200">{contest.title}</h1>
            <p className="text-xs text-slate-450 uppercase font-bold tracking-wider">Registration Status</p>
          </div>
          
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-850 space-y-1.5">
            <p className="text-xs font-semibold text-amber-400">Registration is Not Open</p>
            <p className="text-xs text-slate-400">{scheduleMessage}</p>
          </div>

          <button
            onClick={closeWebApp}
            className="w-full py-3 rounded-xl bg-slate-950 border border-slate-800 text-xs font-semibold text-slate-300 hover:bg-slate-850 transition-all cursor-pointer"
          >
            Back to Telegram
          </button>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="w-full max-w-md bg-slate-900/90 border border-emerald-500/20 rounded-3xl p-6 shadow-[0_0_30px_rgba(16,185,129,0.05)] relative z-10 text-center space-y-6">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 animate-bounce">
            <CheckCircle className="w-8 h-8" />
          </div>

          <div className="space-y-1.5">
            <h2 className="text-xl font-bold text-slate-200">Registration Submitted!</h2>
            <p className="text-xs text-amber-400 font-semibold">⏳ Status: Pending Admin Approval</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-850 space-y-3 text-left">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Contestant Name</span>
              <p className="text-xs font-semibold text-slate-200">{name}</p>
            </div>
            
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Telegram Info</span>
              <p className="text-xs font-semibold text-slate-300">{username || 'No Username'} ({telegramId})</p>
            </div>

            <div className="pt-2 border-t border-slate-900 text-xs text-slate-400 space-y-2">
              <p>🏁 <b>What happens next?</b></p>
              <p>1. The admin will review your registration details.</p>
              <p>2. Once approved and the admin starts voting, your unique voting link will be generated and sent directly to you via the Telegram bot.</p>
              <p>3. You can then share your personal link to collect votes! 🚀</p>
            </div>
          </div>

          <button
            onClick={closeWebApp}
            className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-bold transition-all shadow-lg cursor-pointer"
          >
            Close Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center p-4 sm:p-6 font-sans relative overflow-hidden">
      {/* Background Lights */}
      <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-sky-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-lg bg-slate-900/80 border border-slate-800/80 backdrop-blur-xl rounded-3xl shadow-2xl relative z-10 overflow-hidden">
        {/* Top visual accent */}
        <div className="h-1.5 bg-gradient-to-r from-sky-500 to-indigo-500 w-full" />

        {/* Content area */}
        <div className="p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between">
            <button
              onClick={closeWebApp}
              className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-slate-450 hover:text-slate-300 transition-colors font-bold"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Back
            </button>
            <span className="px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider bg-sky-500/10 text-sky-400 border border-sky-500/20">
              Registration Open
            </span>
          </div>

          <div className="space-y-2 text-center">
            <div className="mx-auto w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 mb-2">
              <Trophy className="w-6 h-6" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">{contest.title}</h1>
            {contest.description && (
              <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto">{contest.description}</p>
            )}
          </div>

          {/* Quick Schedule/Rules Box */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-950 border border-slate-850">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-slate-450">
                <Calendar className="w-3.5 h-3.5 text-sky-500" />
                <span className="text-[9px] font-bold uppercase tracking-wider">Registration Closes</span>
              </div>
              <p className="text-xs font-semibold text-slate-200">
                {regEndDate ? regEndDate.toLocaleDateString() : 'N/A'} at {regEndDate ? regEndDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
              </p>
            </div>

            {contest.rules && (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-slate-450">
                  <FileText className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="text-[9px] font-bold uppercase tracking-wider">Contest Rules</span>
                </div>
                <p className="text-xs text-slate-300 line-clamp-2">{contest.rules}</p>
              </div>
            )}
          </div>

          <form onSubmit={handleRegisterSubmit} className="space-y-5">
            {/* Name Input */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-550" />
                <input
                  type="text"
                  required
                  placeholder="Enter your registration name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-sky-500 placeholder:text-slate-650 transition-all"
                />
              </div>
            </div>

            {/* Telegram Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Telegram ID</label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 129384759"
                  value={telegramId}
                  onChange={e => setTelegramId(e.target.value)}
                  className="w-full px-4 py-2.5 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-sky-500 placeholder:text-slate-650 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Telegram Username (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. @yourusername"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="w-full px-4 py-2.5 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-sky-500 placeholder:text-slate-650 transition-all"
                />
              </div>
            </div>

            {/* Bio/Description */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">About Yourself / Entry Pitch (Optional)</label>
              <textarea
                rows={2}
                placeholder="Brief description about your entry or pitch..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="w-full px-4 py-2.5 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-sky-500 placeholder:text-slate-650 transition-all resize-none"
              />
            </div>

            {/* Photo Upload with Drag & Drop */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Contestant Photo / Avatar (Optional)</label>
              
              {!imageUrl ? (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer flex flex-col items-center justify-center space-y-2 ${
                    isDragging 
                      ? 'border-sky-500 bg-sky-500/5' 
                      : 'border-slate-800 bg-slate-950/50 hover:border-slate-750'
                  }`}
                  onClick={() => document.getElementById('avatar-upload')?.click()}
                >
                  <input
                    type="file"
                    id="avatar-upload"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <Upload className="w-6 h-6 text-slate-550" />
                  <p className="text-xs font-semibold text-slate-350">
                    Drag & Drop your photo here, or <span className="text-sky-400">Browse</span>
                  </p>
                  <p className="text-[10px] text-slate-500">Supports JPG, PNG, WEBP (Max: 150KB)</p>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-850 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img
                      src={imageUrl}
                      alt="Contestant Preview"
                      referrerPolicy="no-referrer"
                      className="w-10 h-10 rounded-xl object-cover border border-slate-800"
                    />
                    <div>
                      <p className="text-xs font-semibold text-slate-250">Photo uploaded successfully</p>
                      <p className="text-[10px] text-slate-500">Will be displayed on your contestant profile</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={clearImage}
                    className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-red-400 hover:border-red-500/20 transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {imageError && (
              <p className="text-xs text-red-400 bg-red-500/5 border border-red-500/10 rounded-xl p-3 flex items-start gap-1.5">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                {imageError}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 rounded-xl bg-sky-500 hover:bg-sky-600 disabled:bg-sky-500/50 text-slate-950 text-xs font-bold transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Registering Entry...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Register for Contest
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
