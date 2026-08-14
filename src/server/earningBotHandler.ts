import { collection, query, where, getDocs, addDoc, doc, getDoc, runTransaction, setDoc, limit, deleteDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../services/firebase';
import { recordWalletTransaction } from './transactionService';
import { sendTelegramApi } from './botHandler';
import { isRoyShareWalletUser } from '../utils/userScope';

// In-memory chat/session steps for users during withdrawal flow
// Keys: `${botId}_${chatId}`
export interface EarningUserChatSession {
  step: 'IDLE' | 'AWAITING_WITHDRAW_AMOUNT' | 'AWAITING_WITHDRAW_DETAILS';
  method?: 'UPI' | 'REDEEM_CODE' | 'ULTRA_PAY';
  amount?: number;
}
const userChatSessions = new Map<string, EarningUserChatSession>();

/**
 * Handle Webhook Update for Earning Bots
 */
export async function processEarningBotUpdate(bot: any, update: any) {
  try {
    const token = bot.token;

    // 1. IGNORE EDITED MESSAGES, CHANNEL POSTS, AND BOT STATUS UPDATES IN GROUPS
    if (update.edited_message || update.channel_post || update.edited_channel_post || update.my_chat_member || update.chat_member) {
      return;
    }

    if (update.message) {
      const message = update.message;
      const chatType = String(message.chat?.type || '');

      // STRICT CHAT-TYPE GUARD:
      // Earning Bot user onboarding, messages, account creation, and menu interactions MUST ONLY happen in PRIVATE DM chats (chat.type === "private").
      // If the message is received in a GROUP or SUPERGROUP or CHANNEL (chat.type === "group" | "supergroup" | "channel"):
      // - DO NOT send Welcome message / Join Channel / Verify / Menu
      // - DO NOT create user accounts / pending sessions
      // - DO NOT award Signup or Referral bonuses
      // - Silently ignore the update!
      if (chatType !== 'private') {
        return;
      }

      const chatId = String(message.chat.id);
      const userId = String(message.from?.id || chatId);
      const text = message.text ? String(message.text).trim() : '';
      const contact = message.contact;

      // Ensure a pending/session entry exists
      const sessionRef = doc(db, 'pendingBotSessions', `${bot.botId}_${userId}`);

      // Handle Share Contact
      if (contact) {
        await handleContactSharing(bot, message, sessionRef);
        return;
      }

      // Handle Interactive Withdrawal Flow Text Inputs
      const sessionKey = `${bot.botId}_${userId}`;
      const chatSession = userChatSessions.get(sessionKey);
      if (chatSession && chatSession.step !== 'IDLE') {
        await handleWithdrawalWizardInput(bot, message, chatSession, sessionKey);
        return;
      }

      // Handle Commands
      if (text.startsWith('/start')) {
        await handleStartCommand(bot, message, text, sessionRef);
        return;
      }

      // Main Menu Button Routing
      if (text.includes('👤 ACCOUNT')) {
        await handleShowAccount(bot, userId);
        return;
      }
      if (text.includes('💰 BALANCE')) {
        await handleShowBalance(bot, userId);
        return;
      }
      if (text.includes('🎁 REFER & EARN')) {
        await handleShowReferEarn(bot, userId);
        return;
      }
      if (text.includes('💸 WITHDRAW')) {
        await handleInitiateWithdrawal(bot, userId);
        return;
      }
      if (text.includes('📊 HISTORY')) {
        await handleShowHistory(bot, userId);
        return;
      }
      if (text.includes('☎ CONTACT US') || text.includes('ℹ SUPPORT') || text.includes('☎ Contact Us')) {
        await handleShowSupport(bot, userId);
        return;
      }

      // Default fallback for active users or unregistered (ONLY in private chat)
      const userDoc = await getEarningUser(bot.botId, userId);
      if (userDoc) {
        await sendTelegramApi(token, 'sendMessage', {
          chat_id: userId,
          text: `🤖 <b>Hello, ${userDoc.firstName}!</b>\n\nHow can I help you today? Please use the menu below.`,
          parse_mode: 'HTML',
          reply_markup: buildUserMenuMarkup(),
        });
      } else {
        await handleStartCommand(bot, message, '/start', sessionRef);
      }
    } else if (update.callback_query) {
      const callback = update.callback_query;
      const chatType = String(callback.message?.chat?.type || '');
      const data = String(callback.data || '');

      await sendTelegramApi(bot.token, 'answerCallbackQuery', {
        callback_query_id: callback.id,
      }).catch(() => {});

      // Handle Admin Task Proof Approval & Rejection from Private Admin Group Chat
      if (data.startsWith('approve_task:') || data.startsWith('reject_task:')) {
        const adminUser = callback.from?.username ? `@${callback.from.username}` : (callback.from?.first_name || 'Admin');
        if (data.startsWith('approve_task:')) {
          const subId = data.replace('approve_task:', '').trim();
          const res = await handleManualTaskApproval(bot, subId, adminUser);
          await sendTelegramApi(bot.token, 'answerCallbackQuery', {
            callback_query_id: callback.id,
            text: res.success ? '✅ Task Approved & Reward Credited!' : (res.error || 'Approval failed'),
            show_alert: true,
          }).catch(() => {});
        } else if (data.startsWith('reject_task:')) {
          const subId = data.replace('reject_task:', '').trim();
          const res = await handleManualTaskRejection(bot, subId, 'Screenshot does not match the required proof.', adminUser);
          await sendTelegramApi(bot.token, 'answerCallbackQuery', {
            callback_query_id: callback.id,
            text: res.success ? '❌ Task Rejected' : (res.error || 'Rejection failed'),
            show_alert: true,
          }).catch(() => {});
        }
        return;
      }

      // Reject other callback queries from non-private chats
      if (chatType !== 'private') {
        return;
      }

      const chatId = String(callback.message?.chat?.id || callback.from?.id);
      const userId = String(callback.from?.id || chatId);

      const sessionRef = doc(db, 'pendingBotSessions', `${bot.botId}_${userId}`);

      if (data === 'earning_verify_join') {
        await handleVerifyJoinCallback(bot, chatId, userId, sessionRef);
      } else if (data.startsWith('earn_wd_method:')) {
        const method = data.split(':')[1] as 'UPI' | 'REDEEM_CODE' | 'ULTRA_PAY';
        await handleSelectWithdrawalMethod(bot, userId, method);
      } else if (data === 'earn_wd_confirm') {
        await handleConfirmWithdrawal(bot, userId);
      } else if (data === 'earn_wd_cancel') {
        userChatSessions.delete(`${bot.botId}_${userId}`);
        await sendTelegramApi(bot.token, 'sendMessage', {
          chat_id: userId,
          text: `❌ <b>Withdrawal cancelled.</b>`,
          parse_mode: 'HTML',
          reply_markup: buildUserMenuMarkup(),
        });
      }
    }
  } catch (err) {
    console.error('[processEarningBotUpdate Error]:', err);
  }
}

/**
 * Resolve Earning Bot Referrer by code, Telegram ID, UID, or Admin Chat ID
 */
export async function resolveEarningBotReferrer(bot: any, rawReferrerCode: string): Promise<{ telegramId: string; docId: string; isAdmin?: boolean } | null> {
  if (!rawReferrerCode || !bot || !bot.botId) return null;

  const botId = bot.botId;
  let cleanCode = String(rawReferrerCode).trim();
  if (cleanCode.startsWith('ref_')) {
    cleanCode = cleanCode.substring(4).trim();
  }
  if (!cleanCode) return null;

  // Extract possible Telegram ID if format is `${botId}_${tgUserId}`
  let candidateTgId = cleanCode;
  if (cleanCode.includes('_')) {
    const parts = cleanCode.split('_');
    candidateTgId = parts[parts.length - 1] || cleanCode;
  }

  // 1. Check if candidate matches Admin Chat ID or 'ADMIN'
  const adminChatId = String(bot.adminChatId || '').trim();
  if (cleanCode === 'ADMIN' || cleanCode.startsWith('ADMIN') || (adminChatId && (cleanCode === adminChatId || candidateTgId === adminChatId))) {
    const targetAdminTg = adminChatId || 'ADMIN';
    const adminDocId = `${botId}_${targetAdminTg}`;
    const adminRef = doc(db, 'users', adminDocId);
    const adminSnap = await getDoc(adminRef);

    if (!adminSnap.exists()) {
      const nowIso = new Date().toISOString();
      await setDoc(adminRef, {
        id: adminDocId,
        uid: adminDocId,
        botId,
        telegramId: targetAdminTg,
        username: 'Admin',
        firstName: 'Bot Admin',
        mobile: 'Admin',
        walletBalance: 0,
        lockedBalance: 0,
        totalWithdrawn: 0,
        channelVerified: true,
        groupVerified: true,
        referrerUid: '',
        totalReferrals: 0,
        successfulReferrals: 0,
        totalReferralEarnings: 0,
        status: 'ACTIVE',
        createdAt: nowIso,
        lastActive: nowIso,
      });
    }
    return { telegramId: targetAdminTg, docId: adminDocId, isAdmin: true };
  }

  // 2. Direct Doc ID check
  const directDocId = `${botId}_${candidateTgId}`;
  const directSnap = await getDoc(doc(db, 'users', directDocId));
  if (directSnap.exists()) {
    const d = directSnap.data();
    return { telegramId: String(d.telegramId || candidateTgId), docId: directDocId };
  }

  // 3. Try cleanCode as direct Doc ID
  const rawDocSnap = await getDoc(doc(db, 'users', cleanCode));
  if (rawDocSnap.exists() && rawDocSnap.data()?.botId === botId) {
    const d = rawDocSnap.data();
    return { telegramId: String(d.telegramId || candidateTgId), docId: rawDocSnap.id };
  }

  // 4. Query users collection by botId and telegramId
  const qTg = query(collection(db, 'users'), where('botId', '==', botId), where('telegramId', '==', candidateTgId));
  const snapTg = await getDocs(qTg);
  if (!snapTg.empty) {
    const d = snapTg.docs[0].data();
    return { telegramId: String(d.telegramId || candidateTgId), docId: snapTg.docs[0].id };
  }

  // 5. Query users collection by botId and uid
  const qUid = query(collection(db, 'users'), where('botId', '==', botId), where('uid', '==', cleanCode));
  const snapUid = await getDocs(qUid);
  if (!snapUid.empty) {
    const d = snapUid.docs[0].data();
    return { telegramId: String(d.telegramId || candidateTgId), docId: snapUid.docs[0].id };
  }

  return null;
}

/**
 * Handle /start and Referral Tracking
 */
async function handleStartCommand(bot: any, message: any, text: string, sessionRef: any) {
  const token = bot.token;

  // STRICT PRIVATE CHAT GUARD
  if (String(message.chat?.type || '') !== 'private') {
    return;
  }

  const chatId = String(message.chat.id);
  const userId = String(message.from?.id || chatId);
  const firstName = message.from?.first_name || 'User';
  const username = message.from?.username || '';

  // Check if already registered
  const userDoc = await getEarningUser(bot.botId, userId);
  if (userDoc) {
    if (userDoc.status === 'BANNED') {
      await sendTelegramApi(token, 'sendMessage', {
        chat_id: userId,
        text: `🚫 <b>Your account has been suspended.</b>\n\nContact Admin.`,
        parse_mode: 'HTML',
      });
      return;
    }
    await sendTelegramApi(token, 'sendMessage', {
      chat_id: userId,
      text: `👋 <b>Welcome back, ${userDoc.firstName}!</b>\n\n👛 <b>Wallet Balance:</b> ₹${userDoc.walletBalance || 0}`,
      parse_mode: 'HTML',
      reply_markup: buildUserMenuMarkup(),
    });
    return;
  }

  // Parse deep link referrer code (ref_CODE or /start ref_CODE or /start CODE)
  let rawReferrerCode = '';
  if (text.includes('start=')) {
    rawReferrerCode = text.split('start=')[1] || '';
  } else {
    const parts = text.split(/\s+/);
    if (parts.length > 1) {
      rawReferrerCode = parts[1];
    }
  }

  if (rawReferrerCode.startsWith('ref_')) {
    rawReferrerCode = rawReferrerCode.substring(4).trim();
  } else {
    rawReferrerCode = rawReferrerCode.trim();
  }

  // 1. Log Raw Telegram /start payload
  console.log(`[REFERRAL DEBUG] 1. Raw Telegram /start payload: "${text}"`);
  // 2. Log Parsed referral payload
  console.log(`[REFERRAL DEBUG] 2. Parsed referral payload: "${rawReferrerCode}"`);
  // 3. Log earningBotId
  console.log(`[REFERRAL DEBUG] 3. earningBotId: "${bot.botId}"`);
  // 5. Log referredTelegramUserId
  console.log(`[REFERRAL DEBUG] 5. referredTelegramUserId: "${userId}"`);

  let resolvedReferrer: { telegramId: string; docId: string } | null = null;
  if (rawReferrerCode) {
    resolvedReferrer = await resolveEarningBotReferrer(bot, rawReferrerCode);
  }

  // Anti Self-Referral Protection
  if (resolvedReferrer && String(resolvedReferrer.telegramId) === String(userId)) {
    console.log(`[REFERRAL DEBUG] Self-referral detected for user ${userId}. Ignoring referrer.`);
    resolvedReferrer = null;
  }

  if (resolvedReferrer) {
    // 4. Log resolved referrerTelegramUserId
    console.log(`[REFERRAL DEBUG] 4. resolved referrerTelegramUserId: "${resolvedReferrer.telegramId}" (docId: "${resolvedReferrer.docId}")`);
  } else {
    console.log(`[REFERRAL DEBUG] 4. resolved referrerTelegramUserId: NONE`);
  }

  // Create or update pending session
  const sessionSnap = await getDoc(sessionRef);
  let savedReferrerTg = resolvedReferrer?.telegramId || '';
  let savedReferrerDocId = resolvedReferrer?.docId || '';

  if (sessionSnap.exists()) {
    const sData = sessionSnap.data() as any;
    // Referral relationship is immutable after creation
    if (sData?.referrerTelegramId) {
      savedReferrerTg = sData.referrerTelegramId;
      savedReferrerDocId = sData.referrerDocId || `${bot.botId}_${sData.referrerTelegramId}`;
    } else if (sData?.referrerUid) {
      savedReferrerTg = sData.referrerUid;
      savedReferrerDocId = sData.referrerDocId || `${bot.botId}_${sData.referrerUid}`;
    }
  }

  await setDoc(sessionRef, {
    botId: bot.botId,
    telegramId: userId,
    firstName,
    username,
    referrerUid: savedReferrerTg,
    referrerTelegramId: savedReferrerTg,
    referrerDocId: savedReferrerDocId,
    channelVerified: false,
    groupVerified: false,
    contactVerified: false,
    updatedAt: new Date().toISOString(),
  }, { merge: true });

  // Create PENDING referral record in botReferrals if referrer exists
  if (savedReferrerTg) {
    const refRecordId = `REF_${bot.botId}_${userId}`;
    const refRecordRef = doc(db, 'botReferrals', refRecordId);
    const refSnap = await getDoc(refRecordRef);

    if (!refSnap.exists() || refSnap.data()?.status !== 'VALID') {
      const pendingRefData = {
        id: refRecordId,
        botId: bot.botId,
        referrerTelegramId: savedReferrerTg,
        referrerDocId: savedReferrerDocId,
        referredTelegramId: userId,
        referredName: firstName,
        status: 'PENDING',
        rewardAmount: Number(bot.referralReward) || 0,
        rewardStatus: 'UNPAID',
        createdAt: new Date().toISOString(),
        registrationCompletedAt: null,
      };
      await setDoc(refRecordRef, pendingRefData, { merge: true });
      // 6. Log Referral Record Creation
      console.log(`[REFERRAL DEBUG] 6. referral record creation (PENDING):`, pendingRefData);
    }
  }

  // Step 1: Verification of channel/group joins
  await sendChannelGroupJoinPrompt(bot, chatId, userId);
}

/**
 * Check Channel and Group Subscriptions
 */
async function checkUserSubscriptions(bot: any, userId: string): Promise<{ channelsJoined: boolean; groupsJoined: boolean; missing: string[] }> {
  let channelsJoined = true;
  let groupsJoined = true;
  const missing: string[] = [];

  const check = async (item: any) => {
    if (!item.chatId) return true;
    try {
      const res = await sendTelegramApi(bot.token, 'getChatMember', {
        chat_id: item.chatId,
        user_id: Number(userId),
      });
      if (res && res.ok) {
        const status = res.result?.status;
        const joined = ['creator', 'administrator', 'member'].includes(status);
        if (!joined) {
          missing.push(item.name || item.username || item.chatId);
          return false;
        }
        return true;
      }
      missing.push(item.name || item.username || item.chatId);
      return false;
    } catch (e) {
      missing.push(item.name || item.username || item.chatId);
      return false;
    }
  };

  if (bot.channels && Array.isArray(bot.channels)) {
    for (const ch of bot.channels) {
      const joined = await check(ch);
      if (!joined) channelsJoined = false;
    }
  }

  if (bot.groups && Array.isArray(bot.groups)) {
    for (const gr of bot.groups) {
      const joined = await check(gr);
      if (!joined) groupsJoined = false;
    }
  }

  return { channelsJoined, groupsJoined, missing };
}

/**
 * Prompts user to join channel/group
 */
async function sendChannelGroupJoinPrompt(bot: any, chatId: string, userId: string) {
  const inline_keyboard: any[][] = [];

  if (bot.channels && Array.isArray(bot.channels)) {
    bot.channels.forEach((ch: any) => {
      inline_keyboard.push([{
        text: `📢 Join Channel: ${ch.name || 'Official'}`,
        url: ch.link || 'https://t.me/',
      }]);
    });
  }

  if (bot.groups && Array.isArray(bot.groups)) {
    bot.groups.forEach((gr: any) => {
      inline_keyboard.push([{
        text: `👥 Join Group: ${gr.name || 'Community'}`,
        url: gr.link || 'https://t.me/',
      }]);
    });
  }

  inline_keyboard.push([{
    text: '✅ VERIFY',
    callback_data: 'earning_verify_join',
  }]);

  await sendTelegramApi(bot.token, 'sendMessage', {
    chat_id: userId,
    text: `👋 <b>Welcome!</b>\n\nPlease join the required channels/groups to continue.`,
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard },
  });
}

