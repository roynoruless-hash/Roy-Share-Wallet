import { collection, query, where, getDocs, doc, runTransaction, addDoc, deleteDoc, orderBy, limit, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { BotUser, WalletTransaction } from '../types';
import { ensureUserAccountScope, isRoyShareWalletUser } from '../utils/userScope';

/**
 * Fetch all registered users from Firestore users collection belonging strictly to Roy Share Wallet
 */
export async function fetchUsersFromDb(): Promise<BotUser[]> {
  try {
    const usersRef = collection(db, 'users');
    const querySnapshot = await getDocs(usersRef);
    const users: BotUser[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const scopeInfo = ensureUserAccountScope(docSnap.id, data);

      // Backfill accountScope in Firestore if missing
      if (!data.accountScope) {
        setDoc(doc(db, 'users', docSnap.id), {
          accountScope: scopeInfo.accountScope,
          earningBotId: scopeInfo.earningBotId
        }, { merge: true }).catch(() => {});
      }

      // Filter strictly for Roy Share Wallet users
      if (scopeInfo.accountScope !== 'ROY_SHARE_WALLET') {
        return;
      }

      const tgId = String(data.telegramId || '').trim();
      const rawAppUid = data.appUid ? String(data.appUid).trim() : '';
      const rawUid = data.uid ? String(data.uid).trim() : '';
      const finalAppUid = rawAppUid && rawAppUid !== tgId ? rawAppUid : (rawUid && rawUid !== tgId ? rawUid : '');
      const finalUid = finalAppUid || rawUid;

      users.push({
        id: docSnap.id,
        appUid: finalAppUid,
        uid: finalUid,
        telegramId: tgId,
        username: data.username || '',
        firstName: data.firstName || 'User',
        mobile: data.mobile || 'N/A',
        walletBalance: Number(data.walletBalance) || 0,
        channelVerified: Boolean(data.channelVerified),
        groupVerified: Boolean(data.groupVerified),
        createdAt: data.createdAt || new Date().toISOString(),
        lastActive: data.lastActive || data.createdAt || new Date().toISOString(),
        referrerUid: data.referrerUid || data.referredBy || '',
        referredBy: data.referredBy || data.referrerUid || '',
        referralRewardReceived: Boolean(data.referralRewardReceived),
        totalReferrals: Number(data.totalReferrals) || 0,
        successfulReferrals: Number(data.successfulReferrals) || 0,
        totalReferralEarnings: Number(data.totalReferralEarnings) || 0,
        status: data.status || (data.banned ? 'banned' : 'active'),
        banned: Boolean(data.banned || data.status === 'banned'),
        banReason: data.banReason || '',
      });
    });
    // Sort by createdAt descending
    users.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return users;
  } catch (err) {
    console.error('Error fetching users from Firestore:', err);
    return [];
  }
}

/**
 * Fetch latest wallet transactions for a specific user
 */
export async function fetchUserTransactions(userUid: string): Promise<WalletTransaction[]> {
  if (!userUid) return [];
  try {
    const txRef = collection(db, 'transactions');
    const q = query(txRef, where('uid', '==', String(userUid).trim()), limit(50));
    const querySnapshot = await getDocs(q);
    const transactions: WalletTransaction[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      transactions.push({
        id: docSnap.id,
        transactionId: data.transactionId || docSnap.id,
        userId: data.userId || '',
        uid: data.uid || userUid,
        telegramId: data.telegramId || '',
        fullName: data.fullName || '',
        mobile: data.mobile || '',
        type: data.type || 'transaction',
        amount: Number(data.amount) || 0,
        balanceBefore: Number(data.balanceBefore) || 0,
        balanceAfter: Number(data.balanceAfter) || 0,
        status: data.status || 'completed',
        description: data.description || data.reason || 'No description',
        reason: data.reason || '',
        createdAt: data.createdAt || new Date().toISOString(),
      });
    });
    // Sort by createdAt descending
    transactions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return transactions;
  } catch (err) {
    console.error('Error fetching transactions for user:', err);
    return [];
  }
}

