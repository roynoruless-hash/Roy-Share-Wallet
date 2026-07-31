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
  arrayUnion,
  runTransaction,
} from 'firebase/firestore';
import { db } from '../services/firebase';

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
    console.error('Error sending Telegram notification in referralVerification:', err);
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

export interface VerifyReferralParams {
  token: string;
  deviceFingerprint: string;
  localStorageId?: string;
  locationPermissionStatus?: 'granted' | 'denied';
  locationCoords?: { latitude: number; longitude: number; accuracy: number } | null;
  rawSignals?: any;
  clientIp: string;
  userAgent: string;
}

/**
 * Get Token Details for verification page with 10-minute expiry check
 */
export async function getReferralTokenInfo(tokenStr: string) {
  if (!tokenStr) {
    return { success: false, error: 'Token string is required' };
  }

  try {
    const q = query(collection(db, 'referralTokens'), where('token', '==', tokenStr));
    const snap = await getDocs(q);

    if (snap.empty) {
      return { success: false, error: 'Referral verification token not found' };
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
        referrerUid: data.referrerUid,
        referredUid: data.referredUid,
        referredTelegramId: data.referredTelegramId,
        referredName: data.referredName,
        status: data.status || 'pending',
        rejectReason: data.rejectReason || '',
        createdAt: data.createdAt,
        isExpired,
      },
    };
  } catch (err: any) {
    console.error('Error in getReferralTokenInfo:', err);
    return { success: false, error: err.message || 'Error fetching token info' };
  }
}

/**
 * Perform complete Anti Self-Referral Device Verification & Fraud Checks (Version 2.0)
 */
