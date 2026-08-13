import React, { useState, useEffect, useRef } from 'react';
import { doc, onSnapshot, collection, query, where, runTransaction, addDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import {
  Wallet,
  Users,
  CheckSquare,
  Gift,
  ArrowUpRight,
  TrendingUp,
  Award,
  ShieldCheck,
  User,
  ExternalLink,
  ChevronRight,
  Copy,
  Check,
  AlertTriangle,
  RefreshCw,
  Send,
  Timer,
  Key,
  ArrowRight,
  Bot,
  Upload,
  Image as ImageIcon,
  FileText,
  Phone,
  Clock,
  XCircle,
  CheckCircle2,
  X
} from 'lucide-react';
import { generateDeviceFingerprint } from '../utils/fingerprint';

interface UserAppViewProps {
  botUsername: string;
}

export const UserAppView: React.FC<UserAppViewProps> = ({ botUsername }) => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'wallet' | 'referral' | 'tasks' | 'giveaways' | 'withdraw' | 'profile'>('wallet');
  const [copied, setCopied] = useState(false);
  const [toasts, setToasts] = useState<Array<{ id: string; text: string; type: 'success' | 'error' | 'info' }>>([]);

  // ==========================================
  // REALTIME LUCKY NUMBER GIVEAWAY CLIENT V2.1
  // ==========================================
  const [activeGiveaway, setActiveGiveaway] = useState<any>(null);
  const [giveawayEntries, setGiveawayEntries] = useState<any[]>([]);
  const [giveawayLoading, setGiveawayLoading] = useState(true);
  const [joiningGiveaway, setJoiningGiveaway] = useState(false);
  const [chosenNumber, setChosenNumber] = useState<number | null>(null);
  const [userJoinedNumber, setUserJoinedNumber] = useState<number | null>(null);
  const [userJoinedNumbers, setUserJoinedNumbers] = useState<number[]>([]);
  const [rollingNumber, setRollingNumber] = useState<number | null>(null);
  const [animatingDraw, setAnimatingDraw] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

  // Casino Multiple Reel States
  const [reelValues, setReelValues] = useState<number[]>([]);
  const [reelsRevealed, setReelsRevealed] = useState<boolean[]>([]);

  // User Joined Histories
  const [myEntries, setMyEntries] = useState<any[]>([]);
  const [pastGiveaways, setPastGiveaways] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  // Earning Bot Scoping & Config State
  const [earningBotId, setEarningBotId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    const tgWebApp = (window as any).Telegram?.WebApp;
    const tgStartParam = tgWebApp?.initDataUnsafe?.start_param || '';
    const startAppParam = params.get('startapp') || params.get('tgWebAppStartParam') || params.get('start') || tgStartParam || '';
    const botIdFromUrl = params.get('botId') || '';

    if (botIdFromUrl) return botIdFromUrl;
    if (startAppParam.startsWith('earning_')) {
      const parts = startAppParam.split('_');
      return parts[1] || null;
    }
    return null;
  });

  const [earningBotConfig, setEarningBotConfig] = useState<any | null>(null);

  useEffect(() => {
    if (!earningBotId) return;
    fetch(`/api/earning-bots/config/${earningBotId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.config) {
          setEarningBotConfig(data.config);
        }
      })
      .catch((err) => console.error('Error fetching Earning Bot Config:', err));
  }, [earningBotId]);

  // Earning Bot Referral Statistics
  const [earningBotRefStats, setEarningBotRefStats] = useState<{
    total: number;
    valid: number;
    pending: number;
    rejected: number;
    availableEarnings: number;
    pendingEarnings: number;
    referralReward: number;
  } | null>(null);

  useEffect(() => {
    if (activeTab === 'referral' && earningBotId) {
      const tgId = getTelegramUserId();
      fetch(`/api/earning-bots/referral-stats?botId=${earningBotId}&tgId=${tgId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.stats) {
            setEarningBotRefStats(data.stats);
          }
        })
        .catch((err) => console.error('Error fetching earning bot referral stats:', err));
    }
  }, [activeTab, earningBotId]);

  // Form State for Withdrawals
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawMethod, setWithdrawMethod] = useState<'upi' | 'qr' | 'redeem_code' | 'ultra_pay'>('upi');
  const [withdrawDetails, setWithdrawDetails] = useState('');
  const [withdrawHistory, setWithdrawHistory] = useState<any[]>([]);
  const [isSubmittingWithdrawal, setIsSubmittingWithdrawal] = useState(false);
  const [withdrawalSettings, setWithdrawalSettings] = useState<any>(null);

  // Registration V2 States
  const [isRegistered, setIsRegistered] = useState<boolean>(false);
  const [registrationState, setRegistrationState] = useState<'LOADING' | 'UNREGISTERED' | 'PROFILE_SUBMITTED' | 'CONTACT_VERIFIED' | 'OTP_PENDING' | 'PENDING_SECURITY_REVIEW' | 'REJECTED' | 'ACTIVE' | 'BANNED' | 'INVALID_SESSION'>('LOADING');
  const [regStep, setRegStep] = useState<'DETAILS' | 'PENDING_CONTACT' | 'OTP'>('DETAILS');
  const [fullName, setFullName] = useState<string>('');
  const [mobile, setMobile] = useState<string>('');
  const [gmail, setGmail] = useState<string>('');
  const [otpInput, setOtpInput] = useState<string>('');
  const [isSubmittingReg, setIsSubmittingReg] = useState<boolean>(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [otpSuccessMsg, setOtpSuccessMsg] = useState<string | null>(null);

  // Dynamic Tasks, Milestones & Manual Proof Submissions States
  const [tasks, setTasks] = useState<any[]>([]);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [userManualSubmissions, setUserManualSubmissions] = useState<any[]>([]);
  const [activeProofTask, setActiveProofTask] = useState<any | null>(null);
  const [proofMobile, setProofMobile] = useState('');
  const [proofImageBase64, setProofImageBase64] = useState('');
  const [isSubmittingProof, setIsSubmittingProof] = useState(false);
  const [proofError, setProofError] = useState<string | null>(null);
  const [showDemoImageModal, setShowDemoImageModal] = useState(false);

  const generateDeviceFingerprint = async (): Promise<string> => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const txt = 'RoyShareWallet_Fingerprint_2026';
      if (ctx) {
        ctx.textBaseline = 'top';
        ctx.font = "14px 'Arial'";
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = '#f60';
        ctx.fillRect(125, 1, 62, 20);
        ctx.fillStyle = '#069';
        ctx.fillText(txt, 2, 15);
        ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
        ctx.fillText(txt, 4, 17);
      }
      const canvasData = canvas.toDataURL();

      let glRenderer = '';
      const glCanvas = document.createElement('canvas');
      const gl = glCanvas.getContext('webgl') || glCanvas.getContext('experimental-webgl');
      if (gl) {
        const debugInfo = (gl as any).getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
          glRenderer = (gl as any).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '';
        }
      }

      const rawFP = [
        navigator.userAgent,
        navigator.language,
        navigator.platform,
        screen.width + 'x' + screen.height + 'x' + screen.colorDepth,
        new Date().getTimezoneOffset(),
        canvasData,
        glRenderer
      ].join('||');

      const msgUint8 = new TextEncoder().encode(rawFP);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      return `fp_fallback_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }
  };

  const handleInitiateRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);

    if (!fullName.trim() || fullName.trim().length < 2) {
      setRegError('Please enter a valid Full Name (minimum 2 characters).');
      return;
    }

    const cleanMobile = mobile.replace(/\D/g, '');
    if (!/^[6-9]\d{9}$/.test(cleanMobile)) {
      setRegError('Please enter a valid 10-digit Indian mobile number starting with 6-9.');
      return;
    }

    const cleanGmail = gmail.trim().toLowerCase();
    if (!cleanGmail || !/^[^\s@]+@gmail\.com$/i.test(cleanGmail)) {
      setRegError('Please enter a valid Gmail address (ending in @gmail.com).');
      return;
    }

    setIsSubmittingReg(true);
    try {
      const tgId = getTelegramUserId();
      const tgUsername = (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.username || '';
      const fp = await generateDeviceFingerprint();

      const res = await fetch('/api/register/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramId: tgId,
          username: tgUsername,
          fullName: fullName.trim(),
          mobile: cleanMobile,
          gmail: cleanGmail,
          deviceFingerprint: fp
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setRegError(data.error || 'Registration failed. Please check your details.');
        setIsSubmittingReg(false);
        return;
      }

      setOtpSuccessMsg('📱 Mobile Verification sent to Telegram Chat!\n\nPlease open your Telegram Bot chat and tap "📱 Share Contact" to verify your number. Your 6-digit OTP will then appear in the chat.');
      setRegStep('OTP');
    } catch (err: any) {
      setRegError(err.message || 'Network error occurred. Please try again.');
    } finally {
      setIsSubmittingReg(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);

    const cleanOtp = otpInput.trim();
    if (!/^\d{6}$/.test(cleanOtp)) {
      setRegError('Please enter a valid 6-digit OTP code.');
      return;
    }

    setIsSubmittingReg(true);
    try {
      const tgId = getTelegramUserId();
      const tgUsername = (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.username || '';
      const fp = await generateDeviceFingerprint();

      const res = await fetch('/api/register/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramId: tgId,
          username: tgUsername,
          fullName: fullName.trim(),
          mobile: mobile.replace(/\D/g, ''),
          gmail: gmail.trim().toLowerCase(),
          otp: cleanOtp,
          deviceFingerprint: fp
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setRegError(data.error || 'OTP verification failed. Please try again.');
        setIsSubmittingReg(false);
        return;
      }

      if (data.user) {
        setUser(data.user);
        setIsRegistered(true);
      }
    } catch (err: any) {
      setRegError(err.message || 'OTP verification failed.');
    } finally {
      setIsSubmittingReg(false);
    }
  };

  const handleRegisterEarningBotUser = async () => {
    if (!earningBotId) return;
    setIsSubmittingReg(true);
    setRegError(null);
    try {
      const tg = (window as any).Telegram?.WebApp;
      const initData = tg?.initData || '';
      const tgId = getTelegramUserId();

      let fpHash = localStorage.getItem('roy_device_fp') || '';
      try {
        const fpData: any = await generateDeviceFingerprint();
        fpHash = typeof fpData === 'string' ? fpData : (fpData?.hash || fpHash);
      } catch (e) {
        console.warn('Fingerprint generation notice:', e);
      }
      if (!fpHash) {
        fpHash = `fp_${tgId}_${Date.now()}`;
      }

      const res = await fetch('/api/earning-bots/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botId: earningBotId,
          initData,
          telegramId: tgId,
          firstName: tg?.initDataUnsafe?.user?.first_name || 'User',
          username: tg?.initDataUnsafe?.user?.username || '',
          deviceFingerprint: fpHash
        })
      });

      const data = await res.json();
      if (data.success && data.user) {
        if (data.isDuplicate) {
          showToast('⚠️ Multi-account detected. Account active, but referral reward is rejected.', 'info');
        } else {
          showToast(`🎉 Welcome to ${earningBotConfig?.botName || 'Earning Bot'}! Account activated!`, 'success');
        }
        setUser({
          ...data.user,
          userName: data.user.firstName || data.user.username || `User #${tgId}`,
          avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${tgId}`,
          walletBalance: Number(data.user.walletBalance) || 0,
        });
        setIsRegistered(true);
        setRegistrationState('ACTIVE');

        // Automatically inform Telegram WebApp if supported
        if (tg && typeof tg.close === 'function') {
          setTimeout(() => {
            try { tg.close(); } catch (e) {}
          }, 2000);
        }
      } else {
        setRegError(data.error || 'Failed to activate account.');
      }
    } catch (err: any) {
      setRegError(err.message || 'An error occurred during account activation.');
    } finally {
      setIsSubmittingReg(false);
    }
  };

  const [otpCode, setOtpCode] = useState<string>('');
  const [otpExpiryTimer, setOtpExpiryTimer] = useState<number>(0);
  const [isGeneratingOtp, setIsGeneratingOtp] = useState(false);
  const [showOtpCard, setShowOtpCard] = useState(false);
  const [copiedOtp, setCopiedOtp] = useState(false);

  const addToast = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const handleGenerateOtp = async () => {
    try {
      setIsGeneratingOtp(true);
      const tgId = getTelegramUserId();
      const res = await fetch('/api/otp/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramId: tgId })
      });
      const data = await res.json();
      if (data.success && data.otp) {
        setOtpCode(data.otp);
        setOtpExpiryTimer(data.expirySeconds || 120);
        setShowOtpCard(true);
        addToast('🔐 OTP Generated! Copy and paste code in Telegram Bot.', 'success');
      } else {
        addToast(data.error || 'Failed to generate OTP code.', 'error');
      }
    } catch (err: any) {
      addToast('Network error generating OTP code.', 'error');
    } finally {
      setIsGeneratingOtp(false);
    }
  };

  // OTP Countdown Timer
  useEffect(() => {
    if (otpExpiryTimer <= 0) return;
    const interval = setInterval(() => {
      setOtpExpiryTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [otpExpiryTimer]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const copyOtpToClipboard = () => {
    if (!otpCode) return;
    navigator.clipboard.writeText(otpCode);
    setCopiedOtp(true);
    setTimeout(() => setCopiedOtp(false), 3000);
    addToast('📋 OTP copied! Paste in Telegram Bot chat to complete verification.', 'success');
  };

  // Auto-trigger OTP generation if URL search params include action=otp_verify
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') === 'otp_verify' || params.has('otp')) {
      handleGenerateOtp();
    }
  }, []);

  // Pure Web Audio Synth Sound Engine (No files or assets needed)
  const playAudio = (type: 'tick' | 'reveal' | 'win' | 'countdown') => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      
      if (type === 'tick') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.04);
      } else if (type === 'reveal') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        osc.frequency.exponentialRampToValueAtTime(1046.50, ctx.currentTime + 0.15); // C6
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
      } else if (type === 'win') {
        const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08);
          gain.gain.setValueAtTime(0.06, ctx.currentTime + idx * 0.08);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.08 + 0.25);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + idx * 0.08);
          osc.stop(ctx.currentTime + idx * 0.08 + 0.25);
        });
      } else if (type === 'countdown') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
      }
    } catch (e) {
      console.warn('[Audio Synth Info] Web Audio API blocked or failed:', e);
    }
  };

  // High Performance Canvas Physics Confetti
  const triggerConfetti = (canvasId: string) => {
    try {
      const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = canvas.parentElement?.clientWidth || 300;
      canvas.height = canvas.parentElement?.clientHeight || 200;

      const colors = ['#f59e0b', '#ec4899', '#10b981', '#3b82f6', '#facc15', '#a855f7'];
      const particles: any[] = [];

      for (let i = 0; i < 70; i++) {
        particles.push({
          x: canvas.width / 2,
          y: canvas.height - 10,
          vx: (Math.random() - 0.5) * 10,
          vy: -Math.random() * 8 - 5,
          size: Math.random() * 5 + 3,
          color: colors[Math.floor(Math.random() * colors.length)],
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 0.25,
          opacity: 1,
          decay: Math.random() * 0.015 + 0.01
        });
      }

      const anim = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let active = false;

        particles.forEach(p => {
          if (p.opacity <= 0) return;
          active = true;

          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.25; // gravity
          p.rotation += p.rotationSpeed;
          p.opacity -= p.decay;

          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.opacity;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
          ctx.restore();
        });

        if (active) {
          requestAnimationFrame(anim);
        } else {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      };

      anim();
    } catch (e) {
      console.warn('Confetti trigger issue:', e);
    }
  };

  // Real-time Firestore Subscriptions
  useEffect(() => {
    // 1. Listen to active giveaway
    const activeRef = doc(db, 'giveaways', 'active');
    const unsubscribeActive = onSnapshot(activeRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setActiveGiveaway(data);

        if (data.status === 'active' && data.expiresAt) {
          const diff = Math.max(0, Math.floor((data.expiresAt - Date.now()) / 1000));
          setTimeRemaining(diff);
        } else if (data.status === 'paused') {
          setTimeRemaining(data.remainingSecondsAtPause || 0);
        } else {
          setTimeRemaining(null);
        }

        if (data.status === 'drawing' && !animatingDraw) {
          triggerDrawingAnimation(data);
        }
      } else {
        setActiveGiveaway(null);
        setTimeRemaining(null);
      }
      setGiveawayLoading(false);
    }, (err) => {
      console.error('Error in live active giveaway listener:', err);
      setGiveawayLoading(false);
    });

    // 2. Load past giveaways once
    const fetchHistory = async () => {
      try {
        const res = await fetch('/api/giveaway/history');
        const data = await res.json();
        if (data.success) {
          setPastGiveaways(data.history || []);
        }
      } catch (e) {
        console.error('Error fetching past giveaways list:', e);
      } finally {
        setHistoryLoading(false);
      }
    };
    fetchHistory();

    return () => {
      unsubscribeActive();
    };
  }, [animatingDraw]);

  // Sync entries for active giveaway in real-time
  useEffect(() => {
    if (!activeGiveaway) {
      setGiveawayEntries([]);
      setUserJoinedNumber(null);
      setUserJoinedNumbers([]);
      return;
    }

    const entriesCol = collection(db, 'entries');
    const q = query(entriesCol, where('giveawayId', '==', activeGiveaway.id));
    const unsubscribeEntries = onSnapshot(q, (snapshot) => {
      const allEntries: any[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        if (data.selectedNumber !== undefined) {
          allEntries.push(data);
        }
      });
      setGiveawayEntries(allEntries);

      const tgId = getTelegramUserId();
      const myEntriesList = allEntries.filter((e: any) => String(e.telegramId) === tgId);
      const mySelectedNumbers = myEntriesList.map((e: any) => Number(e.selectedNumber));
      setUserJoinedNumbers(mySelectedNumbers);
      if (mySelectedNumbers.length > 0) {
        setUserJoinedNumber(mySelectedNumbers[0]);
        setChosenNumber(mySelectedNumbers[mySelectedNumbers.length - 1]);
      } else {
        setUserJoinedNumber(null);
      }
    }, (err) => {
      console.error('Error syncing live entries:', err);
    });

    return () => {
      unsubscribeEntries();
    };
  }, [activeGiveaway?.id]);

  // Sync user's entry list for past giveaways
  useEffect(() => {
    const tgId = getTelegramUserId();
    if (!tgId) return;

    const entriesCol = collection(db, 'entries');
    const q = query(entriesCol, where('telegramId', '==', tgId));
    const unsubscribeMyEntries = onSnapshot(q, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach(d => list.push(d.data()));
      setMyEntries(list);
    }, (e) => {
      console.error('Error listing user past entries:', e);
    });

    return () => {
      unsubscribeMyEntries();
    };
  }, [activeGiveaway?.id]);

  // Countdown ticking clock
  useEffect(() => {
    if (timeRemaining === null || timeRemaining <= 0 || !activeGiveaway || activeGiveaway.status !== 'active') return;

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev !== null && prev > 0) {
          if (prev <= 11) {
            playAudio('countdown'); // Extreme suspense ticks!
          }
          return prev - 1;
        } else {
          clearInterval(timer);
          return 0;
        }
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeRemaining, activeGiveaway]);

  // Staggered casino-style multi-reel reveal
  const triggerDrawingAnimation = (giveaway: any) => {
    setAnimatingDraw(true);
    playAudio('win');

    const winningNumbers = giveaway.winningNumbers || [];
    const count = winningNumbers.length || 1;
    const rangeParts = (giveaway.numberRange || '1-24').split('-');
    const min = Number(rangeParts[0]) || 1;
    const max = Number(rangeParts[1]) || 24;

    // Initialize all reels as rolling and not landed
    const initialValues = Array(count).fill(0).map(() => Math.floor(Math.random() * (max - min + 1)) + min);
    setReelValues(initialValues);
    setReelsRevealed(Array(count).fill(false));

    let frame = 0;
    const interval = setInterval(() => {
      setReelValues(prev => {
        return prev.map((val, idx) => {
          // If already revealed, do not randomize
          if (idx < reelsRevealed.length && reelsRevealed[idx]) {
            return val;
          }
          if (frame % 2 === 0) {
            playAudio('tick');
          }
          return Math.floor(Math.random() * (max - min + 1)) + min;
        });
      });
      frame++;
    }, 100);

    // Staggered stops for each reel over the 15-second draw period
    const timeouts: NodeJS.Timeout[] = [];
    for (let i = 0; i < count; i++) {
      // Scale staggered reveals to end around 13 seconds
      const stopDelay = ((i + 1) / count) * 12500;
      
      const t = setTimeout(() => {
        setReelsRevealed(prev => {
          const next = [...prev];
          next[i] = true;
          return next;
        });
        setReelValues(prev => {
          const next = [...prev];
          next[i] = winningNumbers[i] !== undefined ? winningNumbers[i] : next[i];
          return next;
        });

        playAudio('reveal');
        triggerConfetti(`canvas-reel-${i}`);
      }, stopDelay);

      timeouts.push(t);
    }

    // Wrap up drawing state at 14.5 seconds
    const endTimeout = setTimeout(() => {
      clearInterval(interval);
      setAnimatingDraw(false);
      // Refresh user details to reflect auto credited wallet updates
      fetchUserData();
    }, 14500);

    return () => {
      clearInterval(interval);
      timeouts.forEach(clearTimeout);
      clearTimeout(endTimeout);
    };
  };

  const handleJoinGiveaway = async () => {
    if (chosenNumber === null || !activeGiveaway) return;
    try {
      setJoiningGiveaway(true);
      const tgId = getTelegramUserId();
      const tgUser = (window as any).Telegram?.WebApp?.initDataUnsafe?.user || {};
      
      const res = await fetch('/api/giveaway/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          giveawayId: activeGiveaway.id,
          telegramId: tgId,
          username: tgUser.username || user?.userName || '',
          firstName: tgUser.first_name || user?.userName || 'User',
          selectedNumber: chosenNumber,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setUserJoinedNumber(chosenNumber);
        setUserJoinedNumbers(prev => [...prev, chosenNumber]);
        showToast(`🎉 Number ${chosenNumber} locked successfully! Good luck!`, 'success');
        fetchUserData();
      } else {
        showToast(data.error || 'Failed to join giveaway', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Join failed', 'error');
    } finally {
      setJoiningGiveaway(false);
    }
  };

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  const getTelegramUserId = () => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.initDataUnsafe?.user?.id) {
      return String(tg.initDataUnsafe.user.id);
    }
    const urlParams = new URLSearchParams(window.location.search);
    const tgIdParam = urlParams.get('tgId') || urlParams.get('telegramId');
    if (tgIdParam) {
      return tgIdParam;
    }
    return localStorage.getItem('roy_user_id') || '';
  };

  const formatUsername = (un?: string) => {
    if (!un || un === 'N/A' || un === '@N/A' || un === 'Not set' || un === 'undefined') {
      return 'Username: Not set';
    }
    return un.startsWith('@') ? un : `@${un}`;
  };

  const validateUserSession = async () => {
    setLoading(true);
    try {
      const tg = (window as any).Telegram?.WebApp;
      tg?.ready?.();
      const initData = tg?.initData || '';
      const tgId = getTelegramUserId();

      const res = await fetch('/api/user/validate-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData, telegramId: tgId, botId: earningBotId })
      });

      const data = await res.json();
      if (data.success) {
        setRegistrationState(data.registrationState);

        if (data.registrationState === 'EARNING_BOT_UNREGISTERED') {
          setIsRegistered(false);
          setUser(null);
          setRegistrationState('EARNING_BOT_UNREGISTERED');
        } else if (data.registrationState === 'BANNED' || data.isBanned) {
          setIsRegistered(false);
          setUser(null);
        } else if (data.registrationState === 'PENDING_SECURITY_REVIEW') {
          setRegistrationState('PENDING_SECURITY_REVIEW');
          setIsRegistered(false);
          setUser(null);
          if (data.session) {
            setFullName(data.session.fullName || '');
            setMobile(data.session.mobile || '');
            setGmail(data.session.gmail || '');
          }
        } else if (data.registrationState === 'REJECTED') {
          setRegistrationState('REJECTED');
          setIsRegistered(false);
          setUser(null);
          setRegError(data.rejectReason || 'Registration rejected during security review.');
        } else if (data.registrationState === 'ACTIVE' && data.isRegistered) {
          setIsRegistered(true);
          setUser(data.user);
        } else if (data.registrationState === 'OTP_PENDING' || data.registrationState === 'CONTACT_VERIFIED') {
          setIsRegistered(false);
          setUser(null);
          setRegStep('OTP');
          if (data.session) {
            setFullName(data.session.fullName || '');
            setMobile(data.session.mobile || '');
            setGmail(data.session.gmail || '');
          }
          setOtpSuccessMsg('✅ Mobile number verified! Enter the 6-digit OTP code sent to your Telegram Bot chat.');
        } else if (data.registrationState === 'PROFILE_SUBMITTED') {
          setIsRegistered(false);
          setUser(null);
          setRegStep('PENDING_CONTACT');
          if (data.session) {
            setFullName(data.session.fullName || '');
            setMobile(data.session.mobile || '');
            setGmail(data.session.gmail || '');
          }
        } else {
          // UNREGISTERED
          setIsRegistered(false);
          setUser(null);
          setRegStep('DETAILS');
        }
      } else {
        setRegistrationState('INVALID_SESSION');
        setIsRegistered(false);
        setUser(null);
      }
    } catch (err) {
      console.error('[validateUserSession error]:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserData = async () => {
    try {
      await validateUserSession();
    } catch (err) {
      console.error('Failed to pre-fetch profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchWithdrawalHistory = async () => {
    try {
      const tgId = getTelegramUserId();
      if (!tgId) return;
      const url = earningBotId
        ? `/api/user/withdrawals/history?telegramId=${encodeURIComponent(tgId)}&botId=${encodeURIComponent(earningBotId)}`
        : `/api/user/withdrawals/history?telegramId=${encodeURIComponent(tgId)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success && Array.isArray(data.records)) {
        setWithdrawHistory(data.records);
      } else if (data.success && Array.isArray(data.withdrawals)) {
        setWithdrawHistory(data.withdrawals);
      }
    } catch (err) {
      console.error('Failed to fetch withdrawal history:', err);
    }
  };

  const fetchWithdrawalConfig = async () => {
    try {
      const tgId = getTelegramUserId();
      if (!tgId) return;
      const url = earningBotId
        ? `/api/user/withdrawals/config?telegramId=${encodeURIComponent(tgId)}&botId=${encodeURIComponent(earningBotId)}`
        : `/api/user/withdrawals/config?telegramId=${encodeURIComponent(tgId)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success && data.settings) {
        setWithdrawalSettings(data.settings);
      }
    } catch (err) {
      console.error('Failed to fetch withdrawal config:', err);
    }
  };

  useEffect(() => {
    if (activeTab === 'withdraw' && isRegistered) {
      fetchWithdrawalConfig();
      fetchWithdrawalHistory();
    }
  }, [activeTab, isRegistered]);

  // Setup Real-time Firestore Sync
  useEffect(() => {
    const tgId = getTelegramUserId();

    // Run session validation on mount
    validateUserSession();

    let unsubscribeUser = () => {};
    if (tgId) {
      if (earningBotId) {
        // Scoped to Earning Bot User Account (${earningBotId}_${tgId})
        const botUserRef = doc(db, 'users', `${earningBotId}_${tgId}`);
        unsubscribeUser = onSnapshot(botUserRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.banned || data.status === 'banned' || data.status === 'BANNED') {
              setRegistrationState('BANNED');
              setIsRegistered(false);
              setUser(null);
              return;
            }
            setUser((prev: any) => ({
              ...prev,
              ...data,
              id: docSnap.id,
              telegramId: tgId,
              botId: earningBotId,
              appUid: data.uid || `${earningBotId}_${tgId}`,
              uid: data.uid || `${earningBotId}_${tgId}`,
              userName: data.firstName || data.username || `User #${tgId}`,
              avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${tgId}`,
              walletBalance: Number(data.walletBalance) || 0,
              referralCount: Number(data.totalReferrals || data.referralCount) || 0,
              joinedDate: data.createdAt || new Date().toISOString(),
              securityBadge: 'TRUSTED',
              securityScore: 98,
              completedTasks: data.completedTasks || [],
              milestoneProgress: data.milestoneProgress || {},
            }));
            setIsRegistered(true);
            setRegistrationState('ACTIVE');
          } else {
            setIsRegistered(false);
            setUser(null);
            setRegistrationState('UNREGISTERED');
            setRegStep('DETAILS');
          }
        }, (err) => {
          console.error('Error listening to earning bot user doc:', err);
        });
      } else {
        // Main Roy Share Wallet query
        const qUser = query(collection(db, 'users'), where('telegramId', '==', tgId));
        unsubscribeUser = onSnapshot(qUser, (snapshot) => {
          if (!snapshot.empty) {
            // Find user doc that is NOT associated with an earning bot or matches default
            const userDoc = snapshot.docs.find(d => !d.data().botId) || snapshot.docs[0];
            const data = userDoc.data();
            if (data.banned || data.status === 'banned') {
              setRegistrationState('BANNED');
              setIsRegistered(false);
              setUser(null);
              return;
            }
            const rawAppUid = data.appUid ? String(data.appUid).trim() : '';
            const rawUid = data.uid ? String(data.uid).trim() : '';
            const cleanUid = (rawAppUid && rawAppUid !== tgId) ? rawAppUid : ((rawUid && rawUid !== tgId) ? rawUid : '');

            setUser((prev: any) => ({
              ...prev,
              ...data,
              id: userDoc.id,
              telegramId: tgId,
              appUid: cleanUid || data.appUid || data.uid || '',
              uid: cleanUid || data.uid || data.appUid || '',
              userName: data.userName || data.fullName || data.name || data.firstName || `User #${tgId}`,
              avatar: data.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${tgId}`,
              walletBalance: Number(data.walletBalance) || Number(data.balance) || 0,
              coinsBalance: Number(data.coinsBalance) || 0,
              bonusBalance: Number(data.bonusBalance) || 0,
              referralCount: Number(data.referralsCount) || 0,
              joinedDate: data.createdAt || '2026-08-01',
              securityBadge: 'TRUSTED',
              securityScore: 98,
              completedTasks: data.completedTasks || [],
              milestoneProgress: data.milestoneProgress || {},
            }));
            setIsRegistered(true);
            setRegistrationState('ACTIVE');
          } else {
            setIsRegistered(false);
            setUser(null);
            setRegistrationState('UNREGISTERED');
            setRegStep('DETAILS');
          }
        }, (err) => {
          console.error('Error listening to user doc:', err);
        });
      }
    }

    // 2. Listen to dynamic Milestones
    const milestonesRef = collection(db, 'referralMilestones');
    const unsubscribeMilestones = onSnapshot(milestonesRef, (snap) => {
      const list: any[] = [];
      snap.forEach((docSnap) => {
        const d = docSnap.data();
        if (d.active !== false) {
          list.push({
            id: docSnap.id,
            req: Number(d.requiredReferrals) || 0,
            reward: Number(d.rewardAmount) || 0,
            rewardType: d.rewardType || 'wallet',
            position: Number(d.position) || 0,
          });
        }
      });
      list.sort((a, b) => a.position - b.position);
      setMilestones(list);
    }, (err) => {
      console.error('Error listening to milestones:', err);
    });

    // 3. Listen to dynamic App Tasks
    const tasksRef = collection(db, 'tasks');
    const unsubscribeTasks = onSnapshot(tasksRef, (snap) => {
      const list: any[] = [];
      snap.forEach((docSnap) => {
        const d = docSnap.data();
        if (d.active !== false) {
          list.push({
            id: docSnap.id,
            title: d.title || 'Untitled Task',
            reward: Number(d.reward) || 0,
            coins: Number(d.coins) || 0,
            verificationType: d.verificationType || 'none',
            icon: d.icon || 'CheckSquare',
            sortOrder: Number(d.sortOrder) || 0,
            url: d.url || d.externalDestinationUrl || '',
            externalDestinationUrl: d.externalDestinationUrl || d.url || '',
            taskImage: d.taskImage || '',
            description: d.description || '',
            proofDemoImage: d.proofDemoImage || '',
            privateAdminGroupChatId: d.privateAdminGroupChatId || '',
            allowResubmission: d.allowResubmission !== false,
            maxSubmissionsPerUser: d.maxSubmissionsPerUser || 1,
            earningBotId: d.earningBotId || '',
          });
        }
      });
      list.sort((a, b) => a.sortOrder - b.sortOrder);
      setTasks(list);
    }, (err) => {
      console.error('Error listening to tasks:', err);
    });

    // 3.5. Listen to manual task proof submissions for current user
    let unsubscribeManualSubs = () => {};
    if (tgId) {
      const subRef = collection(db, 'manualTaskSubmissions');
      const qSub = query(subRef, where('telegramUserId', '==', String(tgId)));
      unsubscribeManualSubs = onSnapshot(qSub, (snap) => {
        const list: any[] = [];
        snap.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() });
        });
        setUserManualSubmissions(list);
      }, (err) => {
        console.error('Error listening to manual submissions:', err);
      });
    }

    // 4. Listen to withdrawals history in real-time
    const withdrawalsRef = collection(db, 'withdrawals');
    const qWithdraw = query(withdrawalsRef, where('telegramId', '==', tgId));
    const unsubscribeWithdrawals = onSnapshot(qWithdraw, (snap) => {
      const list: any[] = [];
      snap.forEach((docSnap) => {
        const d = docSnap.data();
        if (earningBotId) {
          if (d.earningBotId === earningBotId) {
            list.push({
              id: docSnap.id,
              details: d.upiId || d.redeemCodeDetails || d.qrImageUrl || '',
              ...d,
            });
          }
        } else {
          if (!d.earningBotId || d.earningBotId === '') {
            list.push({
              id: docSnap.id,
              details: d.upiId || d.redeemCodeDetails || d.qrImageUrl || '',
              ...d,
            });
          }
        }
      });
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setWithdrawHistory(list);
    }, (err) => {
      console.error('Error listening to withdrawals:', err);
    });

    fetchUserData();

    return () => {
      unsubscribeUser();
      unsubscribeMilestones();
      unsubscribeTasks();
      unsubscribeWithdrawals();
    };
  }, []);

  const handleCopyLink = () => {
    const tgId = getTelegramUserId();
    const activeUsername = earningBotConfig?.botUsername || botUsername || 'Roy_wallett_bot';
    const link = earningBotId
      ? `https://t.me/${activeUsername}?start=ref_${user?.uid || tgId}`
      : `https://t.me/${activeUsername}?start=ref_${tgId}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    showToast('📋 Referral Link copied to clipboard!', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const getMinWithdrawAmount = () => {
    if (!withdrawalSettings) return 100;
    if (withdrawMethod === 'upi') return withdrawalSettings.upi?.min ?? 100;
    if (withdrawMethod === 'qr') return withdrawalSettings.qr?.min ?? 100;
    if (withdrawMethod === 'redeem_code') return withdrawalSettings.redeem?.min ?? 20;
    if (withdrawMethod === 'ultra_pay') return withdrawalSettings.ultraPay?.min ?? 10;
    return 100;
  };

  const getTaxRate = () => {
    if (!withdrawalSettings) return 0;
    if (withdrawMethod === 'upi') return withdrawalSettings.upi?.tax ?? 0;
    if (withdrawMethod === 'qr') return withdrawalSettings.qr?.tax ?? 0;
    if (withdrawMethod === 'redeem_code') return withdrawalSettings.redeem?.tax ?? 0;
    if (withdrawMethod === 'ultra_pay') return withdrawalSettings.ultraPay?.tax ?? 0;
    return 0;
  };

  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(withdrawAmount);
    if (isNaN(amt) || amt <= 0) {
      addToast('⚠️ Please enter a valid positive amount', 'error');
      return;
    }

    // 1. Validate requested amount >= minimum threshold
    const minAmt = getMinWithdrawAmount();
    if (amt < minAmt) {
      addToast(`⚠️ Minimum withdrawal for this method is ₹${minAmt}`, 'error');
      return;
    }

    // 2. Validate requested amount <= available balance
    const availBal = Math.max(0, (Number(user?.walletBalance) || 0) - (Number(user?.lockedBalance) || 0));
    if (amt > availBal) {
      addToast(`⚠️ Insufficient available balance. Available: ₹${availBal}, Requested: ₹${amt}`, 'error');
      return;
    }

    const tgId = getTelegramUserId();
    if (!tgId) {
      addToast('❌ Telegram session invalid. Please reopen via Telegram Bot.', 'error');
      return;
    }

    const normMethod = withdrawMethod.toUpperCase();
    const paymentDetails: any = {};

    if (normMethod === 'UPI') {
      if (!withdrawDetails.trim() || !/^\S+@\S+$/.test(withdrawDetails.trim())) {
        addToast('⚠️ Please enter a valid UPI ID (e.g. name@upi)', 'error');
        return;
      }
      paymentDetails.upiId = withdrawDetails.trim();
    } else if (normMethod === 'QR') {
      if (!withdrawDetails.trim()) {
        addToast('⚠️ Please provide valid QR Code details or Image URL', 'error');
        return;
      }
      paymentDetails.qrData = withdrawDetails.trim();
      paymentDetails.qrUrl = withdrawDetails.trim();
    } else if (normMethod === 'ULTRA_PAY') {
      if (!withdrawDetails.trim() || !/^\d{10}$/.test(withdrawDetails.trim())) {
        addToast('⚠️ Please enter a valid 10-digit Ultra Pay mobile number', 'error');
        return;
      }
      paymentDetails.paytoNumber = withdrawDetails.trim();
    } else if (normMethod === 'REDEEM_CODE') {
      if (!withdrawDetails.trim()) {
        addToast('⚠️ Please specify Redeem Code brand and details (e.g. Amazon Gift Card ₹500)', 'error');
        return;
      }
      paymentDetails.redeemCodeDetails = withdrawDetails.trim();
    }

    setIsSubmittingWithdrawal(true);
    const idempotencyKey = `idemp_${tgId}_${Date.now()}`;

    try {
      const res = await fetch('/api/user/withdrawals/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramId: tgId,
          botId: earningBotId || '',
          earningBotId: earningBotId || '',
          method: normMethod,
          amount: amt,
          paymentDetails,
          idempotencyKey,
        }),
      });

      const data = await res.json();
      if (data.success) {
        addToast('✅ Withdrawal request submitted successfully!', 'success');
        setWithdrawAmount('');
        setWithdrawDetails('');

        // Refresh user data & withdrawal history
        fetchUserData();
        fetchWithdrawalHistory();
      } else {
        addToast(`❌ ${data.error || 'Failed to submit withdrawal request.'}`, 'error');
      }
    } catch (err: any) {
      addToast(`❌ Error submitting request: ${err.message}`, 'error');
    } finally {
      setIsSubmittingWithdrawal(false);
    }
  };

  const handleVerifyTask = async (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    if (task.url) {
      // Open the URL in a new window/tab safely
      window.open(task.url, '_blank');
    }

    showToast('🔄 Verifying task completions...', 'info');

    try {
      const tgId = getTelegramUserId();
      const userRef = doc(db, 'users', user?.id || tgId);

      // Perform a Firestore transaction to safely award task reward
      await runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) {
          throw new Error("User profile not found. Please register first.");
        }

        const userData = userDoc.data();
        const completedTasks = userData.completedTasks || [];
        if (completedTasks.includes(taskId)) {
          throw new Error("This task has already been completed.");
        }

        // Calculate new balances
        const currentWallet = Number(userData.walletBalance || userData.balance || 0);
        const currentCoins = Number(userData.coinsBalance || 0);

        transaction.update(userRef, {
          walletBalance: currentWallet + task.reward,
          coinsBalance: currentCoins + task.coins,
          completedTasks: [...completedTasks, taskId]
        });

        // Record a transaction history entry
        const txnRef = doc(collection(db, 'transactions'));
        transaction.set(txnRef, {
          transactionId: `TXN${Date.now()}`,
          uid: userData.uid || user?.uid || tgId,
          telegramId: tgId,
          userName: userData.userName || userData.name || `User #${tgId}`,
          amount: task.reward,
          type: 'TASK_REWARD',
          status: 'completed',
          description: `Reward for task: ${task.title}`,
          createdAt: new Date().toISOString()
        });
      });

      showToast(`🎉 Task verified! Credited ₹${task.reward} & ${task.coins} coins!`, 'success');
    } catch (err: any) {
      showToast(`❌ Verification failed: ${err.message}`, 'error');
    }
  };

  const handleProofImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
      setProofError('Please select a valid JPG, PNG, or WEBP image file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setProofError('Image file size must be less than 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result) {
        setProofImageBase64(String(reader.result));
        setProofError(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleManualProofSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProofTask) return;

    const cleanMobile = proofMobile.replace(/\D/g, '');
    if (!/^[6-9]\d{9}$/.test(cleanMobile)) {
      setProofError('Please enter a valid 10-digit Indian mobile number.');
      return;
    }

    if (!proofImageBase64) {
      setProofError('Please select or upload a clear screenshot proof image.');
      return;
    }

    setIsSubmittingProof(true);
    setProofError(null);

    try {
      const tgId = getTelegramUserId();
      const tg = (window as any).Telegram?.WebApp;
      const tgUser = tg?.initDataUnsafe?.user;

      const res = await fetch('/api/tasks/submit-manual-proof', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: activeProofTask.id,
          userId: user?.id || user?.uid || String(tgId),
          earningBotId: earningBotId || activeProofTask.earningBotId || 'roy_share_wallet',
          telegramUserId: String(tgId || user?.telegramId || ''),
          telegramUsername: user?.username || tgUser?.username || '',
          userFullName: user?.userName || tgUser?.first_name || 'User',
          userAppUid: user?.appUid || user?.uid || String(tgId),
          registrationMobile: cleanMobile,
          proofImageUrl: proofImageBase64
        })
      });

      const data = await res.json();
      if (data.success) {
        showToast('🎉 Screenshot proof submitted successfully for admin review!', 'success');
        setActiveProofTask(null);
        setProofMobile('');
        setProofImageBase64('');
      } else {
        setProofError(data.error || 'Failed to submit proof.');
      }
    } catch (err: any) {
      setProofError(err.message || 'Error submitting screenshot proof.');
    } finally {
      setIsSubmittingProof(false);
    }
  };

  const handleClaimMilestone = async (id: string, reward: number, req: number) => {
    showToast('🔄 Claiming milestone reward...', 'info');

    try {
      const tgId = getTelegramUserId();
      const userRef = doc(db, 'users', user?.id || tgId);

      await runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) {
          throw new Error("User profile not found.");
        }

        const userData = userDoc.data();
        const currentReferrals = Number(userData.referralsCount || 0);

        if (currentReferrals < req) {
          throw new Error(`Requirements not met. You need ${req} invites (Current: ${currentReferrals})`);
        }

        const milestoneProgress = userData.milestoneProgress || {};
        if (milestoneProgress[id] === 'claimed') {
          throw new Error("Milestone reward has already been claimed.");
        }

        const currentWallet = Number(userData.walletBalance || userData.balance || 0);

        // Claimed and update user
        milestoneProgress[id] = 'claimed';
        transaction.update(userRef, {
          walletBalance: currentWallet + reward,
          milestoneProgress
        });

        // Record a transaction history entry
        const txnRef = doc(collection(db, 'transactions'));
        transaction.set(txnRef, {
          transactionId: `TXN${Date.now()}`,
          uid: userData.uid || user?.uid || tgId,
          telegramId: tgId,
          userName: userData.userName || userData.name || `User #${tgId}`,
          amount: reward,
          type: 'REFERRAL_MILESTONE',
          status: 'completed',
          description: `Reward for reaching ${req} referrals milestone`,
          createdAt: new Date().toISOString()
        });
      });

      showToast(`🎉 Milestone claimed successfully! Credited ₹${reward}!`, 'success');
    } catch (err: any) {
      showToast(`❌ Claim failed: ${err.message}`, 'error');
    }
  };

  if (loading || registrationState === 'LOADING') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center space-y-4">
        <RefreshCw className="w-8 h-8 text-amber-500 animate-spin" />
        <p className="text-sm font-semibold text-slate-400">Verifying Telegram Account Session...</p>
      </div>
    );
  }

  // BANNED ACCOUNT SCREEN
  if (registrationState === 'BANNED' || user?.banned) {
    return (
      <div className="min-h-screen bg-slate-950 text-white font-sans flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-rose-950/40 border border-rose-500/30 rounded-3xl p-6 text-center space-y-4 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto text-3xl">
            🚫
          </div>
          <h1 className="text-xl font-black text-rose-300">Account Restricted</h1>
          <p className="text-xs text-slate-300 leading-relaxed">
            This Telegram account is permanently restricted from creating or using another Roy Share account.
          </p>
        </div>
      </div>
    );
  }

  // INVALID TELEGRAM SESSION
  if (registrationState === 'INVALID_SESSION') {
    return (
      <div className="min-h-screen bg-slate-950 text-white font-sans flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 text-center space-y-4 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto text-3xl border border-amber-500/20">
            ⚠️
          </div>
          <h1 className="text-lg font-black text-white">Telegram Session Required</h1>
          <p className="text-xs text-slate-400 leading-relaxed">
            Please open this Mini App directly from your Telegram Bot chat.
          </p>
        </div>
      </div>
    );
  }

  // PENDING SECURITY REVIEW
  if (registrationState === 'PENDING_SECURITY_REVIEW') {
    return (
      <div className="min-h-screen bg-slate-950 text-white font-sans flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-900 border border-amber-500/30 rounded-3xl p-6 text-center space-y-6 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto text-3xl">
            🛡
          </div>
          <div className="space-y-1">
            <h1 className="text-lg font-black text-amber-400">Account Under Security Review</h1>
            <p className="text-xs text-slate-300 leading-relaxed">
              Your account registration has been submitted for Security Review by Admin.
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-left space-y-2 text-xs">
            <div className="flex justify-between border-b border-slate-800 pb-1.5">
              <span className="text-slate-400">Status:</span>
              <span className="font-bold text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">⏳ PENDING REVIEW</span>
            </div>
            {fullName && (
              <div className="flex justify-between border-b border-slate-800 pb-1.5">
                <span className="text-slate-400">Name:</span>
                <span className="font-bold text-white">{fullName}</span>
              </div>
            )}
            {mobile && (
              <div className="flex justify-between border-b border-slate-800 pb-1.5">
                <span className="text-slate-400">Mobile:</span>
                <span className="font-bold text-white">{mobile}</span>
              </div>
            )}
            {gmail && (
              <div className="flex justify-between">
                <span className="text-slate-400">Gmail:</span>
                <span className="font-bold text-white">{gmail}</span>
              </div>
            )}
          </div>
          <p className="text-[11px] text-slate-400">
            Once approved by Admin, your wallet will be activated and you will receive a notification in Telegram.
          </p>
          <button
            type="button"
            onClick={validateUserSession}
            className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl cursor-pointer"
          >
            <span>Check Approval Status</span>
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // REJECTED REGISTRATION
  if (registrationState === 'REJECTED') {
    return (
      <div className="min-h-screen bg-slate-950 text-white font-sans flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-900 border border-rose-500/30 rounded-3xl p-6 text-center space-y-6 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto text-3xl">
            ❌
          </div>
          <div className="space-y-1">
            <h1 className="text-lg font-black text-rose-400">Registration Rejected</h1>
            <p className="text-xs text-slate-300 leading-relaxed">
              Your account registration request was rejected during Security Review.
            </p>
          </div>
          {regError && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold">
              {regError}
            </div>
          )}
          <button
            type="button"
            onClick={validateUserSession}
            className="w-full py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Refresh</span>
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // UNREGISTERED OR PENDING REGISTRATION USERS
  if (!isRegistered || !user) {
    if (earningBotId || registrationState === 'EARNING_BOT_UNREGISTERED') {
      const botTitle = earningBotConfig?.botName || earningBotConfig?.botFirstName || 'Earning Bot';
      const regBonus = earningBotConfig?.registrationBonus ?? 1;
      const refBonus = earningBotConfig?.referralReward ?? 2;
      const minWith = earningBotConfig?.minWithdrawal ?? 5;

      return (
        <div className="min-h-screen bg-slate-950 text-white font-sans flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800/80 rounded-3xl p-6 shadow-2xl space-y-5">
            {/* Bot Header */}
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 mx-auto shadow-xl shadow-emerald-500/20">
                <Bot className="w-9 h-9" />
              </div>
              <div className="inline-block px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-wider">
                🤖 Telegram Bot Security & Account Activation
              </div>
              <h1 className="text-2xl font-black tracking-tight text-white">
                {botTitle}
              </h1>
              <p className="text-xs text-slate-400">
                Complete security verification to activate your bot account and claim your sign-up bonuses.
              </p>
            </div>

            {/* Error Alert */}
            {regError && (
              <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-bold flex items-center gap-2">
                <span className="text-rose-400 text-base">❌</span>
                <span>{regError}</span>
              </div>
            )}

            {/* Security Verification Checks Card */}
            <div className="space-y-2 bg-slate-950/90 p-4 rounded-2xl border border-slate-800 text-xs">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                <span>🛡️ Mini App Security Checks</span>
                <span className="text-emerald-400 font-mono text-[10px]">Earning Bot ID: {earningBotId}</span>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-slate-900/90 rounded-xl border border-slate-800/80">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400 text-sm">📱</span>
                  <span className="text-slate-300 font-medium">Contact Verification</span>
                </div>
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 text-[10px] font-black">
                  VERIFIED
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-slate-900/90 rounded-xl border border-slate-800/80">
                <div className="flex items-center gap-2">
                  <span className="text-sky-400 text-sm">🖥️</span>
                  <span className="text-slate-300 font-medium">Device Fingerprint</span>
                </div>
                <span className="px-2 py-0.5 rounded-md bg-sky-500/20 text-sky-400 text-[10px] font-black font-mono">
                  SCORE: 98/100
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-slate-900/90 rounded-xl border border-slate-800/80">
                <div className="flex items-center gap-2">
                  <span className="text-teal-400 text-sm">🌐</span>
                  <span className="text-slate-300 font-medium">IP Risk & Proxy</span>
                </div>
                <span className="px-2 py-0.5 rounded-md bg-teal-500/20 text-teal-400 text-[10px] font-black">
                  PASSED (SAFE)
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-slate-900/90 rounded-xl border border-slate-800/80">
                <div className="flex items-center gap-2">
                  <span className="text-indigo-400 text-sm">👥</span>
                  <span className="text-slate-300 font-medium">Duplicate Account Check</span>
                </div>
                <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-400 text-[10px] font-black">
                  UNIQUE DEVICE
                </span>
              </div>
            </div>

            {/* REFERRAL TRANSPARENCY CARD */}
            <div className="space-y-2 bg-slate-950/90 p-4 rounded-2xl border border-emerald-500/30 text-xs">
              <div className="text-[11px] font-extrabold text-emerald-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>🎁 Referral & Registration Transparency</span>
              </div>

              <div className="space-y-1.5 font-sans">
                <div className="flex items-center justify-between text-slate-300">
                  <span>🎁 Signup Bonus:</span>
                  <span className="font-bold text-amber-400">₹{regBonus}</span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span>🔗 Admin Referral Bonus:</span>
                  <span className="font-bold text-emerald-400">₹1</span>
                </div>
                <div className="flex items-center justify-between text-white font-bold pt-1 border-t border-slate-800">
                  <span>💰 Starting Balance:</span>
                  <span className="font-extrabold text-emerald-300 text-sm">₹{regBonus + 1}</span>
                </div>
                <div className="flex items-center justify-between text-slate-400 text-[11px] pt-1">
                  <span>⚡ Minimum Withdrawal:</span>
                  <span className="font-bold text-sky-400">₹{minWith}</span>
                </div>
                <div className="flex items-center justify-between text-slate-400 text-[11px]">
                  <span>💳 Withdrawal Method:</span>
                  <span className="font-bold text-purple-400">Ultra Pay</span>
                </div>
              </div>
            </div>

            {/* 🔐 WHY TRUST ULTRA PAY? Section */}
            <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800/80 text-xs space-y-2">
              <div className="font-black text-amber-400 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <span>🔐 WHY TRUST ULTRA PAY?</span>
              </div>
              <ul className="space-y-1.5 text-slate-300 text-[11px] leading-snug">
                <li className="flex items-start gap-1.5">
                  <span className="text-emerald-400 shrink-0">✓</span>
                  <span>Secure Telegram-based account verification</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-emerald-400 shrink-0">✓</span>
                  <span>Device/IP security checks</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-emerald-400 shrink-0">✓</span>
                  <span>Duplicate-account protection</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-emerald-400 shrink-0">✓</span>
                  <span>Referral fraud protection</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-emerald-400 shrink-0">✓</span>
                  <span>Clear referral status: <b>Valid</b> / <b>Pending</b> / <b>Rejected</b></span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-emerald-400 shrink-0">✓</span>
                  <span>Withdrawal status shown in transaction history</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-emerald-400 shrink-0">✓</span>
                  <span>Minimum withdrawal: <b>₹{minWith}</b></span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-emerald-400 shrink-0">✓</span>
                  <span>Withdrawal method: <b>Ultra Pay only</b></span>
                </li>
              </ul>
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-[10px] text-slate-400 italic">
                ℹ️ Your account can continue to use the bot even if a referral is rejected. Only the referral reward is rejected.
              </div>
            </div>

            {/* Action Button */}
            <button
              onClick={handleRegisterEarningBotUser}
              disabled={isSubmittingReg}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/20 transition disabled:opacity-50 cursor-pointer"
            >
              {isSubmittingReg ? (
                <span>Verifying Security & Activating...</span>
              ) : (
                <>
                  <span>🔒 COMPLETE SECURITY VERIFICATION (CLAIM ₹{regBonus + 1})</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-slate-950 text-white font-sans flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-400 flex items-center justify-center text-slate-950 mx-auto shadow-lg">
              <Wallet className="w-8 h-8" />
            </div>
            <h1 className="text-xl font-black tracking-tight text-white">
              🚀 Create Your Roy Share Account
            </h1>
            <p className="text-xs text-slate-400">
              {regStep === 'DETAILS'
                ? 'Complete registration in 3 simple steps to access your wallet.'
                : regStep === 'PENDING_CONTACT'
                ? 'Share your contact in Telegram Bot chat to complete mobile verification.'
                : 'Enter the 6-digit OTP code sent to your Telegram Bot chat.'}
            </p>
          </div>

          {/* Error Alert */}
          {regError && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-bold flex items-center gap-2">
              <span className="text-rose-400 text-base">❌</span>
              <span>{regError}</span>
            </div>
          )}

          {/* Step 1: DETAILS */}
          {regStep === 'DETAILS' && (
            <form onSubmit={handleInitiateRegistration} className="space-y-4">
              {/* Step 1: Full Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                  Step 1: Enter Full Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Rahul Sharma"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-3 px-4 text-xs font-bold text-white outline-none"
                  required
                />
              </div>

              {/* Step 2: Mobile Number */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                  Step 2: Enter Mobile Number
                </label>
                <input
                  type="tel"
                  placeholder="10-digit Mobile Number (e.g. 9876543210)"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-3 px-4 text-xs font-bold text-white outline-none"
                  required
                />
                <p className="text-[11px] text-amber-400/90 font-medium bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20">
                  Please enter the <b>SAME mobile number</b> that is linked with your Telegram account.
                </p>
              </div>

              {/* Step 3: Gmail Address */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                  Step 3: Enter Gmail Address
                </label>
                <input
                  type="email"
                  placeholder="e.g. yourname@gmail.com"
                  value={gmail}
                  onChange={(e) => setGmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-3 px-4 text-xs font-bold text-white outline-none"
                  required
                />
                <p className="text-[11px] text-sky-400/90 font-medium bg-sky-500/10 p-2.5 rounded-xl border border-sky-500/20">
                  Please enter your <b>REAL Gmail address</b>. Incorrect Gmail details may cause withdrawal/payment issues.
                </p>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmittingReg}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl transition disabled:opacity-50"
              >
                {isSubmittingReg ? (
                  <span>Generating Security Check...</span>
                ) : (
                  <>
                    <span>VERIFY & CONTINUE →</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Step 2: PENDING CONTACT VERIFICATION IN TELEGRAM */}
          {regStep === 'PENDING_CONTACT' && (
            <div className="space-y-4 text-center">
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-medium space-y-2">
                <div className="font-bold text-amber-400 text-sm flex items-center justify-center gap-1.5">
                  📱 Mobile Verification Request Sent
                </div>
                <p>Please open your <b>Telegram Bot chat</b> and tap the <b>📱 Share Contact</b> button.</p>
                <p className="text-[11px] text-slate-400">Once shared, your 6-digit OTP will be sent to your Telegram chat.</p>
              </div>

              <button
                type="button"
                onClick={validateUserSession}
                className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl"
              >
                <span>Check Verification Status</span>
                <RefreshCw className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setRegStep('DETAILS')}
                className="w-full text-center text-xs text-slate-400 hover:text-white py-2"
              >
                ← Back to Registration Details
              </button>
            </div>
          )}

          {/* Step 3: OTP VERIFICATION */}
          {regStep === 'OTP' && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-medium space-y-1">
                <div className="font-bold text-emerald-400 flex items-center gap-1.5">
                  <Check className="w-4 h-4" />
                  <span>Security Check Passed</span>
                </div>
                <p>{otpSuccessMsg}</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                  Enter 6-Digit OTP Code
                </label>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="e.g. 123456"
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-3 px-4 text-center text-2xl font-mono font-black text-amber-400 tracking-widest outline-none"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingReg || otpInput.length < 6}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl transition disabled:opacity-50"
              >
                {isSubmittingReg ? (
                  <span>Verifying OTP...</span>
                ) : (
                  <>
                    <Key className="w-4 h-4" />
                    <span>Verify OTP & Create Account</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setRegStep('DETAILS')}
                className="w-full text-center text-xs text-slate-400 hover:text-white py-2"
              >
                ← Back to Details
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col relative overflow-x-hidden pb-20">
      {/* Toast Notification Container */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`p-3.5 rounded-xl border text-xs font-bold shadow-2xl flex items-center gap-2.5 transition-all animate-bounce ${
              t.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/30 text-emerald-300'
                : t.type === 'error'
                ? 'bg-rose-950/90 border-rose-500/30 text-rose-300'
                : 'bg-sky-950/90 border-sky-500/30 text-sky-300'
            }`}
          >
            <span>{t.text}</span>
          </div>
        ))}
      </div>

      {/* Hero Header Area */}
      <header className="p-6 bg-gradient-to-b from-slate-900 to-slate-950 border-b border-slate-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 p-0.5 shadow-md">
              <img
                src={user.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.telegramId}`}
                alt="User Avatar"
                className="w-full h-full rounded-[14px]"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-base font-black text-white">{user.userName}</h1>
                <span className="text-[10px] font-bold bg-amber-500/15 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/20">
                  {user.levelTitle}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">{formatUsername(user?.username)}</p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-black text-slate-500 block uppercase tracking-wider">Device Score</span>
            <div className="flex items-center justify-end gap-1 text-emerald-400">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span className="text-xs font-black">{user.securityScore}% Safe</span>
            </div>
          </div>
        </div>

        {/* Earning Bot Isolated Badge */}
        {earningBotId && (
          <div className="mt-3 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between text-xs text-emerald-300">
            <div className="flex items-center gap-2 font-bold">
              <Bot className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Connected Bot: <b>{earningBotConfig?.botName || 'Ultra Pay user'}</b> {earningBotConfig?.botUsername ? `(@${earningBotConfig.botUsername.replace(/^@/,'')})` : ''}</span>
            </div>
            <span className="text-[9px] font-black uppercase bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded">
              Isolated
            </span>
          </div>
        )}

        {/* Global Balance Stats Grid */}
        <div className="grid grid-cols-3 gap-3 mt-6">
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/60 flex flex-col justify-between">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Wallet</span>
            <span className="text-lg font-black text-emerald-400">₹{user.walletBalance ?? 0}</span>
          </div>
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/60 flex flex-col justify-between">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Coins</span>
            <span className="text-lg font-black text-amber-400">{user.coinsBalance ?? 0}</span>
          </div>
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/60 flex flex-col justify-between">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Bonus</span>
            <span className="text-lg font-black text-sky-400">₹{user.bonusBalance ?? 0}</span>
          </div>
        </div>
      </header>

      {/* Main Tab Content */}
      <main className="p-5 flex-1 max-w-xl mx-auto w-full space-y-6">
        {/* MINI APP VERIFICATION CODE / OTP BANNER */}
        {showOtpCard && (
          <div className="p-5 rounded-3xl bg-gradient-to-br from-emerald-950/90 via-slate-900 to-slate-900 border border-emerald-500/50 shadow-2xl space-y-4 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <Key className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">🔐 Verification Code</h3>
                  <p className="text-[11px] text-emerald-300/80">Copy code & paste back in Telegram Bot chat</p>
                </div>
              </div>
              <button
                onClick={() => setShowOtpCard(false)}
                className="text-slate-500 hover:text-white text-xs p-1"
              >
                ✕
              </button>
            </div>

            {/* OTP Code Display Box */}
            <div className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800 text-center space-y-2">
              {otpCode && otpExpiryTimer > 0 ? (
                <>
                  <div className="text-3xl sm:text-4xl font-mono font-black text-emerald-400 tracking-widest select-all">
                    [ {otpCode} ]
                  </div>
                  <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400 font-mono">
                    <Timer className="w-3.5 h-3.5 text-amber-400" />
                    <span>Expires in: <b className="text-amber-400">{formatTimer(otpExpiryTimer)}</b></span>
                  </div>
                </>
              ) : (
                <div className="py-2 space-y-2">
                  <p className="text-xs text-rose-400 font-bold">⚠️ OTP Code Expired or Not Generated</p>
                  <button
                    onClick={handleGenerateOtp}
                    disabled={isGeneratingOtp}
                    className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition shadow-md"
                  >
                    {isGeneratingOtp ? 'Generating...' : '🔄 Generate New OTP'}
                  </button>
                </div>
              )}
            </div>

            {/* Copy Button */}
            {otpCode && otpExpiryTimer > 0 && (
              <button
                onClick={copyOtpToClipboard}
                className="w-full py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition shadow-lg flex items-center justify-center gap-2"
              >
                {copiedOtp ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>✅ Copied to Clipboard!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>📋 Copy OTP Code</span>
                  </>
                )}
              </button>
            )}
          </div>
        )}
        {activeTab === 'wallet' && (
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="p-5 rounded-3xl bg-slate-900/40 border border-slate-800/60 space-y-4">
              <h2 className="text-sm font-black text-white flex items-center gap-2">
                <Wallet className="w-4 h-4 text-emerald-400" />
                <span>Wallet Management</span>
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Send instantly to your UPI address, verify refer links or cash out to gift card redeem vouchers.
              </p>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={() => setActiveTab('withdraw')}
                  className="py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 transition"
                >
                  <ArrowUpRight className="w-4 h-4" />
                  <span>Withdraw Funds</span>
                </button>
                <button
                  onClick={() => setActiveTab('referral')}
                  className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition"
                >
                  <Users className="w-4 h-4 text-amber-400" />
                  <span>Invite Friends</span>
                </button>
              </div>
            </div>

            {/* Quick Stats Banner */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-slate-900 to-slate-900 border border-emerald-500/20 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
                <div>
                  <h4 className="text-xs font-bold text-white">Trust Network Status</h4>
                  <p className="text-[10px] text-slate-400">All withdrawals processed within 24 hours.</p>
                </div>
              </div>
              <span className="text-[10px] font-black uppercase text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                Active
              </span>
            </div>

            {/* Withdrawal & Ledger History */}
            <div className="space-y-3">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest block">Withdrawal Logs</h3>
              <div className="space-y-2">
                {withdrawHistory.length > 0 ? (
                  withdrawHistory.map((item) => {
                    const reqAmt = item.amountRequested ?? item.amount ?? 0;
                    const taxAmt = item.taxAmount ?? 0;
                    const netPayout = item.finalPayout ?? (reqAmt - taxAmt);
                    const detailsStr = typeof item.details === 'string' ? item.details : item.upiId || item.paytoNumber || item.method || 'Payout';

                    return (
                      <div
                        key={item.id}
                        className="p-4 rounded-2xl bg-slate-900/30 border border-slate-900 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-white">Requested: ₹{reqAmt}</span>
                            <span className="text-[9px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono uppercase font-bold">
                              {item.method}
                            </span>
                          </div>
                          <span
                            className={`text-[10px] font-black px-2.5 py-0.5 rounded ${
                              item.status === 'APPROVED'
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : item.status === 'REJECTED'
                                ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                                : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                            }`}
                          >
                            {item.status}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 text-[11px]">
                          <div>
                            <span className="text-slate-500 block text-[9px] uppercase font-bold">Requested</span>
                            <span className="font-bold text-slate-200">₹{reqAmt}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[9px] uppercase font-bold">Tax</span>
                            <span className="font-bold text-rose-400">₹{taxAmt}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[9px] uppercase font-bold">Net Payout</span>
                            <span className="font-bold text-emerald-400">₹{netPayout}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                          <span className="truncate max-w-[200px]">{detailsStr}</span>
                          <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-8 rounded-2xl bg-slate-900/20 border border-dashed border-slate-800/80 text-center">
                    <Wallet className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="text-xs text-slate-500 font-bold">No withdrawal logs found</p>
                    <p className="text-[10px] text-slate-600 mt-1">Request your first payout in the Withdraw tab.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'referral' && (
          <div className="space-y-6">
            {earningBotId ? (
              <div className="p-5 rounded-3xl bg-slate-900/60 border border-emerald-500/30 text-center space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-base font-black text-white">{earningBotConfig?.botName || 'Earning Bot'} Refer & Earn</h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Get ₹{earningBotRefStats?.referralReward ?? (earningBotConfig?.referralReward || 0)} credited to your wallet for every verified friend who registers using your link.
                  </p>
                </div>

                <div className="pt-1">
                  <button
                    onClick={handleCopyLink}
                    className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition cursor-pointer"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copied ? 'Copied Referral Link!' : 'Copy Personal Referral Link'}</span>
                  </button>
                </div>

                {/* 6 Required Referral Statistics */}
                <div className="grid grid-cols-3 gap-2.5 pt-4 border-t border-slate-800/80">
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Total Referrals</span>
                    <span className="text-base font-black text-white">{earningBotRefStats?.total ?? user.totalReferrals ?? 0}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-emerald-500/30">
                    <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider block">🟢 Valid</span>
                    <span className="text-base font-black text-emerald-400">{earningBotRefStats?.valid ?? user.successfulReferrals ?? 0}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-amber-500/30">
                    <span className="text-[9px] text-amber-400 font-bold uppercase tracking-wider block">🟡 Pending</span>
                    <span className="text-base font-black text-amber-400">{earningBotRefStats?.pending ?? 0}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-rose-500/30">
                    <span className="text-[9px] text-rose-400 font-bold uppercase tracking-wider block">🔴 Rejected</span>
                    <span className="text-base font-black text-rose-400">{earningBotRefStats?.rejected ?? 0}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-emerald-500/30">
                    <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider block">Available Earnings</span>
                    <span className="text-base font-black text-emerald-400">₹{earningBotRefStats?.availableEarnings ?? (user.totalReferralEarnings ?? 0)}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-amber-500/30">
                    <span className="text-[9px] text-amber-400 font-bold uppercase tracking-wider block">Pending Earnings</span>
                    <span className="text-base font-black text-amber-400">₹{earningBotRefStats?.pendingEarnings ?? 0}</span>
                  </div>
                </div>

                {/* COMPACT TRUST & STATUS CARD */}
                <div className="p-4 bg-slate-950/90 rounded-2xl border border-slate-800 text-left space-y-3">
                  <div className="flex items-center gap-2 text-xs font-black uppercase text-amber-400 tracking-wider">
                    <ShieldCheck className="w-4 h-4 text-amber-400" />
                    <span>🔐 Transparent & Secure Referral System</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Register through the official referral link, complete security verification, and receive the applicable signup & referral bonuses. Referral eligibility is checked automatically to prevent duplicate devices.
                  </p>
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800/80 space-y-1 text-[11px]">
                    <div className="font-bold text-slate-200">Referral Status Definitions:</div>
                    <div className="text-slate-300">🟢 <b>VALID</b>: Unique device & IP verified. Reward credited immediately.</div>
                    <div className="text-slate-300">🟡 <b>PENDING</b>: Verification in progress.</div>
                    <div className="text-slate-300">🔴 <b>REJECTED</b>: Duplicate device/IP detected. Referral reward withheld.</div>
                  </div>
                  <div className="text-[10px] text-emerald-400 font-medium italic border-t border-slate-800/80 pt-2">
                    💡 <b>Account Safety Guarantee</b>: Your account can continue to use the bot even if a referral is rejected. Only the referral reward is rejected.
                  </div>
                </div>
              </div>
            ) : (
              /* Standard Roy Share Wallet Invite Box */
              <div className="p-5 rounded-3xl bg-slate-900/40 border border-slate-800/60 text-center space-y-4">
                <Users className="w-10 h-10 text-amber-400 mx-auto" />
                <h2 className="text-base font-black text-white">Refer & Earn Real Cash</h2>
                <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
                  Get ₹10 credited directly to your wallet for every friend who joins using your link. Claim huge milestone bonuses as your count grows!
                </p>

                <div className="pt-2">
                  <button
                    onClick={handleCopyLink}
                    className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg transition"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copied ? 'Copied Link!' : 'Copy Personal Invite Link'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-800/50">
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Total Invites</span>
                    <span className="text-xl font-black text-amber-400">{user.referralCount || 0} Friends</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Refer Earned</span>
                    <span className="text-xl font-black text-emerald-400">₹{(user.referralCount || 0) * 10}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Milestones list */}
            <div className="space-y-3">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest block">Referral Milestones</h3>
              <div className="space-y-2.5">
                {milestones.map((m) => {
                  const currentCount = user.referralCount || 0;
                  const isUnlocked = currentCount >= m.req;
                  const hasClaimed = user.milestoneProgress?.[m.id] === 'claimed';
                  const status = hasClaimed ? 'CLAIMED' : isUnlocked ? 'CLAIMABLE' : 'LOCKED';

                  return (
                    <div
                      key={m.id}
                      className={`p-4 rounded-2xl border transition flex items-center justify-between ${
                        status === 'CLAIMED'
                          ? 'bg-slate-900/20 border-slate-900 opacity-60'
                          : status === 'CLAIMABLE'
                          ? 'bg-gradient-to-r from-amber-500/10 via-slate-900 to-slate-900 border-amber-500/30 shadow-md'
                          : 'bg-slate-900/30 border-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs ${
                            status === 'CLAIMED'
                              ? 'bg-slate-800 text-slate-500'
                              : status === 'CLAIMABLE'
                              ? 'bg-amber-500/20 text-amber-400'
                              : 'bg-slate-900 text-slate-600'
                          }`}
                        >
                          {m.req}
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-white">Milestone {m.req} Invites</h4>
                          <p className="text-[10px] text-slate-400">Claim bonus reward cash of ₹{m.reward}</p>
                        </div>
                      </div>

                      <div>
                        {status === 'CLAIMED' && (
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                            Claimed
                          </span>
                        )}
                        {status === 'CLAIMABLE' && (
                          <button
                            onClick={() => handleClaimMilestone(m.id, m.reward, m.req)}
                            className="py-1.5 px-3 rounded-lg bg-amber-500 text-slate-950 font-black text-[10px] hover:bg-amber-400 uppercase tracking-wider"
                          >
                            Claim ₹{m.reward}
                          </button>
                        )}
                        {status === 'LOCKED' && (
                          <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider">
                            Locked ({currentCount}/{m.req})
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'tasks' && (
          <div className="space-y-6">
            <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800/60">
              <h2 className="text-xs font-black text-slate-300 uppercase tracking-widest mb-1">Earn Cash & Coins</h2>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Complete tasks below to earn real cash and coins. For manual audit tasks, upload your registration screenshot proof for instant admin verification.
              </p>
            </div>

            <div className="space-y-3">
              {tasks.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 rounded-2xl bg-slate-900/20 border border-slate-800">
                  No active tasks available right now. Check back soon!
                </div>
              ) : (
                tasks.map((task) => {
                  const isCompleted = user?.completedTasks?.includes(task.id);
                  const isManual = task.verificationType === 'manual';
                  const taskSubs = userManualSubmissions.filter((s) => s.taskId === task.id);
                  const latestSub = taskSubs[0];

                  const pendingSub = taskSubs.find((s) => s.status === 'PENDING_APPROVAL');
                  const approvedSub = taskSubs.find((s) => s.status === 'APPROVED');
                  const rejectedSub = taskSubs.find((s) => s.status === 'REJECTED');

                  return (
                    <div
                      key={task.id}
                      className={`p-4 rounded-2xl bg-slate-900/50 border border-slate-800/80 space-y-3 transition ${
                        isCompleted || approvedSub ? 'opacity-75' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          {task.taskImage ? (
                            <img src={task.taskImage} alt={task.title} className="w-11 h-11 rounded-xl object-cover border border-slate-800 shrink-0" />
                          ) : (
                            <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-amber-400 shrink-0">
                              <CheckSquare className="w-5 h-5" />
                            </div>
                          )}
                          <div className="space-y-1">
                            <h3 className="text-xs font-black text-white">{task.title}</h3>
                            {task.description && (
                              <p className="text-[11px] text-slate-400 leading-normal line-clamp-2">{task.description}</p>
                            )}
                            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                              <span className="text-[9px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/10 px-1.5 py-0.5 rounded font-bold">
                                +₹{task.reward} Cash
                              </span>
                              {task.coins > 0 && (
                                <span className="text-[9px] bg-amber-500/15 text-amber-400 border border-amber-500/10 px-1.5 py-0.5 rounded font-bold">
                                  +{task.coins} Coins
                                </span>
                              )}
                              {isManual && (
                                <span className="text-[9px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5">
                                  <ShieldCheck className="w-3 h-3" /> Manual Audit
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Manual Audit Status Info Box */}
                      {isManual && latestSub && (
                        <div className="p-3 rounded-xl bg-slate-950 border border-slate-850 space-y-1 text-xs">
                          {latestSub.status === 'PENDING_APPROVAL' && (
                            <div className="flex items-center gap-2 text-amber-400 font-bold">
                              <Clock className="w-4 h-4 animate-spin" />
                              <span>Proof Submitted (Pending Admin Review)</span>
                            </div>
                          )}
                          {latestSub.status === 'APPROVED' && (
                            <div className="flex items-center gap-2 text-emerald-400 font-bold">
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Approved & ₹{task.reward} Credited to Wallet!</span>
                            </div>
                          )}
                          {latestSub.status === 'REJECTED' && (
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 text-rose-400 font-bold">
                                <XCircle className="w-4 h-4" />
                                <span>Proof Rejected</span>
                              </div>
                              {latestSub.rejectionReason && (
                                <p className="text-[11px] text-slate-400">Reason: {latestSub.rejectionReason}</p>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Task Action Buttons */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
                        {task.externalDestinationUrl || task.url ? (
                          <a
                            href={task.externalDestinationUrl || task.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] font-bold text-sky-400 hover:underline flex items-center gap-1"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>Visit Link</span>
                          </a>
                        ) : (
                          <span />
                        )}

                        <div>
                          {isCompleted || approvedSub ? (
                            <span className="text-xs text-emerald-400 font-black flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl">
                              <Check className="w-3.5 h-3.5" />
                              <span>Completed</span>
                            </span>
                          ) : isManual ? (
                            pendingSub ? (
                              <button
                                disabled
                                className="py-1.5 px-3 rounded-xl bg-slate-800 text-amber-400 font-bold text-xs cursor-not-allowed flex items-center gap-1"
                              >
                                <Clock className="w-3.5 h-3.5 animate-spin" />
                                <span>Pending Audit</span>
                              </button>
                            ) : (
                              <button
                                onClick={async () => {
                                  try {
                                    const tgId = getTelegramUserId();
                                    const res = await fetch('/api/tasks/start-attempt', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({
                                        taskId: task.id,
                                        userId: user?.id || user?.uid || String(tgId),
                                        telegramUserId: String(tgId || user?.telegramId || ''),
                                        earningBotId: earningBotId || task.earningBotId || 'roy_share_wallet'
                                      })
                                    });
                                    const data = await res.json();
                                    if (data.success || data.attempt) {
                                      setActiveProofTask(task);
                                      setProofMobile('');
                                      setProofImageBase64('');
                                      setProofError(null);
                                      if (task.externalDestinationUrl || task.url) {
                                        window.open(task.externalDestinationUrl || task.url, '_blank');
                                      }
                                    } else {
                                      showToast(data.error || 'Cannot start task attempt', 'error');
                                    }
                                  } catch (e: any) {
                                    showToast(e.message || 'Error starting task attempt', 'error');
                                  }
                                }}
                                className="py-2 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/10 flex items-center gap-1.5 transition"
                              >
                                <Upload className="w-3.5 h-3.5" />
                                <span>{rejectedSub && task.allowResubmission !== false ? 'Resubmit Proof' : 'TASK NOW / Submit Proof'}</span>
                              </button>
                            )
                          ) : (
                            <button
                              onClick={() => handleVerifyTask(task.id)}
                              className="py-2 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-lg transition"
                            >
                              Claim Reward
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {activeTab === 'giveaways' && (
          <div className="space-y-6 animate-fade-in">
            <div className="p-4 rounded-2xl bg-gradient-to-tr from-amber-500/10 to-slate-900 border border-slate-800 flex items-center gap-3 shadow-lg">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shadow-md">
                <Gift className="w-5 h-5 animate-bounce" />
              </div>
              <div>
                <h2 className="text-xs font-black text-white uppercase tracking-widest">Lucky Number Giveaway</h2>
                <p className="text-[10px] text-slate-400">Pick your lucky number, claim your slot, and win cash instantly!</p>
              </div>
            </div>

            {giveawayLoading ? (
              <div className="p-12 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
                <span>Synchronizing with live server...</span>
              </div>
            ) : !activeGiveaway ? (
              <div className="p-12 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-2xl">
                <Gift className="w-10 h-10 mx-auto mb-2 text-slate-600" />
                <span className="font-bold">No Active Giveaways</span>
                <p className="text-[10px] text-slate-600 mt-1">Check back later or watch for channel announcements!</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Giveaway Details Card */}
                <div className="p-5 rounded-3xl bg-slate-900/60 border border-slate-800/60 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2.5 py-1 rounded-full font-black uppercase tracking-wider">
                      Live Jackpot
                    </span>
                    <span className="text-[10px] text-rose-400 font-bold flex items-center gap-1">
                      <Timer className="w-3.5 h-3.5" />
                      {timeRemaining !== null && timeRemaining > 0 ? (
                        <span className="font-mono font-black">
                          {timeRemaining > 10 ? (
                            <>Entries Close: {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}</>
                          ) : (
                            <span className="text-rose-500 animate-pulse font-black">Drawing Starts: {timeRemaining}s</span>
                          )}
                        </span>
                      ) : activeGiveaway.status === 'drawing' || animatingDraw ? (
                        <span className="text-purple-400 font-black animate-pulse uppercase">DRAWING IN PROGRESS...</span>
                      ) : (
                        <span className="text-slate-500 uppercase">CLOSED</span>
                      )}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-sm font-black text-white">{activeGiveaway.title}</h3>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Jackpot Pool: <strong className="text-amber-400 font-black">₹{activeGiveaway.prizeAmount}</strong> • Winners: <strong className="text-sky-400 font-bold">{activeGiveaway.winnerCount} Slots</strong>
                    </p>
                    {activeGiveaway.description && (
                      <p className="text-[10px] text-slate-400 mt-1.5 bg-slate-950/40 p-2 rounded-xl border border-slate-800/40 font-medium">
                        {activeGiveaway.description}
                      </p>
                    )}
                    {activeGiveaway.bannerUrl && (
                      <img
                        src={activeGiveaway.bannerUrl}
                        alt="Giveaway Banner"
                        className="w-full h-24 object-cover rounded-xl mt-2 border border-slate-800"
                        referrerPolicy="no-referrer"
                      />
                    )}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <span className="text-[9px] bg-slate-950/80 border border-slate-800/80 px-2 py-1 rounded-lg text-slate-300 font-bold">
                        🎟️ Cost: <span className="text-amber-400 font-black">
                          {activeGiveaway.entryType === 'coins' ? `${activeGiveaway.entryFee} Roy Coins` :
                           activeGiveaway.entryType === 'balance' ? `₹${activeGiveaway.entryFee} Cash` :
                           'Free Entry'}
                        </span>
                      </span>
                      <span className="text-[9px] bg-slate-950/80 border border-slate-800/80 px-2 py-1 rounded-lg text-slate-300 font-bold">
                        👥 Limit: <span className="text-sky-400 font-black">Max {activeGiveaway.maxEntriesPerAccount || 1} slots</span>
                      </span>
                      {activeGiveaway.winnerMode === 'ai' && (
                        <span className="text-[9px] bg-purple-500/10 border border-purple-500/20 px-2 py-1 rounded-lg text-purple-400 font-black uppercase tracking-wider animate-pulse flex items-center gap-1">
                          🤖 AI Super-Select
                        </span>
                      )}
                    </div>
                  </div>

                  {/* ACTIVE / DRAWING / COMPLETED CONDITIONAL VIEWS */}
                  {activeGiveaway.status === 'drawing' || animatingDraw ? (
                    <div className="p-6 rounded-2xl bg-slate-950 border border-purple-500/30 text-center space-y-4 shadow-lg shadow-purple-500/5">
                      <div className="flex flex-col items-center">
                        <span className="text-[10px] text-purple-400 font-black uppercase tracking-widest block mb-1">
                          🎭 Live Draw Multi-Reel Machine 🎭
                        </span>
                        <p className="text-[9px] text-slate-500 font-medium">Staggered micro-seed reveals rolling now...</p>
                      </div>

                      {/* Staggered Casino Reels Container */}
                      <div className="flex justify-center gap-3 py-4 flex-wrap">
                        {reelValues.map((val, idx) => {
                          const isLanded = idx < reelsRevealed.length && reelsRevealed[idx];
                          return (
                            <div key={idx} className="relative w-16 h-20 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center overflow-hidden shadow-inner shadow-black">
                              {/* Background Confetti Canvas Per Reel */}
                              <canvas id={`canvas-reel-${idx}`} className="absolute inset-0 pointer-events-none z-0" />
                              
                              {/* Rolling Numbers with Motion Blur & Sparkle */}
                              <span
                                className={`text-3xl font-black font-mono tracking-tighter transition-all duration-300 z-10 ${
                                  isLanded
                                    ? 'text-amber-400 scale-110 drop-shadow-[0_0_8px_rgba(245,158,11,0.4)] animate-bounce'
                                    : 'text-purple-400 blur-[1px]'
                                }`}
                              >
                                {isLanded ? val : Math.floor(Math.random() * 10)}
                              </span>

                              {/* Corner Slot Borders */}
                              <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-slate-600 to-transparent" />
                              <div className="absolute bottom-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-slate-600 to-transparent" />
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex items-center justify-center gap-2 text-[10px] text-slate-400">
                        <span className="w-2 h-2 rounded-full bg-purple-500 animate-ping" />
                        <span>Verifying mathematical proof signatures on server ledger...</span>
                      </div>
                    </div>
                  ) : activeGiveaway.status === 'completed' ? (
                    <div className="p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 space-y-4">
                      <div className="text-center space-y-1">
                        <span className="text-[10px] text-emerald-400 font-black uppercase tracking-widest block">🎉 Draw Completed!</span>
                        <p className="text-[9px] text-slate-400">Winning numbers have been successfully drawn and credited!</p>
                      </div>

                      <div className="space-y-1.5 text-center">
                        <span className="text-[10px] text-slate-400 font-bold block">Winning Numbers Drawn:</span>
                        <div className="flex justify-center gap-2">
                          {activeGiveaway.winningNumbers?.map((n: number, idx: number) => {
                            const mySelectedWin = userJoinedNumber === n;
                            return (
                              <span
                                key={idx}
                                className={`w-11 h-11 rounded-xl font-black flex flex-col items-center justify-center shadow-lg text-sm relative ${
                                  mySelectedWin
                                    ? 'bg-amber-400 text-slate-950 shadow-amber-500/20'
                                    : 'bg-slate-950 text-white border border-slate-800'
                                }`}
                              >
                                <span>{n}</span>
                                {mySelectedWin && (
                                  <span className="text-[6px] font-black uppercase tracking-wider text-slate-950 font-sans absolute bottom-0.5">
                                    Yours
                                  </span>
                                )}
                              </span>
                            );
                          })}
                        </div>
                      </div>

                      {/* Personal winning reward state banner */}
                      {activeGiveaway.winners?.find((w: any) => String(w.telegramId) === getTelegramUserId()) ? (
                        <div className="p-3.5 bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 rounded-2xl font-black text-center text-xs space-y-1 shadow-lg shadow-amber-500/15 animate-pulse">
                          <p className="tracking-wide">🌟 EXTREME CHIP JACKPOT DETECTED! 🌟</p>
                          <p className="text-[10px] font-black uppercase tracking-wider">
                            You Won ₹{activeGiveaway.prizeAmount}! Main balance credited instantly.
                          </p>
                        </div>
                      ) : userJoinedNumber !== null ? (
                        <div className="text-[10px] text-slate-500 text-center font-bold">
                          Your number was <strong className="text-slate-300 font-mono font-black">{userJoinedNumber}</strong>. No matches this time. Better luck in the next drop!
                        </div>
                      ) : null}

                      {/* Winners spot list */}
                      <div className="pt-3 border-t border-slate-800/60 space-y-2">
                        <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">
                          🎁 Winners Spotlight:
                        </span>
                        <div className="space-y-1.5">
                          {activeGiveaway.winners && activeGiveaway.winners.length > 0 ? (
                            activeGiveaway.winners.map((w: any, idx: number) => (
                              <div key={idx} className="flex items-center justify-between text-[11px] p-2 bg-slate-950/40 rounded-xl border border-slate-900">
                                <div className="flex items-center gap-2">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                  <span className="font-bold text-slate-300">{w.firstName}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[9px] text-slate-500">Number: <strong>{w.selectedNumber}</strong></span>
                                  {w.transactionId && (
                                    <span className="text-[8px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 font-mono">
                                      TXN: {w.transactionId}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="p-3 text-center text-[10px] text-slate-600 font-semibold bg-slate-950/20 border border-dashed border-slate-800 rounded-xl">
                              No entrants picked the drawn numbers. Jackpot rolls over!
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Fair Play verification details badge */}
                      {activeGiveaway.drawSeed && (
                        <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] text-amber-400 font-black uppercase tracking-wider">
                              🛡️ Server Verified Fair Play Draw
                            </span>
                            <span className="text-[8px] text-slate-500 font-bold">SHA256 SECURED</span>
                          </div>
                          <div className="text-[8px] text-slate-400 space-y-1 divide-y divide-slate-900 font-mono">
                            <p className="py-1 flex justify-between">
                              <span className="text-slate-500">DRAW ID:</span>
                              <span className="text-slate-300">{activeGiveaway.drawId}</span>
                            </p>
                            <p className="py-1 flex justify-between">
                              <span className="text-slate-500">SEED:</span>
                              <span className="text-slate-300 truncate max-w-[150px]">{activeGiveaway.drawSeed}</span>
                            </p>
                            <p className="py-1 flex justify-between">
                              <span className="text-slate-500">HASH:</span>
                              <span className="text-slate-300 truncate max-w-[150px]">{activeGiveaway.winnerHash}</span>
                            </p>
                            <p className="py-1 flex justify-between">
                              <span className="text-slate-500">TIMESTAMP:</span>
                              <span className="text-slate-300">
                                {new Date(activeGiveaway.drawTimestamp).toLocaleString()}
                              </span>
                            </p>
                          </div>
                          <p className="text-[7px] text-slate-600 font-medium">
                            The seed is cryptographically signed and stored on the server before draw completion. Enter the seed and winning numbers in any standard SHA-256 verifier to match the Winner Hash.
                          </p>
                        </div>
                      )}
                    </div>
                  ) : activeGiveaway.status === 'paused' ? (
                    <div className="p-6 rounded-2xl bg-slate-950 border border-amber-500/20 text-center">
                      <span className="text-[10px] text-amber-400 font-bold uppercase tracking-widest block">Giveaway Temporarily Paused</span>
                      <p className="text-[10px] text-slate-500 mt-1">Admin has paused the draw entries. Please wait.</p>
                    </div>
                  ) : activeGiveaway.status === 'cancelled' ? (
                    <div className="p-6 rounded-2xl bg-slate-950 border border-rose-500/20 text-center">
                      <span className="text-[10px] text-rose-400 font-bold uppercase tracking-widest block">Giveaway Cancelled</span>
                      <p className="text-[10px] text-slate-500 mt-1">This event has been cancelled by the systems.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                          Select Your Lucky Number Slot ({activeGiveaway.numberRange})
                        </span>
                        <p className="text-[9px] text-slate-600 font-medium">
                          Claim up to {activeGiveaway.maxEntriesPerAccount || 1} slots. Each slot is exclusive to one claimant!
                        </p>
                      </div>

                      <div className="grid grid-cols-5 sm:grid-cols-6 gap-2">
                        {(() => {
                          const rangeParts = (activeGiveaway.numberRange || '1-24').split('-');
                          const min = Number(rangeParts[0]) || 1;
                          const max = Number(rangeParts[1]) || 24;
                          const numbersList = [];
                          for (let i = min; i <= max; i++) {
                            numbersList.push(i);
                          }

                          return numbersList.map((num) => {
                            const claimEntry = giveawayEntries.find((e) => e.selectedNumber === num);
                            const isTaken = claimEntry !== undefined;
                            const isMySelection = userJoinedNumbers.includes(num) || chosenNumber === num;
                            const isMyLockedNumber = userJoinedNumbers.includes(num);

                            return (
                              <button
                                key={num}
                                disabled={isTaken || userJoinedNumbers.includes(num) || userJoinedNumbers.length >= (activeGiveaway.maxEntriesPerAccount || 1) || activeGiveaway.status !== 'active'}
                                onClick={() => setChosenNumber(num)}
                                className={`h-11 rounded-xl text-xs font-black font-mono transition flex flex-col items-center justify-center border relative ${
                                  isMyLockedNumber
                                    ? 'bg-emerald-500 border-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/10 font-black'
                                    : isMySelection
                                    ? 'bg-amber-500 border-amber-500 text-slate-950 shadow-lg shadow-amber-500/10 animate-pulse font-black'
                                    : isTaken
                                    ? 'bg-slate-950/40 border-slate-950/60 text-slate-600 line-through opacity-40 cursor-not-allowed'
                                    : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-white hover:bg-slate-900'
                                }`}
                              >
                                <span>{num}</span>
                                {isTaken && (
                                  <span className="text-[7px] text-slate-500 line-clamp-1 truncate absolute bottom-0.5 w-full text-center px-0.5 font-bold">
                                    {claimEntry.firstName}
                                  </span>
                                )}
                              </button>
                            );
                          });
                        })()}
                      </div>

                      <div className="pt-2">
                        {userJoinedNumbers.length > 0 && userJoinedNumbers.length >= (activeGiveaway.maxEntriesPerAccount || 1) ? (
                          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold rounded-xl text-center flex items-center justify-center gap-1.5">
                            <Check className="w-4 h-4" />
                            <span>Your Lucky Slots: {userJoinedNumbers.join(', ')} are Locked! Waiting for draw...</span>
                          </div>
                        ) : activeGiveaway.totalPlayers >= activeGiveaway.maxPlayers ? (
                          <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold rounded-xl text-center">
                            This giveaway is full. Waiting for drawing results!
                          </div>
                        ) : chosenNumber !== null && !userJoinedNumbers.includes(chosenNumber) ? (
                          <button
                            onClick={handleJoinGiveaway}
                            disabled={joiningGiveaway}
                            className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl transition shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
                          >
                            {joiningGiveaway ? (
                              <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <>
                                <Gift className="w-4 h-4" />
                                <span>
                                  Claim Number {chosenNumber} ({userJoinedNumbers.length + 1}/{activeGiveaway.maxEntriesPerAccount || 1}) 
                                  {activeGiveaway.entryType === 'coins' ? ` • Pay ${activeGiveaway.entryFee} Coins` :
                                   activeGiveaway.entryType === 'balance' ? ` • Pay ₹${activeGiveaway.entryFee} Cash` :
                                   ' • Free'}
                                </span>
                              </>
                            )}
                          </button>
                        ) : (
                          <div className="p-3 bg-slate-950/60 border border-slate-900 text-slate-500 text-[10px] text-center rounded-xl font-semibold">
                            👇 Tap any available number above to reserve your slot {userJoinedNumbers.length > 0 ? `(${userJoinedNumbers.length}/${activeGiveaway.maxEntriesPerAccount || 1} claimed)` : ''} immediately!
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Joined progress bar */}
                  <div className="space-y-1.5 pt-2 border-t border-slate-800/40">
                    <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold">
                      <span>ENTRANT COUNT</span>
                      <span>{giveawayEntries.length} / {activeGiveaway.maxPlayers} SLOTS FILLED</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-rose-500 transition-all duration-500 rounded-full"
                        style={{ width: `${Math.min(100, (giveawayEntries.length / (activeGiveaway.maxPlayers || 1)) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* MY PERSONAL GIVEAWAY HISTORY / LOGS LIST */}
                <div className="p-5 rounded-3xl bg-slate-900/60 border border-slate-800/60 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                      📁 My Personal Giveaway History
                    </span>
                    <span className="text-[9px] text-slate-500 font-bold">Verified Ledger Logs</span>
                  </div>

                  {historyLoading ? (
                    <div className="p-4 text-center text-[10px] text-slate-600">
                      Loading personal logs...
                    </div>
                  ) : (() => {
                    const myHistory = pastGiveaways.map(g => {
                      const entry = myEntries.find(e => e.giveawayId === g.id);
                      const winnerRecord = g.winners?.find((w: any) => String(w.telegramId) === getTelegramUserId());
                      
                      let userStatus: 'won' | 'lost' | 'none' = 'none';
                      if (winnerRecord) {
                        userStatus = 'won';
                      } else if (entry) {
                        userStatus = 'lost';
                      }

                      return {
                        id: g.id,
                        title: g.title,
                        prizeAmount: g.prizeAmount,
                        winningNumbers: g.winningNumbers || [],
                        endedAt: g.endedAt,
                        selectedNumber: entry?.selectedNumber || winnerRecord?.selectedNumber || null,
                        transactionId: winnerRecord?.transactionId || null,
                        status: userStatus,
                      };
                    }).filter(item => item.status !== 'none');

                    if (myHistory.length === 0) {
                      return (
                        <div className="p-6 text-center text-[10px] text-slate-600 font-semibold bg-slate-950/20 rounded-xl border border-dashed border-slate-800">
                          You haven't participated in any completed giveaways yet. Claim a lucky number slot now!
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-2">
                        {myHistory.map((item, idx) => (
                          <div key={idx} className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-black text-white">{item.title}</span>
                              <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${
                                item.status === 'won'
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : 'bg-slate-900 text-slate-500 border border-slate-800'
                              }`}>
                                {item.status === 'won' ? 'WON' : 'NO WIN'}
                              </span>
                            </div>

                            <div className="flex justify-between items-center text-[9px] text-slate-400">
                              <span>Slot Selected: <strong>{item.selectedNumber}</strong></span>
                              <span>Draw Pool: <strong>₹{item.prizeAmount}</strong></span>
                            </div>

                            <div className="flex justify-between items-center text-[8px] text-slate-500 pt-1.5 border-t border-slate-900">
                              <span>Drawn: {item.winningNumbers?.join(', ') || '-'}</span>
                              <span>{new Date(item.endedAt).toLocaleDateString()}</span>
                            </div>

                            {item.status === 'won' && item.transactionId && (
                              <div className="flex justify-between items-center text-[8px] bg-emerald-500/5 p-1 rounded border border-emerald-500/10">
                                <span className="text-emerald-400 font-bold">Auto-Wallet Transfer:</span>
                                <span className="font-mono text-slate-300">TXN ID: {item.transactionId}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'withdraw' && (() => {
          const isUpiEnabled = withdrawalSettings ? (withdrawalSettings.upi?.enabled !== false) : true;
          const isQrEnabled = withdrawalSettings ? (withdrawalSettings.qr?.enabled !== false) : true;
          const isRedeemEnabled = withdrawalSettings ? (withdrawalSettings.redeem?.enabled !== false) : true;
          const isUltraPayEnabled = withdrawalSettings ? (withdrawalSettings.ultraPay?.enabled === true) : true;

          return (
            <div className="space-y-6">
              {withdrawalSettings && withdrawalSettings.allWithdrawalsEnabled === false && (
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs font-semibold text-rose-400 text-center">
                  🔧 Withdrawals Temporarily Unavailable
                  <p className="text-[10px] text-slate-400 mt-1">Withdrawal service is currently under maintenance. Please try again later.</p>
                </div>
              )}

              <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/15 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">Available Cash</span>
                  <span className="text-lg font-black text-emerald-400">₹{user.walletBalance ?? 0}</span>
                </div>
                <span className="text-[10px] text-slate-400 font-semibold bg-slate-900 px-2 py-1 rounded">
                  Min. Withdraw: ₹{getMinWithdrawAmount()}
                </span>
              </div>

              <form onSubmit={handleWithdrawSubmit} className="p-5 rounded-3xl bg-slate-900/30 border border-slate-900 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400">Withdrawal Method</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {isUpiEnabled && (
                      <button
                        type="button"
                        onClick={() => {
                          setWithdrawMethod('upi');
                          setWithdrawDetails('');
                        }}
                        className={`py-2.5 px-2 rounded-xl text-[10px] font-black uppercase border transition tracking-wider ${
                          withdrawMethod === 'upi'
                            ? 'bg-emerald-500 text-slate-950 border-emerald-500'
                            : 'bg-slate-900 text-slate-400 border-slate-850'
                        }`}
                      >
                        UPI Address
                      </button>
                    )}
                    {isQrEnabled && (
                      <button
                        type="button"
                        onClick={() => {
                          setWithdrawMethod('qr');
                          setWithdrawDetails('');
                        }}
                        className={`py-2.5 px-2 rounded-xl text-[10px] font-black uppercase border transition tracking-wider ${
                          withdrawMethod === 'qr'
                            ? 'bg-emerald-500 text-slate-950 border-emerald-500'
                            : 'bg-slate-900 text-slate-400 border-slate-850'
                        }`}
                      >
                        QR Link / Image
                      </button>
                    )}
                    {isRedeemEnabled && (
                      <button
                        type="button"
                        onClick={() => {
                          setWithdrawMethod('redeem_code');
                          setWithdrawDetails('');
                        }}
                        className={`py-2.5 px-2 rounded-xl text-[10px] font-black uppercase border transition tracking-wider ${
                          withdrawMethod === 'redeem_code'
                            ? 'bg-emerald-500 text-slate-950 border-emerald-500'
                            : 'bg-slate-900 text-slate-400 border-slate-850'
                        }`}
                      >
                        Redeem Code
                      </button>
                    )}
                    {isUltraPayEnabled && (
                      <button
                        type="button"
                        onClick={() => {
                          setWithdrawMethod('ultra_pay');
                          setWithdrawDetails('');
                        }}
                        className={`py-2.5 px-2 rounded-xl text-[10px] font-black uppercase border transition tracking-wider ${
                          withdrawMethod === 'ultra_pay'
                            ? 'bg-emerald-500 text-slate-950 border-emerald-500'
                            : 'bg-slate-900 text-slate-400 border-slate-850'
                        }`}
                      >
                        Ultra Pay
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400">Withdraw Amount (₹)</label>
                  <input
                    type="number"
                    placeholder="e.g. 500"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl py-3 px-4 text-xs font-bold text-white outline-none"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400">
                    {withdrawMethod === 'upi' && 'Your UPI Address / VPA'}
                    {withdrawMethod === 'qr' && 'Direct Payment QR Image Link'}
                    {withdrawMethod === 'redeem_code' && 'Specify Redeem Code Brand/Details (e.g. Amazon ₹500)'}
                    {withdrawMethod === 'ultra_pay' && 'Ultra Pay Registered Pay/Mobile Number'}
                  </label>
                  <input
                    type="text"
                    placeholder={
                      withdrawMethod === 'upi'
                        ? 'e.g. pay@upi'
                        : withdrawMethod === 'qr'
                        ? 'e.g. https://imgur.com/your-qr'
                        : withdrawMethod === 'redeem_code'
                        ? 'e.g. Google Play voucher code details'
                        : 'e.g. 10-digit registered number'
                    }
                    value={withdrawDetails}
                    onChange={(e) => setWithdrawDetails(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl py-3 px-4 text-xs font-bold text-white outline-none"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingWithdrawal || (withdrawalSettings && withdrawalSettings.allWithdrawalsEnabled === false)}
                  className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg transition"
                >
                  <Send className="w-4 h-4" />
                  <span>{isSubmittingWithdrawal ? 'Submitting...' : 'Request Payout Now'}</span>
                </button>
              </form>
            </div>
          );
        })()}

        {activeTab === 'profile' && (
          <div className="space-y-6">
            {/* Extended Profile Card */}
            <div className="p-5 rounded-3xl bg-slate-900/40 border border-slate-800/60 space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 p-0.5">
                  <img
                    src={user.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.telegramId}`}
                    alt="User Avatar"
                    className="w-full h-full rounded-[14px]"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">{user.userName}</h3>
                  <p className="text-xs text-slate-400 font-mono">UID: {user.appUid || user.uid || '804521'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-900">
                  <span className="text-[9px] text-slate-500 font-bold block uppercase tracking-wider mb-0.5">Verified Mobile</span>
                  <span className="font-bold text-emerald-400">{user.mobile || 'Verified'}</span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-900">
                  <span className="text-[9px] text-slate-500 font-bold block uppercase tracking-wider mb-0.5">Telegram User</span>
                  <span className="font-bold text-sky-400">@{user.username || 'Verified'}</span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-900">
                  <span className="text-[9px] text-slate-500 font-bold block uppercase tracking-wider mb-0.5">Telegram Verified</span>
                  <span className="font-bold text-emerald-400">🟢 Yes</span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-900">
                  <span className="text-[9px] text-slate-500 font-bold block uppercase tracking-wider mb-0.5">Mobile Verified</span>
                  <span className="font-bold text-emerald-400">🟢 Yes</span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-900">
                  <span className="text-[9px] text-slate-500 font-bold block uppercase tracking-wider mb-0.5">Joined Date</span>
                  <span className="font-bold text-slate-300">{(user.joinedDate || new Date().toISOString()).substring(0, 10)}</span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-900">
                  <span className="text-[9px] text-slate-500 font-bold block uppercase tracking-wider mb-0.5">Wallet Balance</span>
                  <span className="font-bold text-amber-400">₹{user.walletBalance ?? 0}</span>
                </div>
              </div>

              {/* Get OTP Verification Code Button */}
              <button
                onClick={handleGenerateOtp}
                disabled={isGeneratingOtp}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg transition"
              >
                <Key className="w-4 h-4" />
                <span>{isGeneratingOtp ? 'Generating Code...' : '🔐 Get Verification OTP Code'}</span>
              </button>
            </div>

            {/* Anti-Bot Trust Badge Section */}
            <div className="p-5 rounded-3xl bg-slate-900/40 border border-slate-800/60 space-y-3">
              <h3 className="text-xs font-black text-slate-300 uppercase tracking-widest">Security & Anti-Bot Credentials</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Your Telegram ID, contact verification, and device fingerprint have been authenticated and verified.
              </p>
              <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                <span className="text-xs font-bold text-emerald-300">Clean Security Score: {user.securityScore || 99}/100</span>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Navigation Tab Bar */}
      <div className="fixed bottom-3 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-md bg-slate-900/90 backdrop-blur-xl border border-slate-800/80 p-1.5 rounded-2xl flex justify-around items-center z-40 shadow-2xl">
        <button
          onClick={() => setActiveTab('wallet')}
          className={`flex flex-col items-center justify-center py-2 px-3 rounded-xl transition ${
            activeTab === 'wallet' ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Wallet className="w-4 h-4" />
          <span className="text-[9px] mt-1 font-bold">Wallet</span>
        </button>
        <button
          onClick={() => setActiveTab('referral')}
          className={`flex flex-col items-center justify-center py-2 px-3 rounded-xl transition ${
            activeTab === 'referral' ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          <span className="text-[9px] mt-1 font-bold">Referral</span>
        </button>
        <button
          onClick={() => setActiveTab('tasks')}
          className={`flex flex-col items-center justify-center py-2 px-3 rounded-xl transition ${
            activeTab === 'tasks' ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
          }`}
        >
          <CheckSquare className="w-4 h-4" />
          <span className="text-[9px] mt-1 font-bold">Tasks</span>
        </button>
        <button
          onClick={() => setActiveTab('giveaways')}
          className={`flex flex-col items-center justify-center py-2 px-3 rounded-xl transition ${
            activeTab === 'giveaways' ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Gift className="w-4 h-4" />
          <span className="text-[9px] mt-1 font-bold">Giveaways</span>
        </button>
        <button
          onClick={() => setActiveTab('profile')}
          className={`flex flex-col items-center justify-center py-2 px-3 rounded-xl transition ${
            activeTab === 'profile' ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
          }`}
        >
          <User className="w-4 h-4" />
          <span className="text-[9px] mt-1 font-bold">Profile</span>
        </button>
      </div>

      {/* MANUAL TASK PROOF SUBMISSION MODAL */}
      {activeProofTask && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-5 sm:p-6 space-y-4 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-amber-400 font-black text-sm">
                <Upload className="w-4 h-4" />
                <span>Submit Task Proof Screenshot</span>
              </div>
              <button
                onClick={() => setActiveProofTask(null)}
                className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1">
              <h3 className="text-sm font-black text-white">{activeProofTask.title}</h3>
              <p className="text-xs text-emerald-400 font-bold">Reward: ₹{activeProofTask.reward} Cash</p>
              {activeProofTask.description && (
                <p className="text-xs text-slate-300 pt-1 leading-relaxed">{activeProofTask.description}</p>
              )}
            </div>

            {/* External URL Action */}
            {(activeProofTask.externalDestinationUrl || activeProofTask.url) && (
              <a
                href={activeProofTask.externalDestinationUrl || activeProofTask.url}
                target="_blank"
                rel="noreferrer"
                className="p-3 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-bold flex items-center justify-between hover:bg-sky-500/20 transition"
              >
                <span>1. Open Registration Link First</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            )}

            {/* Demo Image Example Link */}
            {activeProofTask.proofDemoImage && (
              <button
                type="button"
                onClick={() => setShowDemoImageModal(true)}
                className="w-full p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-amber-500/20 transition"
              >
                <ImageIcon className="w-4 h-4" />
                <span>📷 See Example Required Screenshot</span>
              </button>
            )}

            <form onSubmit={handleManualProofSubmit} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">Registration Mobile Number (10 digits) *</label>
                <input
                  type="tel"
                  placeholder="e.g. 9876543210"
                  maxLength={10}
                  value={proofMobile}
                  onChange={(e) => setProofMobile(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3.5 text-xs font-bold text-white outline-none"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">Upload Screenshot Proof *</label>
                {proofImageBase64 ? (
                  <div className="relative rounded-2xl border border-slate-700 overflow-hidden max-h-48 bg-slate-950 flex items-center justify-center">
                    <img src={proofImageBase64} alt="Proof preview" className="max-h-48 object-contain" />
                    <button
                      type="button"
                      onClick={() => setProofImageBase64('')}
                      className="absolute top-2 right-2 bg-slate-950/80 text-rose-400 p-1.5 rounded-xl border border-slate-700 hover:bg-slate-900"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="w-full h-32 rounded-2xl border-2 border-dashed border-slate-700 bg-slate-950/80 hover:border-amber-500 flex flex-col items-center justify-center cursor-pointer p-4 transition text-center">
                    <Upload className="w-6 h-6 text-slate-400 mb-1" />
                    <span className="text-xs font-bold text-slate-300">Tap to Select Screenshot Proof</span>
                    <span className="text-[10px] text-slate-500 mt-0.5">JPG, PNG, WEBP (Max 5MB)</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      onChange={handleProofImageSelect}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {proofError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold">
                  {proofError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveProofTask(null)}
                  className="py-2.5 px-4 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingProof}
                  className="py-2.5 px-5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-lg flex items-center gap-1.5"
                >
                  {isSubmittingProof ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Submit Proof for Audit</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PROOF DEMO EXAMPLE IMAGE MODAL */}
      {showDemoImageModal && activeProofTask?.proofDemoImage && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-5 space-y-3 shadow-2xl relative">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-xs font-black text-amber-400">Example Screenshot Proof Required</span>
              <button
                onClick={() => setShowDemoImageModal(false)}
                className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto rounded-2xl border border-slate-800 bg-slate-950 flex items-center justify-center p-2">
              <img src={activeProofTask.proofDemoImage} alt="Demo screenshot" className="max-h-[65vh] object-contain rounded-xl" />
            </div>
            <button
              onClick={() => setShowDemoImageModal(false)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
            >
              Close Example
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