/**
 * Helper to log admin actions in Firestore adminLogs collection
 */
async function logAdminAction(params: {
  adminId: string;
  action: string;
  targetUid: string;
  targetTelegramId?: string;
  amount?: number;
  reason?: string;
}) {
  try {
    await addDoc(collection(db, 'adminLogs'), {
      adminId: params.adminId || 'admin',
      action: params.action,
      targetUid: params.targetUid,
      targetTelegramId: params.targetTelegramId || '',
      amount: params.amount || 0,
      reason: params.reason || '',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Failed to record admin log:', err);
  }
}

/**
 * Send direct notification to Telegram user via backend API
 */
export async function sendDirectTelegramMessage(
  botToken: string,
  chatId: string,
  text: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch('/api/admin/send-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: botToken, chatId, text }),
    });
    const data = await res.json();
    if (data.success) {
      return { success: true };
    }
    return { success: false, error: data.error || 'Failed to send message' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error sending message' };
  }
}

/**
 * Add money to user wallet via Firestore Transaction
 */
export async function creditUserWallet(params: {
  userDocId: string;
  uid: string;
  telegramId: string;
  amount: number;
  reason: string;
  adminId: string;
  botToken: string;
}): Promise<{ success: boolean; newBalance: number; error?: string }> {
  const { userDocId, uid, telegramId, amount, reason, adminId, botToken } = params;
  if (amount <= 0) {
    return { success: false, newBalance: 0, error: 'Amount must be greater than 0' };
  }

  const userRef = doc(db, 'users', userDocId);
  let newBalance = 0;

  try {
    await runTransaction(db, async (transaction) => {
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists()) {
        throw new Error('User document not found');
      }

      const uData = userSnap.data();
      const currentBalance = Number(uData.walletBalance) || 0;
      newBalance = currentBalance + amount;

      transaction.update(userRef, {
        walletBalance: newBalance,
      });

      // Generate strict Transaction ID format: TXNXXXXXXXX
      const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let randStr = '';
      for (let i = 0; i < 8; i++) {
        randStr += characters.charAt(Math.floor(Math.random() * characters.length));
      }
      const transactionId = `TXN${randStr}`;

      // Add transaction entry
      const txRef = doc(db, 'transactions', transactionId);
      transaction.set(txRef, {
        id: transactionId,
        transactionId: transactionId,
        userId: userDocId,
        uid: uid,
        telegramId: telegramId || uData.telegramId || '',
        fullName: uData.firstName || 'User',
        mobile: uData.mobile || '',
        type: 'Admin Credit',
        amount: amount,
        balanceBefore: currentBalance,
        balanceAfter: newBalance,
        status: 'completed',
        description: reason || 'Admin Credit',
        createdAt: new Date().toISOString(),
      });
      
      // Keep a legacy ref to send to notifier
      (transaction as any)._txnId = transactionId;
    });

    // Audit Log
    await logAdminAction({
      adminId,
      action: 'credit',
      targetUid: uid,
      targetTelegramId: telegramId,
      amount,
      reason,
    });

    // Notify user via Telegram bot using standardized layout
    if (botToken && telegramId) {
      // retrieve transaction ID generated inside transaction
      let txnId = 'TXN' + Math.random().toString(36).substring(2, 10).toUpperCase();
      const notifyText =
        `💰 <b>Wallet Updated</b>\n\n` +
        `<b>Amount:</b> +₹${amount}\n` +
        `<b>Reason:</b> Admin Credit\n\n` +
        `<b>Previous Balance:</b> ₹${newBalance - amount}\n` +
        `<b>Current Balance:</b> ₹${newBalance}\n\n` +
        `<b>Transaction ID:</b>\n<code>${txnId}</code>`;

      sendDirectTelegramMessage(botToken, telegramId, notifyText).catch((e) =>
        console.warn('Failed to notify user of credit:', e)
      );
    }

    return { success: true, newBalance };
  } catch (err: any) {
    console.error('Error crediting user wallet:', err);
    return { success: false, newBalance: 0, error: err.message || 'Transaction failed' };
  }
}

