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
 * Perform complete Anti Self-Referral Device Verification & Fraud Checks (Version 3.0)
 */
function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return d;
}

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
    if (status === 'verified' || status === 'approved') {
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

    // REQUIREMENT 6: VERIFIED REGISTRATION STATUS FILTER
    // Check if referred user is fully registered, active, and verified
    let referredSnap = await getDocs(query(collection(db, 'users'), where('appUid', '==', String(referredUid))));
    if (referredSnap.empty) {
      referredSnap = await getDocs(query(collection(db, 'users'), where('uid', '==', String(referredUid))));
    }

    if (referredSnap.empty) {
      return {
        success: false,
        reason: 'VERIFICATION_INCOMPLETE',
        message: 'Referred user registration not found. Please complete bot registration first.',
      };
    }

    const refdUserData = referredSnap.docs[0].data();
    const referredDocRef = referredSnap.docs[0].ref;

    const isMobileVerified = refdUserData.mobileVerified === true || refdUserData.contactVerified === true;
    const isTelegramVerified = refdUserData.telegramVerified === true || refdUserData.channelVerified === true;
    const isActive = refdUserData.status === 'active' || refdUserData.accountActive === true;

    if (!isMobileVerified || !isTelegramVerified || !isActive) {
      return {
        success: false,
        reason: 'VERIFICATION_INCOMPLETE',
        message: 'Referred user is not fully registration-completed or mobile-verified. Please ensure bot setup is complete.',
      };
    }

    // 2. MULTI-SIGNAL RISK SCORING ENGINE
    let riskScore = 0;
    const riskFlags: string[] = [];

    // Check A: Self Referral Check (Same Telegram ID or Same UID) -> 100 points
    let isSelfReferral = false;
    if (String(referrerUid) === String(referredUid)) {
      isSelfReferral = true;
    }

    let referrerTelegramId = '';
    let referrerSnap = await getDocs(query(collection(db, 'users'), where('appUid', '==', String(referrerUid))));
    if (referrerSnap.empty) {
      referrerSnap = await getDocs(query(collection(db, 'users'), where('uid', '==', String(referrerUid))));
    }
    if (!referrerSnap.empty) {
      const refUser = referrerSnap.docs[0].data();
      referrerTelegramId = String(refUser.telegramId || '');
      if (referrerTelegramId && String(referrerTelegramId) === String(referredTelegramId)) {
        isSelfReferral = true;
      }
    }

    if (isSelfReferral) {
      riskScore += 100;
      riskFlags.push('Self Referral Detected');
    }

    // Check B: Already Rewarded Check -> 100 points
    if (refdUserData.referralRewardReceived === true) {
      riskScore += 100;
      riskFlags.push('Already Rewarded Referral');
    }

    // Check C: Duplicate Device Fingerprint Registry -> 40 points
    let isDuplicateFp = false;
    const fpQuery = query(
      collection(db, 'referralTokens'),
      where('deviceFingerprint', '==', deviceFingerprint),
      where('status', '==', 'verified')
    );
    const fpSnap = await getDocs(fpQuery);
    if (!fpSnap.empty) {
      isDuplicateFp = true;
    } else {
      // Check users collection
      const uFpQuery = query(collection(db, 'users'), where('deviceFingerprint', '==', deviceFingerprint));
      const uFpSnap = await getDocs(uFpQuery);
      uFpSnap.forEach((dDoc) => {
        if (dDoc.id !== referredUid && dDoc.id !== referrerUid) {
          isDuplicateFp = true;
        }
      });
    }
    if (isDuplicateFp) {
      riskScore += 40;
      riskFlags.push('Duplicate Device Fingerprint');
    }

    // Check D: Same Device Registry (Device Fingerprints Collection) -> 35 points per extra account
    let sameDeviceExtraAccounts = 0;
    const fpDocRef = doc(db, 'deviceFingerprints', deviceFingerprint);
    const fpRegistryDoc = await getDoc(fpDocRef);
    if (fpRegistryDoc.exists()) {
      const regData = fpRegistryDoc.data();
      const knownTelegramIds = regData.telegramIds || [];
      const otherTgs = knownTelegramIds.filter((id: string) => String(id) !== String(referredTelegramId));
      sameDeviceExtraAccounts = otherTgs.length;
    }
    if (sameDeviceExtraAccounts > 0) {
      riskScore += (sameDeviceExtraAccounts * 35);
      riskFlags.push(`Same Device Registry: ${sameDeviceExtraAccounts} other account(s)`);
    }

    // Check E: IP Reuse Check -> 15 points
    let ipReuseCount = 0;
    if (clientIp && clientIp !== '127.0.0.1' && clientIp !== '::1' && clientIp !== 'localhost' && clientIp !== 'unknown') {
      const ipQuery = query(collection(db, 'users'), where('ipAddress', '==', clientIp));
      const ipSnap = await getDocs(ipQuery);
      ipSnap.forEach((docSnap) => {
        if (docSnap.id !== referredUid) {
          ipReuseCount++;
        }
      });
    }
    if (ipReuseCount >= 3) {
      riskScore += 15;
      riskFlags.push(`Suspicious IP Reuse: ${ipReuseCount} other account(s)`);
    }

    // Check F: Enhanced Location Discrepancy (GPS vs IP) -> 30 points
    let ipLat: number | null = null;
    let ipLon: number | null = null;
    let distanceKm = 0;
    let locationDiscrepancy = false;

    const isPrivateIp = !clientIp ||
      clientIp === '127.0.0.1' ||
      clientIp === '::1' ||
      clientIp === 'localhost' ||
      clientIp.startsWith('10.') ||
      clientIp.startsWith('192.168.') ||
      clientIp.startsWith('172.');

    if (!isPrivateIp && locationCoords && typeof locationCoords.latitude === 'number' && typeof locationCoords.longitude === 'number') {
      try {
        const ipRes = await fetch(`http://ip-api.com/json/${clientIp}?fields=status,lat,lon`);
        const ipData = await ipRes.json();
        if (ipData && ipData.status === 'success' && typeof ipData.lat === 'number' && typeof ipData.lon === 'number') {
          ipLat = ipData.lat;
          ipLon = ipData.lon;

          const gpsLat = locationCoords.latitude;
          const gpsLon = locationCoords.longitude;

          const isGpsValid = gpsLat >= -90 && gpsLat <= 90 && gpsLon >= -180 && gpsLon <= 180 && !(gpsLat === 0 && gpsLon === 0);
          const isIpValid = ipLat >= -90 && ipLat <= 90 && ipLon >= -180 && ipLon <= 180 && !(ipLat === 0 && ipLon === 0);

          if (isGpsValid && isIpValid) {
            distanceKm = calculateHaversineDistance(gpsLat, gpsLon, ipLat, ipLon);
            if (distanceKm > 1000) {
              locationDiscrepancy = true;
            }
          }
        }
      } catch (err) {
        console.warn('[processReferralVerification] Resilient IP location look up failed:', err);
      }
    }

    if (locationDiscrepancy) {
      riskScore += 30;
      riskFlags.push(`Location Discrepancy: ${Math.round(distanceKm)} km between GPS & IP`);
    }

    // Check G: Browser/Environment Signal & Bot Attack Detectors -> 50 points
    let isBotOrHeadless = false;
    if (rawSignals?.webdriver === true || rawSignals?.headless === true || (userAgent && (userAgent.toLowerCase().includes('headless') || userAgent.toLowerCase().includes('selenium') || userAgent.toLowerCase().includes('puppeteer')))) {
      isBotOrHeadless = true;
    }
    if (isBotOrHeadless) {
      riskScore += 50;
      riskFlags.push('Automated/Headless Browser Detected');
    }

    // Check H: Referrer Abuse History -> 25 points
    let referrerAbuseCount = 0;
    const refAbuseQuery = query(
      collection(db, 'referralLogs'),
      where('referrerUid', '==', String(referrerUid)),
      where('status', '==', 'rejected')
    );
    const refAbuseSnap = await getDocs(refAbuseQuery);
    referrerAbuseCount = refAbuseSnap.size;
    if (referrerAbuseCount >= 3) {
      riskScore += 25;
      riskFlags.push(`Referrer Abuse History: ${referrerAbuseCount} rejected referrals`);
    }

    // Determine Status
    let statusValue: 'approved' | 'pending' | 'rejected' = 'approved';
    const rejectReasonText = riskFlags.join(', ') || 'Security policy rejection.';

    if (riskScore >= 80) {
      statusValue = 'rejected';
    } else if (riskScore >= 50) {
      statusValue = 'pending';
    } else {
      statusValue = 'approved';
    }

    // Retrieve referred user's username for logging
    const referredUsername = refdUserData?.username || 'Anonymous';

    // 3. LOG TO referralLogs COLLECTION
    try {
      await addDoc(collection(db, 'referralLogs'), {
        token,
        uid: String(referredUid),
        referredUsername,
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
        status: statusValue,
        riskScore,
        rejectReason: statusValue === 'rejected' ? rejectReasonText : '',
        rawSignals: rawSignals || {},
      });
    } catch (logErr) {
      console.warn('Failed recording referralLog:', logErr);
    }

    // 4. ACTION BASED ON RISK VALUE
    // A. HIGH RISK (>= 80) -> REJECT REFERRAL AND BAN USER
    if (statusValue === 'rejected') {
      // Mark token as rejected
      await updateDoc(tokenRef, {
        status: 'rejected',
        riskScore,
        rejectReason: rejectReasonText,
        deviceFingerprint,
        localStorageId,
        ipAddress: clientIp,
        userAgent,
        verifiedAt: new Date().toISOString(),
      });

      // BAN repeat offenders
      await updateDoc(referredDocRef, {
        banned: true,
        status: 'banned',
        banReason: `Fraudulent self-referral: ${rejectReasonText}`,
        updatedAt: new Date().toISOString(),
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
          action: 'referral_rejected_and_user_banned',
          targetUid: String(referredUid),
          targetTelegramId: String(referredTelegramId),
          reason: `Auto Banned: ${rejectReasonText} (Device FP: ${deviceFingerprint})`,
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
          `❌ <b>Referral Blocked & Account Suspended</b>\n\n` +
            `<b>Reason:</b> Multiple device registry or anti-fraud trigger.\n\n` +
            `Your account has been placed under suspension for violating referral safety guidelines. No referral reward has been granted.`
        );
      }

      return {
        success: false,
        reason: 'SAME_DEVICE_DETECTED',
        message: 'Self referrals or duplicate devices are not allowed. The account has been suspended.',
      };
    }

    // B. MEDIUM RISK (50 - 79) -> SUBMIT AS PENDING REVIEW
    if (statusValue === 'pending') {
      // Mark token as pending
      await updateDoc(tokenRef, {
        status: 'pending',
        riskScore,
        deviceFingerprint,
        localStorageId,
        ipAddress: clientIp,
        userAgent,
        verifiedAt: new Date().toISOString(),
      });

      // Notify Telegram referrer & user of verification review
      const botToken = await getBotToken();
      if (botToken && referredTelegramId) {
        await sendTelegramMessage(
          botToken,
          referredTelegramId,
          `🟡 <b>Referral Verification Under Review</b>\n\n` +
            `Your referral of friend <b>${referredName}</b> is currently being reviewed by an administrator to verify safety guidelines.\n\n` +
            `Rewards will be released automatically upon approval.`
        );
      }

      return {
        success: true,
        pendingReview: true,
        message: 'Your referral is under pending review by administrators. Rewards will be credited upon manual approval.',
      };
    }

    // C. LOW RISK (< 50) -> CREDIT REFERRAL REWARD VIA TRANSACTION
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
    let newReferralCount = 0;

    if (!referrerSnap.empty) {
      const referrerDocRef = doc(db, 'users', referrerSnap.docs[0].id);

      await runTransaction(db, async (transaction) => {
        const refFreshSnap = await transaction.get(referrerDocRef);
        if (!refFreshSnap.exists()) {
          throw new Error('Referrer account not found');
        }

        const refData = refFreshSnap.data();
        const currentTotal = Number(refData.totalReferrals || 0);
        const currentSucc = Number(refData.successfulReferrals || 0);
        const currentEarned = Number(refData.totalReferralEarnings || 0);

        newReferralCount = currentSucc + 1;

        // Update referrer statistics (balance is updated below via recordWalletTransaction)
        transaction.update(referrerDocRef, {
          totalReferrals: currentTotal + 1,
          successfulReferrals: newReferralCount,
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

      // Record Wallet Transaction for Referrer atomically
      try {
        await recordWalletTransaction({
          uid: String(referrerUid),
          type: 'Referral Bonus',
          amount: rewardAmount,
          status: 'completed',
          description: `Referral Reward for Verified Friend (UID #${referredUid})`,
          botToken: botToken,
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
            `👛 <b>Status:</b> Credited Instantly`
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

      // Trigger milestone checks asynchronously
      checkAndTriggerReferralMilestones(referrerUid, newReferralCount).catch((err) => {
        console.error('Error in checkAndTriggerReferralMilestones trigger:', err);
      });

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

/**
 * Check if the referrer has hit any milestones with their new referral count.
 * Generates a claim token and notifies them on Telegram with a button.
 */
export async function checkAndTriggerReferralMilestones(referrerUid: string, newCount: number) {
  try {
    const milestonesSnap = await getDocs(
      query(collection(db, 'referralMilestones'), where('active', '==', true))
    );
    if (milestonesSnap.empty) return;

    const milestones: any[] = [];
    milestonesSnap.forEach((doc) => {
      milestones.push({ id: doc.id, ...doc.data() });
    });

    // Find any milestone where the user qualifies
    const eligibleMilestones = milestones.filter(
      (m) => Number(m.requiredReferrals) <= newCount
    );

    if (eligibleMilestones.length === 0) return;

    const botToken = await getBotToken();
    if (!botToken) return;

    // Fetch user details to get their telegram ID
    const userQuery = query(collection(db, 'users'), where('uid', '==', String(referrerUid)));
    const userSnap = await getDocs(userQuery);
    if (userSnap.empty) return;
    const userData = userSnap.docs[0].data();
    const telegramId = String(userData.telegramId || '');
    if (!telegramId) return;

    for (const milestone of eligibleMilestones) {
      // Check if user already claimed or has a token for this milestone
      const claimQuery = query(
        collection(db, 'milestoneClaimRecords'),
        where('uid', '==', String(referrerUid)),
        where('milestoneId', '==', milestone.id)
      );
      const claimSnap = await getDocs(claimQuery);

      const tokenQuery = query(
        collection(db, 'milestoneTokens'),
        where('uid', '==', String(referrerUid)),
        where('milestoneId', '==', milestone.id),
        where('used', '==', false)
      );
      const tokenSnap = await getDocs(tokenQuery);

      // If they already claimed or have a pending active token, skip
      if (!claimSnap.empty || !tokenSnap.empty) {
        continue;
      }

      // Generate a secure one-time token
      const secureToken = 'claim_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const createdAt = new Date().toISOString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

      // Save token
      await addDoc(collection(db, 'milestoneTokens'), {
        token: secureToken,
        uid: String(referrerUid),
        telegramId: telegramId,
        milestoneId: milestone.id,
        requiredReferrals: Number(milestone.requiredReferrals),
        rewardAmount: Number(milestone.rewardAmount),
        rewardType: String(milestone.rewardType),
        createdAt,
        expiresAt,
        used: false,
      });

      // Send Telegram notification with an inline keyboard button!
      const botConfigDoc = await getDoc(doc(db, 'settings', 'config'));
      let baseDomain = 'https://roy-share-wallet.onrender.com';
      if (botConfigDoc.exists()) {
        const bd = botConfigDoc.data().appBaseUrl || botConfigDoc.data().appUrl;
        if (bd) baseDomain = bd.replace(/\/$/, '');
      }

      const claimUrl = `${baseDomain}/claim-reward?token=${secureToken}`;

      const inlineKeyboard = {
        inline_keyboard: [
          [
            {
              text: '🎁 Claim Reward',
              url: claimUrl,
            },
          ],
        ],
      };

      const messageText = `🎉 <b>Congratulations!</b>\n\n` +
        `You have completed\n` +
        `✅ <b>${milestone.requiredReferrals} Valid Referrals</b>\n\n` +
        `<b>Reward:</b>\n` +
        `💰 <b>₹${milestone.rewardAmount}</b> (${milestone.rewardType.toUpperCase()})\n\n` +
        `Press the button below to verify your device and claim your reward.`;

      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: telegramId,
          text: messageText,
          parse_mode: 'HTML',
          reply_markup: inlineKeyboard,
        }),
      });
    }
  } catch (err) {
    console.error('Error in checkAndTriggerReferralMilestones:', err);
  }
}
