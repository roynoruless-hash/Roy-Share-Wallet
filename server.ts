import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { processTelegramUpdate } from './src/server/botHandler';
import { getReferralTokenInfo, processReferralVerification } from './src/server/referralVerification';
import { getMilestoneTokenInfo, processMilestoneClaim } from './src/server/milestoneVerification';
import { approveWithdrawal, rejectWithdrawal } from './src/server/withdrawalHandler';
import { approveFeedbackReview, rejectFeedbackReview } from './src/server/feedbackHandler';
import { doc, setDoc, collection, query, where, getDocs, getDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { db } from './src/services/firebase';
import crypto from 'crypto';
import { encrypt, decrypt } from './src/utils/encryption';

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Parse JSON payloads
  app.use(express.json());

  // Helper to reply via Telegram API
  async function sendTelegramMessage(token: string, chatId: number | string, text: string) {
    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'HTML',
        }),
      });
      return await response.json();
    } catch (err) {
      console.error('Error sending Telegram message:', err);
      return null;
    }
  }

  // 1. TELEGRAM WEBHOOK ENDPOINTS
  // Telegram sends updates here via POST
  const handleWebhook = async (req: express.Request, res: express.Response) => {
    try {
      const token = req.params.token || (req.query.token as string) || (req.headers['x-bot-token'] as string);
      const update = req.body;

      console.log('Incoming Telegram Update:', JSON.stringify(update));

      if (token && update) {
        // Process update asynchronously or synchronously through complete bot handler
        processTelegramUpdate(token, update).catch((err) =>
          console.error('Error in processTelegramUpdate:', err)
        );
      }

      // Always return 200 OK to Telegram
      return res.status(200).json({ ok: true });
    } catch (error: any) {
      console.error('Webhook processing error:', error);
      return res.status(200).json({ ok: true, error: error.message });
    }
  };

  app.post('/api/telegram/webhook/:token', handleWebhook);
  app.post('/api/telegram/webhook', handleWebhook);

  // 2. SET WEBHOOK ENDPOINT
  app.post('/api/telegram/set-webhook', async (req, res) => {
    try {
      const { token, customDomain } = req.body;
      const cleanToken = token?.trim();

      if (!cleanToken) {
        return res.status(400).json({ success: false, error: 'Bot Token is required.' });
      }

      const host = (req.headers['x-forwarded-host'] as string) || req.headers.host;
      const proto = (req.headers['x-forwarded-proto'] as string) || 'https';
      const defaultDomain = process.env.APP_BASE_URL || process.env.APP_URL || `${proto}://${host}`;
      const baseDomain = (customDomain || defaultDomain).replace(/\/$/, '');

      const webhookUrl = `${baseDomain}/api/telegram/webhook/${cleanToken}`;

      console.log(`Setting Telegram webhook for bot to: ${webhookUrl}`);

      const tgRes = await fetch(
        `https://api.telegram.org/bot${cleanToken}/setWebhook`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: webhookUrl,
            allowed_updates: ['message', 'callback_query', 'channel_post', 'chat_member'],
          }),
        }
      );

      const tgData = await tgRes.json();

      if (tgData.ok) {
        return res.json({
          success: true,
          webhookUrl,
          description: tgData.description || 'Webhook registered successfully',
        });
      } else {
        return res.status(400).json({
          success: false,
          webhookUrl,
          error: tgData.description || 'Telegram API returned error when setting webhook',
        });
      }
    } catch (err: any) {
      console.error('Set webhook endpoint error:', err);
      return res.status(500).json({
        success: false,
        error: err.message || 'Internal server error setting webhook',
      });
    }
  });

  // 3. GET WEBHOOK INFO ENDPOINT
  app.get('/api/telegram/webhook-info', async (req, res) => {
    try {
      const token = (req.query.token as string)?.trim();
      if (!token) {
        return res.status(400).json({ success: false, error: 'Token query parameter required' });
      }

      const tgRes = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
      const tgData = await tgRes.json();

      if (tgData.ok) {
        const info = tgData.result;
        return res.json({
          success: true,
          url: info.url || '',
          hasCustomCertificate: info.has_custom_certificate || false,
          pendingUpdateCount: info.pending_update_count || 0,
          lastErrorDate: info.last_error_date,
          lastErrorMessage: info.last_error_message || '',
          rawResult: info,
        });
      } else {
        return res.status(400).json({
          success: false,
          error: tgData.description || 'Failed to fetch webhook info from Telegram',
        });
      }
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err.message || 'Network error fetching webhook info',
      });
    }
  });

  // 4. TEST BOT ENDPOINT
  app.post('/api/telegram/test-bot', async (req, res) => {
    try {
      const { token, adminChatId } = req.body;
      const cleanToken = token?.trim();

      if (!cleanToken) {
        return res.status(400).json({ success: false, error: 'Bot Token is required to test bot.' });
      }

      // Step A: Test getMe
      const getMeRes = await fetch(`https://api.telegram.org/bot${cleanToken}/getMe`);
      const getMeData = await getMeRes.json();

      if (!getMeData.ok) {
        return res.status(400).json({
          success: false,
          error: `Bot Token Invalid: ${getMeData.description || 'Failed getMe check'}`,
        });
      }

      const botUser = getMeData.result;

      // Step B: Check Webhook Info
      const getWhRes = await fetch(`https://api.telegram.org/bot${cleanToken}/getWebhookInfo`);
      const getWhData = await getWhRes.json();
      let webhookInfo = getWhData.ok ? getWhData.result : null;

      const host = (req.headers['x-forwarded-host'] as string) || req.headers.host;
      const proto = (req.headers['x-forwarded-proto'] as string) || 'https';
      const baseDomain = (process.env.APP_BASE_URL || process.env.APP_URL || `${proto}://${host}`).replace(/\/$/, '');
      const expectedWebhookUrl = `${baseDomain}/api/telegram/webhook/${cleanToken}`;

      let autoRegistered = false;
      let webhookRegError = '';

      // Requirement 4: If webhook is missing or points to wrong host, auto-register it!
      if (!webhookInfo?.url || !webhookInfo.url.includes('/api/telegram/webhook/')) {
        const setWhRes = await fetch(`https://api.telegram.org/bot${cleanToken}/setWebhook`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: expectedWebhookUrl,
            allowed_updates: ['message', 'callback_query', 'channel_post', 'chat_member'],
          }),
        });
        const setWhData = await setWhRes.json();
        if (setWhData.ok) {
          autoRegistered = true;
          webhookInfo = { url: expectedWebhookUrl, pending_update_count: 0 };
        } else {
          webhookRegError = setWhData.description || 'Webhook registration failed';
        }
      }

      // Step C: Optional Admin Chat Ping Test
      let pingResult = null;
      if (adminChatId) {
        pingResult = await sendTelegramMessage(
          cleanToken,
          adminChatId,
          `🤖 <b>Roy Share Bot Test Passed!</b>\n\n` +
            `• Bot Name: <b>${botUser.first_name}</b>\n` +
            `• Username: @${botUser.username}\n` +
            `• Webhook: <code>${webhookInfo?.url || 'Not set'}</code>\n` +
            `• Status: Online & Receiving Updates ✅`
        );
      }

      return res.json({
        success: true,
        message: `Bot @${botUser.username} is Active & Online!`,
        botInfo: {
          id: botUser.id,
          username: botUser.username,
          firstName: botUser.first_name,
        },
        webhookInfo: {
          url: webhookInfo?.url || '',
          pendingUpdates: webhookInfo?.pending_update_count || 0,
          lastError: webhookInfo?.last_error_message || '',
          autoRegistered,
          webhookRegError,
        },
        pingResult,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: `Bot Test Error: ${err.message || 'Network exception'}`,
      });
    }
  });

  // 5. ADMIN DIRECT TELEGRAM MESSAGE ENDPOINT
  app.post('/api/admin/send-message', async (req, res) => {
    try {
      const { token, chatId, text } = req.body;
      const cleanToken = token?.trim();

      if (!cleanToken || !chatId || !text) {
        return res.status(400).json({ success: false, error: 'Bot Token, Chat ID, and message text are required.' });
      }

      const tgRes = await sendTelegramMessage(cleanToken, chatId, text);
      if (tgRes && tgRes.ok) {
        return res.json({ success: true, messageId: tgRes.result?.message_id });
      } else {
        return res.status(400).json({
          success: false,
          error: tgRes?.description || 'Failed to send message via Telegram API. Ensure user has started bot.',
        });
      }
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message || 'Internal server error' });
    }
  });

  // 6. ANTI SELF-REFERRAL VERIFICATION ENDPOINTS
  app.get('/api/referral/token-info', async (req, res) => {
    try {
      const token = req.query.token as string;
      const info = await getReferralTokenInfo(token);
      if (info.success) {
        return res.json(info);
      } else {
        return res.status(400).json(info);
      }
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/referral/verify', async (req, res) => {
    try {
      const {
        token,
        deviceFingerprint,
        localStorageId,
        locationPermissionStatus,
        locationCoords,
        rawSignals,
        browserSignals,
      } = req.body;

      const clientIp =
        ((req.headers['x-forwarded-for'] as string) || '').split(',')[0].trim() ||
        req.socket.remoteAddress ||
        '127.0.0.1';
      const userAgent = req.headers['user-agent'] || 'unknown';

      const result = await processReferralVerification({
        token,
        deviceFingerprint,
        localStorageId,
        locationPermissionStatus,
        locationCoords,
        rawSignals: rawSignals || browserSignals,
        clientIp,
        userAgent,
      });

      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ success: false, reason: 'SERVER_ERROR', message: err.message });
    }
  });

  // MILESTONE REWARD CLAIM ENDPOINTS
  app.get('/api/milestones/claim-token-info', async (req, res) => {
    try {
      const token = req.query.token as string;
      const info = await getMilestoneTokenInfo(token);
      if (info.success) {
        return res.json(info);
      } else {
        return res.status(400).json(info);
      }
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/milestones/claim', async (req, res) => {
    try {
      const {
        token,
        deviceFingerprint,
        localStorageId,
        locationPermissionStatus,
        locationCoords,
        timezone,
        platform,
      } = req.body;

      const clientIp =
        ((req.headers['x-forwarded-for'] as string) || '').split(',')[0].trim() ||
        req.socket.remoteAddress ||
        '127.0.0.1';
      const userAgent = req.headers['user-agent'] || 'unknown';

      const result = await processMilestoneClaim({
        token,
        deviceFingerprint,
        localStorageId,
        locationPermissionStatus,
        locationCoords,
        timezone,
        platform,
        userAgent,
        clientIp,
      });

      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ success: false, reason: 'SERVER_ERROR', message: err.message });
    }
  });

  // Admin Ban Device Endpoint
  app.post('/api/admin/referrals/ban-device', async (req, res) => {
    try {
      const { deviceFingerprint, localStorageId, ipAddress, reason } = req.body;
      if (!deviceFingerprint && !localStorageId && !ipAddress) {
        return res.status(400).json({ success: false, error: 'Device fingerprint, localStorageId, or IP is required' });
      }

      const key = deviceFingerprint || localStorageId || ipAddress;
      await setDoc(doc(db, 'bannedDevices', key), {
        deviceFingerprint: deviceFingerprint || '',
        localStorageId: localStorageId || '',
        ipAddress: ipAddress || '',
        reason: reason || 'Banned by admin from referral system',
        bannedAt: new Date().toISOString(),
      });

      return res.json({ success: true, message: 'Device banned successfully' });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 7. ADMIN WITHDRAWAL APPROVAL & REJECTION ENDPOINTS
  app.post('/api/admin/withdrawals/approve', async (req, res) => {
    try {
      const { token, withdrawalId } = req.body;
      const result = await approveWithdrawal(token, withdrawalId);
      if (result.success) {
        return res.json(result);
      } else {
        return res.status(400).json(result);
      }
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/admin/withdrawals/reject', async (req, res) => {
    try {
      const { token, withdrawalId, reason } = req.body;
      const result = await rejectWithdrawal(token, withdrawalId, reason);
      if (result.success) {
        return res.json(result);
      } else {
        return res.status(400).json(result);
      }
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/admin/send-message', async (req, res) => {
    try {
      const { token, telegramId, message } = req.body;
      if (!token || !telegramId || !message) {
        return res.status(400).json({ success: false, error: 'Token, Telegram ID, and Message are required' });
      }

      const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: telegramId,
          text: message,
          parse_mode: 'HTML',
        }),
      });

      const tgData = await tgRes.json();
      if (tgData.ok) {
        return res.json({ success: true, message: 'Message sent successfully.' });
      } else {
        return res.status(400).json({ success: false, error: tgData.description || 'Telegram API error' });
      }
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // ==========================================
  // FEEDBACK CAMPAIGN PUBLIC FLOW ENDPOINTS
  // ==========================================

  // Fetch campaign info publicly
  app.get('/api/feedback/campaign-info', async (req, res) => {
    try {
      const campaignId = req.query.campaignId as string;
      if (!campaignId) {
        return res.status(400).json({ success: false, error: 'Campaign ID is required' });
      }

      const campDoc = await getDoc(doc(db, 'feedbackCampaigns', campaignId));
      if (!campDoc.exists()) {
        return res.status(404).json({ success: false, error: 'Feedback Campaign not found.' });
      }

      const data = campDoc.data();
      const now = new Date().toISOString();

      // Expired campaign blocked
      const isExpired = data.endDate && now > data.endDate;
      const isNotStarted = data.startDate && now < data.startDate;

      return res.json({
        success: true,
        campaign: {
          id: campDoc.id,
          name: data.name,
          bonusAmount: Number(data.bonusAmount) || 0,
          startDate: data.startDate,
          endDate: data.endDate,
          active: data.active && !isExpired && !isNotStarted,
          isExpired,
          isNotStarted,
          thankYouMessage: data.thankYouMessage,
          rejectMessage: data.rejectMessage,
        }
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Request OTP via Telegram Bot
  app.post('/api/feedback/send-otp', async (req, res) => {
    try {
      const { mobile, campaignId } = req.body;
      const cleanMobile = String(mobile || '').replace(/\D/g, '');

      if (!cleanMobile || !campaignId) {
        return res.status(400).json({ success: false, error: 'Mobile number and Campaign ID are required.' });
      }

      // 1. Check campaign status
      const campDoc = await getDoc(doc(db, 'feedbackCampaigns', campaignId));
      if (!campDoc.exists()) {
        return res.status(404).json({ success: false, error: 'Feedback Campaign not found.' });
      }
      const campData = campDoc.data();
      const now = new Date().toISOString();
      const isExpired = campData.endDate && now > campData.endDate;
      const isNotStarted = campData.startDate && now < campData.startDate;
      if (!campData.active || isExpired || isNotStarted) {
        return res.status(400).json({ success: false, error: 'This feedback campaign is inactive or expired.' });
      }

      // 2. Check if mobile registered in Roy Share Wallet
      const usersQ = query(collection(db, 'users'), where('mobile', '==', cleanMobile));
      const uSnap = await getDocs(usersQ);
      if (uSnap.empty) {
        return res.status(400).json({ success: false, error: 'This mobile number is not registered with Roy Share Wallet.' });
      }

      const userDoc = uSnap.docs[0];
      const userData = userDoc.data();
      const userUid = userData.uid;
      const userName = userData.firstName || 'User';
      const telegramId = userData.telegramId;
      const telegramUsername = userData.username || '';

      if (userData.status === 'banned' || userData.banned === true) {
        return res.status(400).json({ success: false, error: 'Your account has been suspended.' });
      }

      // 3. Security Check: One feedback per campaign per UID.
      // 4. Duplicate mobile rejected.
      const reviewsQ = query(
        collection(db, 'feedbackReviews'),
        where('campaignId', '==', campaignId)
      );
      const revSnap = await getDocs(reviewsQ);
      const alreadySubmitted = revSnap.docs.some(doc => {
        const d = doc.data();
        return d.uid === userUid || d.mobile === cleanMobile;
      });

      if (alreadySubmitted) {
        return res.status(400).json({ success: false, error: 'You have already submitted feedback for this campaign.' });
      }

      // 5. Generate 6-digit numeric OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = Date.now() + 5 * 60 * 1000; // 5 mins validity

      // Save OTP to Firestore feedbackOtps
      await setDoc(doc(db, 'feedbackOtps', cleanMobile), {
        otp,
        telegramId,
        uid: userUid,
        name: userName,
        telegramUsername,
        expiresAt,
        createdAt: new Date().toISOString()
      });

      // 6. Get Telegram bot token from settings/config
      const configDoc = await getDoc(doc(db, 'settings', 'config'));
      const botToken = configDoc.exists() ? configDoc.data()?.botToken : null;

      if (!botToken) {
        return res.status(500).json({ success: false, error: 'Admin Bot token not configured.' });
      }

      // Send Bot OTP Message
      const text = `🔐 <b>Your Feedback OTP</b>\n\nYour OTP is: <b>${otp}</b>\n\nValid for 5 minutes.`;
      await sendTelegramMessage(botToken, telegramId, text);

      return res.json({ success: true, message: 'OTP has been sent to your Telegram Bot successfully.' });
    } catch (err: any) {
      console.error('send-otp error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Verify OTP Code
  app.post('/api/feedback/verify-otp', async (req, res) => {
    try {
      const { mobile, otp } = req.body;
      const cleanMobile = String(mobile || '').replace(/\D/g, '');

      if (!cleanMobile || !otp) {
        return res.status(400).json({ success: false, error: 'Mobile number and OTP are required.' });
      }

      const otpDoc = await getDoc(doc(db, 'feedbackOtps', cleanMobile));
      if (!otpDoc.exists()) {
        return res.status(400).json({ success: false, error: 'OTP request not found. Please request again.' });
      }

      const data = otpDoc.data();
      if (Date.now() > data.expiresAt) {
        return res.status(400).json({ success: false, error: 'OTP has expired. Please request a new one.' });
      }

      if (data.otp !== String(otp).trim()) {
        return res.status(400).json({ success: false, error: 'Invalid OTP. Please try again.' });
      }

      // Retrieve user details
      const userDetails = {
        uid: data.uid,
        name: data.name,
        telegramId: data.telegramId,
        telegramUsername: data.telegramUsername || '',
        mobile: cleanMobile
      };

      // Delete OTP on successful verification
      await deleteDoc(doc(db, 'feedbackOtps', cleanMobile));

      return res.json({ success: true, user: userDetails });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Submit Feedback Review
  app.post('/api/feedback/submit', async (req, res) => {
    try {
      const {
        campaignId,
        uid,
        name,
        mobile,
        telegramId,
        telegramUsername,
        rating,
        category,
        title,
        message,
        screenshotUrl
      } = req.body;

      if (!campaignId || !uid || !mobile || !rating || !category || !title) {
        return res.status(400).json({ success: false, error: 'All fields including Rating, Category, Title, and user info are required.' });
      }

      // Check campaign
      const campDoc = await getDoc(doc(db, 'feedbackCampaigns', campaignId));
      if (!campDoc.exists()) {
        return res.status(404).json({ success: false, error: 'Feedback Campaign not found.' });
      }
      const campData = campDoc.data();
      const now = new Date().toISOString();
      const isExpired = campData.endDate && now > campData.endDate;
      const isNotStarted = campData.startDate && now < campData.startDate;
      if (!campData.active || isExpired || isNotStarted) {
        return res.status(400).json({ success: false, error: 'This feedback campaign is expired or inactive.' });
      }

      // Duplicate checks
      const reviewsQ = query(
        collection(db, 'feedbackReviews'),
        where('campaignId', '==', campaignId)
      );
      const revSnap = await getDocs(reviewsQ);
      const alreadySubmitted = revSnap.docs.some(doc => {
        const d = doc.data();
        return d.uid === uid || d.mobile === mobile;
      });

      if (alreadySubmitted) {
        return res.status(400).json({ success: false, error: 'You have already submitted feedback for this campaign.' });
      }

      // Create feedback review
      const newReviewRef = doc(collection(db, 'feedbackReviews'));
      await setDoc(newReviewRef, {
        id: newReviewRef.id,
        campaignId,
        campaignName: campData.name || 'Feedback Campaign',
        uid,
        name,
        mobile,
        telegramId,
        telegramUsername: telegramUsername || '',
        rating: Number(rating),
        category,
        title,
        message: message || '',
        screenshotUrl: screenshotUrl || '',
        status: 'pending',
        rewardAmount: Number(campData.bonusAmount) || 0,
        submittedAt: new Date().toISOString()
      });

      return res.json({ success: true, message: 'Feedback Submitted Successfully. Your feedback is under review.' });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Admin Feedback Approval Endpoint
  app.post('/api/admin/feedback/approve', async (req, res) => {
    try {
      const { token, reviewId, customAmount, reason } = req.body;
      const result = await approveFeedbackReview(token, reviewId, customAmount, reason);
      if (result.success) {
        return res.json(result);
      } else {
        return res.status(400).json(result);
      }
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Admin Feedback Rejection Endpoint
  app.post('/api/admin/feedback/reject', async (req, res) => {
    try {
      const { token, reviewId, reason } = req.body;
      const result = await rejectFeedbackReview(token, reviewId, reason);
      if (result.success) {
        return res.json(result);
      } else {
        return res.status(400).json(result);
      }
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // ==========================================
  // SECURE ADMIN TELEGRAM OTP AUTHENTICATION ENDPOINTS
  // ==========================================

  // Helper to load settings/config and decrypt sensitive fields
  async function getDecryptedConfig() {
    try {
      const configDoc = await getDoc(doc(db, 'settings', 'config'));
      if (configDoc.exists()) {
        const data = configDoc.data() || {};
        return {
          ...data,
          botToken: decrypt(data.botToken || ''),
          adminChatId: decrypt(data.adminChatId || ''),
          adminMobileNumber: decrypt(data.adminMobileNumber || ''),
        };
      }
    } catch (err) {
      console.error('Error fetching decrypted config:', err);
    }
    return null;
  }

  // Middleware to require a valid admin session
  async function requireAdminSession(req: express.Request, res: express.Response, next: express.NextFunction) {
    const token = req.headers['x-admin-session-token'] as string;
    if (!token) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Session token missing.' });
    }

    try {
      const sessionDoc = await getDoc(doc(db, 'adminSessions', 'active_session'));
      if (!sessionDoc.exists()) {
        return res.status(401).json({ success: false, error: 'Unauthorized: Session invalid.' });
      }

      const data = sessionDoc.data();
      if (data.sessionToken !== token) {
        return res.status(401).json({ success: false, error: 'Unauthorized: Session invalid.' });
      }

      if (Date.now() > data.expiresAt) {
        return res.status(401).json({ success: false, error: 'Unauthorized: Session expired.' });
      }

      // Update lastActive and extend expiresAt (3 hours sliding window)
      const newExpiresAt = Date.now() + 3 * 3600 * 1000;
      await setDoc(doc(db, 'adminSessions', 'active_session'), {
        ...data,
        lastActive: Date.now(),
        expiresAt: newExpiresAt
      }, { merge: true });

      next();
    } catch (err: any) {
      return res.status(500).json({ success: false, error: 'Server error validating session: ' + err.message });
    }
  }

  // Check setup/configuration status
  app.get('/api/admin/status', async (req, res) => {
    try {
      const config = await getDecryptedConfig();
      if (config && config.botToken && config.adminChatId && config.adminMobileNumber) {
        return res.json({ isConfigured: true });
      }
      return res.json({ isConfigured: false });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Setup Step 1: Save & Verify Bot Token + Chat ID
  app.post('/api/admin/setup', async (req, res) => {
    try {
      const { botToken, adminChatId } = req.body;
      const cleanToken = botToken?.trim();
      const cleanChatId = adminChatId?.trim();

      if (!cleanToken || !cleanChatId) {
        return res.status(400).json({ success: false, error: 'Both Bot Token and Chat ID are required.' });
      }

      // Verify Bot Token via Telegram API
      const getMeRes = await fetch(`https://api.telegram.org/bot${cleanToken}/getMe`);
      const getMeData = await getMeRes.json();
      if (!getMeData.ok) {
        return res.status(400).json({ success: false, error: 'Invalid Bot Token. ' + (getMeData.description || '') });
      }

      const botUser = getMeData.result;

      // Send a verification ping message to ensure Chat ID works
      const pingRes = await fetch(`https://api.telegram.org/bot${cleanToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: cleanChatId,
          text: `🤖 <b>Roy Share Bot: Admin Setup Verification</b>\n\nYour Telegram Chat ID has been verified successfully!`,
          parse_mode: 'HTML',
        }),
      });
      const pingData = await pingRes.json();
      if (!pingData.ok) {
        return res.status(400).json({ success: false, error: 'Could not send verification message. Ensure you have started the bot on Telegram.' });
      }

      // Save credentials encrypted
      await setDoc(doc(db, 'settings', 'config'), {
        botToken: encrypt(cleanToken),
        adminChatId: encrypt(cleanChatId),
        botName: botUser.first_name,
        botUsername: botUser.username,
        botId: String(botUser.id),
        botTokenValidated: true,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      return res.json({ success: true, message: 'Bot details and Chat ID saved and verified!' });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Setup Step 2: Save Admin Mobile & Send OTP
  app.post('/api/admin/setup-mobile', async (req, res) => {
    try {
      const { adminMobileNumber } = req.body;
      const cleanMobile = String(adminMobileNumber || '').replace(/\D/g, '');

      if (!cleanMobile || cleanMobile.length < 10) {
        return res.status(400).json({ success: false, error: 'Invalid mobile number. Please enter a valid 10-digit number.' });
      }

      // Save Admin Mobile Number encrypted
      await setDoc(doc(db, 'settings', 'config'), {
        adminMobileNumber: encrypt(cleanMobile),
        updatedAt: new Date().toISOString()
      }, { merge: true });

      // Generate 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = Date.now() + 5 * 60 * 1000; // 5 mins

      await setDoc(doc(db, 'adminOtps', 'admin_login_otp'), {
        otp,
        expiresAt,
        attempts: 0,
        createdAt: new Date().toISOString()
      });

      // Get configuration to send OTP
      const decryptedConfig = await getDecryptedConfig();
      if (!decryptedConfig || !decryptedConfig.botToken || !decryptedConfig.adminChatId) {
        return res.status(400).json({ success: false, error: 'Bot and Chat ID must be configured first.' });
      }

      // Send OTP via bot
      const text = `🔐 <b>Roy Share Admin Login Setup</b>\n\nYour Setup Verification OTP is:\n<b>${otp}</b>\n\nValid for 5 minutes.`;
      await sendTelegramMessage(decryptedConfig.botToken, decryptedConfig.adminChatId, text);

      return res.json({ success: true, message: 'OTP sent successfully!' });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Send login OTP (when admin is already configured)
  app.post('/api/admin/send-otp', async (req, res) => {
    try {
      const { mobile } = req.body;
      const cleanMobile = String(mobile || '').replace(/\D/g, '');

      if (!cleanMobile) {
        return res.status(400).json({ success: false, error: 'Mobile number is required.' });
      }

      // Check lockout status
      const lockoutDoc = await getDoc(doc(db, 'adminLoginAttempts', 'admin_lockout'));
      if (lockoutDoc.exists()) {
        const lockData = lockoutDoc.data();
        if (lockData.lockedUntil && lockData.lockedUntil > Date.now()) {
          const minutesLeft = Math.ceil((lockData.lockedUntil - Date.now()) / (60 * 1000));
          return res.status(403).json({ success: false, error: `Login is temporarily locked due to 5 wrong attempts. Please try again in ${minutesLeft} minutes.` });
        }
      }

      const decryptedConfig = await getDecryptedConfig();
      if (!decryptedConfig || !decryptedConfig.adminMobileNumber) {
        return res.status(400).json({ success: false, error: 'Admin is not configured yet.' });
      }

      if (decryptedConfig.adminMobileNumber !== cleanMobile) {
        return res.status(400).json({ success: false, error: 'Unauthorized: Mobile number does not match the configured admin number.' });
      }

      // Generate 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = Date.now() + 5 * 60 * 1000; // 5 mins

      await setDoc(doc(db, 'adminOtps', 'admin_login_otp'), {
        otp,
        expiresAt,
        attempts: 0,
        createdAt: new Date().toISOString()
      });

      // Send OTP
      const text = `🔐 <b>Roy Share Admin Login</b>\n\nOTP:\n<b>${otp}</b>\n\nValid for 5 minutes.`;
      await sendTelegramMessage(decryptedConfig.botToken, decryptedConfig.adminChatId, text);

      return res.json({ success: true, message: 'OTP sent via Telegram Bot.' });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Verify OTP and issue secure session
  app.post('/api/admin/verify-otp', async (req, res) => {
    try {
      const { otp } = req.body;
      const cleanOtp = String(otp || '').trim();

      if (!cleanOtp) {
        return res.status(400).json({ success: false, error: 'OTP is required.' });
      }

      // Check lockout status
      const lockoutDoc = await getDoc(doc(db, 'adminLoginAttempts', 'admin_lockout'));
      let lockoutData = lockoutDoc.exists() ? lockoutDoc.data() : { failedAttempts: 0, lockedUntil: 0 };
      if (lockoutData.lockedUntil && lockoutData.lockedUntil > Date.now()) {
        const minutesLeft = Math.ceil((lockoutData.lockedUntil - Date.now()) / (60 * 1000));
        return res.status(403).json({ success: false, error: `Login is locked. Please try again in ${minutesLeft} minutes.` });
      }

      // Fetch active OTP
      const otpDoc = await getDoc(doc(db, 'adminOtps', 'admin_login_otp'));
      if (!otpDoc.exists()) {
        return res.status(400).json({ success: false, error: 'OTP has expired or is not found. Please request a new OTP.' });
      }

      const otpData = otpDoc.data();
      if (Date.now() > otpData.expiresAt) {
        return res.status(400).json({ success: false, error: 'OTP has expired. Please request a new OTP.' });
      }

      if (otpData.otp !== cleanOtp) {
        // Increment failed attempts
        const newFailedAttempts = (lockoutData.failedAttempts || 0) + 1;
        let newLockedUntil = 0;
        let errorMsg = `Invalid OTP. Attempts left: ${5 - newFailedAttempts}`;

        if (newFailedAttempts >= 5) {
          newLockedUntil = Date.now() + 15 * 60 * 1000; // 15 mins
          errorMsg = 'Too many wrong attempts. Login locked for 15 minutes.';
        }

        await setDoc(doc(db, 'adminLoginAttempts', 'admin_lockout'), {
          failedAttempts: newFailedAttempts,
          lockedUntil: newLockedUntil,
          updatedAt: new Date().toISOString()
        }, { merge: true });

        return res.status(400).json({ success: false, error: errorMsg, attemptsLeft: 5 - newFailedAttempts });
      }

      // Success: clear lockout
      await setDoc(doc(db, 'adminLoginAttempts', 'admin_lockout'), {
        failedAttempts: 0,
        lockedUntil: 0,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      // Generate session
      const sessionToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = Date.now() + 3 * 3600 * 1000; // 3 hours

      await setDoc(doc(db, 'adminSessions', 'active_session'), {
        sessionToken,
        lastActive: Date.now(),
        expiresAt,
        createdAt: new Date().toISOString()
      });

      // Clear OTP
      await deleteDoc(doc(db, 'adminOtps', 'admin_login_otp'));

      return res.json({ success: true, sessionToken, expiresAt });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Admin Logout
  app.post('/api/admin/logout', async (req, res) => {
    try {
      await deleteDoc(doc(db, 'adminSessions', 'active_session'));
      return res.json({ success: true, message: 'Logged out successfully.' });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Request settings change verification OTP
  app.post('/api/admin/request-settings-change-otp', requireAdminSession, async (req, res) => {
    try {
      const decryptedConfig = await getDecryptedConfig();
      if (!decryptedConfig || !decryptedConfig.botToken || !decryptedConfig.adminChatId) {
        return res.status(400).json({ success: false, error: 'Bot is not fully configured.' });
      }

      // Generate settings update OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = Date.now() + 5 * 60 * 1000; // 5 mins

      await setDoc(doc(db, 'adminOtps', 'admin_settings_change_otp'), {
        otp,
        expiresAt,
        createdAt: new Date().toISOString()
      });

      // Send OTP via bot
      const text = `🔐 <b>Roy Share Admin Settings Change</b>\n\nYour OTP to verify credentials update is:\n<b>${otp}</b>\n\nValid for 5 minutes.`;
      await sendTelegramMessage(decryptedConfig.botToken, decryptedConfig.adminChatId, text);

      return res.json({ success: true, message: 'Settings change verification OTP sent.' });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Load Admin Config (Protected)
  app.get('/api/admin/config', requireAdminSession, async (req, res) => {
    try {
      const config = await getDecryptedConfig();
      return res.json({ success: true, config: config || {} });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Save Admin Config (Protected)
  app.post('/api/admin/config', requireAdminSession, async (req, res) => {
    try {
      const { config, changeOtp } = req.body;
      if (!config) {
        return res.status(400).json({ success: false, error: 'Config is required.' });
      }

      const currentConfig = await getDecryptedConfig();

      const isSensitiveChanged = currentConfig && (
        (config.botToken && config.botToken !== currentConfig.botToken) ||
        (config.adminChatId && config.adminChatId !== currentConfig.adminChatId) ||
        (config.adminMobileNumber && config.adminMobileNumber !== currentConfig.adminMobileNumber)
      );

      if (isSensitiveChanged) {
        if (!changeOtp) {
          return res.status(400).json({ success: false, needsOtp: true, error: 'OTP verification is required to change credentials.' });
        }

        // Verify the settings change OTP
        const otpDoc = await getDoc(doc(db, 'adminOtps', 'admin_settings_change_otp'));
        if (!otpDoc.exists()) {
          return res.status(400).json({ success: false, error: 'Verification OTP has not been sent or has expired.' });
        }

        const otpData = otpDoc.data();
        if (Date.now() > otpData.expiresAt) {
          return res.status(400).json({ success: false, error: 'Verification OTP has expired.' });
        }

        if (otpData.otp !== String(changeOtp).trim()) {
          return res.status(400).json({ success: false, error: 'Invalid verification OTP.' });
        }

        // Clean OTP after verification
        await deleteDoc(doc(db, 'adminOtps', 'admin_settings_change_otp'));
      }

      // Save with encrypted credentials
      const savePayload = { ...config };
      if (savePayload.botToken) savePayload.botToken = encrypt(savePayload.botToken);
      if (savePayload.adminChatId) savePayload.adminChatId = encrypt(savePayload.adminChatId);
      if (savePayload.adminMobileNumber) savePayload.adminMobileNumber = encrypt(savePayload.adminMobileNumber.replace(/\D/g, ''));

      // If bot token is decrypted and saved, update validation status
      if (savePayload.botToken && savePayload.botToken !== currentConfig?.botToken) {
        savePayload.botTokenValidated = true;
      }

      await setDoc(doc(db, 'settings', 'config'), {
        ...savePayload,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      return res.json({ success: true, message: 'Configuration saved successfully.' });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Serve Vite in dev or static files in production
  const isProduction = process.env.NODE_ENV === 'production' || !!process.env.RENDER;

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Roy Share Full-Stack Server running on port ${PORT}`);
  });
}

startServer();
