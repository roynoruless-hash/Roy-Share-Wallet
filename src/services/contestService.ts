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
      contests.push({
        id: docSnap.id,
        title: data.title || '',
        description: data.description || '',
        imageUrl: data.imageUrl || '',
        registrationStartDate: data.registrationStartDate || '',
        registrationEndDate: data.registrationEndDate || '',
        votingEndDate: data.votingEndDate || '',
        registrationClosedProcessed: data.registrationClosedProcessed || false,
        votingEndedProcessed: data.votingEndedProcessed || false,
        status: data.status || 'active',
        createdAt: data.createdAt || new Date().toISOString(),
        rules: data.rules || '',
        maxVotesPerUser: Number(data.maxVotesPerUser) || 1,
        voteIntervalHours: Number(data.voteIntervalHours) || 0,
        voterRewardAmount: Number(data.voterRewardAmount) || 0,
        winnerRewardAmount: Number(data.winnerRewardAmount) || 0,
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
  const dataToSave = {
    title: contest.title || '',
    description: contest.description || '',
    imageUrl: contest.imageUrl || '',
    registrationStartDate: contest.registrationStartDate || new Date().toISOString().split('T')[0],
    registrationEndDate: contest.registrationEndDate || new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0] + 'T23:59',
    votingEndDate: contest.votingEndDate || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0] + 'T23:59',
    registrationClosedProcessed: contest.registrationClosedProcessed !== undefined ? contest.registrationClosedProcessed : false,
    votingEndedProcessed: contest.votingEndedProcessed !== undefined ? contest.votingEndedProcessed : false,
    status: contest.status || 'active',
    createdAt: contest.createdAt || new Date().toISOString(),
    rules: contest.rules || '',
    maxVotesPerUser: contest.maxVotesPerUser !== undefined ? Number(contest.maxVotesPerUser) : 1,
    voteIntervalHours: contest.voteIntervalHours !== undefined ? Number(contest.voteIntervalHours) : 0,
    voterRewardAmount: contest.voterRewardAmount !== undefined ? Number(contest.voterRewardAmount) : 0,
    winnerRewardAmount: contest.winnerRewardAmount !== undefined ? Number(contest.winnerRewardAmount) : 0,
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
      contestants.push({
        id: docSnap.id,
        contestId: data.contestId || '',
        contestTitle: data.contestTitle || '',
        name: data.name || '',
        telegramId: data.telegramId || '',
        username: data.username || '',
        description: data.description || '',
        imageUrl: data.imageUrl || '',
        votesCount: Number(data.votesCount) || 0,
        status: data.status || 'approved',
        createdAt: data.createdAt || new Date().toISOString(),
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
  const dataToSave = {
    contestId: contestant.contestId,
    contestTitle: contestant.contestTitle || '',
    name: contestant.name || '',
    telegramId: contestant.telegramId || '',
    username: contestant.username || '',
    description: contestant.description || '',
    imageUrl: contestant.imageUrl || '',
    votesCount: contestant.votesCount !== undefined ? Number(contestant.votesCount) : 0,
    status: contestant.status || 'approved',
    createdAt: contestant.createdAt || new Date().toISOString(),
  };
  await setDoc(contestantRef, dataToSave, { merge: true });
  return contestantId;
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
}): Promise<{ success: boolean; error?: string; rewardEarned?: number }> {
  const { contestId, contestantId, voterTelegramId, voterName, voterUsername, botToken } = params;

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
    if (contest.status !== 'active') {
      return { success: false, error: `This contest is currently ${contest.status}.` };
    }

    const now = new Date();
    const regEndDate = new Date(contest.registrationEndDate);
    const voteEndDate = new Date(contest.votingEndDate);

    if (now < regEndDate) {
      return { success: false, error: 'Voting has not started yet. Registration is still open.' };
    }
    if (now > voteEndDate) {
      return { success: false, error: 'Voting has already ended for this contest.' };
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

    // Execute firestore transaction to record vote, update vote count, and optionally credit voter's wallet
    await runTransaction(db, async (transaction) => {
      // Get fresh data inside transaction
      const innerContestantSnap = await transaction.get(contestantRef);
      if (!innerContestantSnap.exists()) {
        throw new Error('Contestant deleted during transaction');
      }
      const freshContestant = innerContestantSnap.data() as Contestant;
      const currentVotes = Number(freshContestant.votesCount) || 0;

      // Update contestant votes count
      transaction.update(contestantRef, {
        votesCount: currentVotes + 1,
      });

      // Write vote log
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

    // Send direct notify in background if successful & reward earned & botToken available
    if (rewardGiven > 0 && botToken) {
      const notifyText =
        `🎉 <b>Vote Logged & Rewarded!</b>\n\n` +
        `You voted for <b>${contestant.name}</b> in the <b>${contest.title}</b> contest!\n\n` +
        `💰 <b>Reward Earned:</b> +₹${rewardGiven}\n` +
        `Balance updated in your wallet. Thank you for voting!`;

      // Inline import prevention or call API
      fetch('/api/admin/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: botToken, chatId: voterTelegramId, text: notifyText }),
      }).catch(() => {});
    }

    return { success: true, rewardEarned: rewardGiven };
  } catch (err: any) {
    console.error('Error submitting vote transaction:', err);
    return { success: false, error: err.message || 'Failed to record vote.' };
  }
}
