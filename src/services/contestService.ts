import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  deleteDoc,
  updateDoc,
  query,
  where,
  runTransaction,
  limit,
  orderBy
} from 'firebase/firestore';
import { db } from './firebase';
import { Contest, Contestant, VoteLog, BotUser } from '../types';
import { uploadImageWithFallback, uploadImageToStorage } from './storageService';
import { loadAdminConfig } from './configService';
import { addWarPointsForActivity } from './giveawayWarService';

/**
 * Fetch all contests from Firestore
 */
export async function getContests(): Promise<Contest[]> {
  try {
    const contestsRef = collection(db, 'contests');
    const querySnapshot = await getDocs(contestsRef);
    const contests: Contest[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      let banner = data.bannerUrl || data.imageUrl || '';

      // Asynchronously replace any legacy base64 image in Firestore
      if (banner.startsWith('data:image')) {
        const originalBase64 = banner;
        uploadImageToStorage(originalBase64, 'contests').then((publicUrl) => {
          if (publicUrl && publicUrl !== originalBase64) {
            updateDoc(docSnap.ref, { bannerUrl: publicUrl, imageUrl: publicUrl }).catch(() => {});
          }
        }).catch(() => {});
        banner = '';
      }

      contests.push({
        id: docSnap.id,
        title: data.title || '',
        description: data.description || '',
        bannerUrl: banner,
        imageUrl: banner,
        registrationStartDate: data.registrationStartDate || '',
        registrationEndDate: data.registrationEndDate || '',
        votingEndDate: data.votingEndDate || '',
        votingStarted: data.votingStarted || false,
        votingStartedAt: data.votingStartedAt || '',
        registrationClosedProcessed: data.registrationClosedProcessed || false,
        votingEndedProcessed: data.votingEndedProcessed || false,
        status: data.status || 'active',
        createdAt: data.createdAt || new Date().toISOString(),
        rules: data.rules || '',
        maxVotesPerUser: Number(data.maxVotesPerUser) || 1,
        voteIntervalHours: Number(data.voteIntervalHours) || 0,
        voterRewardAmount: Number(data.voterRewardAmount) || 0,
        winnerRewardAmount: Number(data.winnerRewardAmount) || 0,
        winnerPrizes: Array.isArray(data.winnerPrizes) ? data.winnerPrizes.map(Number) : [],
        totalWinners: Number(data.totalWinners) || 3,
      });
    });
    // Sort by createdAt desc
    contests.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return contests;
  } catch (err) {
    console.error('Error fetching contests:', err);
    return [];
  }
}

/**
 * Save or update a contest
 */
export async function saveContest(contest: Partial<Contest> & { id?: string }): Promise<string> {
  const contestId = contest.id || 'CST' + Math.random().toString(36).substring(2, 9).toUpperCase();
  const contestRef = doc(db, 'contests', contestId);

  let bannerUrl = contest.bannerUrl || contest.imageUrl || '';
  if (bannerUrl && bannerUrl.startsWith('data:image')) {
    try {
      const configRes = await loadAdminConfig();
      bannerUrl = await uploadImageWithFallback(bannerUrl, configRes.config?.imgbbApiKey, 'contests');
    } catch (err) {
      console.error('Failed to upload banner image:', err);
    }
  }

  const dataToSave: any = {
    title: contest.title || '',
    description: contest.description || '',
    bannerUrl: bannerUrl,
    imageUrl: bannerUrl,
    registrationStartDate: contest.registrationStartDate || new Date().toISOString().split('T')[0],
    registrationEndDate: contest.registrationEndDate || '',
    votingEndDate: contest.votingEndDate || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0] + 'T23:59',
    votingStarted: contest.votingStarted !== undefined ? contest.votingStarted : false,
    votingStartedAt: contest.votingStartedAt || '',
    registrationClosedProcessed: contest.registrationClosedProcessed !== undefined ? contest.registrationClosedProcessed : false,
    votingEndedProcessed: contest.votingEndedProcessed !== undefined ? contest.votingEndedProcessed : false,
    status: contest.status || 'active',
    createdAt: contest.createdAt || new Date().toISOString(),
    rules: contest.rules || '',
    maxVotesPerUser: contest.maxVotesPerUser !== undefined ? Number(contest.maxVotesPerUser) : 1,
    voteIntervalHours: contest.voteIntervalHours !== undefined ? Number(contest.voteIntervalHours) : 0,
    voterRewardAmount: contest.voterRewardAmount !== undefined ? Number(contest.voterRewardAmount) : 0,
    winnerRewardAmount: contest.winnerRewardAmount !== undefined ? Number(contest.winnerRewardAmount) : 0,
    winnerPrizes: Array.isArray(contest.winnerPrizes) ? contest.winnerPrizes.map(Number) : [],
    totalWinners: contest.totalWinners !== undefined ? Number(contest.totalWinners) : 3,
  };
  await setDoc(contestRef, dataToSave, { merge: true });
  return contestId;
}