export async function processReferralVerification(params: VerifyReferralParams) {
  const {
    token,
    deviceFingerprint,
    localStorageId = '',
    locationPermissionStatus,
    locationCoords,
    rawSignals,
    clientIp,
    userAgent,
  } = params;

  if (!token || !deviceFingerprint) {
    return {
      success: false,
      reason: 'INVALID_PARAMS',
      message: 'Token and device fingerprint are required.',
    };
  }

  // REQUIREMENT 3: Geolocation Permission Enforcement
  if (locationPermissionStatus !== 'granted') {
    return {
      success: false,
      reason: 'PERMISSION_DENIED',
      message: 'Location permission is required to verify your referral.',
    };
  }

  try {
    // 1. Fetch Referral Token Document
    const tokenQuery = query(collection(db, 'referralTokens'), where('token', '==', token));
    const tokenSnap = await getDocs(tokenQuery);

    if (tokenSnap.empty) {
      return {
        success: false,
        reason: 'INVALID_TOKEN',
        message: 'Invalid or expired referral verification link.',
      };
    }

    const tokenDoc = tokenSnap.docs[0];
    const tokenRef = doc(db, 'referralTokens', tokenDoc.id);
    const tokenData = tokenDoc.data();

    const { referrerUid, referredUid, referredTelegramId, referredName, status, createdAt } = tokenData;

    // REQUIREMENT 9: Check Token Expiry (10 Minutes)
    const createdAtMs = new Date(createdAt).getTime();
    if (Date.now() - createdAtMs > 10 * 60 * 1000) {
      await updateDoc(tokenRef, {
        status: 'rejected',
        rejectReason: 'Referral verification token expired (10 minute limit).',
        verifiedAt: new Date().toISOString(),
      });
      return {
        success: false,
        reason: 'TOKEN_EXPIRED',
        message: 'Referral verification token has expired (10 minute limit). Please request a new link.',
      };
    }

    // Check existing status
    if (status === 'verified') {
      return {
        success: true,
        alreadyVerified: true,
        message: 'This referral device verification has already been completed successfully.',
      };
    }

    if (status === 'rejected') {
      return {
        success: false,
        reason: 'SAME_DEVICE_DETECTED',
        message: tokenData.rejectReason || 'Self referrals or multiple Telegram accounts on the same device are not allowed.',
      };
    }

    // 2. ANTI-FRAUD CHECKS
    let isFraud = false;
    let fraudReason = '';

    // Check A: Self Referral Check (Same Telegram ID or Same UID)
    if (String(referrerUid) === String(referredUid)) {
      isFraud = true;
      fraudReason = 'Self Referral Detected: Referrer and Referred user have the same UID.';
    }

    // Check referrer's Telegram ID
    let referrerTelegramId = '';
    const referrerQuery = query(collection(db, 'users'), where('uid', '==', String(referrerUid)));
    const referrerSnap = await getDocs(referrerQuery);
    if (!referrerSnap.empty) {
      const refUser = referrerSnap.docs[0].data();
      referrerTelegramId = String(refUser.telegramId || '');
      if (referrerTelegramId && String(referrerTelegramId) === String(referredTelegramId)) {
        isFraud = true;
        fraudReason = 'Self Referral Detected: Referrer and Referred user share the same Telegram ID.';
      }
    }

    // Check B: Banned Device or User Check
    try {
      const bannedDevQuery = query(
        collection(db, 'bannedDevices'),
        where('deviceFingerprint', '==', deviceFingerprint)
      );
      const bannedDevSnap = await getDocs(bannedDevQuery);
      if (!bannedDevSnap.empty) {
        isFraud = true;
        fraudReason = 'Banned Device: This device has been banned from referral verification.';
      }

      if (localStorageId && localStorageId !== 'ls_unavailable') {
        const bannedLsQuery = query(
          collection(db, 'bannedDevices'),
          where('localStorageId', '==', localStorageId)
        );
        const bannedLsSnap = await getDocs(bannedLsQuery);
        if (!bannedLsSnap.empty) {
          isFraud = true;
          fraudReason = 'Banned Device: This device identifier has been banned.';
        }
      }
    } catch (bErr) {
      console.warn('Error checking banned devices:', bErr);
    }

    // Check C: Already Rewarded Check
    const referredQuery = query(collection(db, 'users'), where('uid', '==', String(referredUid)));
    const referredSnap = await getDocs(referredQuery);
    let referredDocRef: any = null;
    if (!referredSnap.empty) {
      referredDocRef = doc(db, 'users', referredSnap.docs[0].id);
      const refdUserData = referredSnap.docs[0].data();
      if (refdUserData.referralRewardReceived === true) {
        isFraud = true;
        fraudReason = 'Already Rewarded: This user account has already received a referral reward.';
      }
      if (refdUserData.banned === true) {
        isFraud = true;
        fraudReason = 'Account Banned: This user account has been banned.';
      }
    }

    // Check D: Same Device Fingerprint or LocalStorage ID Reuse
    const fpQuery = query(
      collection(db, 'referralTokens'),
      where('deviceFingerprint', '==', deviceFingerprint),
      where('status', '==', 'verified')
    );
    const fpSnap = await getDocs(fpQuery);

    if (!fpSnap.empty) {
      isFraud = true;
      fraudReason = 'Same Device Detected: This device has already been used for another verified referral.';
    }

    if (localStorageId && localStorageId !== 'ls_unavailable') {
      const lsQuery = query(
        collection(db, 'referralTokens'),
        where('localStorageId', '==', localStorageId),
        where('status', '==', 'verified')
      );
      const lsSnap = await getDocs(lsQuery);
      if (!lsSnap.empty) {
        isFraud = true;
        fraudReason = 'Same Device Detected: Local storage identifier matches existing referral history.';
      }
    }

    // Check Device Fingerprint Registry
    const fpDocRef = doc(db, 'deviceFingerprints', deviceFingerprint);
    const fpRegistryDoc = await getDoc(fpDocRef);

    if (fpRegistryDoc.exists()) {
      const regData = fpRegistryDoc.data();
      const knownTelegramIds = regData.telegramIds || [];
      const knownUids = regData.uids || [];

      if (
        (knownTelegramIds.length > 0 && !knownTelegramIds.includes(String(referredTelegramId))) ||
        (knownUids.length > 0 && knownUids.includes(String(referrerUid)))
      ) {
        isFraud = true;
        fraudReason = 'Same Device Detected: Device fingerprint matches existing referral history.';
      }
    }

    // 3. LOG TO referralLogs COLLECTION
    try {
      await addDoc(collection(db, 'referralLogs'), {
        token,
        uid: String(referredUid),
        referrerUid: String(referrerUid),
        telegramId: String(referredTelegramId),
        referredName: String(referredName || 'User'),
        ip: clientIp,
        deviceHash: deviceFingerprint,
        localStorageId: localStorageId || 'N/A',
        browser: userAgent,
        platform: rawSignals?.platform || 'Unknown',
        locationPermissionStatus: locationPermissionStatus || 'denied',
        locationCoords: locationCoords || null,
        verificationTime: new Date().toISOString(),
        status: isFraud ? 'rejected' : 'approved',
        rejectReason: isFraud ? fraudReason : '',
        rawSignals: rawSignals || {},
      });
    } catch (logErr) {
      console.warn('Failed recording referralLog:', logErr);
    }

    // 4. IF FRAUD DETECTED -> REJECT REFERRAL
    if (isFraud) {
      // Mark token as rejected
      await updateDoc(tokenRef, {
        status: 'rejected',
        rejectReason: fraudReason,
        deviceFingerprint,
        localStorageId,
        ipAddress: clientIp,
        userAgent,
        verifiedAt: new Date().toISOString(),
      });

      // Update Device Fingerprint Log
      try {
        if (fpRegistryDoc.exists()) {
          await updateDoc(fpDocRef, {
            uids: arrayUnion(referredUid),
            telegramIds: arrayUnion(referredTelegramId),
            referralTokens: arrayUnion(token),
            lastUsedAt: new Date().toISOString(),
          });
        } else {
          await setDoc(fpDocRef, {
            fingerprint: deviceFingerprint,
            localStorageId,
            uids: [referredUid],
            telegramIds: [referredTelegramId],
            referralTokens: [token],
            count: 1,
            lastUsedAt: new Date().toISOString(),
          });
        }
      } catch (fpErr) {
        console.warn('Failed updating device fingerprint doc:', fpErr);
      }

      // Add Admin Audit Log
      try {
        await addDoc(collection(db, 'adminLogs'), {
          adminId: 'system_antifraud',
          action: 'referral_rejected',
          targetUid: String(referredUid),
          targetTelegramId: String(referredTelegramId),
          reason: `Rejected: ${fraudReason} (Device FP: ${deviceFingerprint})`,
          timestamp: new Date().toISOString(),
        });
      } catch (logErr) {
        console.warn('Failed adding admin log:', logErr);
      }

      // Notify Telegram user
      const botToken = await getBotToken();
      if (botToken && referredTelegramId) {
        await sendTelegramMessage(
          botToken,
          referredTelegramId,
          `❌ <b>Referral Verification Failed</b>\n\n` +
            `<b>Reason:</b> Same Device Detected.\n\n` +
            `Self-referrals or multiple Telegram accounts on the same device are not allowed. No referral reward has been granted.`
        );
      }

      return {
        success: false,
        reason: 'SAME_DEVICE_DETECTED',
        message: 'Self referrals or multiple Telegram accounts on the same device are not allowed.',
      };
    }

    // 5. VERIFICATION PASSED -> CREDIT REFERRAL REWARD VIA TRANSACTION
    const botToken = await getBotToken();

    // Read Admin Config for reward rate
    let rewardAmount = 5;
    try {
      const configDoc = await getDoc(doc(db, 'settings', 'config'));
      if (configDoc.exists()) {
        const c = configDoc.data();
        rewardAmount = Number(c.rewardPerReferral ?? c.referralBonus ?? 5);
      }
    } catch (e) {
      console.warn('Error fetching reward amount:', e);
    }

    let updatedReferrerBalance = 0;

    if (!referrerSnap.empty) {
      const referrerDocRef = doc(db, 'users', referrerSnap.docs[0].id);

      await runTransaction(db, async (transaction) => {
        const refFreshSnap = await transaction.get(referrerDocRef);
        if (!refFreshSnap.exists()) {
          throw new Error('Referrer account not found');
        }

        const refData = refFreshSnap.data();
        const currentBal = Number(refData.walletBalance || 0);
        const currentTotal = Number(refData.totalReferrals || 0);
        const currentSucc = Number(refData.successfulReferrals || 0);
        const currentEarned = Number(refData.totalReferralEarnings || 0);

        updatedReferrerBalance = currentBal + rewardAmount;

        // Credit referrer
        transaction.update(referrerDocRef, {
          walletBalance: updatedReferrerBalance,
          totalReferrals: currentTotal + 1,
          successfulReferrals: currentSucc + 1,
          totalReferralEarnings: currentEarned + rewardAmount,
        });

        // Update referred user
        if (referredDocRef) {
          transaction.update(referredDocRef, {
            referralRewardReceived: true,
            referredBy: referrerUid,
          });
        }

        // Update referral token
        transaction.update(tokenRef, {
          status: 'verified',
          deviceFingerprint,
          localStorageId,
          ipAddress: clientIp,
          userAgent,
          verifiedAt: new Date().toISOString(),
        });
      });

      // Record Wallet Transaction for Referrer
      try {
        await addDoc(collection(db, 'transactions'), {
          userId: referrerSnap.docs[0].id,
          uid: String(referrerUid),
          type: 'referral',
          amount: rewardAmount,
          balanceAfter: updatedReferrerBalance,
          reason: `Referral Reward for Verified Friend (UID #${referredUid})`,
          createdAt: new Date().toISOString(),
        });
      } catch (txErr) {
        console.warn('Error recording transaction:', txErr);
      }

      // Update Device Fingerprint Registry
      try {
        if (fpRegistryDoc.exists()) {
          await updateDoc(fpDocRef, {
            uids: arrayUnion(referredUid, referrerUid),
            telegramIds: arrayUnion(referredTelegramId, referrerTelegramId),
            referralTokens: arrayUnion(token),
            localStorageId,
            lastUsedAt: new Date().toISOString(),
          });
        } else {
          await setDoc(fpDocRef, {
            fingerprint: deviceFingerprint,
            localStorageId,
            uids: [referredUid, referrerUid],
            telegramIds: [referredTelegramId, referrerTelegramId].filter(Boolean),
            referralTokens: [token],
            count: 1,
            lastUsedAt: new Date().toISOString(),
          });
        }
      } catch (fpErr) {
        console.warn('Error updating fp registry:', fpErr);
      }

      // Add Admin Log
      try {
        await addDoc(collection(db, 'adminLogs'), {
          adminId: 'system_antifraud',
          action: 'referral_verified',
          targetUid: String(referredUid),
          targetTelegramId: String(referredTelegramId),
          amount: rewardAmount,
          reason: `Device Fingerprint Verified (${deviceFingerprint})`,
          timestamp: new Date().toISOString(),
        });
      } catch (logErr) {
        console.warn('Error adding admin log:', logErr);
      }

      // Add System Log
      try {
        await addDoc(collection(db, 'logs'), {
          type: 'referral_verified',
          message: `✅ Referral reward of ₹${rewardAmount} verified & credited to referrer UID #${referrerUid} for referring UID #${referredUid}.`,
          timestamp: new Date().toISOString(),
          details: {
            token,
            referrerUid,
            referredUid,
            rewardAmount,
            deviceFingerprint,
            localStorageId,
            clientIp,
          },
        });
      } catch (logErr) {
        console.warn('Error adding system log:', logErr);
      }

      // Notify Referrer on Telegram
      if (botToken && referrerTelegramId) {
        await sendTelegramMessage(
          botToken,
          referrerTelegramId,
          `🎉 <b>Referral Reward Verified & Credited!</b>\n\n` +
            `Your friend <b>${referredName}</b> (UID: <code>${referredUid}</code>) passed device verification!\n\n` +
            `💰 <b>Reward Credited:</b> ₹${rewardAmount}\n` +
            `👛 <b>New Balance:</b> ₹${updatedReferrerBalance}`
        );
      }

      // Notify Referred User on Telegram
      if (botToken && referredTelegramId) {
        await sendTelegramMessage(
          botToken,
          referredTelegramId,
          `✅ <b>Referral Verified Successfully!</b>\n\n` +
            `Your device verification was successful. Your referrer was credited ₹${rewardAmount}.`
        );
      }

      return {
        success: true,
        message: 'Referral device verified successfully! Reward credited.',
      };
    } else {
      return {
        success: false,
        reason: 'REFERRER_NOT_FOUND',
        message: 'Referrer account was not found.',
      };
    }
  } catch (err: any) {
    console.error('Error in processReferralVerification:', err);
    return {
      success: false,
      reason: 'SERVER_ERROR',
      message: err.message || 'Internal error processing verification',
    };
  }
}
