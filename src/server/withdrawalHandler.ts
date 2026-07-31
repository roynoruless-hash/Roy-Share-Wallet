import { collection, query, where, getDocs, doc, runTransaction, addDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

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
  let upiId = '';

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
      upiId = data.upiId || '';

      transaction.update(wRef, {
        status: 'completed',
        processedAt: new Date().toISOString(),
      });
    });

    // Send Telegram Notification to User
    if (botToken && telegramId) {
      await sendTelegramMessage(
        botToken,
        telegramId,
        `✅ <b>Withdrawal Approved!</b>\n\n` +
          `Your withdrawal request of <b>₹${amount}</b> (ID: <code>${withdrawalIdStr}</code>) to UPI <code>${upiId}</code> has been approved and processed.\n\n` +
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
  let newBalance = 0;

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

    const userDocRef = uSnap.docs[0].ref;

    // Step 2: Run transaction to update status & refund wallet balance
    await runTransaction(db, async (transaction) => {
      const uDocSnap = await transaction.get(userDocRef);
      if (!uDocSnap.exists()) {
        throw new Error('User document missing during transaction.');
      }
      const userData = uDocSnap.data();
      const currentBalance = Number(userData.walletBalance) || 0;
      newBalance = currentBalance + amount;

      // Update withdrawal status
      transaction.update(wRef, {
        status: 'rejected',
        rejectReason: cleanReason,
        processedAt: new Date().toISOString(),
      });

      // Refund user
      transaction.update(userDocRef, {
        walletBalance: newBalance,
      });
    });

    // Step 3: Record refund transaction
    try {
      await addDoc(collection(db, 'transactions'), {
        userId,
        uid: userUid,
        type: 'withdrawal_refund',
        amount: amount,
        balanceAfter: newBalance,
        reason: `Refund for rejected withdrawal #${withdrawalIdStr}: ${cleanReason}`,
        createdAt: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('Transaction refund log warning:', e);
    }

    // Step 4: Notify user via Telegram
    if (botToken && telegramId) {
      await sendTelegramMessage(
        botToken,
        telegramId,
        `❌ <b>Withdrawal Request Rejected</b>\n\n` +
          `Your withdrawal request of <b>₹${amount}</b> (ID: <code>${withdrawalIdStr}</code>) was rejected.\n` +
          `<b>Reason:</b> ${cleanReason}\n\n` +
          `💰 <b>₹${amount}</b> has been refunded automatically back to your wallet balance.`
      );
    }

    return { success: true, message: 'Withdrawal rejected and funds refunded automatically.' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to reject withdrawal.' };
  }
}