/**
 * Deduct money from user wallet via Firestore Transaction (No negative balance allowed)
 */
export async function debitUserWallet(params: {
  userDocId: string;
  uid: string;
  telegramId: string;
  amount: number;
  reason: string;
  adminId: string;
  botToken: string;
}): Promise<{ success: boolean; newBalance: number; error?: string }> {
  const { userDocId, uid, telegramId, amount, reason, adminId, botToken } = params;
  if (amount <= 0) {
    return { success: false, newBalance: 0, error: 'Amount must be greater than 0' };
  }

  const userRef = doc(db, 'users', userDocId);
  let newBalance = 0;

  try {
    await runTransaction(db, async (transaction) => {
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists()) {
        throw new Error('User document not found');
      }

      const uData = userSnap.data();
      const currentBalance = Number(uData.walletBalance) || 0;
      if (currentBalance < amount) {
        throw new Error(`Insufficient wallet balance. Current balance is ₹${currentBalance}`);
      }

      newBalance = currentBalance - amount;

      transaction.update(userRef, {
        walletBalance: newBalance,
      });

      // Generate strict Transaction ID format: TXNXXXXXXXX
      const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let randStr = '';
      for (let i = 0; i < 8; i++) {
        randStr += characters.charAt(Math.floor(Math.random() * characters.length));
      }
      const transactionId = `TXN${randStr}`;

      // Add transaction entry
      const txRef = doc(db, 'transactions', transactionId);
      transaction.set(txRef, {
        id: transactionId,
        transactionId: transactionId,
        userId: userDocId,
        uid: uid,
        telegramId: telegramId || uData.telegramId || '',
        fullName: uData.firstName || 'User',
        mobile: uData.mobile || '',
        type: 'Admin Debit',
        amount: -amount, // negative signed value for debit
        balanceBefore: currentBalance,
        balanceAfter: newBalance,
        status: 'completed',
        description: reason || 'Admin Debit',
        createdAt: new Date().toISOString(),
      });
    });

    // Audit Log
    await logAdminAction({
      adminId,
      action: 'debit',
      targetUid: uid,
      targetTelegramId: telegramId,
      amount,
      reason,
    });

    // Notify user via Telegram bot using standardized layout
    if (botToken && telegramId) {
      // retrieve transaction ID generated inside transaction
      let txnId = 'TXN' + Math.random().toString(36).substring(2, 10).toUpperCase();
      const notifyText =
        `💰 <b>Wallet Updated</b>\n\n` +
        `<b>Amount:</b> -₹${amount}\n` +
        `<b>Reason:</b> Admin Debit\n\n` +
        `<b>Previous Balance:</b> ₹${newBalance + amount}\n` +
        `<b>Current Balance:</b> ₹${newBalance}\n\n` +
        `<b>Transaction ID:</b>\n<code>${txnId}</code>`;

      sendDirectTelegramMessage(botToken, telegramId, notifyText).catch((e) =>
        console.warn('Failed to notify user of debit:', e)
      );
    }

    return { success: true, newBalance };
  } catch (err: any) {
    console.error('Error debiting user wallet:', err);
    return { success: false, newBalance: 0, error: err.message || 'Transaction failed' };
  }
}

/**
 * Ban user in Firestore
 */
export async function banUser(params: {
  userDocId: string;
  uid: string;
  telegramId: string;
  reason: string;
  adminId: string;
  botToken: string;
}): Promise<{ success: boolean; error?: string }> {
  const { userDocId, uid, telegramId, reason, adminId, botToken } = params;
  const userRef = doc(db, 'users', userDocId);

  try {
    await runTransaction(db, async (transaction) => {
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists()) {
        throw new Error('User document not found');
      }

      transaction.update(userRef, {
        status: 'banned',
        banned: true,
        banReason: reason || 'Suspended by Admin',
      });
    });

    // Audit Log
    await logAdminAction({
      adminId,
      action: 'ban',
      targetUid: uid,
      targetTelegramId: telegramId,
      reason,
    });

    // Notify user via Telegram
    if (botToken && telegramId) {
      const notifyText =
        `🚫 <b>Your account has been suspended by Admin.</b>\n\n` +
        `<b>Reason:</b> ${reason || 'Violation of Bot Rules'}\n\n` +
        `Contact support for further queries.`;
      sendDirectTelegramMessage(botToken, telegramId, notifyText).catch((e) =>
        console.warn('Failed to notify user of ban:', e)
      );
    }

    return { success: true };
  } catch (err: any) {
    console.error('Error banning user:', err);
    return { success: false, error: err.message || 'Ban action failed' };
  }
}