/**
 * Verification callback handler
 */
async function handleVerifyJoinCallback(bot: any, chatId: string, userId: string, sessionRef: any) {
  const { channelsJoined, groupsJoined, missing } = await checkUserSubscriptions(bot, userId);

  if (!channelsJoined || !groupsJoined) {
    await sendTelegramApi(bot.token, 'sendMessage', {
      chat_id: userId,
      text: `❌ <b>Please join all required channels/groups to continue:</b>\n\n• ${missing.join('\n• ')}`,
      parse_mode: 'HTML',
    });
    return;
  }

  // Update session
  await setDoc(sessionRef, {
    channelVerified: channelsJoined,
    groupVerified: groupsJoined,
    updatedAt: new Date().toISOString(),
  }, { merge: true });

  // Continue to contact verification
  await sendTelegramApi(bot.token, 'sendMessage', {
    chat_id: userId,
    text: `✅ <b>Verification Complete!</b>\n\nPlease tap the button below to share your verified mobile number securely.`,
    parse_mode: 'HTML',
    reply_markup: {
      keyboard: [
        [{ text: '📱 SHARE CONTACT', request_contact: true }]
      ],
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  });
}

/**
 * Handle contact sharing & run silent background security check
 */
async function handleContactSharing(bot: any, message: any, sessionRef: any) {
  if (String(message.chat?.type || '') !== 'private') return;

  const chatId = String(message.chat.id);
  const userId = String(message.from?.id || chatId);
  const contact = message.contact;

  if (!contact) return;

  const contactUserId = String(contact.user_id || '');
  if (contactUserId && contactUserId !== userId) {
    await sendTelegramApi(bot.token, 'sendMessage', {
      chat_id: userId,
      text: `❌ <b>This contact does not belong to your Telegram account.</b>\n\nPlease share your own verified mobile number.`,
      parse_mode: 'HTML',
      reply_markup: {
        keyboard: [
          [{ text: '📱 SHARE CONTACT', request_contact: true }]
        ],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    });
    return;
  }

  const normalizePhone = (p: string) => (p || '').replace(/\D/g, '').slice(-10);
  const sharedPhoneNorm = normalizePhone(contact.phone_number);

  if (!sharedPhoneNorm || sharedPhoneNorm.length < 7) {
    await sendTelegramApi(bot.token, 'sendMessage', {
      chat_id: userId,
      text: `❌ <b>Invalid mobile number received.</b>\n\nPlease tap the button below to share your contact number.`,
      parse_mode: 'HTML',
      reply_markup: {
        keyboard: [
          [{ text: '📱 SHARE CONTACT', request_contact: true }]
        ],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    });
    return;
  }

  console.log(`[CONTACT_VERIFIED] botId: ${bot.botId} | userId: ${userId} | phone: ${sharedPhoneNorm}`);

  // Fetch the pending registration session from Firestore for Earning Bots
  const regSessionDocRef = doc(db, 'registrationSessions', `${bot.botId}_${userId}`);
  const regSessionSnap = await getDoc(regSessionDocRef);

  if (regSessionSnap.exists()) {
    const regSession = regSessionSnap.data();
    // Compare entered mobile with shared contact number
    const enteredPhone = normalizePhone(regSession.mobile || '');
    if (enteredPhone && enteredPhone !== sharedPhoneNorm) {
      await sendTelegramApi(bot.token, 'sendMessage', {
        chat_id: userId,
        text: `❌ <b>Mobile Number Mismatch</b>\n\nThe phone number linked to your Telegram account (ending in <b>${sharedPhoneNorm.slice(-4)}</b>) does not match the mobile number you entered during registration (ending in <b>${enteredPhone.slice(-4)}</b>).\n\nPlease open the Mobile Verification Mini App and enter the correct mobile number.`,
        parse_mode: 'HTML',
        reply_markup: {
          remove_keyboard: true,
        }
      });
      return;
    }

    // Generate random 6-digit OTP code
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = Date.now() + 120000; // 2 minutes expiry

    // Save OTP to the registration session in Firestore
    await setDoc(regSessionDocRef, {
      contactVerified: true,
      otp: otpCode,
      otpExpiry: otpExpiry,
      attempts: 0
    }, { merge: true });

    console.log(`[EarningBot Auth] OTP verification started`);
    console.log(`[EarningBot Auth] Generated OTP ${otpCode} for Telegram ID: ${userId} under Bot: ${bot.botId}`);

    // Send OTP to the user in Telegram Chat
    const otpMessage =
      `🔐 <b>Your Mobile Verification OTP</b>\n\n` +
      `Your 6-digit verification code is: <code>${otpCode}</code>\n\n` +
      `Please enter this code in the Mobile Verification Mini App to complete your registration. Code expires in 2 minutes.`;

    await sendTelegramApi(bot.token, 'sendMessage', {
      chat_id: userId,
      text: otpMessage,
      parse_mode: 'HTML',
      reply_markup: {
        remove_keyboard: true // Clear the custom share contact keyboard
      }
    });

    return;
  }

  // Save/merge contact verified state to session
  await setDoc(sessionRef, {
    contactVerified: true,
    phone: sharedPhoneNorm,
    updatedAt: new Date().toISOString(),
  }, { merge: true });

  // Construct Mini App Verification URL
  const baseUrl = (process.env.PUBLIC_APP_URL || process.env.APP_URL || process.env.APP_BASE_URL || 'https://ais-dev-iecssl5uoae4d72ttmqrhh-963220536272.asia-southeast1.run.app').replace(/\/$/, '');
  const miniAppUrl = bot.miniAppUrl || `${baseUrl}/?botId=${bot.botId}&tgId=${userId}`;

  // PROMPT USER TO OPEN TELEGRAM MINI APP FOR MANDATORY SECURITY VERIFICATION
  await sendTelegramApi(bot.token, 'sendMessage', {
    chat_id: userId,
    text: `📱 <b>Contact Verified Successfully!</b>\n\n` +
      `🔒 <b>Final Step: Mandatory Security Verification Required</b>\n\n` +
      `Please tap the button below to open the Telegram Mini App and complete automated device fingerprinting, IP risk check, and bot-specific security verification to activate your account and claim your <b>₹${bot.registrationBonus || 0} Registration Bonus</b>!`,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔒 COMPLETE SECURITY VERIFICATION', web_app: { url: miniAppUrl } }]
      ]
    }
  });
  console.log(`[SECURITY_VERIFICATION_PROMPTED] Mini App verification link sent for botId: ${bot.botId} | userId: ${userId}`);
}

/**
 * Prompt unverified user to complete Mini App security verification
 */
export async function promptUnverifiedUser(bot: any, chatId: string, userId: string) {
  const baseUrl = (process.env.PUBLIC_APP_URL || process.env.APP_URL || process.env.APP_BASE_URL || 'https://ais-dev-iecssl5uoae4d72ttmqrhh-963220536272.asia-southeast1.run.app').replace(/\/$/, '');
  const miniAppUrl = bot.miniAppUrl || `${baseUrl}/?botId=${bot.botId}&tgId=${userId}`;

  await sendTelegramApi(bot.token, 'sendMessage', {
    chat_id: userId,
    text: `🔒 <b>Security Verification Required</b>\n\n` +
      `Your account is not yet active. Please tap the button below to complete Telegram Mini App security verification to activate your account and claim your registration bonus.`,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔒 COMPLETE SECURITY VERIFICATION', web_app: { url: miniAppUrl } }]
      ]
    }
  });
}

