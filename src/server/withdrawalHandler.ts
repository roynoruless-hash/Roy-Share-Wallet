import { collection, query, where, getDocs, doc, runTransaction, addDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { recordWalletTransaction } from './transactionService';

async function sendTelegramMessage(token: string, chatId: string, text: string) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
    return await res.json();
  } catch (e) {
    console.error('Failed sending telegram notification:', e);
    return null;
  }
}

export async function approveWithdrawal(botToken: string, withdrawalDocId: string) {
  if (!withdrawalDocId) {
    return { success: false, error: 'Withdrawal ID required' };
  }

  let telegramId = '';
  let withdrawalIdStr = '';
  let amount = 0;
  let method = 'upi';
  let upiId = '';
  let redeemDetails = '';
  let userUid = '';

  try {
    const wRef = doc(db, 'withdrawals', withdrawalDocId);
    await runTransaction(db, async (transaction) => {
      const wSnap = await transaction.get(wRef);
      if (!wSnap.exists()) {
        throw new Error('Withdrawal record not found.');
      }
      const data = wSnap.data();
      if (data.status !== 'pending') {
        throw new Error(`Withdrawal is already ${data.status}.`);
      }

      telegramId = data.telegramId;
      withdrawalIdStr = data.withdrawalId;
      amount = Number(data.amount) || 0;
      method = data.method || 'upi';
      upiId = data.upiId || '';
      redeemDetails = data.redeemCodeDetails || '';
      userUid = data.uid;

      transaction.update(wRef, {
        status: 'completed',
        processedAt: new Date().toISOString(),
      });
    });

    // Record Withdrawal Approved in transactions ledger
    try {
      await recordWalletTransaction({
        uid: userUid,
        type: 'Withdrawal Approved',
        amount: 0, // balance was already deducted, this is a status log with 0 impact
        status: 'completed',
        description: `Withdrawal request #${withdrawalIdStr} of ₹${amount} was approved by Admin.`,
      });
    } catch (e) {
      console.warn('Error recording approved withdrawal transaction:', e);
    }

    // Send Telegram Notification to User
    if (botToken && telegramId) {
      let detailText = '';
      if (method === 'upi') {
        detailText = `to UPI <code>${upiId}</code>`;
      } else if (method === 'qr') {
        detailText = `via <b>QR Code Payment</b>`;
      } else if (method === 'redeem_code') {
        detailText = `via <b>Redeem Code</b> (${redeemDetails})`;
      }

      await sendTelegramMessage(
        botToken,
        telegramId,
        `✅ <b>Withdrawal Approved!</b>\n\n` +
          `Your withdrawal request of <b>₹${amount}</b> (ID: <code>${withdrawalIdStr}</code>) ${detailText} has been approved and processed.\n\n` +
          `Thank you for using Roy Share Wallet!`
      );
    }

    return { success: true, message: 'Withdrawal approved successfully.' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to approve withdrawal.' };
  }
}

export async function rejectWithdrawal(botToken: string, withdrawalDocId: string, reason: string) {
  if (!withdrawalDocId) {
    return { success: false, error: 'Withdrawal ID required' };
  }

  const cleanReason = (reason || 'Request rejected by admin').trim();
  let telegramId = '';
  let withdrawalIdStr = '';
  let amount = 0;
  let userId = '';
  let userUid = '';

  try {
    const wRef = doc(db, 'withdrawals', withdrawalDocId);
    
    // Step 1: Find user document first
    const wSnapPre = await getDocs(query(collection(db, 'withdrawals')));
    // Find target document
    const targetDoc = wSnapPre.docs.find(d => d.id === withdrawalDocId);
    if (!targetDoc) {
      return { success: false, error: 'Withdrawal record not found.' };
    }
    const wData = targetDoc.data();
    if (wData.status !== 'pending') {
      return { success: false, error: `Withdrawal is already ${wData.status}.` };
    }

    telegramId = wData.telegramId;
    withdrawalIdStr = wData.withdrawalId;
    amount = Number(wData.amount) || 0;
    userId = wData.userId;
    userUid = wData.uid;

    const usersQ = query(collection(db, 'users'), where('uid', '==', userUid));
    const uSnap = await getDocs(usersQ);
    if (uSnap.empty) {
      return { success: false, error: 'Associated user account not found for refund.' };
    }

    // Step 2: Run transaction to update status
    await runTransaction(db, async (transaction) => {
      // Update withdrawal status
      transaction.update(wRef, {
        status: 'rejected',
        rejectReason: cleanReason,
        processedAt: new Date().toISOString(),
      });
    });

    // Step 3: Record refund transaction atomically (this updates user's wallet balance too)
    try {
      await recordWalletTransaction({
        uid: userUid,
        type: 'Withdrawal Rejected',
        amount: amount, // refund is positive credit
        status: 'rejected',
        description: `Refund for rejected withdrawal #${withdrawalIdStr}: ${cleanReason}`,
        botToken: botToken,
      });
    } catch (e) {
      console.warn('Transaction refund log warning:', e);
    }

    return { success: true, message: 'Withdrawal rejected and funds refunded automatically.' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to reject withdrawal.' };
  }
}
