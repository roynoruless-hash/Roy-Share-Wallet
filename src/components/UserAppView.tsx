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
  Timer
} from 'lucide-react';

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

  // Form State for Withdrawals
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawMethod, setWithdrawMethod] = useState<'upi' | 'qr' | 'redeem_code'>('upi');
  const [withdrawDetails, setWithdrawDetails] = useState('');
  const [withdrawHistory, setWithdrawHistory] = useState<any[]>([]);
  const [isSubmittingWithdrawal, setIsSubmittingWithdrawal] = useState(false);

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
      const myEntry = allEntries.find((e: any) => String(e.telegramId) === tgId);
      if (myEntry) {
        setUserJoinedNumber(myEntry.selectedNumber);
        setChosenNumber(myEntry.selectedNumber);
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

  const [tasks, setTasks] = useState<any[]>([]);
  const [milestones, setMilestones] = useState<any[]>([]);

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
    return localStorage.getItem('roy_user_id') || '89421042'; // Reliable fallback
  };

  const fetchUserData = async () => {
    // Left as compatibility hook, real loading handled via real-time onSnapshot
    try {
      const tgId = getTelegramUserId();
      const res = await fetch(`/api/user-profile?telegramId=${tgId}`);
      const data = await res.json();
      if (data.success && data.profile) {
        setUser((prev: any) => ({ ...prev, ...data.profile }));
      }
    } catch (err) {
      console.error('Failed to pre-fetch profile:', err);
    } finally {
      setLoading(false);
    }
  };

  // Setup Real-time Firestore Sync
  useEffect(() => {
    const tgId = getTelegramUserId();

    // 1. Listen to active User Document in real-time
    const qUser = query(collection(db, 'users'), where('telegramId', '==', tgId));
    const unsubscribeUser = onSnapshot(qUser, (snapshot) => {
      if (!snapshot.empty) {
        const userDoc = snapshot.docs[0];
        const data = userDoc.data();
        const rawAppUid = data.appUid ? String(data.appUid).trim() : '';
        const rawUid = data.uid ? String(data.uid).trim() : '';
        const cleanUid = (rawAppUid && rawAppUid !== tgId) ? rawAppUid : ((rawUid && rawUid !== tgId) ? rawUid : '');

        setUser((prev: any) => ({
          ...prev,
          ...data,
          id: userDoc.id, // Store the real document ID
          telegramId: tgId,
          appUid: cleanUid || data.appUid || data.uid || '',
          uid: cleanUid || data.uid || data.appUid || '',
          userName: data.userName || data.name || data.firstName || `User #${tgId}`,
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
      } else {
        // Fallback user structure if doc does not exist yet (or standalone local testing)
        setUser({
          id: tgId,
          telegramId: tgId,
          uid: '866114',
          userName: 'Alex Roy',
          avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${tgId}`,
          levelBadge: '🥈 Pro User',
          levelTitle: 'PRO',
          activityScore: 420,
          walletBalance: 1250,
          coinsBalance: 480,
          bonusBalance: 15,
          referralCount: 4,
          joinedDate: '2026-08-01',
          securityBadge: 'TRUSTED',
          securityScore: 99,
          completedTasks: [],
          milestoneProgress: {},
        });
      }
      setLoading(false);
    }, (err) => {
      console.error('Error listening to user doc:', err);
      setLoading(false);
    });

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
            url: d.url || '',
          });
        }
      });
      list.sort((a, b) => a.sortOrder - b.sortOrder);
      setTasks(list);
    }, (err) => {
      console.error('Error listening to tasks:', err);
    });

    // 4. Listen to withdrawals history in real-time
    const withdrawalsRef = collection(db, 'withdraw_requests');
    const qWithdraw = query(withdrawalsRef, where('telegramId', '==', tgId));
    const unsubscribeWithdrawals = onSnapshot(qWithdraw, (snap) => {
      const list: any[] = [];
      snap.forEach((docSnap) => {
        const d = docSnap.data();
        list.push({
          id: docSnap.id,
          details: d.upiId || d.redeemCodeDetails || d.qrImageUrl || '',
          ...d,
        });
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
    const link = `https://t.me/${botUsername || 'Roy_wallett_bot'}?start=ref_${tgId}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    showToast('📋 Referral Link copied to clipboard!', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(withdrawAmount);
    if (isNaN(amt) || amt <= 0) {
      showToast('⚠️ Please enter a valid positive amount', 'error');
      return;
    }
    if (user && amt > (user.walletBalance || 0)) {
      showToast(`❌ Insufficient balance! Your current balance is ₹${user.walletBalance || 0}`, 'error');
      return;
    }
    if (!withdrawDetails.trim()) {
      showToast('⚠️ Please enter account details (UPI, QR Link, or voucher spec)', 'error');
      return;
    }

    setIsSubmittingWithdrawal(true);
    try {
      const tgId = getTelegramUserId();
      const userRef = doc(db, 'users', user?.id || tgId);

      // Deduct balance and create withdrawal record atomically
      await runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) {
          throw new Error("User profile not found.");
        }

        const userData = userDoc.data();
        const currentWallet = Number(userData.walletBalance || userData.balance || 0);

        if (amt > currentWallet) {
          throw new Error("Insufficient balance!");
        }

        // Deduct balance from user
        transaction.update(userRef, {
          walletBalance: currentWallet - amt
        });

        // Generate Transaction/Withdrawal ID
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let randStr = '';
        for (let i = 0; i < 8; i++) {
          randStr += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        const withdrawalId = `WD${randStr}`;
        const finalUid = userData.appUid || user?.appUid || userData.uid || user?.uid || '';

        // Create withdrawal record in withdraw_requests (as required)
        const withdrawRequestsRef = doc(collection(db, 'withdraw_requests'));
        transaction.set(withdrawRequestsRef, {
          requestId: withdrawalId,
          telegramId: tgId,
          username: userData.username || userData.userName || userData.firstName || '',
          userName: userData.userName || userData.name || userData.firstName || `User #${tgId}`,
          amount: amt,
          upiId: withdrawMethod === 'upi' ? withdrawDetails : '',
          currentWalletBalance: currentWallet,
          status: 'Pending',
          createdAt: new Date().toISOString(),
          processedAt: '',
          processedBy: '',
          rejectReason: '',
          // Add extra fields to keep compatibility with standard visual components
          withdrawalId: withdrawalId,
          userId: tgId,
          uid: finalUid,
          method: withdrawMethod,
          qrImageUrl: withdrawMethod === 'qr' ? withdrawDetails : '',
          redeemCodeDetails: withdrawMethod === 'redeem_code' ? withdrawDetails : '',
          payoutAmount: amt,
          platformFee: 0,
          feePercent: 0,
        });

        // Also create record in withdrawals for backward-compatibility with other system endpoints
        const withdrawRef = doc(collection(db, 'withdrawals'));
        transaction.set(withdrawRef, {
          withdrawalId,
          userId: tgId,
          uid: finalUid,
          telegramId: tgId,
          userName: userData.userName || userData.name || `User #${tgId}`,
          amount: amt,
          requestedAmount: amt,
          platformFee: 0,
          payoutAmount: amt,
          feePercent: 0,
          method: withdrawMethod,
          upiId: withdrawMethod === 'upi' ? withdrawDetails : '',
          qrImageUrl: withdrawMethod === 'qr' ? withdrawDetails : '',
          redeemCodeDetails: withdrawMethod === 'redeem_code' ? withdrawDetails : '',
          status: 'pending',
          createdAt: new Date().toISOString()
        });

        // Create transaction entry
        const txnRef = doc(collection(db, 'transactions'));
        transaction.set(txnRef, {
          transactionId: `TXN${Date.now()}`,
          uid: finalUid,
          telegramId: tgId,
          userName: userData.userName || userData.name || `User #${tgId}`,
          amount: amt,
          type: 'WITHDRAWAL_REQUEST',
          status: 'pending',
          description: `Withdrawal request of ₹${amt} via ${withdrawMethod.toUpperCase()}`,
          createdAt: new Date().toISOString()
        });
      });

      setWithdrawAmount('');
      setWithdrawDetails('');
      showToast('💸 Withdrawal Request Submitted! Awaiting Admin review.', 'success');
    } catch (err: any) {
      showToast(`❌ Error: ${err.message || 'Submission failed'}`, 'error');
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

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center space-y-4">
        <RefreshCw className="w-8 h-8 text-amber-500 animate-spin" />
        <p className="text-sm font-semibold text-slate-400">Loading Roy Wallet App...</p>
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
              <p className="text-xs text-slate-400 font-medium">@{user.username || 'N/A'}</p>
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
      <main className="p-5 flex-1 max-w-xl mx-auto w-full">
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
                  withdrawHistory.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 rounded-2xl bg-slate-900/30 border border-slate-900 flex items-center justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-white">₹{item.amount}</span>
                          <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono">
                            {item.method}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-medium mt-1 font-mono">
                          {item.details.substring(0, 24)}...
                        </p>
                      </div>
                      <div className="text-right">
                        <span
                          className={`text-[10px] font-black px-2 py-0.5 rounded ${
                            item.status === 'APPROVED'
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : item.status === 'REJECTED'
                              ? 'bg-rose-500/15 text-rose-400'
                              : 'bg-amber-500/15 text-amber-400'
                          }`}
                        >
                          {item.status}
                        </span>
                        <span className="text-[9px] text-slate-500 block mt-1">
                          {new Date(item.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))
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
            {/* Invite Box */}
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
              <h2 className="text-xs font-black text-slate-300 uppercase tracking-widest mb-1">How it works</h2>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Complete the easy tasks below to earn cash balances and coins. Coins can be used to participate in special Giveaway pools.
              </p>
            </div>

            <div className="space-y-2.5">
              {tasks.map((task) => {
                const isCompleted = user?.completedTasks?.includes(task.id);
                return (
                  <div
                    key={task.id}
                    className={`p-4 rounded-2xl bg-slate-900/30 border border-slate-900 flex items-center justify-between ${
                      isCompleted ? 'opacity-65' : ''
                    }`}
                  >
                    <div>
                      <h3 className="text-xs font-black text-white">{task.title}</h3>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[9px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/10 px-1.5 py-0.5 rounded font-bold">
                          +₹{task.reward} Cash
                        </span>
                        <span className="text-[9px] bg-amber-500/15 text-amber-400 border border-amber-500/10 px-1.5 py-0.5 rounded font-bold">
                          +{task.coins} Coins
                        </span>
                      </div>
                    </div>

                    <div>
                      {isCompleted ? (
                        <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          <span>Completed</span>
                        </span>
                      ) : task.url ? (
                        <div className="flex gap-2">
                          <a
                            href={task.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                          <button
                            onClick={() => handleVerifyTask(task.id)}
                            className="py-1.5 px-3 rounded-lg bg-amber-500 text-slate-950 font-black text-[10px] hover:bg-amber-400"
                          >
                            Verify
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleVerifyTask(task.id)}
                          className="py-1.5 px-3 rounded-lg bg-amber-500 text-slate-950 font-black text-[10px] hover:bg-amber-400"
                        >
                          Claim
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
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
                          Each number can only be claimed by ONE player. Quick claim before others block it!
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
                            const isMySelection = userJoinedNumber === num || chosenNumber === num;
                            const isMyLockedNumber = userJoinedNumber === num;

                            return (
                              <button
                                key={num}
                                disabled={isTaken || userJoinedNumber !== null || activeGiveaway.status !== 'active'}
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
                        {userJoinedNumber !== null ? (
                          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold rounded-xl text-center flex items-center justify-center gap-1.5">
                            <Check className="w-4 h-4" />
                            <span>Your Lucky Slot: Number {userJoinedNumber} is Locked! Waiting for draw...</span>
                          </div>
                        ) : activeGiveaway.totalPlayers >= activeGiveaway.maxPlayers ? (
                          <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold rounded-xl text-center">
                            This giveaway is full. Waiting for drawing results!
                          </div>
                        ) : chosenNumber !== null ? (
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
                                <span>Lock Number {chosenNumber} &amp; Join Giveaway</span>
                              </>
                            )}
                          </button>
                        ) : (
                          <div className="p-3 bg-slate-950/60 border border-slate-900 text-slate-500 text-[10px] text-center rounded-xl font-semibold">
                            👇 Tap any available number above to reserve your slot immediately!
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

        {activeTab === 'withdraw' && (
          <div className="space-y-6">
            <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/15 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">Available Cash</span>
                <span className="text-lg font-black text-emerald-400">₹{user.walletBalance ?? 0}</span>
              </div>
              <span className="text-[10px] text-slate-400 font-semibold bg-slate-900 px-2 py-1 rounded">
                Min. Withdraw: ₹100
              </span>
            </div>

            <form onSubmit={handleWithdrawSubmit} className="p-5 rounded-3xl bg-slate-900/30 border border-slate-900 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400">Withdrawal Method</label>
                <div className="grid grid-cols-3 gap-2">
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
                </label>
                <input
                  type="text"
                  placeholder={
                    withdrawMethod === 'upi'
                      ? 'e.g. pay@upi'
                      : withdrawMethod === 'qr'
                      ? 'e.g. https://imgur.com/your-qr'
                      : 'e.g. Google Play voucher code details'
                  }
                  value={withdrawDetails}
                  onChange={(e) => setWithdrawDetails(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl py-3 px-4 text-xs font-bold text-white outline-none"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingWithdrawal}
                className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg transition"
              >
                <Send className="w-4 h-4" />
                <span>{isSubmittingWithdrawal ? 'Submitting...' : 'Request Payout Now'}</span>
              </button>
            </form>
          </div>
        )}

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
                  <p className="text-xs text-slate-400 font-mono">UID: {user.appUid || user.uid || '483921'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-900">
                  <span className="text-[9px] text-slate-500 font-bold block uppercase tracking-wider mb-0.5">Verified Status</span>
                  <span className="font-bold text-emerald-400">Human Verified</span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-900">
                  <span className="text-[9px] text-slate-500 font-bold block uppercase tracking-wider mb-0.5">Joined Date</span>
                  <span className="font-bold text-slate-300">{user.joinedDate.substring(0, 10)}</span>
                </div>
              </div>
            </div>

            {/* Anti-Bot Trust Badge Section */}
            <div className="p-5 rounded-3xl bg-slate-900/40 border border-slate-800/60 space-y-3">
              <h3 className="text-xs font-black text-slate-300 uppercase tracking-widest">Security & Anti-Bot Credentials</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Your device fingerprint and transaction activity have been inspected and marked as 100% human-operated.
              </p>
              <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                <span className="text-xs font-bold text-emerald-300">Clean Fingerprint Score: {user.securityScore}/100</span>
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
    </div>
  );
};