/**
 * Get configured user or return null
 */
export async function getEarningUser(botId: string, telegramId: string): Promise<any> {
  const docRef = doc(db, 'users', `${botId}_${telegramId}`);
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    return snap.data();
  }
  return null;
}

/**
 * Build professional bot keyboard menu markup
 */
export function buildUserMenuMarkup() {
  return {
    keyboard: [
      [{ text: '👤 ACCOUNT' }, { text: '💰 BALANCE' }],
      [{ text: '🎁 REFER & EARN' }, { text: '💸 WITHDRAW' }],
      [{ text: '📊 HISTORY' }, { text: '☎️ CONTACT US' }]
    ],
    resize_keyboard: true,
  };
}

/**
 * Interactive Account Screen
 */
async function handleShowAccount(bot: any, userId: string) {
  const user = await getEarningUser(bot.botId, userId);
  if (!user) {
    await promptUnverifiedUser(bot, userId, userId);
    return;
  }

  const regDate = user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A';
  const maskedMobile = user.mobile ? `${user.mobile.substring(0, 4)}****${user.mobile.slice(-2)}` : 'N/A';

  const text = `👤 <b>My Account</b>\n\n` +
    `• <b>Name:</b> ${user.firstName}\n` +
    `• <b>UID:</b> <code>${user.uid}</code>\n` +
    `• <b>Mobile:</b> <code>${maskedMobile}</code>\n` +
    `• <b>Telegram ID:</b> <code>${user.telegramId}</code>\n` +
    `• <b>Username:</b> @${user.username || 'N/A'}\n` +
    `• <b>Registration Date:</b> ${regDate}\n` +
    `• <b>Account Status:</b> 🟢 ${user.status || 'ACTIVE'}`;

  await sendTelegramApi(bot.token, 'sendMessage', {
    chat_id: userId,
    text,
    parse_mode: 'HTML',
    reply_markup: buildUserMenuMarkup(),
  });
}