/**
 * Delete a contest and optionally its contestants and vote logs
 */
export async function deleteContest(contestId: string): Promise<void> {
  const contestRef = doc(db, 'contests', contestId);
  await deleteDoc(contestRef);

  // Clean up contestants
  try {
    const contestantsRef = collection(db, 'contestants');
    const q = query(contestantsRef, where('contestId', '==', contestId));
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      await deleteDoc(doc(db, 'contestants', d.id));
    }
  } catch (err) {
    console.warn('Error cleaning up contestants of contest:', contestId, err);
  }
}

/**
 * Fetch contestants, optionally filtered by contestId
 */
export async function getContestants(contestId?: string): Promise<Contestant[]> {
  try {
    const contestantsRef = collection(db, 'contestants');
    const q = contestId ? query(contestantsRef, where('contestId', '==', contestId)) : contestantsRef;
    const querySnapshot = await getDocs(q);
    const contestants: Contestant[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      let img = data.imageUrl || '';

      if (img.startsWith('data:image')) {
        const originalBase64 = img;
        uploadImageToStorage(originalBase64, 'contestants').then((publicUrl) => {
          if (publicUrl && publicUrl !== originalBase64) {
            updateDoc(docSnap.ref, { imageUrl: publicUrl }).catch(() => {});
          }
        }).catch(() => {});
        img = '';
      }

      contestants.push({
        id: docSnap.id,
        contestId: data.contestId || '',
        contestTitle: data.contestTitle || '',
        name: data.name || '',
        telegramId: data.telegramId || '',
        username: data.username || '',
        description: data.description || '',
        imageUrl: img,
        votesCount: Number(data.votesCount) || 0,
        status: data.status || 'pending',
        createdAt: data.createdAt || new Date().toISOString(),
        voteLink: data.voteLink || '',
        rank: data.rank !== undefined ? Number(data.rank) : undefined,
        isWinner: data.isWinner !== undefined ? Boolean(data.isWinner) : undefined,
        winnerPrize: data.winnerPrize || '',
        winningTime: data.winningTime || '',
      });
    });
    // Sort by votesCount desc, then name asc
    contestants.sort((a, b) => b.votesCount - a.votesCount || a.name.localeCompare(b.name));
    return contestants;
  } catch (err) {
    console.error('Error fetching contestants:', err);
    return [];
  }
}

/**
 * Save or update a contestant
 */
