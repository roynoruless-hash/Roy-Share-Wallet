import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  runTransaction
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { recordWalletTransaction } from './transactionService';

async function sendTelegramMessage(token: string, chatId: string | number, text: string) {
  if (!token || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
      }),
    });
  } catch (err) {
    console.error('Error sending Telegram message in milestoneVerification:', err);
  }
}

async function getBotToken(): Promise<string> {
  try {
    const configDoc = await getDoc(doc(db, 'settings', 'config'));
    if (configDoc.exists()) {
      return configDoc.data().botToken || '';
    }
  } catch (e) {
    console.warn('Failed to fetch bot token for notifications:', e);
  }
  return '';
}

export interface VerifyMilestoneClaimParams {
  token: string;
  deviceFingerprint: string;
  localStorageId?: string;
  locationPermissionStatus?: 'granted' | 'denied';
  locationCoords?: { latitude: number; longitude: number; accuracy: number } | null;
  timezone?: string;
  platform?: string;
  userAgent: string;
  clientIp: string;
}

/**
 * Fetch token details for claiming a milestone
 */
export async function getMilestoneTokenInfo(tokenStr: string) {
  if (!tokenStr) {
    return { success: false, error: 'Token is required' };
  }

  try {
    const q = query(collection(db, 'milestoneTokens'), where('token', '==', tokenStr));
    const snap = await getDocs(q);

    if (snap.empty) {
      return { success: false, error: 'Token not found or invalid' };
    }

    const tokenDoc = snap.docs[0];
    const data = tokenDoc.data();

    const createdAtMs = new Date(data.createdAt).getTime();
    const isExpired = Date.now() - createdAtMs > 10 * 60 * 1000; // 10 minutes

    return {
      success: true,
      tokenData: {
        id: tokenDoc.id,
        token: data.token,
        uid: data.uid,
        telegramId: data.telegramId,
        milestoneId: data.milestoneId,
        requiredReferrals: data.requiredReferrals,
        rewardAmount: data.rewardAmount,
        rewardType: data.rewardType || 'wallet',
        used: !!data.used,
        createdAt: data.createdAt,
        expiresAt: data.expiresAt,
        isExpired,
      },
    };
  } catch (err: any) {
    console.error('Error in getMilestoneTokenInfo:', err);
    return { success: false, error: err.message || 'Error fetching milestone token info' };
  }
}

/**
 * Process milestone claim with full security and anti-fraud checks
 */