/**
 * Interactive Balance Screen
 */
async function handleShowBalance(bot: any, userId: string) {
  const user = await getEarningUser(bot.botId, userId);
  if (!user) {
    await promptUnverifiedUser(bot, userId, userId);
    return;
  }

  // Query pending balance from referrals
  const refQuery = query(collection(db, 'botReferrals'), where('botId', '==', bot.botId), where('referrerTelegramId', '==', userId), where('status', '==', 'PENDING'));
  const refSnap = await getDocs(refQuery);
  let pendingBalance = 0;
  refSnap.forEach((doc) => {
    pendingBalance += doc.data().rewardAmount || 0;
  });

  const totalWithdrawn = user.totalWithdrawn || 0;
  const totalEarned = (user.walletBalance || 0) + totalWithdrawn;

  const text = `💰 <b>Wallet Balance</b>\n\n` +
    `• 💰 <b>AVAILABLE BALANCE:</b> ₹${user.walletBalance || 0}\n` +
    `• 🟡 <b>PENDING BALANCE:</b> ₹${pendingBalance}\n` +
    `• 💵 <b>TOTAL EARNED:</b> ₹${totalEarned}\n` +
    `• 💸 <b>TOTAL WITHDRAWN:</b> ₹${totalWithdrawn}`;

  await sendTelegramApi(bot.token, 'sendMessage', {
    chat_id: userId,
    text,
    parse_mode: 'HTML',
    reply_markup: buildUserMenuMarkup(),
  });
}

/**
 * Refer & Earn Screen
 */
async function handleShowReferEarn(bot: any, userId: string) {
  const user = await getEarningUser(bot.botId, userId);
  if (!user) {
    await promptUnverifiedUser(bot, userId, userId);
    return;
  }

  // Stats
  const refCol = collection(db, 'botReferrals');
  const qAll = query(refCol, where('botId', '==', bot.botId), where('referrerTelegramId', '==', userId));
  const snapAll = await getDocs(qAll);

  let total = 0;
  let valid = 0;
  let pending = 0;
  let rejected = 0;
  let earned = 0;
  let pendingEarned = 0;

  snapAll.forEach((doc) => {
    const d = doc.data();
    total++;
    if (d.status === 'VALID') {
      valid++;
      earned += d.rewardAmount || 0;
    } else if (d.status === 'PENDING') {
      pending++;
      pendingEarned += d.rewardAmount || 0;
    } else {
      rejected++;
    }
  });

  const botRefLink = `https://t.me/${bot.botUsername}?start=ref_${user.uid}`;

  const text = `🎁 <b>Refer & Earn Program</b>\n\n` +
    `Invite your friends and earn money when they register and pass verification!\n\n` +
    `• <b>Per Referral Reward:</b> ₹${bot.referralReward || 0}\n\n` +
    `🔗 <b>Your Referral Link:</b>\n<code>${botRefLink}</code>\n\n` +
    `📊 <b>Statistics:</b>\n` +
    `• <b>Total Referrals:</b> ${total}\n` +
    `• 🟢 <b>Valid:</b> ${valid}\n` +
    `• 🟡 <b>Pending:</b> ${pending}\n` +
    `• 🔴 <b>Rejected:</b> ${rejected}\n\n` +
    `• 💵 <b>Available Earnings:</b> ₹${earned}\n` +
    `• 🟡 <b>Pending Earnings:</b> ₹${pendingEarned}`;

  await sendTelegramApi(bot.token, 'sendMessage', {
    chat_id: userId,
    text,
    parse_mode: 'HTML',
    reply_markup: buildUserMenuMarkup(),
  });
}

/**
 * Interactive Support Page
 */
async function handleShowSupport(bot: any, userId: string) {
  const supportText = `☎ <b>Contact Support</b>\n\n` +
    `For any queries or issues regarding <b>${bot.botName || '@' + bot.botUsername}</b>, please contact our support team:\n\n` +
    `• <b>Bot Username:</b> @${bot.botUsername}\n` +
    `• <b>Telegram Support:</b> @${bot.botUsername}_support\n` +
    `• <b>Support Contact:</b> Available in-app support chat\n\n` +
    `We are available 24/7 to help you!`;

  await sendTelegramApi(bot.token, 'sendMessage', {
    chat_id: userId,
    text: supportText,
    parse_mode: 'HTML',
  });
}

/**
 * Show History
 */