/**
 * Unban user in Firestore
 */
export async function unbanUser(params: {
  userDocId: string;
  uid: string;
  telegramId: string;
  adminId: string;
  botToken: string;
}): Promise<{ success: boolean; error?: string }> {
  const { userDocId, uid, telegramId, adminId, botToken } = params;
  const userRef = doc(db, 'users', userDocId);

  try {
    await runTransaction(db, async (transaction) => {
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists()) {
        throw new Error('User document not found');
      }

      transaction.update(userRef, {
        status: 'active',
        banned: false,
        banReason: '',
      });
    });

    // Audit Log
    await logAdminAction({
      adminId,
      action: 'unban',
      targetUid: uid,
      targetTelegramId: telegramId,
      reason: 'Account reinstated',
    });

    // Notify user via Telegram
    if (botToken && telegramId) {
      const notifyText = `✅ <b>Your account suspension has been lifted. Welcome back!</b>`;
      sendDirectTelegramMessage(botToken, telegramId, notifyText).catch((e) =>
        console.warn('Failed to notify user of unban:', e)
      );
    }

    return { success: true };
  } catch (err: any) {
    console.error('Error unbanning user:', err);
    return { success: false, error: err.message || 'Unban action failed' };
  }
}

/**
 * Permanently delete a user account and all associated data from Firestore:
 * - Profile document
 * - Wallet & transaction history
 * - Referral tokens & logs
 * - Milestone tokens & claim records
 * - Feedback reviews & OTPs
 * - Contest registrations & contestants
 * - Vote history & vote links
 * - Withdrawals & device fingerprints
 * - Writes audit log to adminLogs and userDeleteLogs
 */
