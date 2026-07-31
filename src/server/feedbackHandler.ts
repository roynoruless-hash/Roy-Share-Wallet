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

export async function approveFeedbackReview(botToken: string, reviewDocId: string, customAmount?: number, reason?: string) {
  if (!reviewDocId) {
    return { success: false, error: 'Review ID required' };
  }

  const cleanReason = (reason || 'Feedback Bonus').trim();
  let telegramId = '';
  let userUid = '';
  let campaignName = '';
  let rewardAmount = 0;
  let newBalance = 0;
  let userId = '';

  try {
    const reviewRef = doc(db, 'feedbackReviews', reviewDocId);

    // Get review pre-transaction to inspect details
    const reviewsSnap = await getDocs(query(collection(db, 'feedbackReviews')));
    const targetReviewDoc = reviewsSnap.docs.find(d => d.id === reviewDocId);
    if (!targetReviewDoc) {
      return { success: false, error: 'Feedback review record not found.' };
    }
    const rData = targetReviewDoc.data();
    if (rData.status !== 'pending') {
      return { success: false, error: `Feedback review is already ${rData.status}.` };
    }

    telegramId = rData.telegramId;
    userUid = rData.uid;
    campaignName = rData.campaignName || 'Feedback Campaign';
    rewardAmount = typeof customAmount === 'number' ? customAmount : (Number(rData.rewardAmount) || 0);

    // Find the associated user document
    const usersQ = query(collection(db, 'users'), where('uid', '==', userUid));
    const uSnap = await getDocs(usersQ);
    if (uSnap.empty) {
      return { success: false, error: 'Associated user account not found for reward credit.' };
    }

    const userDocRef = uSnap.docs[0].ref;
    userId = uSnap.docs[0].id;

    // Run transaction
    await runTransaction(db, async (transaction) => {
      const uDocSnap = await transaction.get(userDocRef);
      if (!uDocSnap.exists()) {
        throw new Error('User document missing during transaction.');
      }
      const userData = uDocSnap.data();
      const currentBalance = Number(userData.walletBalance) || 0;
      newBalance = currentBalance + rewardAmount;

      // Update feedback status
      transaction.update(reviewRef, {
        status: 'approved',
        rewardAmount: rewardAmount,
        approveReason: cleanReason,
        processedAt: new Date().toISOString(),
      });

      // Credit user's wallet
      transaction.update(userDocRef, {
        walletBalance: newBalance,
      });
    });

    // Add record to transactions collection
    try {
      await addDoc(collection(db, 'transactions'), {
        userId,
        uid: userUid,
        type: 'feedback_reward',
        amount: rewardAmount,
        balanceAfter: newBalance,
        reason: `Feedback Campaign "${campaignName}" Reward: ${cleanReason}`,
        createdAt: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('Transaction feedback log warning:', e);
    }

    // Notify user via Telegram
    if (botToken && telegramId) {
      await sendTelegramMessage(
        botToken,
        telegramId,
        `🎉 <b>Feedback Reward Received</b>\n\n` +
          `<b>₹${rewardAmount}</b> has been added to your wallet.\n\n` +
          `<b>Reason:</b> ${cleanReason}`
      );
    }

    return { success: true, message: 'Feedback approved and reward credited successfully!' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to approve feedback.' };
  }
}

export async function rejectFeedbackReview(botToken: string, reviewDocId: string, reason: string) {
  if (!reviewDocId) {
    return { success: false, error: 'Review ID required' };
  }

  const cleanReason = (reason || 'Your feedback did not meet our guidelines.').trim();
  let telegramId = '';
  let campaignName = '';

  try {
    const reviewRef = doc(db, 'feedbackReviews', reviewDocId);

    // Get review pre-transaction to inspect details
    const reviewsSnap = await getDocs(query(collection(db, 'feedbackReviews')));
    const targetReviewDoc = reviewsSnap.docs.find(d => d.id === reviewDocId);
    if (!targetReviewDoc) {
      return { success: false, error: 'Feedback review record not found.' };
    }
    const rData = targetReviewDoc.data();
    if (rData.status !== 'pending') {
      return { success: false, error: `Feedback review is already ${rData.status}.` };
    }

    telegramId = rData.telegramId;
    campaignName = rData.campaignName || 'Feedback Campaign';

    // Update feedback status
    await runTransaction(db, async (transaction) => {
      transaction.update(reviewRef, {
        status: 'rejected',
        rejectReason: cleanReason,
        processedAt: new Date().toISOString(),
      });
    });

    // Notify user via Telegram
    if (botToken && telegramId) {
      await sendTelegramMessage(
        botToken,
        telegramId,
        `❌ <b>Feedback Rejected</b>\n\n` +
          `<b>Reason:</b> ${cleanReason}`
      );
    }

    return { success: true, message: 'Feedback rejected successfully.' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to reject feedback.' };
  }
}