export async function saveContestant(contestant: Partial<Contestant> & { id?: string; contestId: string }): Promise<string> {
  const contestantId = contestant.id || 'CNT' + Math.random().toString(36).substring(2, 9).toUpperCase();
  const contestantRef = doc(db, 'contestants', contestantId);

  let imageUrl = contestant.imageUrl || '';
  if (imageUrl && imageUrl.startsWith('data:image')) {
    try {
      const configRes = await loadAdminConfig();
      imageUrl = await uploadImageWithFallback(imageUrl, configRes.config?.imgbbApiKey, 'contestants');
    } catch (err) {
      console.error('Failed to upload contestant image:', err);
    }
  }

  const dataToSave: any = {
    contestId: contestant.contestId,
    contestTitle: contestant.contestTitle || '',
    name: contestant.name || '',
    telegramId: contestant.telegramId || '',
    username: contestant.username || '',
    description: contestant.description || '',
    imageUrl: imageUrl,
    votesCount: contestant.votesCount !== undefined ? Number(contestant.votesCount) : 0,
    status: contestant.status || 'pending',
    createdAt: contestant.createdAt || new Date().toISOString(),
  };
  if (contestant.voteLink !== undefined) {
    dataToSave.voteLink = contestant.voteLink;
  }
  if (contestant.rank !== undefined) {
    dataToSave.rank = Number(contestant.rank);
  }
  if (contestant.isWinner !== undefined) {
    dataToSave.isWinner = Boolean(contestant.isWinner);
  }
  if (contestant.winnerPrize !== undefined) {
    dataToSave.winnerPrize = contestant.winnerPrize;
  }
  if (contestant.prizeAmount !== undefined) {
    dataToSave.prizeAmount = Number(contestant.prizeAmount);
  }
  if (contestant.walletCreditStatus !== undefined) {
    dataToSave.walletCreditStatus = contestant.walletCreditStatus;
  }
  if (contestant.winningTime !== undefined) {
    dataToSave.winningTime = contestant.winningTime;
  }
  if (contestant.winnerStatus !== undefined) {
    dataToSave.winnerStatus = contestant.winnerStatus;
  }
  await setDoc(contestantRef, dataToSave, { merge: true });
  return contestantId;
}

/**
 * Credit contest prize to a winner's wallet and record transactions
 */
export async function creditContestantWinnerWallet(
  contestant: Contestant,
  contest: Contest,
  prizeAmount: number,
  rank: number
): Promise<{ success: boolean; status: 'credited' | 'failed' | 'none'; message?: string }> {
  if (prizeAmount <= 0) {
    return { success: true, status: 'none', message: 'No prize amount to credit' };
  }

  try {
    const usersRef = collection(db, 'users');
    let userDoc: any = null;

    // 1. Try matching by telegramId if present
    if (contestant.telegramId) {
      const qTg = query(usersRef, where('telegramId', '==', String(contestant.telegramId)), limit(1));
      const snapTg = await getDocs(qTg);
      if (!snapTg.empty) {
        userDoc = snapTg.docs[0];
      }
    }

    // 2. Try matching by username if not found
    if (!userDoc && contestant.username) {
      const cleanUsername = contestant.username.replace(/^@/, '').trim();
      if (cleanUsername) {
        const qUn = query(usersRef, where('username', '==', cleanUsername), limit(1));
        const snapUn = await getDocs(qUn);
        if (!snapUn.empty) {
          userDoc = snapUn.docs[0];
        }
      }
    }

    // 3. Try matching by name if not found
    if (!userDoc && contestant.name) {
      const qNm = query(usersRef, where('firstName', '==', contestant.name.trim()), limit(1));
      const snapNm = await getDocs(qNm);
      if (!snapNm.empty) {
        userDoc = snapNm.docs[0];
      }
    }

    if (!userDoc) {
      console.warn(`[creditContestantWinnerWallet] User doc not found for contestant ${contestant.name} (${contestant.telegramId})`);
      return { success: false, status: 'failed', message: 'User account not found' };
    }

    const userData = userDoc.data();
    const currentBalance = Number(userData.walletBalance) || 0;
    const newBalance = currentBalance + prizeAmount;
    const nowIso = new Date().toISOString();

    // Update user balance in Firestore
    await updateDoc(userDoc.ref, {
      walletBalance: newBalance,
      updatedAt: nowIso
    });

    // Record Transaction in transactions collection
    const txnId = 'TXN_WIN_' + Math.random().toString(36).substring(2, 10).toUpperCase();
    const txRef = doc(db, 'transactions', txnId);
    const rankLabel = rank === 1 ? '1st' : rank === 2 ? '2nd' : rank === 3 ? '3rd' : `${rank}th`;

    await setDoc(txRef, {
      id: txnId,
      transactionId: txnId,
      userId: userDoc.id,
      uid: userData.uid || '',
      telegramId: String(userData.telegramId || contestant.telegramId || ''),
      fullName: userData.firstName || contestant.name,
      mobile: userData.mobile || '',
      type: 'Contest Prize',
      amount: prizeAmount,
      balanceBefore: currentBalance,
      balanceAfter: newBalance,
      status: 'completed',
      description: `🏆 Prize for ${rankLabel} Place in contest "${contest.title}"`,
      createdAt: nowIso,
    });

    // Also record in walletTransactions collection for user history / bot
    const walletTxnId = 'WTX_WIN_' + Math.random().toString(36).substring(2, 10).toUpperCase();
    await setDoc(doc(db, 'walletTransactions', walletTxnId), {
      transactionId: walletTxnId,
      userId: userDoc.id,
      uid: userData.uid || '',
      type: 'Contest Prize',
      amount: prizeAmount,
      status: 'completed',
      description: `🏆 Prize for ${rankLabel} Place in contest "${contest.title}"`,
      createdAt: nowIso,
    });

    return { success: true, status: 'credited' };
  } catch (err: any) {
    console.error('Error crediting winner wallet:', err);
    return { success: false, status: 'failed', message: err.message };
  }
}