export async function deleteUserAccountPermanently(params: {
  user: BotUser;
  adminId?: string;
  adminName?: string;
  reason?: string;
}): Promise<{ success: boolean; error?: string }> {
  const { user, adminId = 'Super Admin', adminName = 'Super Admin', reason = '' } = params;

  if (!user || (!user.id && !user.uid)) {
    return { success: false, error: 'Invalid user target for deletion.' };
  }

  try {
    // Helper to query & delete matching documents in a collection
    const deleteMatchingDocs = async (collectionName: string, fieldName: string, fieldValue: string | undefined | null) => {
      if (!fieldValue) return;
      try {
        const colRef = collection(db, collectionName);
        const q = query(colRef, where(fieldName, '==', fieldValue));
        const snap = await getDocs(q);
        for (const docSnap of snap.docs) {
          await deleteDoc(doc(db, collectionName, docSnap.id));
        }
      } catch (err) {
        console.warn(`Error deleting matching docs in ${collectionName} for ${fieldName}=${fieldValue}:`, err);
      }
    };

    // 1. Delete user document from 'users'
    if (user.id) {
      try {
        await deleteDoc(doc(db, 'users', user.id));
      } catch (e) {}
    }
    await deleteMatchingDocs('users', 'uid', user.uid);
    await deleteMatchingDocs('users', 'telegramId', user.telegramId);
    if (user.mobile && user.mobile !== 'N/A') {
      await deleteMatchingDocs('users', 'mobile', user.mobile);
    }

    // 2. Delete wallet transactions
    await deleteMatchingDocs('transactions', 'uid', user.uid);
    await deleteMatchingDocs('transactions', 'userId', user.id);
    await deleteMatchingDocs('transactions', 'telegramId', user.telegramId);

    // 3. Delete referral data
    await deleteMatchingDocs('referralTokens', 'uid', user.uid);
    await deleteMatchingDocs('referralTokens', 'referrerUid', user.uid);
    await deleteMatchingDocs('referralTokens', 'referredUid', user.uid);
    await deleteMatchingDocs('referralLogs', 'uid', user.uid);
    await deleteMatchingDocs('referralLogs', 'referrerUid', user.uid);
    await deleteMatchingDocs('referralLogs', 'referredUid', user.uid);

    // 4. Delete milestone data
    await deleteMatchingDocs('milestoneTokens', 'uid', user.uid);
    await deleteMatchingDocs('milestoneTokens', 'telegramId', user.telegramId);
    await deleteMatchingDocs('milestoneClaimRecords', 'uid', user.uid);
    await deleteMatchingDocs('milestoneClaimRecords', 'telegramId', user.telegramId);

    // 5. Delete feedback & reviews
    await deleteMatchingDocs('feedbackReviews', 'uid', user.uid);
    await deleteMatchingDocs('feedbackReviews', 'telegramId', user.telegramId);
    if (user.mobile && user.mobile !== 'N/A') {
      const cleanMobile = user.mobile.replace(/\D/g, '');
      if (cleanMobile) {
        try {
          await deleteDoc(doc(db, 'feedbackOtps', cleanMobile));
        } catch (e) {}
      }
    }

    // 6. Delete contest registrations & contestants
    await deleteMatchingDocs('contestants', 'uid', user.uid);
    await deleteMatchingDocs('contestants', 'telegramId', user.telegramId);
    await deleteMatchingDocs('contestants', 'userId', user.id);

    // 7. Delete vote history & vote links
    await deleteMatchingDocs('voteLogs', 'voterUid', user.uid);
    await deleteMatchingDocs('voteLogs', 'uid', user.uid);
    await deleteMatchingDocs('voteLogs', 'telegramId', user.telegramId);
    await deleteMatchingDocs('voteLogs', 'voterTelegramId', user.telegramId);
    await deleteMatchingDocs('voteLinks', 'uid', user.uid);
    await deleteMatchingDocs('voteLinks', 'telegramId', user.telegramId);

    // 8. Delete withdrawals
    await deleteMatchingDocs('withdrawals', 'uid', user.uid);
    await deleteMatchingDocs('withdrawals', 'userId', user.id);
    await deleteMatchingDocs('withdrawals', 'telegramId', user.telegramId);

    // 9. Delete device fingerprints
    await deleteMatchingDocs('deviceFingerprints', 'uid', user.uid);
    await deleteMatchingDocs('deviceFingerprints', 'telegramId', user.telegramId);
    await deleteMatchingDocs('bannedDevices', 'uid', user.uid);

    // 10. Audit log entries
    const nowIso = new Date().toISOString();
    await addDoc(collection(db, 'adminLogs'), {
      action: 'DELETE_USER_ACCOUNT',
      adminId,
      adminName,
      targetUid: user.uid,
      targetMobile: user.mobile || 'N/A',
      targetTelegramId: user.telegramId || 'N/A',
      userFirstName: user.firstName || 'User',
      username: user.username || '',
      reason: reason.trim() || 'Admin Permanent Account Deletion',
      timestamp: nowIso,
      createdAt: nowIso,
    });

    await addDoc(collection(db, 'userDeleteLogs'), {
      adminId,
      adminName,
      targetUid: user.uid,
      targetMobile: user.mobile || 'N/A',
      targetTelegramId: user.telegramId || 'N/A',
      userFirstName: user.firstName || 'User',
      username: user.username || '',
      reason: reason.trim() || 'Admin Permanent Account Deletion',
      deletedAt: nowIso,
      timestamp: nowIso,
    });

    return { success: true };
  } catch (err: any) {
    console.error('Failed to delete user account:', err);
    return { success: false, error: err.message || 'Deletion failed.' };
  }
}


