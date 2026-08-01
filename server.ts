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
import { execSync } from 'child_process';
import { startContestScheduler } from './src/services/contestScheduler';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Start background contest scheduler
  startContestScheduler();

  // Print startup version & build information
  let gitCommit = 'dev-main';
  try {
    gitCommit = execSync('git rev-parse --short HEAD', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch (e) {
    gitCommit = '3cb5a04'; // Default stable fallback commit reference
  }
  const appVersion = '1.0.24';
  const buildTime = '2026-07-31T05:22:54-07:00';

  console.log('===================================================');
  console.log(`🤖 Roy Share Wallet - Version ${appVersion}`);
  console.log(`📅 Build Time: ${buildTime}`);
  console.log(`🌿 Git Commit: ${gitCommit}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('===================================================');

  // Parse JSON payloads
  app.use(express.json());

  // Global Request Logger Middleware
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      const bodyLog = req.method === 'POST' ? JSON.stringify(req.body) : 'N/A';
      console.log(`[Request] ${req.method} ${req.url} - Status: ${res.statusCode} - Duration: ${duration}ms - Body: ${bodyLog}`);
    });
    next();
  });

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
  // HEALTH & DEBUG ENDPOINTS
  // ==========================================

  // GET /api/health - Returns system status, version, build info, environment, and connectivity checks
  app.get('/api/health', async (req, res) => {
    console.log('[Health] Checking service health status...');
    try {
      let firestoreConnected = false;
      let telegramConfigLoaded = false;
      let botUsername = '';

      try {
        console.log('[Health] Fetching configuration from Firestore settings/config...');
        const decryptedConfig = await getDecryptedConfig() as any;
        firestoreConnected = true;
        if (decryptedConfig && decryptedConfig.botToken) {
          telegramConfigLoaded = true;
          botUsername = decryptedConfig.botUsername || '';
          console.log('[Health] Telegram configuration is successfully loaded and decrypted.');
        } else {
          console.warn('[Health] Telegram configuration is not yet set up or botToken is empty.');
        }
      } catch (dbErr: any) {
        console.error('[Health] Firestore connection or config decryption check failed with exception:', dbErr);
        console.error('[Health] Stack Trace:', dbErr.stack);
      }

      return res.json({
        status: 'Server Running',
        version: '1.0.24',
        buildTime: '2026-07-31T05:22:54-07:00',
        environment: process.env.NODE_ENV || 'development',
        telegramConfigLoaded,
        firestoreConnected,
        botUsername,
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      console.error('[Health] General Exception inside health check endpoint:', err);
      console.error('[Health] Stack Trace:', err.stack);
      return res.status(500).json({
        status: 'Error',
        error: err.message,
        stack: err.stack
      });
    }
  });

  // GET /api/debug/routes - Returns all registered Express routes for diagnostic purposes
  app.get('/api/debug/routes', (req, res) => {
    console.log('[Debug Routes] Retrieving list of all registered Express routes...');
    try {
      const routes: { method: string; path: string }[] = [];
      
      // Print routes registered on the express app router stack
      app._router.stack.forEach((layer: any) => {
        if (layer.route) {
          const path = layer.route.path;
          const methods = Object.keys(layer.route.methods).map(m => m.toUpperCase());
          methods.forEach(method => {
            routes.push({ method, path });
          });
        }
      });

      console.log(`[Debug Routes] Successfully retrieved ${routes.length} routes.`);
      return res.json({ success: true, count: routes.length, routes });
    } catch (err: any) {
      console.error('[Debug Routes] Exception while listing routes:', err);
      console.error('[Debug Routes] Stack Trace:', err.stack);
      return res.status(500).json({ success: false, error: err.message, stack: err.stack });
    }
  });

  // GET /api/debug/send-test - Sends a direct test Telegram message to the configured Admin Chat ID
  app.get('/api/debug/send-test', async (req, res) => {
    console.log('[Debug Send-Test] Initiating message ping directly to configured Admin Chat ID...');
    try {
      console.log('[Debug Send-Test] Loading and decrypting settings/config...');
      const decryptedConfig = await getDecryptedConfig() as any;
      
      if (!decryptedConfig) {
        console.error('[Debug Send-Test] Decrypted configuration was not found or is empty.');
        return res.status(400).json({ success: false, error: 'Decrypted configuration could not be loaded from Firestore.' });
      }

      const { botToken, adminChatId } = decryptedConfig;
      console.log('[Debug Send-Test] Configuration fetched.', { hasBotToken: !!botToken, hasAdminChatId: !!adminChatId });

      if (!botToken || !adminChatId) {
        console.error('[Debug Send-Test] Missing Telegram Bot Token or Admin Chat ID configuration.');
        return res.status(400).json({
          success: false,
          error: 'Telegram Bot Token or Admin Chat ID is not configured in settings/config.',
          config: { hasBotToken: !!botToken, hasAdminChatId: !!adminChatId }
        });
      }

      const text = `🧪 <b>Roy Share Debug Ping Message</b>\n\nSent at: <code>${new Date().toISOString()}</code>\nStatus: <b>OK</b>\nVersion: <b>1.0.24</b>`;
      console.log(`[Debug Send-Test] Dispatching message via Telegram sendMessage API to Admin Chat ID: ${adminChatId}`);
      
      const tgRes = await sendTelegramMessage(botToken, adminChatId, text);
      console.log('[Debug Send-Test] Telegram API Response received:', JSON.stringify(tgRes));

      if (tgRes && tgRes.ok) {
        console.log(`[Debug Send-Test] Ping message successfully delivered to Telegram. Message ID: ${tgRes.result?.message_id}`);
        return res.json({
          success: true,
          message: 'Direct Telegram message dispatched successfully.',
          telegramResponse: tgRes
        });
      } else {
        const description = tgRes?.description || 'Unknown Telegram API error';
        console.error(`[Debug Send-Test] Telegram API returned failure: ${description}`);
        return res.status(400).json({
          success: false,
          error: `Telegram sendMessage failed: ${description}`,
          telegramResponse: tgRes
        });
      }
    } catch (err: any) {
      console.error('[Debug Send-Test] Direct send-test exception occurred:', err);
      console.error('[Debug Send-Test] Stack Trace:', err.stack);
      return res.status(500).json({ success: false, error: err.message, stack: err.stack });
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

      console.log(`[Feedback OTP] New OTP request received:`, { mobile, campaignId, cleanMobile });

      if (!cleanMobile || !campaignId) {
        console.warn(`[Feedback OTP] Missing mobile or campaignId in request.`);
        return res.status(400).json({ success: false, error: 'Mobile number and Campaign ID are required.' });
      }

      // 1. Check campaign status
      console.log(`[Feedback OTP] Fetching feedback campaign document for campaignId: ${campaignId}`);
      const campDoc = await getDoc(doc(db, 'feedbackCampaigns', campaignId));
      if (!campDoc.exists()) {
        console.warn(`[Feedback OTP] Campaign not found in Firestore for campaignId: ${campaignId}`);
        return res.status(404).json({ success: false, error: 'Feedback Campaign not found.' });
      }
      const campData = campDoc.data();
      const now = new Date().toISOString();
      const isExpired = campData.endDate && now > campData.endDate;
      const isNotStarted = campData.startDate && now < campData.startDate;
      if (!campData.active || isExpired || isNotStarted) {
        console.warn(`[Feedback OTP] Campaign is inactive/expired:`, { active: campData.active, isExpired, isNotStarted });
        return res.status(400).json({ success: false, error: 'This feedback campaign is inactive or expired.' });
      }
      console.log(`[Feedback OTP] Campaign found and is active:`, campData.name);

      // 2. Check if mobile registered in Roy Share Wallet
      console.log(`[Feedback OTP] Querying Firestore 'users' for mobile: ${cleanMobile}`);
      const usersQ = query(collection(db, 'users'), where('mobile', '==', cleanMobile));
      const uSnap = await getDocs(usersQ);
      if (uSnap.empty) {
        console.warn(`[Feedback OTP] Mobile number ${cleanMobile} is not registered in Firestore 'users' collection.`);
        return res.status(400).json({ success: false, error: 'This mobile number is not registered with Roy Share Wallet.' });
      }

      const userDoc = uSnap.docs[0];
      const userData = userDoc.data();
      const userUid = userData.uid;
      const userName = userData.firstName || 'User';
      const telegramId = userData.telegramId;
      const telegramUsername = userData.username || '';

      console.log(`[Feedback OTP] User found matching mobile:`, {
        uid: userUid,
        name: userName,
        telegramId,
        telegramUsername,
        status: userData.status,
        banned: userData.banned
      });

      if (userData.status === 'banned' || userData.banned === true) {
        console.warn(`[Feedback OTP] User ${userUid} is banned/suspended.`);
        return res.status(400).json({ success: false, error: 'Your account has been suspended.' });
      }

      if (!telegramId) {
        console.error(`[Feedback OTP] User ${userUid} does not have a telegramId in Firestore! cannot deliver OTP message.`);
        return res.status(400).json({
          success: false,
          error: 'Your Telegram account is not linked. Please open the bot and complete registration.'
        });
      }

      // 3. Security Check: One feedback per campaign per UID.
      // 4. Duplicate mobile rejected.
      console.log(`[Feedback OTP] Verifying if feedback was already submitted for campaign ${campaignId} by uid ${userUid} or mobile ${cleanMobile}`);
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
        console.warn(`[Feedback OTP] User has already submitted feedback for campaign ${campaignId}`);
        return res.status(400).json({ success: false, error: 'You have already submitted feedback for this campaign.' });
      }

      // 5. Generate 6-digit numeric OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = Date.now() + 5 * 60 * 1000; // 5 mins validity

      console.log(`[Feedback OTP] Generated OTP: ${otp} (expires in 5 minutes). Saving to Firestore...`);

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
      console.log(`[Feedback OTP] OTP saved successfully in Firestore feedbackOtps/${cleanMobile}`);

      // 6. Get decrypted Telegram bot token from settings/config
      console.log(`[Feedback OTP] Fetching decrypted configuration...`);
      const decryptedConfig = await getDecryptedConfig() as any;
      const botToken = decryptedConfig?.botToken;

      if (!botToken) {
        console.error(`[Feedback OTP] Admin Bot token is not configured or could not be decrypted.`);
        return res.status(500).json({ success: false, error: 'Admin Bot token is not configured.' });
      }

      // Before sending, verify user has started the bot & confirm in logs
      console.log(`Confirming in logs: Sending OTP to Telegram ID: ${telegramId}`);

      // Send Bot OTP Message
      const text = `🔐 <b>Your Feedback OTP</b>\n\nYour OTP is: <b>${otp}</b>\n\nValid for 5 minutes.`;
      const tgRes = await sendTelegramMessage(botToken, telegramId, text);

      // Log: Mobile Number, User UID, User telegramId, Chat ID used for sending, Telegram API Response
      console.log(`[Feedback OTP] Log Details:`, {
        'Mobile Number': cleanMobile,
        'User UID': userUid,
        'User telegramId': telegramId,
        'Chat ID used for sending': telegramId,
        'Telegram API Response': tgRes
      });

      if (tgRes && tgRes.ok) {
        console.log(`[Feedback OTP] Message sent successfully to Telegram ID: ${telegramId}. Message ID: ${tgRes.result?.message_id}`);
        return res.json({ success: true, message: 'OTP has been sent to your Telegram Bot successfully.' });
      } else {
        const description = tgRes?.description || 'Unknown Telegram API error';
        console.error(`[Feedback OTP] Telegram API failed to send message to Telegram ID ${telegramId}. Error description: ${description}`);
        return res.status(400).json({
          success: false,
          error: `Telegram delivery failed: ${description}. Please open your Telegram Bot @${decryptedConfig?.botUsername || 'bot'} and press Start first.`
        });
      }
    } catch (err: any) {
      console.error('[Feedback OTP] send-otp exception:', err);
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
  async function getDecryptedConfig(): Promise<any> {
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
    const rawAuth = req.headers['authorization'];
    const authHeaderStr = typeof rawAuth === 'string' ? rawAuth : Array.isArray(rawAuth) ? (rawAuth as string[]).join(', ') : '';
    const tokenHeader = req.headers['x-admin-session-token'];
    const sessionTokenFromXHeader = typeof tokenHeader === 'string' ? tokenHeader : Array.isArray(tokenHeader) ? (tokenHeader as string[])[0] : '';

    let token = sessionTokenFromXHeader;
    if (!token && authHeaderStr) {
      if (authHeaderStr.toLowerCase().startsWith('bearer ')) {
        token = authHeaderStr.substring(7).trim();
      } else {
        token = authHeaderStr.trim();
      }
    }

    console.log(`[AdminAuthLog] Path: ${req.method} ${req.path}`);
    console.log(`[AdminAuthLog] Received Authorization header: "${authHeaderStr || 'N/A'}"`);
    console.log(`[AdminAuthLog] Received x-admin-session-token header: "${sessionTokenFromXHeader || 'N/A'}"`);
    console.log(`[AdminAuthLog] Extracted Session Token: "${token ? (token.substring(0, 8) + '...') : 'NONE'}"`);

    if (!token) {
      const reason = 'Session token missing in request headers (neither Authorization nor x-admin-session-token provided).';
      console.log(`[AdminAuthLog] Validation Result: FAIL | Reason: ${reason} | Admin UID: N/A | Admin Role: N/A`);
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Admin session token missing.',
        reason
      });
    }

    try {
      const sessionDoc = await getDoc(doc(db, 'adminSessions', 'active_session'));
      if (!sessionDoc.exists()) {
        const reason = 'No active admin session found in database (active_session document missing).';
        console.log(`[AdminAuthLog] Validation Result: FAIL | Reason: ${reason} | Admin UID: N/A | Admin Role: N/A`);
        return res.status(401).json({
          success: false,
          error: 'Unauthorized: Admin session invalid.',
          reason
        });
      }

      const data = sessionDoc.data();
      const storedToken = data.sessionToken;
      const adminUid = data.adminUid || data.adminId || 'super_admin_01';
      const adminRole = data.adminRole || 'Super Admin';

      if (storedToken !== token) {
        const reason = 'Session token mismatch. Provided token does not match active session in database.';
        console.log(`[AdminAuthLog] Validation Result: FAIL | Reason: ${reason} | Admin UID: ${adminUid} | Admin Role: ${adminRole}`);
        return res.status(401).json({
          success: false,
          error: 'Unauthorized: Session token mismatch or invalid.',
          reason,
          adminUid,
          adminRole
        });
      }

      if (Date.now() > data.expiresAt) {
        const reason = `Session expired at ${new Date(data.expiresAt).toISOString()}.`;
        console.log(`[AdminAuthLog] Validation Result: FAIL | Reason: ${reason} | Admin UID: ${adminUid} | Admin Role: ${adminRole}`);
        return res.status(401).json({
          success: false,
          error: 'Unauthorized: Session expired.',
          reason,
          adminUid,
          adminRole
        });
      }

      console.log(`[AdminAuthLog] Validation Result: SUCCESS | Admin UID: ${adminUid} | Admin Role: ${adminRole}`);

      (req as any).adminSession = {
        token,
        adminUid,
        adminRole,
        data
      };

      // Update lastActive and extend expiresAt (3 hours sliding window)
      const newExpiresAt = Date.now() + 3 * 3600 * 1000;
      await setDoc(doc(db, 'adminSessions', 'active_session'), {
        ...data,
        lastActive: Date.now(),
        expiresAt: newExpiresAt
      }, { merge: true });

      next();
    } catch (err: any) {
      const reason = `Server error during session validation: ${err.message}`;
      console.error(`[AdminAuthLog] Validation Result: ERROR | Reason: ${reason}`);
      return res.status(500).json({
        success: false,
        error: 'Server error validating session.',
        reason
      });
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

  // Execute Delete User Account (Super Admin Protected - No OTP required)
  app.post('/api/admin/delete-user-account', requireAdminSession, async (req, res) => {
    try {
      const sessionInfo = (req as any).adminSession || {};
      const adminUid = sessionInfo.adminUid || 'super_admin_01';
      const adminRole = sessionInfo.adminRole || 'Super Admin';

      console.log(`[DeleteUserAccountLog] Request received. Admin UID: ${adminUid}, Admin Role: ${adminRole}`);

      const { targetUid, targetDocId, targetTelegramId, targetMobile, reason } = req.body;

      if (!targetUid && !targetDocId) {
        console.log(`[DeleteUserAccountLog] Bad Request: Missing targetUid and targetDocId`);
        return res.status(400).json({
          success: false,
          error: 'Target User UID or Document ID is required.',
          reason: 'Missing targetUid and targetDocId'
        });
      }

      // Helper to batch query & delete
      const deleteMatchingDocs = async (collectionName: string, fieldName: string, fieldValue: string | undefined | null) => {
        if (!fieldValue) return;
        try {
          const colRef = collection(db, collectionName);
          const q = query(colRef, where(fieldName, '==', fieldValue));
          const snap = await getDocs(q);
          for (const docSnap of snap.docs) {
            await deleteDoc(doc(db, collectionName, docSnap.id));
          }
        } catch (err) {
          console.warn(`Error deleting ${collectionName} docs:`, err);
        }
      };

      if (targetDocId) {
        try {
          await deleteDoc(doc(db, 'users', targetDocId));
        } catch (e) {}
      }
      await deleteMatchingDocs('users', 'uid', targetUid);
      await deleteMatchingDocs('users', 'telegramId', targetTelegramId);
      if (targetMobile && targetMobile !== 'N/A') {
        await deleteMatchingDocs('users', 'mobile', targetMobile);
      }

      // Wallet transactions
      await deleteMatchingDocs('transactions', 'uid', targetUid);
      await deleteMatchingDocs('transactions', 'userId', targetDocId);
      await deleteMatchingDocs('transactions', 'telegramId', targetTelegramId);

      // Referral & milestone
      await deleteMatchingDocs('referralTokens', 'uid', targetUid);
      await deleteMatchingDocs('referralTokens', 'referrerUid', targetUid);
      await deleteMatchingDocs('referralTokens', 'referredUid', targetUid);
      await deleteMatchingDocs('referralLogs', 'uid', targetUid);
      await deleteMatchingDocs('referralLogs', 'referrerUid', targetUid);
      await deleteMatchingDocs('referralLogs', 'referredUid', targetUid);
      await deleteMatchingDocs('milestoneTokens', 'uid', targetUid);
      await deleteMatchingDocs('milestoneTokens', 'telegramId', targetTelegramId);
      await deleteMatchingDocs('milestoneClaimRecords', 'uid', targetUid);
      await deleteMatchingDocs('milestoneClaimRecords', 'telegramId', targetTelegramId);

      // Feedback, contestants, votes, withdrawals, devices
      await deleteMatchingDocs('feedbackReviews', 'uid', targetUid);
      await deleteMatchingDocs('feedbackReviews', 'telegramId', targetTelegramId);
      if (targetMobile && targetMobile !== 'N/A') {
        const cleanMobile = targetMobile.replace(/\D/g, '');
        if (cleanMobile) {
          try {
            await deleteDoc(doc(db, 'feedbackOtps', cleanMobile));
          } catch (e) {}
        }
      }
      await deleteMatchingDocs('contestants', 'uid', targetUid);
      await deleteMatchingDocs('contestants', 'telegramId', targetTelegramId);
      await deleteMatchingDocs('contestants', 'userId', targetDocId);
      await deleteMatchingDocs('voteLogs', 'voterUid', targetUid);
      await deleteMatchingDocs('voteLogs', 'uid', targetUid);
      await deleteMatchingDocs('voteLogs', 'telegramId', targetTelegramId);
      await deleteMatchingDocs('voteLinks', 'uid', targetUid);
      await deleteMatchingDocs('voteLinks', 'telegramId', targetTelegramId);
      await deleteMatchingDocs('withdrawals', 'uid', targetUid);
      await deleteMatchingDocs('withdrawals', 'userId', targetDocId);
      await deleteMatchingDocs('withdrawals', 'telegramId', targetTelegramId);
      await deleteMatchingDocs('deviceFingerprints', 'uid', targetUid);
      await deleteMatchingDocs('deviceFingerprints', 'telegramId', targetTelegramId);
      await deleteMatchingDocs('bannedDevices', 'uid', targetUid);

      // Record Audit Log
      const nowIso = new Date().toISOString();
      await addDoc(collection(db, 'adminLogs'), {
        action: 'DELETE_USER_ACCOUNT',
        adminId: 'Super Admin',
        adminName: 'Super Admin',
        targetUid: targetUid || 'N/A',
        mobileNumber: targetMobile || 'N/A',
        telegramId: targetTelegramId || 'N/A',
        reason: reason || 'Admin Permanent Account Deletion',
        timestamp: nowIso,
        createdAt: nowIso
      });

      await addDoc(collection(db, 'userDeleteLogs'), {
        adminId: 'Super Admin',
        adminName: 'Super Admin',
        targetUid: targetUid || 'N/A',
        mobileNumber: targetMobile || 'N/A',
        telegramId: targetTelegramId || 'N/A',
        reason: reason || 'Admin Permanent Account Deletion',
        deletedAt: nowIso,
        timestamp: nowIso
      });

      return res.json({
        success: true,
        message: '✅ User account deleted successfully. The user can now register again as a new account.'
      });
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

  // Resend Contestant Voting Link (Protected)
  app.post('/api/admin/contestants/resend-link', requireAdminSession, async (req, res) => {
    try {
      const { contestantId, contestId } = req.body;
      if (!contestantId || !contestId) {
        return res.status(400).json({ success: false, error: 'contestantId and contestId are required.' });
      }

      // Fetch contest
      const contestDoc = await getDoc(doc(db, 'contests', contestId));
      if (!contestDoc.exists()) {
        return res.status(404).json({ success: false, error: 'Contest not found.' });
      }
      const contest = contestDoc.data();

      // Fetch contestant
      const contestantDoc = await getDoc(doc(db, 'contestants', contestantId));
      if (!contestantDoc.exists()) {
        return res.status(404).json({ success: false, error: 'Contestant not found.' });
      }
      const contestant = contestantDoc.data();

      if (!contestant.telegramId) {
        return res.status(400).json({ success: false, error: 'Contestant does not have a Telegram Chat ID registered.' });
      }

      // Get configuration
      const config = await getDecryptedConfig();
      if (!config || !config.botToken) {
        return res.status(500).json({ success: false, error: 'Bot token configuration is missing or decrypted unsuccessfully.' });
      }

      const botUsername = config.botUsername || 'RoyShareWalletBot';
      const uniqueLink = `https://t.me/${botUsername}?start=vote_${contestId}_${contestantId}`;

      // Save permanently in voteLinks collection and update contestant doc
      const linkId = `vote_${contestId}_${contestantId}`;
      await setDoc(doc(db, 'voteLinks', linkId), {
        id: linkId,
        contestId,
        contestantId,
        voteLink: uniqueLink,
        createdAt: new Date().toISOString()
      }, { merge: true });

      await setDoc(doc(db, 'contestants', contestantId), {
        voteLink: uniqueLink
      }, { merge: true });

      const messageText = `🎉 <b>Voting Started!</b>\n\n` +
        `Hello ${contestant.name},\n\n` +
        `Your personal vote link is ready.\n\n` +
        `🔗 ${uniqueLink}\n\n` +
        `📢 Share this link with your friends.\n\n` +
        `Only verified users can vote.\n\n` +
        `Good Luck! 🏆`;

      const response = await fetch(`https://api.telegram.org/bot${config.botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: contestant.telegramId,
          text: messageText,
          parse_mode: 'HTML',
        }),
      });

      const resJson = await response.json();
      if (resJson.ok) {
        return res.json({ success: true, message: 'Unique voting link sent successfully via the Telegram Bot!' });
      } else {
        return res.status(500).json({ success: false, error: `Telegram Bot API Error: ${resJson.description || 'Unknown'}` });
      }
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // API fallback handler: Ensure any request starting with /api that doesn't match an actual registered Express route
  // is returned as a 404 JSON response instead of falling through to serve the static frontend index.html
  app.all('/api/*', (req, res) => {
    console.warn(`[API Fallback] Unmatched API request: ${req.method} ${req.url}`);
    return res.status(404).json({
      success: false,
      error: `API endpoint not found: ${req.method} ${req.url}`
    });
  });

  // Serve Vite in dev or static files in production
  const isProduction = 
    process.env.NODE_ENV === 'production' || 
    !!process.env.RENDER || 
    (typeof __filename !== 'undefined' && __filename.endsWith('.cjs')) || 
    !(process.argv[1] && (process.argv[1].endsWith('.ts') || process.argv[1].endsWith('.tsx')));

  if (!isProduction) {
    console.log('[Server Startup] Mounting Vite middleware (Development Mode)');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    console.log('[Server Startup] Serving static frontend files from /dist (Production Mode)');
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