/**
 * Save or get a vote link in Firestore 'voteLinks' collection permanently
 */
export async function saveVoteLink(data: {
  contestId: string;
  contestantId: string;
  voteLink: string;
}): Promise<void> {
  const linkId = `vote_${data.contestId}_${data.contestantId}`;
  const linkRef = doc(db, 'voteLinks', linkId);
  await setDoc(linkRef, {
    id: linkId,
    contestId: data.contestId,
    contestantId: data.contestantId,
    voteLink: data.voteLink,
    createdAt: new Date().toISOString(),
  }, { merge: true });

  const contestantRef = doc(db, 'contestants', data.contestantId);
  await setDoc(contestantRef, { voteLink: data.voteLink }, { merge: true });
}

/**
 * Fetch vote links from Firestore
 */
export async function getVoteLinks(contestId?: string): Promise<any[]> {
  try {
    const ref = collection(db, 'voteLinks');
    const q = contestId ? query(ref, where('contestId', '==', contestId)) : ref;
    const snap = await getDocs(q);
    const links: any[] = [];
    snap.forEach((d) => links.push(d.data()));
    return links;
  } catch (err) {
    console.error('Error fetching vote links:', err);
    return [];
  }
}

/**
 * Add a log to 'contestLogs' collection
 */
export async function addContestLog(log: {
  contestId: string;
  action: string;
  details: string;
}): Promise<void> {
  try {
    const logsRef = collection(db, 'contestLogs');
    await addDoc(logsRef, {
      ...log,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Error adding contest log:', err);
  }
}

/**
 * Fetch contest logs from Firestore
 */
export async function getContestLogs(contestId?: string): Promise<any[]> {
  try {
    const ref = collection(db, 'contestLogs');
    const q = contestId ? query(ref, where('contestId', '==', contestId)) : ref;
    const snap = await getDocs(q);
    const logs: any[] = [];
    snap.forEach((d) => logs.push(d.data()));
    logs.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
    return logs;
  } catch (err) {
    console.error('Error fetching contest logs:', err);
    return [];
  }
}

/**
 * Delete a contestant
 */
export async function deleteContestant(contestantId: string): Promise<void> {
  const contestantRef = doc(db, 'contestants', contestantId);
  await deleteDoc(contestantRef);
}

/**
 * Fetch voting logs, optionally filtered by contestId
 */
export async function getVoteLogs(contestId?: string): Promise<VoteLog[]> {
  try {
    const logsRef = collection(db, 'voteLogs');
    const q = contestId ? query(logsRef, where('contestId', '==', contestId)) : logsRef;
    const querySnapshot = await getDocs(q);
    const logs: VoteLog[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      logs.push({
        id: docSnap.id,
        contestId: data.contestId || '',
        contestTitle: data.contestTitle || '',
        contestantId: data.contestantId || '',
        contestantName: data.contestantName || '',
        voterTelegramId: data.voterTelegramId || '',
        voterUsername: data.voterUsername || '',
        voterName: data.voterName || '',
        createdAt: data.createdAt || '',
        rewardEarned: Number(data.rewardEarned) || 0,
      });
    });
    // Sort by date desc
    logs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return logs;
  } catch (err) {
    console.error('Error fetching vote logs:', err);
    return [];
  }
}

/**
 * Transactional voting logic that ensures compliance with vote rules,
 * prevents double voting, and updates balances/transactions securely if voter rewards are enabled.
 */
export async function submitVote(params: {
  contestId: string;
  contestantId: string;
  voterTelegramId: string;
  voterName: string;
  voterUsername?: string;
  botToken?: string;
  ipHash?: string;
  deviceFingerprint?: string;
}): Promise<{ success: boolean; error?: string; rewardEarned?: number }> {
  const { contestId, contestantId, voterTelegramId, voterName, voterUsername, botToken, ipHash, deviceFingerprint } = params;

  if (!contestId || !contestantId || !voterTelegramId) {
    return { success: false, error: 'Missing contest, contestant, or voter Telegram ID.' };
  }

  try {
    const contestRef = doc(db, 'contests', contestId);
    const contestantRef = doc(db, 'contestants', contestantId);

    // Get the contest first to read config and check status
    const contestSnap = await getDoc(contestRef);
    if (!contestSnap.exists()) {
      return { success: false, error: 'Voting contest not found.' };
    }

    const contest = contestSnap.data() as Contest;

    if (contest.status === 'completed' || contest.votingEndedProcessed) {
      return { success: false, error: '🔒 This voting contest has ended. All voting links are now disabled.' };
    }

    if (contest.status === 'paused') {
      return { success: false, error: '⏸ This contest is currently paused by the administrator.' };
    }

    if (!contest.votingStarted) {
      return { success: false, error: '⏳ Voting for this contest has not been started yet by the administrator.' };
    }

    // Read the contestant
    const contestantSnap = await getDoc(contestantRef);
    if (!contestantSnap.exists()) {
      return { success: false, error: 'Contestant not found.' };
    }
    const contestant = contestantSnap.data() as Contestant;
    if (contestant.status !== 'approved') {
      return { success: false, error: 'Contestant is not active or approved.' };
    }

    // Query voter logs to verify limit constraints
    const logsRef = collection(db, 'voteLogs');
    const userVotesQuery = query(
      logsRef,
      where('contestId', '==', contestId),
      where('voterTelegramId', '==', String(voterTelegramId))
    );
    const userVotesSnap = await getDocs(userVotesQuery);
    const previousVotes: VoteLog[] = [];
    userVotesSnap.forEach((d) => previousVotes.push(d.data() as VoteLog));

    const now = new Date();

    // Check duplicate vote for same contestant (Requirement 8: One Telegram account = One vote per contestant)
    const votedForThisContestant = previousVotes.some((v) => v.contestantId === contestantId);
    if (votedForThisContestant) {
      return { success: false, error: 'You have already voted for this contestant.' };
    }

    const totalPreviousVotes = previousVotes.length;
    const maxVotes = contest.maxVotesPerUser || 1;

    // 1. Total Vote Count Check
    if (totalPreviousVotes >= maxVotes && !contest.voteIntervalHours) {
      return { success: false, error: `You have already voted the maximum (${maxVotes} time(s)) in this contest.` };
    }

    // 2. Interval Check (e.g. 24-hourly limit)
    if (contest.voteIntervalHours && contest.voteIntervalHours > 0) {
      // Find the latest vote timestamp
      if (previousVotes.length > 0) {
        previousVotes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        const lastVoteTime = new Date(previousVotes[0].createdAt).getTime();
        const hoursPassed = (now.getTime() - lastVoteTime) / (3600 * 1000);
        if (hoursPassed < contest.voteIntervalHours) {
          const hoursLeft = Math.ceil(contest.voteIntervalHours - hoursPassed);
          return {
            success: false,
            error: `Hourly limit! Please wait ${hoursLeft} hour(s) before casting another vote.`
          };
        }
      }
    }

    const rewardAmount = Number(contest.voterRewardAmount) || 0;
    let rewardGiven = 0;
    let updatedVotesCount = (contestant.votesCount || 0) + 1;

    // Execute firestore transaction to record vote, update vote count, and optionally credit voter's wallet
    await runTransaction(db, async (transaction) => {
      // Get fresh data inside transaction
      const innerContestantSnap = await transaction.get(contestantRef);
      if (!innerContestantSnap.exists()) {
        throw new Error('Contestant deleted during transaction');
      }
      const freshContestant = innerContestantSnap.data() as Contestant;
      const currentVotes = Number(freshContestant.votesCount) || 0;
      updatedVotesCount = currentVotes + 1;

      // Update contestant votes count
      transaction.update(contestantRef, {
        votesCount: updatedVotesCount,
      });

      // Write complete vote log (Requirement 9)
      const logId = 'VOT' + Math.random().toString(36).substring(2, 9).toUpperCase();
      const voteLogRef = doc(db, 'voteLogs', logId);
      transaction.set(voteLogRef, {
        id: logId,
        contestId,
        contestTitle: contest.title,
        contestantId,
        contestantName: freshContestant.name,
        voterTelegramId: String(voterTelegramId),
        voterUsername: voterUsername || '',
        voterName: voterName || 'User',
        createdAt: now.toISOString(),
        rewardEarned: rewardAmount,
        ipHash: ipHash || 'tg_internal',
        deviceFingerprint: deviceFingerprint || 'tg_mobile_app',
        verificationStatus: 'verified',
      });

      // If voterRewardAmount > 0, find and credit the user's wallet
      if (rewardAmount > 0) {
        // Find user by Telegram ID
        const usersRef = collection(db, 'users');
        const userQuery = query(usersRef, where('telegramId', '==', String(voterTelegramId)), limit(1));
        const userSnapshots = await getDocs(userQuery);

        if (!userSnapshots.empty) {
          const userDoc = userSnapshots.docs[0];
          const userRef = doc(db, 'users', userDoc.id);
          const userData = userDoc.data();
          const currentBalance = Number(userData.walletBalance) || 0;
          const newBalance = currentBalance + rewardAmount;

          // Update user wallet balance
          transaction.update(userRef, {
            walletBalance: newBalance,
          });

          // Generate TXN
          const txnId = 'TXN' + Math.random().toString(36).substring(2, 10).toUpperCase();
          const txRef = doc(db, 'transactions', txnId);
          transaction.set(txRef, {
            id: txnId,
            transactionId: txnId,
            userId: userDoc.id,
            uid: userData.uid || '',
            telegramId: String(voterTelegramId),
            fullName: userData.firstName || voterName,
            mobile: userData.mobile || '',
            type: 'Vote Bonus',
            amount: rewardAmount,
            balanceBefore: currentBalance,
            balanceAfter: newBalance,
            status: 'completed',
            description: `Voting reward in contest "${contest.title}"`,
            createdAt: now.toISOString(),
          });

          rewardGiven = rewardAmount;
        }
      }
    });

    // Automatically award Giveaway War verified vote points if active war exists
    try {
      if (voterTelegramId) {
        await addWarPointsForActivity({
          telegramId: String(voterTelegramId),
          activityType: 'verified_vote',
          description: `Verified Vote cast in Contest #${contestId}`,
          ipHash,
          deviceFingerprint,
        });
      }
    } catch (warErr) {
      console.warn('Error adding Giveaway War vote points:', warErr);
    }

    // Notify contestant instantly via Telegram (Requirement 11)
    if (contestant.telegramId && botToken) {
      const contestantNotifyText =
        `🎉 <b>New Vote Received!</b>\n\n` +
        `👤 <b>Voter:</b> ${voterName}\n` +
        `🗳 <b>Total Votes:</b> ${updatedVotesCount}`;

      fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: contestant.telegramId,
          text: contestantNotifyText,
          parse_mode: 'HTML',
        }),
      }).catch((err) => console.error('Error notifying contestant:', err));
    }

    return { success: true, rewardEarned: rewardGiven };
  } catch (err: any) {
    console.error('Error submitting vote transaction:', err);
    return { success: false, error: err.message || 'Failed to record vote.' };
  }
}