async function handleShowHistory(bot: any, userId: string) {
  const txQuery = query(
    collection(db, 'wallet_transactions'),
    where('botId', '==', bot.botId),
    where('telegramId', '==', userId),
    limit(10)
  );
  const snap = await getDocs(txQuery);

  if (snap.empty) {
    await sendTelegramApi(bot.token, 'sendMessage', {
      chat_id: userId,
      text: `📊 <b>No recent transaction history found.</b>`,
      parse_mode: 'HTML',
    });
    return;
  }

  let text = `📊 <b>Recent Transactions:</b>\n\n`;
  snap.forEach((doc) => {
    const d = doc.data();
    const date = d.createdAt ? new Date(d.createdAt).toLocaleDateString() : '';
    const sign = d.amount >= 0 ? '🟢 +' : '🔴 ';
    text += `• [${date}] ${d.description || d.type}\n   <b>${sign}₹${Math.abs(d.amount)}</b> (${d.status || 'completed'})\n\n`;
  });

  await sendTelegramApi(bot.token, 'sendMessage', {
    chat_id: userId,
    text,
    parse_mode: 'HTML',
  });
}

/**
 * Initiate Withdrawal conversational workflow
 */
async function handleInitiateWithdrawal(bot: any, userId: string) {
  const user = await getEarningUser(bot.botId, userId);
  if (!user) {
    await promptUnverifiedUser(bot, userId, userId);
    return;
  }

  const bal = user.walletBalance || 0;
  if (bal < bot.minWithdrawal) {
    await sendTelegramApi(bot.token, 'sendMessage', {
      chat_id: userId,
      text: `❌ <b>Insufficient Balance for Withdrawal</b>\n\n` +
        `• <b>Your Balance:</b> ₹${bal}\n` +
        `• <b>Minimum Required:</b> ₹${bot.minWithdrawal}\n\n` +
        `Keep referring and complete tasks to reach the threshold!`,
      parse_mode: 'HTML',
    });
    return;
  }

  // Display available withdrawal methods configured by admin
  const inline_keyboard: any[][] = [];
  const methods = bot.withdrawalMethods || ['UPI'];

  methods.forEach((m: string) => {
    let label = '';
    if (m === 'UPI') label = '💳 UPI Payout';
    if (m === 'REDEEM_CODE') label = '🎁 Gift Redeem Code';
    if (m === 'ULTRA_PAY') label = '⚡ Ultra Pay Instantly';

    inline_keyboard.push([{
      text: label,
      callback_data: `earn_wd_method:${m}`,
    }]);
  });

  await sendTelegramApi(bot.token, 'sendMessage', {
    chat_id: userId,
    text: `💸 <b>Withdraw Funds</b>\n\n` +
      `• <b>Available Balance:</b> ₹${bal}\n` +
      `• <b>Minimum Payout:</b> ₹${bot.minWithdrawal}\n` +
      `• <b>Platform Tax/Fee:</b> ${bot.withdrawalTax || 0}%\n\n` +
      `Please select your preferred withdrawal method:`,
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard },
  });
}

/**
 * Step 1 Withdrawal Selection callback
 */
async function handleSelectWithdrawalMethod(bot: any, userId: string, method: 'UPI' | 'REDEEM_CODE' | 'ULTRA_PAY') {
  const sessionKey = `${bot.botId}_${userId}`;
  userChatSessions.set(sessionKey, {
    step: 'AWAITING_WITHDRAW_AMOUNT',
    method,
  });

  await sendTelegramApi(bot.token, 'sendMessage', {
    chat_id: userId,
    text: `💸 <b>Withdrawal Method:</b> ${method}\n\n` +
      `Please enter the amount you wish to withdraw (numbers only):`,
    parse_mode: 'HTML',
  });
}

/**
 * Step 2: Withdrawal Wizard Inputs
 */
async function handleWithdrawalWizardInput(bot: any, message: any, chatSession: EarningUserChatSession, sessionKey: string) {
  const userId = String(message.from?.id);
  const text = String(message.text).trim();

  if (chatSession.step === 'AWAITING_WITHDRAW_AMOUNT') {
    const amount = Number(text);
    if (isNaN(amount) || amount <= 0) {
      await sendTelegramApi(bot.token, 'sendMessage', {
        chat_id: userId,
        text: `❌ <b>Invalid amount.</b> Please enter a positive number:`,
        parse_mode: 'HTML',
      });
      return;
    }

    const user = await getEarningUser(bot.botId, userId);
    const currentBal = Number(user?.walletBalance) || 0;
    const currentLock = Number(user?.lockedBalance) || 0;
    const avail = Math.max(0, currentBal - currentLock);

    // 1. Validate requested amount >= minimum threshold
    if (amount < bot.minWithdrawal) {
      await sendTelegramApi(bot.token, 'sendMessage', {
        chat_id: userId,
        text: `❌ <b>Minimum withdrawal threshold is ₹${bot.minWithdrawal}.</b>\n\nPlease enter a higher amount:`,
        parse_mode: 'HTML',
      });
      return;
    }

    // 2. Validate requested amount <= available balance
    if (amount > avail) {
      await sendTelegramApi(bot.token, 'sendMessage', {
        chat_id: userId,
        text: `❌ <b>Insufficient available balance!</b>\n\n• Available balance: ₹${avail}\n• Requested amount: ₹${amount}\n\nPlease enter a lower amount:`,
        parse_mode: 'HTML',
      });
      return;
    }

    chatSession.amount = amount;
    chatSession.step = 'AWAITING_WITHDRAW_DETAILS';

    let detailsPrompt = '';
    if (chatSession.method === 'UPI') detailsPrompt = `💳 Please enter your <b>UPI ID</b> (e.g. <code>username@bank</code>):`;
    if (chatSession.method === 'REDEEM_CODE') detailsPrompt = `🎁 Please enter details for redeem code delivery (e.g. your email or contact):`;
    if (chatSession.method === 'ULTRA_PAY') detailsPrompt = `⚡ Please enter your <b>Ultra Pay Pay Number</b> (verified registered mobile):`;

    await sendTelegramApi(bot.token, 'sendMessage', {
      chat_id: userId,
      text: detailsPrompt,
      parse_mode: 'HTML',
    });

  } else if (chatSession.step === 'AWAITING_WITHDRAW_DETAILS') {
    if (!text || text.length < 3) {
      await sendTelegramApi(bot.token, 'sendMessage', {
        chat_id: userId,
        text: `❌ <b>Invalid entry.</b> Please provide valid details:`,
        parse_mode: 'HTML',
      });
      return;
    }

    const amount = chatSession.amount || 0;
    const taxPct = bot.withdrawalTax || 0;
    const taxAmount = Number(((amount * taxPct) / 100).toFixed(2));
    const payoutAmount = Number((amount - taxAmount).toFixed(2));

    // Save details to the session
    const detailsKey = chatSession.method === 'UPI' ? 'upiId' : (chatSession.method === 'REDEEM_CODE' ? 'redeemCode' : 'paytoNumber');
    (chatSession as any)[detailsKey] = text;

    const summaryText = `📝 <b>Confirm Withdrawal Request</b>\n\n` +
      `• <b>Method:</b> ${chatSession.method}\n` +
      `• <b>Amount requested:</b> ₹${amount}\n` +
      `• <b>Tax/Fees (${taxPct}%):</b> ₹${taxAmount}\n` +
      `• <b>Net Payout Amount:</b> <b>₹${payoutAmount}</b>\n` +
      `• <b>Payout Address/ID:</b> <code>${text}</code>\n\n` +
      `Are you sure you want to proceed?`;

    await sendTelegramApi(bot.token, 'sendMessage', {
      chat_id: userId,
      text: summaryText,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Confirm', callback_data: 'earn_wd_confirm' },
            { text: '❌ Cancel', callback_data: 'earn_wd_cancel' }
          ]
        ]
      }
    });
  }
}

/**
 * Handle confirmation of withdrawal
 */
