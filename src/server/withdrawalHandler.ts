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

  let platformFee = 0;
  let payoutAmount = 0;
  let feePercent = 6;

  try {
    // Look up in both collections to locate the withdrawal request
    const wrRef = doc(db, 'withdraw_requests', withdrawalDocId);
    const wRef = doc(db, 'withdrawals', withdrawalDocId);

    let activeSnap = await getDocs(query(collection(db, 'withdraw_requests')));
    let targetDoc = activeSnap.docs.find(d => d.id === withdrawalDocId);
    let isWithdrawRequest = true;

    if (!targetDoc) {
      const wSnap = await getDocs(query(collection(db, 'withdrawals')));
      targetDoc = wSnap.docs.find(d => d.id === withdrawalDocId);
      isWithdrawRequest = false;
    }

    if (!targetDoc) {
      return { success: false, error: 'Withdrawal record not found.' };
    }

    const data = targetDoc.data();
    const rawStatus = String(data.status).toLowerCase();
    if (rawStatus !== 'pending') {
      return { success: false, error: `Withdrawal is already ${data.status}.` };
    }

    telegramId = data.telegramId || '';
    withdrawalIdStr = data.withdrawalId || data.requestId || '';
    amount = Number(data.amount) || 0;
    method = data.method || 'upi';
    upiId = data.upiId || '';
    redeemDetails = data.redeemCodeDetails || '';
    userUid = data.uid || data.userId || data.telegramId || '';

    feePercent = data.feePercent !== undefined ? Number(data.feePercent) : 6;
    platformFee = data.platformFee !== undefined ? Number(data.platformFee) : Number(((amount * feePercent) / 100).toFixed(2));
    payoutAmount = data.payoutAmount !== undefined ? Number(data.payoutAmount) : Number((amount - platformFee).toFixed(2));

    const processedTime = new Date().toISOString();

    // Look up any matching documents in BOTH collections to update them synchronously
    const wrQuery = query(collection(db, 'withdraw_requests'), where('requestId', '==', withdrawalIdStr));
    const wrSnapshots = await getDocs(wrQuery);

    const wQuery = query(collection(db, 'withdrawals'), where('withdrawalId', '==', withdrawalIdStr));
    const wSnapshots = await getDocs(wQuery);

    await runTransaction(db, async (transaction) => {
      // Update target withdraw_requests documents
      wrSnapshots.forEach((docSnap) => {
        transaction.update(docSnap.ref, {
          status: 'Approved',
          processedAt: processedTime,
          processedBy: 'Admin',
        });
      });

      // Update target withdrawals documents
      wSnapshots.forEach((docSnap) => {
        transaction.update(docSnap.ref, {
          status: 'completed',
          processedAt: processedTime,
        });
      });
    });

    // Record Withdrawal Approved in transactions ledger (already deducted balance during request)
    try {
      await recordWalletTransaction({
        uid: userUid,
        type: 'Withdrawal Approved',
        amount: 0,
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
          `Your withdrawal request of <b>₹${amount}</b> (ID: <code>${withdrawalIdStr}</code>) has been approved.\n` +
          `⚡ <b>Platform Fee (${feePercent}%):</b> ₹${platformFee}\n` +
          `🎁 <b>Payout Amount Sent:</b> <b>₹${payoutAmount}</b> ${detailText}\n\n` +
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
  let userUid = '';

  try {
    let activeSnap = await getDocs(query(collection(db, 'withdraw_requests')));
    let targetDoc = activeSnap.docs.find(d => d.id === withdrawalDocId);

    if (!targetDoc) {
      const wSnap = await getDocs(query(collection(db, 'withdrawals')));
      targetDoc = wSnap.docs.find(d => d.id === withdrawalDocId);
    }

    if (!targetDoc) {
      return { success: false, error: 'Withdrawal record not found.' };
    }

    const data = targetDoc.data();
    const rawStatus = String(data.status).toLowerCase();
    if (rawStatus !== 'pending') {
      return { success: false, error: `Withdrawal is already ${data.status}.` };
    }

    telegramId = data.telegramId || '';
    withdrawalIdStr = data.withdrawalId || data.requestId || '';
    amount = Number(data.amount) || 0;
    userUid = data.uid || data.userId || data.telegramId || '';

    const usersQ = query(collection(db, 'users'), where('uid', '==', userUid));
    const uSnap = await getDocs(usersQ);
    if (uSnap.empty) {
      return { success: false, error: 'Associated user account not found for refund.' };
    }

    const processedTime = new Date().toISOString();

    // Look up any matching documents in BOTH collections to update them synchronously
    const wrQuery = query(collection(db, 'withdraw_requests'), where('requestId', '==', withdrawalIdStr));
    const wrSnapshots = await getDocs(wrQuery);

    const wQuery = query(collection(db, 'withdrawals'), where('withdrawalId', '==', withdrawalIdStr));
    const wSnapshots = await getDocs(wQuery);

    await runTransaction(db, async (transaction) => {
      // Update target withdraw_requests documents
      wrSnapshots.forEach((docSnap) => {
        transaction.update(docSnap.ref, {
          status: 'Rejected',
          rejectReason: cleanReason,
          processedAt: processedTime,
          processedBy: 'Admin',
        });
      });

      // Update target withdrawals documents
      wSnapshots.forEach((docSnap) => {
        transaction.update(docSnap.ref, {
          status: 'rejected',
          rejectReason: cleanReason,
          processedAt: processedTime,
        });
      });
    });

    // Record refund transaction atomically (this updates user's wallet balance too)
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