export async function processMilestoneClaim(params: VerifyMilestoneClaimParams) {
  const {
    token,
    deviceFingerprint,
    localStorageId = '',
    locationPermissionStatus,
    locationCoords,
    timezone = '',
    platform = '',
    userAgent,
    clientIp,
  } = params;

  if (!token || !deviceFingerprint) {
    return {
      success: false,
      reason: 'INVALID_PARAMS',
      message: 'Token and device fingerprint are required.',
    };
  }

  // Geolocation constraint
  if (locationPermissionStatus !== 'granted') {
    return {
      success: false,
      reason: 'PERMISSION_DENIED',
      message: 'Location permission is required to verify device and claim reward.',
    };
  }

  try {
    // 1. Fetch token
    const tokenQuery = query(collection(db, 'milestoneTokens'), where('token', '==', token));
    const tokenSnap = await getDocs(tokenQuery);

    if (tokenSnap.empty) {
      return {
        success: false,
        reason: 'INVALID_TOKEN',
        message: 'Invalid reward claim token.',
      };
    }

    const tokenDoc = tokenSnap.docs[0];
    const tokenRef = doc(db, 'milestoneTokens', tokenDoc.id);
    const tokenData = tokenDoc.data();

    const { uid, telegramId, milestoneId, requiredReferrals, rewardAmount, rewardType, used, createdAt } = tokenData;

    // Check if token is already used
    if (used) {
      return {
        success: false,
        reason: 'DUPLICATE_CLAIM_TOKEN',
        message: 'This claim link has already been used. Tokens are one-time use only.',
      };
    }

    // Check token expiry (10 minutes)
    const createdAtMs = new Date(createdAt).getTime();
    if (Date.now() - createdAtMs > 10 * 60 * 1000) {
      // Mark token as expired
      await updateDoc(tokenRef, { used: true, expired: true });
      return {
        success: false,
        reason: 'TOKEN_EXPIRED',
        message: 'This claim link has expired (10 minute limit). Please request a new milestone notification.',
      };
    }

    const botToken = await getBotToken();

    // 2. ANTI-FRAUD CHECKS
    let isFraud = false;
    let fraudReason = '';

    // A. Check if Same Device already claimed any milestone
    const deviceClaimQuery = query(
      collection(db, 'milestoneClaimRecords'),
      where('deviceFingerprint', '==', deviceFingerprint),
      where('status', '==', 'approved')
    );
    const deviceClaimSnap = await getDocs(deviceClaimQuery);
    if (!deviceClaimSnap.empty) {
      isFraud = true;
      fraudReason = 'Same Device Detected';
    }

    // B. Check duplicate browser (Same user agent in successful claims)
    if (userAgent && userAgent !== 'unknown') {
      const browserQuery = query(
        collection(db, 'milestoneClaimRecords'),
        where('userAgent', '==', userAgent),
        where('status', '==', 'approved')
      );
      const browserSnap = await getDocs(browserQuery);
      // If we have same userAgent, same device, etc., check more robustly. Let's require fingerprint to match to prevent false positives on common browsers, but we also check localStorage
      if (!browserSnap.empty && localStorageId && localStorageId !== 'ls_unavailable') {
        const matchingLs = browserSnap.docs.some(d => d.data().localStorageId === localStorageId);
        if (matchingLs) {
          isFraud = true;
          fraudReason = 'Same Device Detected';
        }
      }
    }

    // C. Check same local storage ID already claimed
    if (localStorageId && localStorageId !== 'ls_unavailable') {
      const lsQuery = query(
        collection(db, 'milestoneClaimRecords'),
        where('localStorageId', '==', localStorageId),
        where('status', '==', 'approved')
      );
      const lsSnap = await getDocs(lsQuery);
      if (!lsSnap.empty) {
        isFraud = true;
        fraudReason = 'Same Device Detected';
      }
    }

    // D. Same Device creating multiple Telegram accounts or multiple claims
    // Check if there are other telegramIds associated with this deviceFingerprint in milestone claims or referralTokens
    const multiTelegramQuery = query(
      collection(db, 'milestoneClaimRecords'),
      where('deviceFingerprint', '==', deviceFingerprint),
      where('status', '==', 'approved')
    );
    const multiTelegramSnap = await getDocs(multiTelegramQuery);
    if (!multiTelegramSnap.empty) {
      const otherTgs = multiTelegramSnap.docs.map(doc => doc.data().telegramId).filter(tid => tid !== telegramId);
      if (otherTgs.length > 0) {
        isFraud = true;
        fraudReason = 'Same Device Detected: Multiple accounts claiming from same device.';
      }
    }

    // E. Reward already claimed (Duplicate milestone check for this user)
    const userClaimQuery = query(
      collection(db, 'milestoneClaimRecords'),
      where('uid', '==', String(uid)),
      where('milestoneId', '==', milestoneId),
      where('status', '==', 'approved')
    );
    const userClaimSnap = await getDocs(userClaimQuery);
    if (!userClaimSnap.empty) {
      isFraud = true;
      fraudReason = 'Reward already claimed.';
    }

    // F. Referrer referred himself or Self Referral is not allowed
    // Verify user details
    const userSnap = await getDocs(query(collection(db, 'users'), where('uid', '==', String(uid))));
    let userData: any = null;
    let userDocId = '';
    if (!userSnap.empty) {
      userData = userSnap.docs[0].data();
      userDocId = userSnap.docs[0].id;
      // If they are flagged as having referred themselves, or their referredBy is equal to their UID
      if (userData.referredBy && String(userData.referredBy) === String(uid)) {
        isFraud = true;
        fraudReason = 'Self Referral is not allowed.';
      }
    }

    // 3. LOG TO milestoneClaimRecords COLLECTION
    const claimRecordData = {
      uid: String(uid),
      telegramId: String(telegramId),
      userName: userData?.firstName || 'User',
      telegramUsername: userData?.username || '',
      milestoneId: String(milestoneId),
      requiredReferrals: Number(requiredReferrals),
      rewardAmount: Number(rewardAmount),
      rewardType: String(rewardType),
      claimToken: token,
      status: isFraud ? 'rejected' : 'approved',
      rejectReason: isFraud ? fraudReason : '',
      ip: clientIp,
      deviceFingerprint: deviceFingerprint,
      deviceHash: deviceFingerprint,
      localStorageId: localStorageId || 'N/A',
      userAgent: userAgent || 'N/A',
      timezone: timezone || 'N/A',
      platform: platform || 'N/A',
      location: locationCoords ? { latitude: locationCoords.latitude, longitude: locationCoords.longitude } : null,
      claimTime: new Date().toISOString(),
      verifiedAt: new Date().toISOString(),
    };

    const claimDoc = await addDoc(collection(db, 'milestoneClaimRecords'), claimRecordData);

    // 4. IF FRAUD DETECTED -> REJECT REWARD
    if (isFraud) {
      // Mark token as used anyway to prevent replay attack
      await updateDoc(tokenRef, { used: true, usedAt: new Date().toISOString() });

      // Notify Telegram user of failure
      if (botToken && telegramId) {
        await sendTelegramMessage(
          botToken,
          telegramId,
          `❌ <b>Milestone Claim Rejected</b>\n\n` +
            `<b>Reason:</b> ${fraudReason || 'Same Device Detected'}\n\n` +
            `Self-referrals, duplication, and multiple claims from the same device are prohibited.`
        );
      }

      // Add Admin Audit Log
      try {
        await addDoc(collection(db, 'adminLogs'), {
          adminId: 'system_antifraud',
          action: 'milestone_claim_rejected',
          targetUid: String(uid),
          targetTelegramId: String(telegramId),
          reason: `Milestone Reject: ${fraudReason} (Device FP: ${deviceFingerprint})`,
          timestamp: new Date().toISOString(),
        });
      } catch (logErr) {
        console.warn('Failed adding admin log:', logErr);
      }

      return {
        success: false,
        reason: fraudReason || 'Same Device Detected',
        message: fraudReason === 'Self Referral is not allowed.' 
          ? 'Self Referral is not allowed.'
          : 'Same Device Detected',
      };
    }

    // 5. SUCCESSFUL CLAIM -> CREDIT BALANCES VIA TRANSACTION
    let updatedBalance = 0;
    if (userDocId) {
      const userRef = doc(db, 'users', userDocId);
      await runTransaction(db, async (transaction) => {
        const freshUserSnap = await transaction.get(userRef);
        if (!freshUserSnap.exists()) {
          throw new Error('User not found in transaction');
        }

        const uData = freshUserSnap.data();
        const curCoins = Number(uData.coinsBalance || 0);
        const curBonus = Number(uData.bonusBalance || 0);
        const curEarned = Number(uData.totalReferralEarnings || 0);

        let updateFields: any = {};
        if (rewardType === 'coins') {
          updateFields.coinsBalance = curCoins + Number(rewardAmount);
        } else if (rewardType === 'bonus') {
          updateFields.bonusBalance = curBonus + Number(rewardAmount);
        }
        
        // Update referral earnings too
        updateFields.totalReferralEarnings = curEarned + Number(rewardAmount);

        // Save verification milestone claims progress to mark it as claimed
        const progress = uData.milestoneProgress || {};
        progress[milestoneId] = 'claimed';
        updateFields.milestoneProgress = progress;

        transaction.update(userRef, updateFields);
        transaction.update(tokenRef, { used: true, usedAt: new Date().toISOString() });
      });

      // Log wallet transaction and update walletBalance atomically
      try {
        await recordWalletTransaction({
          uid: String(uid),
          type: 'Referral Milestone Reward',
          amount: Number(rewardAmount),
          status: 'completed',
          description: `Milestone Reward Claimed for ${requiredReferrals} Valid Referrals`,
          botToken: botToken,
        });
      } catch (e) {
        console.warn('Error saving transaction record:', e);
      }

      // Record System Log
      try {
        await addDoc(collection(db, 'logs'), {
          type: 'milestone_claimed',
          message: `✅ Milestone Reward of ₹${rewardAmount} claimed successfully by UID #${uid} (Referrals: ${requiredReferrals}).`,
          timestamp: new Date().toISOString(),
          details: {
            uid,
            milestoneId,
            requiredReferrals,
            rewardAmount,
            rewardType,
            claimToken: token,
            deviceFingerprint,
          },
        });
      } catch (e) {
        console.warn('Error saving logs:', e);
      }

      // Add Admin Audit Log
      try {
        await addDoc(collection(db, 'adminLogs'), {
          adminId: 'system_antifraud',
          action: 'milestone_claim_approved',
          targetUid: String(uid),
          targetTelegramId: String(telegramId),
          amount: Number(rewardAmount),
          reason: `Milestone Claim approved: ${requiredReferrals} referrals`,
          timestamp: new Date().toISOString(),
        });
      } catch (logErr) {
        console.warn('Failed adding admin log:', logErr);
      }

      // Notify Telegram user of success
      if (botToken && telegramId) {
        await sendTelegramMessage(
          botToken,
          telegramId,
          `🎉 <b>Reward Successfully Claimed</b>\n\n` +
            `<b>Reward:</b> ₹${rewardAmount} (${rewardType.toUpperCase()})\n\n` +
            `Wallet Balance Updated.`
        );
      }

      return {
        success: true,
        message: 'Milestone claim successfully verified! Reward credited to your account.',
        rewardAmount,
        rewardType,
        updatedBalance,
      };
    } else {
      return {
        success: false,
        reason: 'USER_NOT_FOUND',
        message: 'User account was not found.',
      };
    }
  } catch (err: any) {
    console.error('Error in processMilestoneClaim:', err);
    return {
      success: false,
      reason: 'SERVER_ERROR',
      message: err.message || 'Error processing milestone claim verification',
    };
  }
}