async function handleConfirmWithdrawal(bot: any, userId: string) {
  const sessionKey = `${bot.botId}_${userId}`;
  const chatSession = userChatSessions.get(sessionKey);
  if (!chatSession || !chatSession.amount) {
    await sendTelegramApi(bot.token, 'sendMessage', {
      chat_id: userId,
      text: `❌ <b>Session expired or invalid.</b> Please try again.`,
      parse_mode: 'HTML',
    });
    return;
  }

  const amount = chatSession.amount;
  const method = chatSession.method || 'UPI';
  const taxPct = bot.withdrawalTax || 0;
  const taxAmount = Number(((amount * taxPct) / 100).toFixed(2));
  const payoutAmount = Number((amount - taxAmount).toFixed(2));
  const totalDeduction = amount; // Lock the full amount requested

  const detailsValue = (chatSession as any).upiId || (chatSession as any).redeemCode || (chatSession as any).paytoNumber || '';

  const userRef = doc(db, 'users', `${bot.botId}_${userId}`);

  try {
    const withdrawalId = `EWD_${bot.botId}_${userId}_${Date.now()}`;
    const nowIso = new Date().toISOString();

    const newWithdrawalRecord = {
      withdrawalId,
      botId: bot.botId,
      uid: `${bot.botId}_${userId}`,
      telegramId: userId,
      fullName: (chatSession as any).firstName || 'User',
      amount: amount,
      deductionAmount: totalDeduction,
      processingFee: 0,
      taxAmount: taxAmount,
      payoutAmount: payoutAmount,
      method: method,
      paymentDetails: {
        upiId: (chatSession as any).upiId || '',
        redeemCode: (chatSession as any).redeemCode || '',
        paytoNumber: (chatSession as any).paytoNumber || '',
      },
      status: 'PENDING',
      riskStatus: 'LOW',
      createdAt: nowIso,
      updatedAt: nowIso,
      idempotencyKey: `withdrawal_${bot.botId}_${userId}_${amount}_${Date.now()}`,
      providerPaymentStarted: false,
    };

    await runTransaction(db, async (transaction) => {
      const uSnap = await transaction.get(userRef);
      if (!uSnap.exists()) {
        throw new Error('User record not found.');
      }

      const freshUser = uSnap.data();
      const currentBal = Number(freshUser.walletBalance) || 0;
      const currentLock = Number(freshUser.lockedBalance) || 0;
      const avail = Math.max(0, currentBal - currentLock);

      if (avail < totalDeduction) {
        throw new Error(`Insufficient available balance: ₹${avail}`);
      }

      // Update user balances - lock requested amount ONLY (wallet balance deducted upon approval)
      transaction.update(userRef, {
        lockedBalance: currentLock + totalDeduction,
        updatedAt: nowIso,
      });

      // Save Withdrawal Record
      const wRef = doc(db, 'withdrawals', withdrawalId);
      transaction.set(wRef, newWithdrawalRecord);
    });

    // Record ledger entry
    await recordWalletTransaction({
      uid: `${bot.botId}_${userId}`,
      botId: bot.botId,
      type: 'WITHDRAWAL_REQUEST',
      amount: -totalDeduction,
      status: 'pending',
      description: `Withdrawal Hold #${withdrawalId} (${method})`,
      transactionId: `TXN_HOLD_${withdrawalId}`,
    });

    // Log action to audit logs
    await addDoc(collection(db, 'auditLogs'), {
      action: 'Withdrawal Created',
      botId: bot.botId,
      admin: false,
      referenceId: withdrawalId,
      timestamp: nowIso,
    });

    userChatSessions.delete(sessionKey);

    await sendTelegramApi(bot.token, 'sendMessage', {
      chat_id: userId,
      text: `🎉 <b>Withdrawal Submitted Successfully!</b>\n\n` +
        `• 🆔 <b>Withdrawal ID:</b> <code>${withdrawalId}</code>\n` +
        `• 💸 <b>Amount:</b> ₹${amount}\n` +
        `• <b>Method:</b> ${method}\n\n` +
        `Our admins will review and process your payment shortly. Thank you!`,
      parse_mode: 'HTML',
      reply_markup: buildUserMenuMarkup(),
    });

  } catch (err: any) {
    console.error('Withdrawal transaction failed:', err);
    await sendTelegramApi(bot.token, 'sendMessage', {
      chat_id: userId,
      text: `❌ <b>Failed to process withdrawal:</b> ${err.message || 'Server error'}`,
      parse_mode: 'HTML',
    });
  }
}

/**
 * Resolve exact Roy Share Wallet user account for a task submission
 * Uses strict hierarchy:
 * 1. Primary: accountScope == "ROY_SHARE_WALLET" AND (appUid == sub.userAppUid/uid OR docId == sub.userAppUid/uid)
 * 2. Fallback: accountScope == "ROY_SHARE_WALLET" AND (telegramId == sub.telegramUserId OR docId == sub.telegramUserId)
 * 3. Final Fallback: accountScope == "ROY_SHARE_WALLET" AND (mobile == sub.registrationMobile)
 */
export async function resolveRoyShareWalletAccountForSubmission(sub: any): Promise<{
  userDocRef: any;
  userSnap: any;
  userDocId: string | null;
  userData: any | null;
  lookupAttempted: string[];
}> {
  const lookupAttempted: string[] = [];

  const submissionUid = String(sub.userAppUid || sub.uid || sub.userUid || sub.userId || '').trim();
  const submissionTgId = String(sub.telegramUserId || sub.userId || '').trim();
  const rawMobile = String(sub.registrationMobile || sub.mobile || '').replace(/\D/g, '').trim();

  const usersRef = collection(db, 'users');

  const checkIsRoyUser = (docId: string, data: any) => {
    if (!data) return false;
    // Exclude Earning Bot or non-Roy accounts
    if (data.accountScope === 'EARNING_BOT' || (data.earningBotId && data.earningBotId !== 'ROY_SHARE_WALLET' && data.earningBotId !== 'roy_share_wallet')) {
      return false;
    }
    return isRoyShareWalletUser(docId, data);
  };

  // 1. PRIMARY LOOKUP: accountScope == "ROY_SHARE_WALLET" AND uid == submission.uid
  if (submissionUid) {
    lookupAttempted.push(`Primary: accountScope == "ROY_SHARE_WALLET" AND uid == "${submissionUid}"`);

    // Check appUid field
    const qAppUid = query(usersRef, where('appUid', '==', submissionUid));
    const snapAppUid = await getDocs(qAppUid);
    for (const d of snapAppUid.docs) {
      if (checkIsRoyUser(d.id, d.data())) {
        return { userDocRef: d.ref, userSnap: d, userDocId: d.id, userData: d.data(), lookupAttempted };
      }
    }

    // Check uid field
    const qUid = query(usersRef, where('uid', '==', submissionUid));
    const snapUid = await getDocs(qUid);
    for (const d of snapUid.docs) {
      if (checkIsRoyUser(d.id, d.data())) {
        return { userDocRef: d.ref, userSnap: d, userDocId: d.id, userData: d.data(), lookupAttempted };
      }
    }

    // Check direct document ID = submissionUid
    const directRef = doc(db, 'users', submissionUid);
    const directSnap = await getDoc(directRef);
    if (directSnap.exists() && checkIsRoyUser(directSnap.id, directSnap.data())) {
      return { userDocRef: directRef, userSnap: directSnap, userDocId: directSnap.id, userData: directSnap.data(), lookupAttempted };
    }
  }

  // 2. FALLBACK LOOKUP: accountScope == "ROY_SHARE_WALLET" AND telegramUserId == submission.telegramUserId
  if (submissionTgId) {
    lookupAttempted.push(`Fallback: accountScope == "ROY_SHARE_WALLET" AND telegramUserId == "${submissionTgId}"`);

    // Check direct document ID = submissionTgId
    const directTgRef = doc(db, 'users', submissionTgId);
    const directTgSnap = await getDoc(directTgRef);
    if (directTgSnap.exists() && checkIsRoyUser(directTgSnap.id, directTgSnap.data())) {
      return { userDocRef: directTgRef, userSnap: directTgSnap, userDocId: directTgSnap.id, userData: directTgSnap.data(), lookupAttempted };
    }

    // Check telegramId field
    const qTg = query(usersRef, where('telegramId', '==', submissionTgId));
    const snapTg = await getDocs(qTg);
    for (const d of snapTg.docs) {
      if (checkIsRoyUser(d.id, d.data())) {
        return { userDocRef: d.ref, userSnap: d, userDocId: d.id, userData: d.data(), lookupAttempted };
      }
    }
  }

  // 3. FINAL FALLBACK LOOKUP: accountScope == "ROY_SHARE_WALLET" AND mobile == submission.registrationMobile
  if (rawMobile) {
    lookupAttempted.push(`Final Fallback: accountScope == "ROY_SHARE_WALLET" AND mobile == "${rawMobile}"`);

    const qMob = query(usersRef, where('mobile', '==', rawMobile));
    const snapMob = await getDocs(qMob);
    for (const d of snapMob.docs) {
      if (checkIsRoyUser(d.id, d.data())) {
        return { userDocRef: d.ref, userSnap: d, userDocId: d.id, userData: d.data(), lookupAttempted };
      }
    }

    const qRegMob = query(usersRef, where('registrationMobile', '==', rawMobile));
    const snapRegMob = await getDocs(qRegMob);
    for (const d of snapRegMob.docs) {
      if (checkIsRoyUser(d.id, d.data())) {
        return { userDocRef: d.ref, userSnap: d, userDocId: d.id, userData: d.data(), lookupAttempted };
      }
    }
  }

  return { userDocRef: null, userSnap: null, userDocId: null, userData: null, lookupAttempted };
}

