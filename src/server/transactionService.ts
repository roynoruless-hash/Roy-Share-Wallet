import { collection, query, where, getDocs, doc, runTransaction } from 'firebase/firestore';
import { db } from '../services/firebase';

export interface TransactionInput {
  uid: string;
  type:
    | 'Registration Bonus'
    | 'Referral Bonus'
    | 'Referral Milestone Reward'
    | 'Feedback Reward'
    | 'Admin Credit'
    | 'Admin Debit'
    | 'Withdrawal Request'
    | 'Withdrawal Approved'
    | 'Withdrawal Rejected';
  amount: number; // positive for credit, negative for debit
  status: 'completed' | 'pending' | 'rejected' | 'approved';
  description: string;
  botToken?: string;
}

/**
 * Send a Telegram message helper
 */
async function sendTelegramMessage(token: string, chatId: string, text: string) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
    return await res.json();
  } catch (e) {
    console.error('[transactionService] Failed sending Telegram notification:', e);
    return null;
  }
}

/**
 * Centrally records a wallet transaction, updates user balance atomically, and notifies the user on Telegram.
 * Implements strict immutability.
 */
export async function recordWalletTransaction(input: TransactionInput) {
  const { uid, type, amount, status, description, botToken } = input;
  console.log(`[transactionService] Processing ${type} of amount ${amount} for user UID: ${uid}`);

  try {
    // 1. Find user document
    const usersQ = query(collection(db, 'users'), where('uid', '==', String(uid).trim()));
    const uSnap = await getDocs(usersQ);
    if (uSnap.empty) {
      console.error(`[transactionService] User with UID ${uid} not found!`);
      return { success: false, error: `User not found: ${uid}` };
    }

    const userDoc = uSnap.docs[0];
    const userDocRef = userDoc.ref;
    const userData = userDoc.data();

    let balanceBefore = 0;
    let balanceAfter = 0;
    // Generate strict Transaction ID format: TXNXXXXXXXX
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let randStr = '';
    for (let i = 0; i < 8; i++) {
      randStr += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    const transactionId = `TXN${randStr}`;

    // 2. Perform atomic Firestore Transaction
    await runTransaction(db, async (transaction) => {
      const uFreshSnap = await transaction.get(userDocRef);
      if (!uFreshSnap.exists()) {
        throw new Error('User document missing during transaction execution.');
      }
      const uFreshData = uFreshSnap.data();
      balanceBefore = Number(uFreshData.walletBalance) || 0;
      balanceAfter = balanceBefore + amount;

      if (balanceAfter < 0) {
        throw new Error(`Insufficient wallet balance. Current balance: ₹${balanceBefore}, attempted operation: ₹${amount}`);
      }

      // Update User Wallet Balance
      transaction.update(userDocRef, {
        walletBalance: balanceAfter,
      });

      // Write Immutable Transaction Document
      const txRef = doc(db, 'transactions', transactionId);
      transaction.set(txRef, {
        id: transactionId,
        transactionId: transactionId,
        userId: userDoc.id,
        uid: String(uid).trim(),
        telegramId: String(uFreshData.telegramId || userData.telegramId || ''),
        fullName: String(uFreshData.firstName || userData.firstName || 'User'),
        mobile: String(uFreshData.mobile || userData.mobile || ''),
        type: type,
        amount: amount,
        balanceBefore: balanceBefore,
        balanceAfter: balanceAfter,
        status: status,
        description: description,
        createdAt: new Date().toISOString(),
      });
    });

    console.log(`[transactionService] Atomic balance update & immutable log succeeded for ${transactionId}. New Balance: ₹${balanceAfter}`);

    // 3. Automatically send Telegram notification to user
    const finalTelegramId = String(userData.telegramId || '');
    if (botToken && finalTelegramId) {
      const amountStr = amount >= 0 ? `+₹${amount}` : `-₹${Math.abs(amount)}`;
      const messageText =
        `💰 <b>Wallet Updated</b>\n\n` +
        `<b>Amount:</b> ${amountStr}\n` +
        `<b>Reason:</b> ${type}\n\n` +
        `<b>Previous Balance:</b> ₹${balanceBefore}\n` +
        `<b>Current Balance:</b> ₹${balanceAfter}\n\n` +
        `<b>Transaction ID:</b>\n<code>${transactionId}</code>`;

      console.log(`[transactionService] Dispatching Telegram notification to ${finalTelegramId}...`);
      await sendTelegramMessage(botToken, finalTelegramId, messageText);
    }

    return {
      success: true,
      transactionId,
      balanceBefore,
      balanceAfter,
    };
  } catch (err: any) {
    console.error(`[transactionService] Error in recordWalletTransaction:`, err);
    return { success: false, error: err.message || 'Transaction recording failed' };
  }
}
