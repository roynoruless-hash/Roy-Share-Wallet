import { collection, query, where, getDocs, doc, getDoc, updateDoc, addDoc, orderBy, limit, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { approveWithdrawal, rejectWithdrawal } from './withdrawalHandler';
import { sendTelegramApi } from './botHandler';

/**
 * Verify if caller ID or Chat ID matches configured Super Admin Telegram IDs
 */
export function isSuperAdminUser(callerId: string | number, adminConfig: any): boolean {
  if (!callerId) return false;
  const callerStr = String(callerId).trim();

  // If no admin config supplied or empty, fallback
  if (!adminConfig) return false;

  const rawAdmins = [
    adminConfig.adminTelegramId,
    adminConfig.adminChatId,
    adminConfig.superAdminTelegramIds
  ].filter(Boolean).map(s => String(s));

  if (rawAdmins.length === 0) return false;

  for (const raw of rawAdmins) {
    const list = raw.split(/[\s,]+/).map(s => s.trim().replace(/^@/, ''));
    if (list.includes(callerStr)) return true;
  }

  return false;
}

/**
 * Calculate User Risk Level & Score
 */
export function calculateUserRiskLevel(userData: any, withdrawalAmount: number): { label: string; score: number; level: 'Low' | 'Medium' | 'High' } {
  let score = Number(userData?.riskScore) || 0;

  if (userData?.isBanned) {
    score += 100;
  }
  if (withdrawalAmount >= 5000) {
    score += 30;
  }
  if (!userData?.mobile) {
    score += 15;
  }
  const totalRefs = Number(userData?.totalReferrals || userData?.referralCount) || 0;
  if (totalRefs === 0 && withdrawalAmount >= 500) {
    score += 20;
  }

  if (score >= 50) {
    return { label: '🔴 High', score, level: 'High' };
  } else if (score >= 20) {
    return { label: '🟡 Medium', score, level: 'Medium' };
  } else {
    return { label: '🟢 Low', score, level: 'Low' };
  }
}

/**
 * Send interactive Withdrawal Request Card to Admin Telegram Bot
 */
export async function sendAdminWithdrawalNotification(
  token: string,
  adminChat: string,
  docId: string,
  wData: any,
  userData: any
) {
  if (!token || !adminChat || !docId) return;

  const adminChats = String(adminChat).split(/[\s,]+/).map(c => c.trim()).filter(Boolean);

  // 1. Query Total Previous Completed Withdrawals for this User
  let totalPrevAmount = 0;
  let totalPrevCount = 0;
  try {
    const wQ = query(collection(db, 'withdrawals'), where('uid', '==', userData.uid), where('status', '==', 'completed'));
    const wSnap = await getDocs(wQ);
    totalPrevCount = wSnap.size;
    wSnap.forEach(d => {
      totalPrevAmount += (Number(d.data().amount) || 0);
    });
  } catch (e) {
    console.warn('Error fetching total previous withdrawals:', e);
  }

  // 2. Risk Level
  const riskInfo = calculateUserRiskLevel(userData, Number(wData.amount) || 0);

  // 3. Format UPI / Payment Details
  let methodDetail = wData.upiId || 'N/A';
  if (wData.method === 'qr') {
    methodDetail = wData.qrImageUrl ? `<a href="${wData.qrImageUrl}">View QR Photo</a>` : 'QR Code Uploaded';
  } else if (wData.method === 'redeem_code') {
    methodDetail = `Redeem Code (${wData.redeemCodeDetails || 'N/A'})`;
  }

  const reqTime = wData.createdAt
    ? new Date(wData.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
    : new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  const requestedAmount = Number(wData.requestedAmount !== undefined ? wData.requestedAmount : wData.amount) || 0;
  const feePercent = Number(wData.feePercent !== undefined ? wData.feePercent : 6);
  const platformFee = Number(wData.platformFee !== undefined ? wData.platformFee : ((requestedAmount * feePercent) / 100).toFixed(2));
  const payoutAmount = Number(wData.payoutAmount !== undefined ? wData.payoutAmount : (requestedAmount - platformFee).toFixed(2));

  const text =
    `💸 <b>New Withdrawal Request</b>\n\n` +
    `👤 <b>Name:</b> ${userData.firstName || userData.name || 'User'}\n` +
    `🆔 <b>UID:</b> <code>${userData.uid}</code>\n` +
    `📱 <b>Mobile:</b> <code>${userData.mobile || 'N/A'}</code>\n` +
    `💰 <b>Wallet Balance:</b> ₹${userData.walletBalance || 0}\n\n` +
    `💸 <b>Requested Amount:</b> ₹${requestedAmount}\n` +
    `⚡ <b>Platform Fee (${feePercent}%):</b> ₹${platformFee}\n` +
    `🎁 <b>Final Payout Amount:</b> ₹${payoutAmount}\n\n` +
    `🏦 <b>UPI ID:</b> ${methodDetail}\n` +
    `📅 <b>Request Time:</b> ${reqTime}\n` +
    `🆔 <b>Withdrawal ID:</b> <code>${wData.withdrawalId}</code>\n` +
    `📊 <b>Total Previous Withdrawals:</b> ₹${totalPrevAmount} (${totalPrevCount} completed)\n` +
    `⚠ <b>Risk Level:</b> ${riskInfo.label}`;

  const replyMarkup = {
    inline_keyboard: [
      [
        { text: '✅ Approve', callback_data: `wdr_app_${docId}` },
        { text: '❌ Reject', callback_data: `wdr_rej_${docId}` }
      ],
      [
        { text: '👤 View User', callback_data: `wdr_user_${docId}` },
        { text: '📜 Transaction History', callback_data: `wdr_tx_${docId}` }
      ]
    ]
  };

  for (const chat of adminChats) {
    await sendTelegramApi(token, 'sendMessage', {
      chat_id: chat,
      text,
      parse_mode: 'HTML',
      reply_markup: replyMarkup
    });
  }
}

/**
 * Handle Telegram Admin Withdrawal Callback Queries
 */
export async function handleAdminWithdrawalCallback(token: string, cb: any, adminConfig: any): Promise<boolean> {
  const data: string = cb.data || '';
  if (!data.startsWith('wdr_')) return false;

  const cbId = cb.id;
  const callerId = cb.from?.id;
  const callerName = cb.from?.first_name || cb.from?.username || String(callerId);
  const chatId = cb.message?.chat?.id || callerId;
  const messageId = cb.message?.message_id;

  // 1. Security Check: Only Super Admin Telegram IDs
  if (!isSuperAdminUser(callerId, adminConfig) && !isSuperAdminUser(chatId, adminConfig)) {
    await sendTelegramApi(token, 'answerCallbackQuery', {
      callback_query_id: cbId,
      text: '⚠️ Unauthorized: Only Super Admin Telegram accounts can manage withdrawals.',
      show_alert: true
    });
    return true;
  }

  if (data === 'wdr_noop') {
    await sendTelegramApi(token, 'answerCallbackQuery', {
      callback_query_id: cbId,
      text: 'This request has already been processed.',
      show_alert: false
    });
    return true;
  }

  // --- APPROVE WITHDRAWAL ---
  if (data.startsWith('wdr_app_')) {
    const docId = data.replace('wdr_app_', '').trim();
    try {
      const wRef = doc(db, 'withdrawals', docId);
      const wSnap = await getDoc(wRef);

      if (!wSnap.exists()) {
        await sendTelegramApi(token, 'answerCallbackQuery', {
          callback_query_id: cbId,
          text: '❌ Withdrawal record not found in database.',
          show_alert: true
        });
        return true;
      }

      const wData = wSnap.data();

      if (wData.status !== 'pending') {
        await sendTelegramApi(token, 'answerCallbackQuery', {
          callback_query_id: cbId,
          text: `⚠️ Request is already ${wData.status.toUpperCase()}!`,
          show_alert: true
        });

        // Update card to current status
        const statusHeader = wData.status === 'completed' ? '🟢 Approved' : '🔴 Rejected';
        await sendTelegramApi(token, 'editMessageText', {
          chat_id: chatId,
          message_id: messageId,
          text: `${statusHeader}\n\nWithdrawal #${wData.withdrawalId} is already ${wData.status.toUpperCase()}.`,
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: [[{ text: statusHeader, callback_data: 'wdr_noop' }]] }
        });
        return true;
      }

      // Execute Approval
      const appRes = await approveWithdrawal(token, docId);
      if (!appRes.success) {
        await sendTelegramApi(token, 'answerCallbackQuery', {
          callback_query_id: cbId,
          text: `❌ Error: ${appRes.error}`,
          show_alert: true
        });
        return true;
      }

      // Record Admin Action Log in Firestore
      try {
        await addDoc(collection(db, 'adminLogs'), {
          adminId: String(callerId),
          adminName: callerName,
          action: 'APPROVE_WITHDRAWAL_TELEGRAM',
          targetUid: wData.uid,
          withdrawalId: wData.withdrawalId,
          amount: wData.amount,
          details: `Approved withdrawal #${wData.withdrawalId} of ₹${wData.amount} for user ${wData.userName} (${wData.uid}) via Telegram Bot`,
          timestamp: new Date().toISOString()
        });

        await updateDoc(wRef, {
          approvedBy: callerName,
          approvedAt: new Date().toISOString(),
          adminActionLog: `Approved by ${callerName} via Telegram Bot`
        });
      } catch (e) {
        console.warn('Error recording admin approval log:', e);
      }

      // Fetch fresh user balance for updated text
      let freshUserBal = 0;
      try {
        const uQ = query(collection(db, 'users'), where('uid', '==', wData.uid));
        const uSnap = await getDocs(uQ);
        if (!uSnap.empty) {
          freshUserBal = Number(uSnap.docs[0].data().walletBalance) || 0;
        }
      } catch (e) {}

      let methodDetail = wData.upiId || 'N/A';
      if (wData.method === 'qr') {
        methodDetail = wData.qrImageUrl ? `<a href="${wData.qrImageUrl}">View QR Photo</a>` : 'QR Code Uploaded';
      } else if (wData.method === 'redeem_code') {
        methodDetail = `Redeem Code (${wData.redeemCodeDetails || 'N/A'})`;
      }

      const reqTime = wData.createdAt
        ? new Date(wData.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
        : 'N/A';

      const requestedAmount = Number(wData.requestedAmount !== undefined ? wData.requestedAmount : wData.amount) || 0;
      const feePercent = Number(wData.feePercent !== undefined ? wData.feePercent : 6);
      const platformFee = Number(wData.platformFee !== undefined ? wData.platformFee : ((requestedAmount * feePercent) / 100).toFixed(2));
      const payoutAmount = Number(wData.payoutAmount !== undefined ? wData.payoutAmount : (requestedAmount - platformFee).toFixed(2));

      const approvedText =
        `🟢 <b>Approved</b>\n\n` +
        `💸 <b>Withdrawal Request Processed</b>\n\n` +
        `👤 <b>Name:</b> ${wData.userName || 'User'}\n` +
        `🆔 <b>UID:</b> <code>${wData.uid}</code>\n` +
        `📱 <b>Mobile:</b> <code>${wData.mobile || 'N/A'}</code>\n` +
        `💰 <b>Wallet Balance:</b> ₹${freshUserBal}\n\n` +
        `💸 <b>Requested Amount:</b> ₹${requestedAmount}\n` +
        `⚡ <b>Platform Fee (${feePercent}%):</b> ₹${platformFee}\n` +
        `🎁 <b>Final Payout Amount:</b> ₹${payoutAmount}\n\n` +
        `🏦 <b>UPI ID:</b> ${methodDetail}\n` +
        `📅 <b>Request Time:</b> ${reqTime}\n` +
        `🆔 <b>Withdrawal ID:</b> <code>${wData.withdrawalId}</code>\n` +
        `👑 <b>Approved By:</b> ${callerName}\n` +
        `⏱ <b>Approved At:</b> ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`;

      await sendTelegramApi(token, 'editMessageText', {
        chat_id: chatId,
        message_id: messageId,
        text: approvedText,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[{ text: '🟢 Approved', callback_data: 'wdr_noop' }]]
        }
      });

      await sendTelegramApi(token, 'answerCallbackQuery', {
        callback_query_id: cbId,
        text: `✅ Withdrawal #${wData.withdrawalId} Approved!`,
        show_alert: false
      });

      return true;
    } catch (err: any) {
      console.error('Error in wdr_app_ callback:', err);
      await sendTelegramApi(token, 'answerCallbackQuery', {
        callback_query_id: cbId,
        text: `❌ Failed to approve: ${err.message}`,
        show_alert: true
      });
      return true;
    }
  }

  // --- REJECT REASON SELECTION MENU ---
  if (data.startsWith('wdr_rej_')) {
    const docId = data.replace('wdr_rej_', '').trim();
    try {
      const wRef = doc(db, 'withdrawals', docId);
      const wSnap = await getDoc(wRef);

      if (!wSnap.exists()) {
        await sendTelegramApi(token, 'answerCallbackQuery', {
          callback_query_id: cbId,
          text: '❌ Withdrawal record not found.',
          show_alert: true
        });
        return true;
      }

      const wData = wSnap.data();

      if (wData.status !== 'pending') {
        await sendTelegramApi(token, 'answerCallbackQuery', {
          callback_query_id: cbId,
          text: `⚠️ Request is already ${wData.status.toUpperCase()}!`,
          show_alert: true
        });
        return true;
      }

      const reasonKeyboard = {
        inline_keyboard: [
          [
            { text: 'Invalid UPI', callback_data: `wdr_rr_${docId}_upi` },
            { text: 'Suspicious Activity', callback_data: `wdr_rr_${docId}_suspicious` }
          ],
          [
            { text: 'KYC Required', callback_data: `wdr_rr_${docId}_kyc` },
            { text: 'Duplicate Request', callback_data: `wdr_rr_${docId}_dup` }
          ],
          [
            { text: 'Wallet Issue', callback_data: `wdr_rr_${docId}_wallet` },
            { text: 'Other', callback_data: `wdr_rr_${docId}_other` }
          ],
          [
            { text: '⬅ Back to Request', callback_data: `wdr_back_${docId}` }
          ]
        ]
      };

      await sendTelegramApi(token, 'editMessageText', {
        chat_id: chatId,
        message_id: messageId,
        text: `❌ <b>Select Rejection Reason for Withdrawal #${wData.withdrawalId}</b> (₹${wData.amount}):\n\nPlease select a quick reason below to reject and issue a wallet refund:`,
        parse_mode: 'HTML',
        reply_markup: reasonKeyboard
      });

      await sendTelegramApi(token, 'answerCallbackQuery', {
        callback_query_id: cbId,
        text: 'Select rejection reason',
        show_alert: false
      });

      return true;
    } catch (err: any) {
      console.error('Error in wdr_rej_ callback:', err);
      return true;
    }
  }

  // --- REJECTION REASON SELECTED & EXECUTED ---
  if (data.startsWith('wdr_rr_')) {
    const parts = data.replace('wdr_rr_', '').split('_');
    const docId = parts[0];
    const code = parts[1] || 'other';

    const reasonMap: Record<string, string> = {
      upi: 'Invalid UPI ID / Details',
      suspicious: 'Suspicious Activity Detected',
      kyc: 'KYC Verification Required',
      dup: 'Duplicate Withdrawal Request',
      wallet: 'Wallet Balance Issue',
      other: 'Request Rejected by Admin'
    };

    const cleanReason = reasonMap[code] || 'Request Rejected by Admin';

    try {
      const wRef = doc(db, 'withdrawals', docId);
      const wSnap = await getDoc(wRef);

      if (!wSnap.exists()) {
        await sendTelegramApi(token, 'answerCallbackQuery', {
          callback_query_id: cbId,
          text: '❌ Withdrawal record not found.',
          show_alert: true
        });
        return true;
      }

      const wData = wSnap.data();

      if (wData.status !== 'pending') {
        await sendTelegramApi(token, 'answerCallbackQuery', {
          callback_query_id: cbId,
          text: `⚠️ Request is already ${wData.status.toUpperCase()}!`,
          show_alert: true
        });
        return true;
      }

      // Execute Rejection and Refund
      const rejRes = await rejectWithdrawal(token, docId, cleanReason);
      if (!rejRes.success) {
        await sendTelegramApi(token, 'answerCallbackQuery', {
          callback_query_id: cbId,
          text: `❌ Failed: ${rejRes.error}`,
          show_alert: true
        });
        return true;
      }

      // Notify User on Telegram
      if (wData.telegramId) {
        await sendTelegramApi(token, 'sendMessage', {
          chat_id: wData.telegramId,
          text:
            `❌ <b>Your withdrawal has been rejected.</b>\n\n` +
            `<b>Reason:</b> ${cleanReason}\n` +
            `<b>Withdrawal ID:</b> <code>${wData.withdrawalId}</code>\n` +
            `<b>Amount:</b> ₹${wData.amount}\n\n` +
            `ℹ <i>The withdrawal amount has been refunded back to your wallet.</i>`,
          parse_mode: 'HTML'
        });
      }

      // Record Admin Action Log in Firestore
      try {
        await addDoc(collection(db, 'adminLogs'), {
          adminId: String(callerId),
          adminName: callerName,
          action: 'REJECT_WITHDRAWAL_TELEGRAM',
          targetUid: wData.uid,
          withdrawalId: wData.withdrawalId,
          amount: wData.amount,
          reason: cleanReason,
          details: `Rejected withdrawal #${wData.withdrawalId} of ₹${wData.amount} for ${wData.userName} (${wData.uid}). Reason: ${cleanReason}`,
          timestamp: new Date().toISOString()
        });

        await updateDoc(wRef, {
          rejectedBy: callerName,
          rejectedAt: new Date().toISOString(),
          rejectReason: cleanReason,
          adminActionLog: `Rejected by ${callerName} via Telegram Bot (${cleanReason})`
        });
      } catch (e) {
        console.warn('Error recording admin rejection log:', e);
      }

      let methodDetail = wData.upiId || 'N/A';
      if (wData.method === 'qr') {
        methodDetail = wData.qrImageUrl ? `<a href="${wData.qrImageUrl}">View QR Photo</a>` : 'QR Code Uploaded';
      } else if (wData.method === 'redeem_code') {
        methodDetail = `Redeem Code (${wData.redeemCodeDetails || 'N/A'})`;
      }

      const requestedAmount = Number(wData.requestedAmount !== undefined ? wData.requestedAmount : wData.amount) || 0;
      const feePercent = Number(wData.feePercent !== undefined ? wData.feePercent : 6);
      const platformFee = Number(wData.platformFee !== undefined ? wData.platformFee : ((requestedAmount * feePercent) / 100).toFixed(2));
      const payoutAmount = Number(wData.payoutAmount !== undefined ? wData.payoutAmount : (requestedAmount - platformFee).toFixed(2));

      const rejectedText =
        `🔴 <b>Rejected</b>\n\n` +
        `💸 <b>Withdrawal Request Rejected</b>\n\n` +
        `👤 <b>Name:</b> ${wData.userName || 'User'}\n` +
        `🆔 <b>UID:</b> <code>${wData.uid}</code>\n` +
        `📱 <b>Mobile:</b> <code>${wData.mobile || 'N/A'}</code>\n\n` +
        `💸 <b>Requested Amount:</b> ₹${requestedAmount}\n` +
        `⚡ <b>Platform Fee (${feePercent}%):</b> ₹${platformFee}\n` +
        `🎁 <b>Final Payout Amount:</b> ₹${payoutAmount}\n\n` +
        `🏦 <b>UPI ID:</b> ${methodDetail}\n` +
        `🆔 <b>Withdrawal ID:</b> <code>${wData.withdrawalId}</code>\n` +
        `❌ <b>Rejection Reason:</b> ${cleanReason}\n` +
        `👑 <b>Rejected By:</b> ${callerName}\n` +
        `⏱ <b>Rejected At:</b> ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`;

      await sendTelegramApi(token, 'editMessageText', {
        chat_id: chatId,
        message_id: messageId,
        text: rejectedText,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[{ text: '🔴 Rejected', callback_data: 'wdr_noop' }]]
        }
      });

      await sendTelegramApi(token, 'answerCallbackQuery', {
        callback_query_id: cbId,
        text: `❌ Withdrawal Rejected & Refunded!`,
        show_alert: false
      });

      return true;
    } catch (err: any) {
      console.error('Error in wdr_rr_ callback:', err);
      return true;
    }
  }

  // --- VIEW USER PROFILE ---
  if (data.startsWith('wdr_user_')) {
    const docId = data.replace('wdr_user_', '').trim();
    try {
      const wRef = doc(db, 'withdrawals', docId);
      const wSnap = await getDoc(wRef);

      if (!wSnap.exists()) {
        await sendTelegramApi(token, 'answerCallbackQuery', {
          callback_query_id: cbId,
          text: '❌ Withdrawal record not found.',
          show_alert: true
        });
        return true;
      }

      const wData = wSnap.data();
      const userUid = wData.uid;

      // Fetch User Record
      const uQ = query(collection(db, 'users'), where('uid', '==', userUid));
      const uSnap = await getDocs(uQ);

      if (uSnap.empty) {
        await sendTelegramApi(token, 'answerCallbackQuery', {
          callback_query_id: cbId,
          text: '❌ Associated user account not found.',
          show_alert: true
        });
        return true;
      }

      const userData = uSnap.docs[0].data();

      // Query total completed withdrawals
      let totalWithdrawalSum = 0;
      let totalWithdrawalCount = 0;
      try {
        const wUserQ = query(collection(db, 'withdrawals'), where('uid', '==', userUid), where('status', '==', 'completed'));
        const wUserSnap = await getDocs(wUserQ);
        totalWithdrawalCount = wUserSnap.size;
        wUserSnap.forEach(d => {
          totalWithdrawalSum += (Number(d.data().amount) || 0);
        });
      } catch (e) {}

      const riskInfo = calculateUserRiskLevel(userData, 0);

      const profileText =
        `👤 <b>Complete User Profile</b>\n\n` +
        `👤 <b>Name:</b> ${userData.firstName || userData.name || 'User'}\n` +
        `🆔 <b>UID:</b> <code>${userData.uid}</code>\n` +
        `📱 <b>Mobile:</b> <code>${userData.mobile || 'N/A'}</code>\n` +
        `🤖 <b>Telegram ID:</b> <code>${userData.telegramId || 'N/A'}</code>\n` +
        `💰 <b>Wallet Balance:</b> ₹${userData.walletBalance || 0}\n` +
        `👥 <b>Referrals:</b> ${userData.totalReferrals || userData.referralCount || 0}\n` +
        `🎁 <b>Total Rewards:</b> ₹${userData.totalRewards || userData.referralEarnings || 0}\n` +
        `📤 <b>Total Withdrawals:</b> ₹${totalWithdrawalSum} (${totalWithdrawalCount} completed)\n` +
        `📅 <b>Join Date:</b> ${userData.createdAt ? new Date(userData.createdAt).toLocaleDateString('en-IN') : 'N/A'}\n` +
        `⚠ <b>Risk Score:</b> ${userData.isBanned ? '100/100 (HIGH - BANNED)' : `${userData.riskScore || riskInfo.score}/100 (${riskInfo.level})`}\n` +
        `📊 <b>Account Status:</b> ${userData.isBanned ? '🚫 BANNED' : '🟢 ACTIVE'}`;

      const adminAppUrl = 'https://ais-dev-iecssl5uoae4d72ttmqrhh-963220536272.asia-southeast1.run.app';

      const keyboard = {
        inline_keyboard: [
          [
            {
              text: userData.isBanned ? '✅ Unban User' : '🚫 Ban User',
              callback_data: `wdr_ban_${userData.uid}_${docId}`
            },
            {
              text: '🗑 Delete User',
              callback_data: `wdr_del_${userData.uid}_${docId}`
            }
          ],
          [
            {
              text: '🌐 Open Admin Panel',
              url: adminAppUrl
            }
          ],
          [
            {
              text: '⬅ Back to Request',
              callback_data: `wdr_back_${docId}`
            }
          ]
        ]
      };

      await sendTelegramApi(token, 'editMessageText', {
        chat_id: chatId,
        message_id: messageId,
        text: profileText,
        parse_mode: 'HTML',
        reply_markup: keyboard
      });

      await sendTelegramApi(token, 'answerCallbackQuery', {
        callback_query_id: cbId,
        text: 'User profile loaded',
        show_alert: false
      });

      return true;
    } catch (err: any) {
      console.error('Error in wdr_user_ callback:', err);
      return true;
    }
  }

  // --- BAN / UNBAN USER ---
  if (data.startsWith('wdr_ban_')) {
    const raw = data.replace('wdr_ban_', '');
    const firstUnderscore = raw.indexOf('_');
    const userUid = raw.substring(0, firstUnderscore);
    const docId = raw.substring(firstUnderscore + 1);

    try {
      const uQ = query(collection(db, 'users'), where('uid', '==', userUid));
      const uSnap = await getDocs(uQ);

      if (uSnap.empty) {
        await sendTelegramApi(token, 'answerCallbackQuery', {
          callback_query_id: cbId,
          text: '❌ User not found.',
          show_alert: true
        });
        return true;
      }

      const userDocRef = uSnap.docs[0].ref;
      const uData = uSnap.docs[0].data();
      const newBanState = !uData.isBanned;

      await updateDoc(userDocRef, {
        isBanned: newBanState,
        bannedAt: newBanState ? new Date().toISOString() : null,
        bannedReason: newBanState ? `Banned via Telegram Bot by ${callerName}` : null
      });

      // Admin Log
      try {
        await addDoc(collection(db, 'adminLogs'), {
          adminId: String(callerId),
          adminName: callerName,
          action: newBanState ? 'BAN_USER_TELEGRAM' : 'UNBAN_USER_TELEGRAM',
          targetUid: userUid,
          details: `${newBanState ? 'Banned' : 'Unbanned'} user ${userUid} via Telegram Admin Bot`,
          timestamp: new Date().toISOString()
        });
      } catch (e) {}

      await sendTelegramApi(token, 'answerCallbackQuery', {
        callback_query_id: cbId,
        text: newBanState ? `🚫 User ${userUid} has been BANNED.` : `✅ User ${userUid} UNBANNED.`,
        show_alert: true
      });

      // Refresh User Profile View
      const redirectCb = { ...cb, data: `wdr_user_${docId}` };
      await handleAdminWithdrawalCallback(token, redirectCb, adminConfig);

      return true;
    } catch (err: any) {
      console.error('Error in wdr_ban_ callback:', err);
      return true;
    }
  }

  // --- DELETE USER CONFIRMATION ---
  if (data.startsWith('wdr_del_')) {
    const raw = data.replace('wdr_del_', '');
    const firstUnderscore = raw.indexOf('_');
    const userUid = raw.substring(0, firstUnderscore);
    const docId = raw.substring(firstUnderscore + 1);

    const confirmKeyboard = {
      inline_keyboard: [
        [
          { text: '⚠️ YES, DELETE PERMANENTLY', callback_data: `wdr_cdel_${userUid}_${docId}` }
        ],
        [
          { text: '❌ Cancel', callback_data: `wdr_user_${docId}` }
        ]
      ]
    };

    await sendTelegramApi(token, 'editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text:
        `🗑 <b>Confirm Permanent User Deletion</b>\n\n` +
        `Are you sure you want to permanently delete user account <code>${userUid}</code>?\n\n` +
        `⚠️ <b>Warning:</b> This action cannot be undone.`,
      parse_mode: 'HTML',
      reply_markup: confirmKeyboard
    });

    await sendTelegramApi(token, 'answerCallbackQuery', {
      callback_query_id: cbId,
      text: 'Confirm user deletion',
      show_alert: false
    });

    return true;
  }

  // --- EXECUTE DELETE USER ---
  if (data.startsWith('wdr_cdel_')) {
    const raw = data.replace('wdr_cdel_', '');
    const firstUnderscore = raw.indexOf('_');
    const userUid = raw.substring(0, firstUnderscore);
    const docId = raw.substring(firstUnderscore + 1);

    try {
      const uQ = query(collection(db, 'users'), where('uid', '==', userUid));
      const uSnap = await getDocs(uQ);

      if (!uSnap.empty) {
        for (const userDoc of uSnap.docs) {
          await deleteDoc(userDoc.ref);
        }
      }

      // Log action
      try {
        await addDoc(collection(db, 'adminLogs'), {
          adminId: String(callerId),
          adminName: callerName,
          action: 'DELETE_USER_TELEGRAM',
          targetUid: userUid,
          details: `Deleted user ${userUid} via Telegram Admin Bot`,
          timestamp: new Date().toISOString()
        });
      } catch (e) {}

      await sendTelegramApi(token, 'editMessageText', {
        chat_id: chatId,
        message_id: messageId,
        text: `🗑 <b>User Account Deleted</b>\n\nUser account <code>${userUid}</code> has been permanently deleted by Admin ${callerName}.`,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[{ text: '⬅ Back to Request', callback_data: `wdr_back_${docId}` }]]
        }
      });

      await sendTelegramApi(token, 'answerCallbackQuery', {
        callback_query_id: cbId,
        text: `🗑 User account deleted!`,
        show_alert: true
      });

      return true;
    } catch (err: any) {
      console.error('Error deleting user via telegram:', err);
      return true;
    }
  }

  // --- TRANSACTION HISTORY ---
  if (data.startsWith('wdr_tx_')) {
    const docId = data.replace('wdr_tx_', '').trim();
    try {
      const wRef = doc(db, 'withdrawals', docId);
      const wSnap = await getDoc(wRef);

      if (!wSnap.exists()) {
        await sendTelegramApi(token, 'answerCallbackQuery', {
          callback_query_id: cbId,
          text: '❌ Withdrawal record not found.',
          show_alert: true
        });
        return true;
      }

      const wData = wSnap.data();
      const userUid = wData.uid;

      // Query last 10 wallet transactions for this user
      const txQ = query(
        collection(db, 'walletTransactions'),
        where('uid', '==', userUid),
        orderBy('createdAt', 'desc'),
        limit(10)
      );

      let txList: any[] = [];
      try {
        const txSnap = await getDocs(txQ);
        txSnap.forEach(d => txList.push(d.data()));
      } catch (e) {
        // Fallback without orderBy if index is building
        const fallbackQ = query(
          collection(db, 'walletTransactions'),
          where('uid', '==', userUid),
          limit(20)
        );
        const fbSnap = await getDocs(fallbackQ);
        fbSnap.forEach(d => txList.push(d.data()));
        txList.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        txList = txList.slice(0, 10);
      }

      let formattedLines = '';
      if (txList.length === 0) {
        formattedLines = '<i>No wallet transaction history recorded yet.</i>';
      } else {
        txList.forEach((tx, idx) => {
          const amtSign = tx.amount >= 0 ? '+' : '';
          const timeStr = tx.createdAt
            ? new Date(tx.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'short', timeStyle: 'short' })
            : 'N/A';
          formattedLines += `${idx + 1}. <b>${tx.type}</b>\n   Amount: <b>${amtSign}₹${tx.amount}</b> | Status: ${tx.status || 'completed'}\n   Time: <i>${timeStr}</i>\n   Note: ${tx.description || '-'}\n\n`;
        });
      }

      const historyText =
        `📜 <b>Last 10 Wallet Transactions</b>\n` +
        `👤 User: <b>${wData.userName || 'User'}</b> (UID: <code>${userUid}</code>)\n\n` +
        formattedLines;

      await sendTelegramApi(token, 'editMessageText', {
        chat_id: chatId,
        message_id: messageId,
        text: historyText,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[{ text: '⬅ Back to Request', callback_data: `wdr_back_${docId}` }]]
        }
      });

      await sendTelegramApi(token, 'answerCallbackQuery', {
        callback_query_id: cbId,
        text: 'Transaction history loaded',
        show_alert: false
      });

      return true;
    } catch (err: any) {
      console.error('Error in wdr_tx_ callback:', err);
      return true;
    }
  }

  // --- BACK TO REQUEST CARD ---
  if (data.startsWith('wdr_back_')) {
    const docId = data.replace('wdr_back_', '').trim();
    try {
      const wRef = doc(db, 'withdrawals', docId);
      const wSnap = await getDoc(wRef);

      if (!wSnap.exists()) {
        await sendTelegramApi(token, 'answerCallbackQuery', {
          callback_query_id: cbId,
          text: '❌ Withdrawal record not found.',
          show_alert: true
        });
        return true;
      }

      const wData = wSnap.data();

      // Fetch user data
      let userData: any = { uid: wData.uid, firstName: wData.userName };
      try {
        const uQ = query(collection(db, 'users'), where('uid', '==', wData.uid));
        const uSnap = await getDocs(uQ);
        if (!uSnap.empty) {
          userData = uSnap.docs[0].data();
        }
      } catch (e) {}

      if (wData.status === 'completed') {
        const requestedAmount = Number(wData.requestedAmount !== undefined ? wData.requestedAmount : wData.amount) || 0;
        const feePercent = Number(wData.feePercent !== undefined ? wData.feePercent : 6);
        const platformFee = Number(wData.platformFee !== undefined ? wData.platformFee : ((requestedAmount * feePercent) / 100).toFixed(2));
        const payoutAmount = Number(wData.payoutAmount !== undefined ? wData.payoutAmount : (requestedAmount - platformFee).toFixed(2));

        const approvedText =
          `🟢 <b>Approved</b>\n\n` +
          `💸 <b>Withdrawal Request Processed</b>\n\n` +
          `👤 <b>Name:</b> ${wData.userName || 'User'}\n` +
          `🆔 <b>UID:</b> <code>${wData.uid}</code>\n` +
          `📱 <b>Mobile:</b> <code>${userData.mobile || 'N/A'}</code>\n` +
          `💰 <b>Wallet Balance:</b> ₹${userData.walletBalance || 0}\n\n` +
          `💸 <b>Requested Amount:</b> ₹${requestedAmount}\n` +
          `⚡ <b>Platform Fee (${feePercent}%):</b> ₹${platformFee}\n` +
          `🎁 <b>Final Payout Amount:</b> ₹${payoutAmount}\n\n` +
          `🆔 <b>Withdrawal ID:</b> <code>${wData.withdrawalId}</code>\n` +
          `👑 <b>Approved By:</b> ${wData.approvedBy || 'Admin'}\n` +
          `⏱ <b>Approved At:</b> ${wData.approvedAt ? new Date(wData.approvedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'N/A'}`;

        await sendTelegramApi(token, 'editMessageText', {
          chat_id: chatId,
          message_id: messageId,
          text: approvedText,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [[{ text: '🟢 Approved', callback_data: 'wdr_noop' }]]
          }
        });
        return true;
      }

      if (wData.status === 'rejected') {
        const requestedAmount = Number(wData.requestedAmount !== undefined ? wData.requestedAmount : wData.amount) || 0;
        const feePercent = Number(wData.feePercent !== undefined ? wData.feePercent : 6);
        const platformFee = Number(wData.platformFee !== undefined ? wData.platformFee : ((requestedAmount * feePercent) / 100).toFixed(2));
        const payoutAmount = Number(wData.payoutAmount !== undefined ? wData.payoutAmount : (requestedAmount - platformFee).toFixed(2));

        const rejectedText =
          `🔴 <b>Rejected</b>\n\n` +
          `💸 <b>Withdrawal Request Rejected</b>\n\n` +
          `👤 <b>Name:</b> ${wData.userName || 'User'}\n` +
          `🆔 <b>UID:</b> <code>${wData.uid}</code>\n` +
          `📱 <b>Mobile:</b> <code>${userData.mobile || 'N/A'}</code>\n\n` +
          `💸 <b>Requested Amount:</b> ₹${requestedAmount}\n` +
          `⚡ <b>Platform Fee (${feePercent}%):</b> ₹${platformFee}\n` +
          `🎁 <b>Final Payout Amount:</b> ₹${payoutAmount}\n\n` +
          `🆔 <b>Withdrawal ID:</b> <code>${wData.withdrawalId}</code>\n` +
          `❌ <b>Rejection Reason:</b> ${wData.rejectReason || 'N/A'}\n` +
          `👑 <b>Rejected By:</b> ${wData.rejectedBy || 'Admin'}\n` +
          `⏱ <b>Rejected At:</b> ${wData.rejectedAt ? new Date(wData.rejectedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'N/A'}`;

        await sendTelegramApi(token, 'editMessageText', {
          chat_id: chatId,
          message_id: messageId,
          text: rejectedText,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [[{ text: '🔴 Rejected', callback_data: 'wdr_noop' }]]
          }
        });
        return true;
      }

      // If pending, render original card
      let totalPrevAmount = 0;
      let totalPrevCount = 0;
      try {
        const wQ = query(collection(db, 'withdrawals'), where('uid', '==', userData.uid), where('status', '==', 'completed'));
        const wSnapPrev = await getDocs(wQ);
        totalPrevCount = wSnapPrev.size;
        wSnapPrev.forEach(d => {
          totalPrevAmount += (Number(d.data().amount) || 0);
        });
      } catch (e) {}

      const riskInfo = calculateUserRiskLevel(userData, Number(wData.amount) || 0);

      let methodDetail = wData.upiId || 'N/A';
      if (wData.method === 'qr') {
        methodDetail = wData.qrImageUrl ? `<a href="${wData.qrImageUrl}">View QR Photo</a>` : 'QR Code Uploaded';
      } else if (wData.method === 'redeem_code') {
        methodDetail = `Redeem Code (${wData.redeemCodeDetails || 'N/A'})`;
      }

      const reqTime = wData.createdAt
        ? new Date(wData.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
        : 'N/A';

      const requestedAmountPending = Number(wData.requestedAmount !== undefined ? wData.requestedAmount : wData.amount) || 0;
      const feePercentPending = Number(wData.feePercent !== undefined ? wData.feePercent : 6);
      const platformFeePending = Number(wData.platformFee !== undefined ? wData.platformFee : ((requestedAmountPending * feePercentPending) / 100).toFixed(2));
      const payoutAmountPending = Number(wData.payoutAmount !== undefined ? wData.payoutAmount : (requestedAmountPending - platformFeePending).toFixed(2));

      const pendingText =
        `💸 <b>New Withdrawal Request</b>\n\n` +
        `👤 <b>Name:</b> ${userData.firstName || userData.name || wData.userName || 'User'}\n` +
        `🆔 <b>UID:</b> <code>${userData.uid}</code>\n` +
        `📱 <b>Mobile:</b> <code>${userData.mobile || 'N/A'}</code>\n` +
        `💰 <b>Wallet Balance:</b> ₹${userData.walletBalance || 0}\n\n` +
        `💸 <b>Requested Amount:</b> ₹${requestedAmountPending}\n` +
        `⚡ <b>Platform Fee (${feePercentPending}%):</b> ₹${platformFeePending}\n` +
        `🎁 <b>Final Payout Amount:</b> ₹${payoutAmountPending}\n\n` +
        `🏦 <b>UPI ID:</b> ${methodDetail}\n` +
        `📅 <b>Request Time:</b> ${reqTime}\n` +
        `🆔 <b>Withdrawal ID:</b> <code>${wData.withdrawalId}</code>\n` +
        `📊 <b>Total Previous Withdrawals:</b> ₹${totalPrevAmount} (${totalPrevCount} completed)\n` +
        `⚠ <b>Risk Level:</b> ${riskInfo.label}`;

      const replyMarkup = {
        inline_keyboard: [
          [
            { text: '✅ Approve', callback_data: `wdr_app_${docId}` },
            { text: '❌ Reject', callback_data: `wdr_rej_${docId}` }
          ],
          [
            { text: '👤 View User', callback_data: `wdr_user_${docId}` },
            { text: '📜 Transaction History', callback_data: `wdr_tx_${docId}` }
          ]
        ]
      };

      await sendTelegramApi(token, 'editMessageText', {
        chat_id: chatId,
        message_id: messageId,
        text: pendingText,
        parse_mode: 'HTML',
        reply_markup: replyMarkup
      });

      await sendTelegramApi(token, 'answerCallbackQuery', {
        callback_query_id: cbId,
        text: 'Returned to request card',
        show_alert: false
      });

      return true;
    } catch (err: any) {
      console.error('Error in wdr_back_ callback:', err);
      return true;
    }
  }

  return false;
}