/**
 * Handle Manual Audit Task Approval
 */
export async function handleManualTaskApproval(
  bot: any,
  submissionId: string,
  adminUsername: string,
  adminNote?: string
): Promise<{ success: boolean; newBalance?: number; error?: string }> {
  try {
    const subRef = doc(db, 'manualTaskSubmissions', submissionId);
    const subSnap = await getDoc(subRef);
    if (!subSnap.exists()) {
      return { success: false, error: 'Submission record not found' };
    }

    const sub = subSnap.data();
    if (sub.status === 'APPROVED') {
      return { success: false, error: 'Submission has already been approved and rewarded' };
    }
    if (sub.status !== 'PENDING_APPROVAL' && sub.status !== 'PENDING') {
      return { success: false, error: `Submission cannot be approved (current status: ${sub.status})` };
    }

    // Resolve exact Roy Share Wallet user account using submission identity
    const accountResult = await resolveRoyShareWalletAccountForSubmission(sub);

    if (!accountResult.userDocRef || !accountResult.userDocId) {
      console.warn('[ManualTaskApproval] User account resolution failed. Attempted lookups:', accountResult.lookupAttempted, 'for submissionId:', submissionId);

      const subUid = sub.userAppUid || sub.uid || sub.userUid || sub.userId || 'N/A';
      const subTgId = sub.telegramUserId || sub.userId || 'N/A';

      const diagnosticError = `Roy Share Wallet account could not be resolved for this submission.\nUID: ${subUid}\nTelegram ID: ${subTgId}\nScope: ROY_SHARE_WALLET`;

      return {
        success: false,
        error: diagnosticError
      };
    }

    const resolvedUserRef = accountResult.userDocRef;
    const resolvedUserDocId = accountResult.userDocId;

    const taskRef = doc(db, 'tasks', sub.taskId);
    const attemptId = sub.attemptId || `${resolvedUserDocId}_${sub.taskId}`;
    const attemptRef = doc(db, 'taskAttempts', attemptId);
    const idempotentTxnId = `TASK_REWARD_${submissionId}`;
    const idempotentTxnRef = doc(db, 'transactions', idempotentTxnId);

    let newBalance = 0;

    await runTransaction(db, async (transaction) => {
      // 1. Idempotency Check
      const existingTxnSnap = await transaction.get(idempotentTxnRef);
      if (existingTxnSnap.exists()) {
        throw new Error('Reward transaction has already been credited.');
      }

      // 2. Fresh Submission Check
      const freshSubSnap = await transaction.get(subRef);
      if (!freshSubSnap.exists()) {
        throw new Error('Submission not found');
      }
      const freshSub = freshSubSnap.data();
      if (freshSub.status !== 'PENDING_APPROVAL' && freshSub.status !== 'PENDING') {
        throw new Error(`Submission is already ${freshSub.status}`);
      }

      // 3. User Account Check
      const userSnap = await transaction.get(resolvedUserRef);
      if (!userSnap.exists()) {
        throw new Error('Roy Share Wallet user account no longer exists');
      }

      const userData = userSnap.data() as any || {};
      if (!isRoyShareWalletUser(resolvedUserDocId, userData)) {
        throw new Error('Resolved account does not belong to ROY_SHARE_WALLET');
      }

      const taskSnap = await transaction.get(taskRef);

      const currentWallet = Number(userData.walletBalance || userData.balance || 0);
      const currentCoins = Number(userData.coinsBalance || 0);
      const rewardAmt = Number(freshSub.reward || 0);
      const coinsAmt = Number(freshSub.coins || 0);
      const completedTasks = Array.isArray(userData.completedTasks) ? userData.completedTasks : [];

      if (completedTasks.includes(freshSub.taskId)) {
        throw new Error('Task reward has already been credited to this user');
      }

      newBalance = currentWallet + rewardAmt;
      const nowIso = new Date().toISOString();

      // Update Submission status
      transaction.update(subRef, {
        status: 'APPROVED',
        approvedAt: nowIso,
        approvedBy: adminUsername,
        reviewedAt: nowIso,
        reviewedBy: adminUsername,
        adminNote: adminNote || '',
        userDocId: resolvedUserDocId,
        accountScope: 'ROY_SHARE_WALLET'
      });

      // Update User Wallet & Tasks
      transaction.update(resolvedUserRef, {
        walletBalance: newBalance,
        balance: newBalance,
        coinsBalance: currentCoins + coinsAmt,
        completedTasks: [...completedTasks, freshSub.taskId],
        accountScope: 'ROY_SHARE_WALLET',
        updatedAt: nowIso
      });

      // Create Idempotent Wallet Transaction Entry
      transaction.set(idempotentTxnRef, {
        id: idempotentTxnId,
        transactionId: idempotentTxnId,
        uid: resolvedUserDocId,
        userAppUid: freshSub.userAppUid || freshSub.uid || userData.appUid || userData.uid || '',
        telegramId: freshSub.telegramUserId || userData.telegramId || '',
        userName: userData.userName || userData.firstName || freshSub.userFullName || `User #${freshSub.telegramUserId}`,
        amount: rewardAmt,
        type: 'TASK_REWARD',
        taskId: freshSub.taskId,
        submissionId: submissionId,
        status: 'completed',
        accountScope: 'ROY_SHARE_WALLET',
        description: `Task Reward: ${freshSub.taskTitle}`,
        createdAt: nowIso
      });

      // Update Task Attempt
      transaction.set(attemptRef, {
        id: attemptId,
        earningBotId: 'roy_share_wallet',
        accountScope: 'ROY_SHARE_WALLET',
        taskId: freshSub.taskId,
        telegramUserId: freshSub.telegramUserId || userData.telegramId || '',
        userId: resolvedUserDocId,
        status: 'APPROVED',
        submissionId,
        updatedAt: nowIso
      }, { merge: true });

      // Update Task Capacity / Approved Count
      if (taskSnap.exists()) {
        const taskData = taskSnap.data();
        const currentApproved = Number(taskData.approvedCount || 0) + 1;
        const maxApproved = Number(taskData.maxApprovedUsers || 0);
        const isFull = maxApproved > 0 && currentApproved >= maxApproved;

        transaction.update(taskRef, {
          approvedCount: currentApproved,
          isFull: isFull
        });

        // Update Campaign if linked
        if (taskData.campaignId) {
          const campaignRef = doc(db, 'taskCampaigns', taskData.campaignId);
          const campaignSnap = await transaction.get(campaignRef);
          if (campaignSnap.exists()) {
            const campData = campaignSnap.data();
            const currentSpent = Number(campData.spentBudget || 0) + rewardAmt;
            const currentUsers = Number(campData.approvedUsersCount || 0) + 1;
            const totalBudget = Number(campData.totalBudget || 0);
            const maxUsers = Number(campData.maxApprovedUsers || 0);

            let newStatus = campData.status || 'ACTIVE';
            if ((totalBudget > 0 && currentSpent >= totalBudget) || (maxUsers > 0 && currentUsers >= maxUsers)) {
              newStatus = 'COMPLETED';
            }

            transaction.update(campaignRef, {
              spentBudget: currentSpent,
              approvedUsersCount: currentUsers,
              status: newStatus
            });
          }
        }
      }
    });

    // Send Telegram Notification to user
    const userTgId = sub.telegramUserId || accountResult.userData?.telegramId;
    if (bot && bot.token && userTgId) {
      await sendTelegramApi(bot.token, 'sendMessage', {
        chat_id: String(userTgId),
        text: `🎉 <b>TASK APPROVED!</b>\n\n` +
          `Task: <b>${sub.taskTitle}</b>\n` +
          `💰 Reward: <b>₹${sub.reward}</b>\n\n` +
          `✅ <b>₹${sub.reward} has been credited to your wallet.</b>\n\n` +
          `💰 <b>New Wallet Balance: ₹${newBalance}</b>`,
        parse_mode: 'HTML',
      }).catch(() => {});
    }

    // Update Telegram Admin Group message caption/text if available
    if (bot && bot.token && sub.adminGroupChatId && sub.adminGroupMessageId) {
      const updatedCaption =
        `📋 <b>TASK PROOF SUBMISSION (APPROVED ✅)</b>\n\n` +
        `Task: ${sub.taskTitle}\n` +
        `💰 Reward: ₹${sub.reward}\n` +
        `📱 Registration Mobile: ${sub.registrationMobile}\n` +
        `👤 Telegram Username: @${sub.telegramUsername || 'N/A'}\n` +
        `🆔 Telegram ID: ${sub.telegramUserId}\n` +
        `👤 Full Name: ${sub.userFullName || 'N/A'}\n` +
        `🆔 User UID: ${sub.userAppUid || sub.uid || sub.userId}\n\n` +
        `📌 <b>Status: APPROVED ✅ by ${adminUsername}</b>` +
        (adminNote ? `\n📝 <b>Note:</b> ${adminNote}` : '');

      await sendTelegramApi(bot.token, 'editMessageCaption', {
        chat_id: sub.adminGroupChatId,
        message_id: sub.adminGroupMessageId,
        caption: updatedCaption,
        parse_mode: 'HTML',
        reply_markup: JSON.stringify({
          inline_keyboard: [[{ text: '✅ APPROVED', callback_data: 'none' }]]
        })
      }).catch(async () => {
        await sendTelegramApi(bot.token, 'editMessageText', {
          chat_id: sub.adminGroupChatId,
          message_id: sub.adminGroupMessageId,
          text: updatedCaption,
          parse_mode: 'HTML',
          reply_markup: JSON.stringify({
            inline_keyboard: [[{ text: '✅ APPROVED', callback_data: 'none' }]]
          })
        }).catch(() => {});
      });
    }

    return { success: true, newBalance };
  } catch (err: any) {
    console.error('Error approving manual task submission:', err);
    return { success: false, error: err.message || 'Failed to approve submission' };
  }
}

/**
 * Handle Manual Audit Task Rejection
 */
export async function handleManualTaskRejection(
  bot: any,
  submissionId: string,
  reason: string,
  adminUsername: string,
  adminNote?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const subRef = doc(db, 'manualTaskSubmissions', submissionId);
    const subSnap = await getDoc(subRef);
    if (!subSnap.exists()) {
      return { success: false, error: 'Submission record not found' };
    }

    const sub = subSnap.data();
    if (sub.status !== 'PENDING_APPROVAL' && sub.status !== 'PENDING') {
      return { success: false, error: `Submission cannot be rejected (status: ${sub.status})` };
    }

    const botId = sub.earningBotId || bot?.botId || 'roy_share_wallet';
    const tgUserId = String(sub.telegramUserId || sub.userId || '');
    const rejectionReason = reason || 'Screenshot does not match the required proof.';
    const nowIso = new Date().toISOString();

    // Check task settings for resubmission
    const taskRef = doc(db, 'tasks', sub.taskId);
    const taskSnap = await getDoc(taskRef);
    const taskData = taskSnap.exists() ? taskSnap.data() : null;

    const allowResubmission = taskData ? (taskData.allowResubmission !== false) : true;
    const maxResubmissions = taskData ? Number(taskData.maxResubmissions || 2) : 2;
    const currentVersion = Number(sub.submissionVersion || 1);

    const canResubmit = allowResubmission && currentVersion <= maxResubmissions;

    await updateDoc(subRef, {
      status: 'REJECTED',
      rejectionReason,
      adminNote: adminNote || '',
      reviewedAt: nowIso,
      reviewedBy: adminUsername,
      rejectedAt: nowIso,
      rejectedBy: adminUsername
    });

    // Update attempt status
    const attemptId = sub.attemptId || `${tgUserId}_${sub.taskId}`;
    const attemptRef = doc(db, 'taskAttempts', attemptId);
    await setDoc(attemptRef, {
      id: attemptId,
      earningBotId: botId,
      accountScope: 'ROY_SHARE_WALLET',
      taskId: sub.taskId,
      telegramUserId: tgUserId,
      userId: sub.userId || tgUserId,
      status: canResubmit ? 'RESUBMISSION_AVAILABLE' : 'REJECTED',
      submissionId,
      updatedAt: nowIso
    }, { merge: true });

    // Send Telegram Notification to user using submission identity directly
    if (bot && bot.token && tgUserId) {
      const resubmitNotice = canResubmit ? `\n\n🔄 <b>Resubmission Available:</b> You can upload a new proof screenshot from the app.` : '';
      await sendTelegramApi(bot.token, 'sendMessage', {
        chat_id: tgUserId,
        text: `❌ <b>TASK REJECTED</b>\n\n` +
          `Task: <b>${sub.taskTitle}</b>\n\n` +
          `<b>Reason:</b>\n${rejectionReason}\n` +
          (adminNote ? `<b>Admin Note:</b> ${adminNote}\n` : '') +
          `No reward was credited.${resubmitNotice}`,
        parse_mode: 'HTML',
      }).catch(() => {});
    }

    // Update Telegram Admin Group message caption
    if (bot && bot.token && sub.adminGroupChatId && sub.adminGroupMessageId) {
      const updatedCaption =
        `📋 <b>TASK PROOF SUBMISSION (REJECTED ❌)</b>\n\n` +
        `Task: ${sub.taskTitle}\n` +
        `💰 Reward: ₹${sub.reward}\n` +
        `📱 Registration Mobile: ${sub.registrationMobile}\n` +
        `👤 Telegram Username: @${sub.telegramUsername || 'N/A'}\n` +
        `🆔 Telegram ID: ${sub.telegramUserId}\n` +
        `👤 Full Name: ${sub.userFullName || 'N/A'}\n` +
        `🆔 User UID: ${sub.userAppUid || sub.uid || sub.userId}\n\n` +
        `📌 <b>Status: REJECTED ❌ by ${adminUsername}</b>\n` +
        `<b>Reason:</b> ${rejectionReason}` +
        (adminNote ? `\n📝 <b>Note:</b> ${adminNote}` : '');

      await sendTelegramApi(bot.token, 'editMessageCaption', {
        chat_id: sub.adminGroupChatId,
        message_id: sub.adminGroupMessageId,
        caption: updatedCaption,
        parse_mode: 'HTML',
        reply_markup: JSON.stringify({
          inline_keyboard: [[{ text: '❌ REJECTED', callback_data: 'none' }]]
        })
      }).catch(async () => {
        await sendTelegramApi(bot.token, 'editMessageText', {
          chat_id: sub.adminGroupChatId,
          message_id: sub.adminGroupMessageId,
          text: updatedCaption,
          parse_mode: 'HTML',
          reply_markup: JSON.stringify({
            inline_keyboard: [[{ text: '❌ REJECTED', callback_data: 'none' }]]
          })
        }).catch(() => {});
      });
    }

    return { success: true };
  } catch (err: any) {
    console.error('Error rejecting manual task submission:', err);
    return { success: false, error: err.message || 'Failed to reject submission' };
  }
}
