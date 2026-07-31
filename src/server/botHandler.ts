import { collection, query, where, getDocs, addDoc, doc, getDoc, runTransaction } from 'firebase/firestore';
import { db } from '../services/firebase';

interface UserSession {
  step: 'FORCE_JOIN' | 'WAITING_NAME' | 'WAITING_MOBILE' | 'WAITING_CONTACT';
  fullName?: string;
  mobile?: string;
  channelVerified?: boolean;
  groupVerified?: boolean;
  referrerUid?: string;
}

// In-memory session state store for onboarding users
const userSessions: Map<string, UserSession> = new Map();

/**
 * Fetch bot admin configuration dynamically from Firestore settings/config
 */
async function getAdminConfig(): Promise<Record<string, any> | null> {
  try {
    const configDoc = await getDoc(doc(db, 'settings', 'config'));
    if (configDoc.exists()) {
      const data = configDoc.data() || {};
      const channel = data.mainChannelUsername ? String(data.mainChannelUsername).trim() : '';
      const group = data.mainGroupUsername ? String(data.mainGroupUsername).trim() : '';

      console.log(`Loaded Channel: ${channel}`);
      console.log(`Loaded Group: ${group}`);

      return {
        ...data,
        mainChannelUsername: channel,
        mainGroupUsername: group,
        forceJoinEnabled: data.forceJoinEnabled !== undefined ? Boolean(data.forceJoinEnabled) : true,
        autoVerificationEnabled: data.autoVerificationEnabled !== undefined ? Boolean(data.autoVerificationEnabled) : true,
      };
    }
  } catch (err) {
    console.warn('Failed to load settings/config from Firestore:', err);
  }

  console.log('Loaded Channel:');
  console.log('Loaded Group:');
  return null;
}

/**
 * Query user document from Firestore by Telegram ID
 */
export async function getUserByTelegramId(telegramId: string) {
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('telegramId', '==', String(telegramId)));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const docSnap = querySnapshot.docs[0];
      return { id: docSnap.id, ...docSnap.data() } as any;
    }
  } catch (err) {
    console.error('Error fetching user by telegramId:', err);
  }
  return null;
}

/**
 * Query user document from Firestore by unique UID
 */
export async function getUserByUid(uid: string) {
  if (!uid) return null;
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('uid', '==', String(uid).trim()));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const docSnap = querySnapshot.docs[0];
      return { id: docSnap.id, ...docSnap.data() } as any;
    }
  } catch (err) {
    console.error('Error fetching user by uid:', err);
  }
  return null;
}

/**
 * Generate a unique 6-digit numeric UID
 */
async function generateUniqueUid(): Promise<string> {
  let uid = '';
  let exists = true;
  let attempts = 0;

  while (exists && attempts < 10) {
    uid = Math.floor(100000 + Math.random() * 900000).toString();
    attempts++;
    try {
      const q = query(collection(db, 'users'), where('uid', '==', uid));
      const snap = await getDocs(q);
      if (snap.empty) {
        exists = false;
      }
    } catch (e) {
      exists = false;
    }
  }
  return uid || String(Date.now()).slice(-6);
}

/**
 * Send Telegram message helper
 */
async function sendTelegramApi(token: string, method: string, payload: any) {
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return await response.json();
  } catch (err) {
    console.error(`Telegram API error (${method}):`, err);
    return null;
  }
}

/**
 * Check if user is member of a Telegram channel/group
 */
async function checkChatMember(token: string, chatIdOrUsername: string, userId: string | number): Promise<boolean> {
  if (!chatIdOrUsername) return true;

  let cleanChat = chatIdOrUsername.trim();
  if (!cleanChat.startsWith('@') && !cleanChat.startsWith('-')) {
    cleanChat = `@${cleanChat}`;
  }

  const res = await sendTelegramApi(token, 'getChatMember', {
    chat_id: cleanChat,
    user_id: userId,
  });

  if (res && res.ok && res.result) {
    const status = res.result.status;
    return ['creator', 'administrator', 'member'].includes(status) || (status === 'restricted' && res.result.is_member === true);
  }
  return false;
}

/**
 * Main Telegram Webhook Update Processor
 */
export async function processTelegramUpdate(token: string, update: any) {
  if (!token || !update) return;

  // 1. IGNORE EDITED MESSAGES, CHANNEL POSTS, AND NON-PRIVATE UPDATES
  if (update.edited_message || update.channel_post || update.edited_channel_post || update.my_chat_member || update.chat_member) {
    console.log('Ignored Group Update');
    return;
  }

  // 2. HANDLE CALLBACK QUERIES (Inline Buttons like "Verify Join")
  if (update.callback_query) {
    const cb = update.callback_query;
    const chatType = cb.message?.chat?.type;

    // Reject callback queries from groups, supergroups, or channels
    if (chatType !== 'private') {
      console.log('Ignored Group Update');
      return;
    }

    const chatId = String(cb.message?.chat?.id || cb.from?.id);
    const cbId = cb.id;
    const data = cb.data;

    if (data === 'check_membership') {
      const adminConfig = await getAdminConfig();

      if (!adminConfig || !adminConfig.mainChannelUsername || !adminConfig.mainGroupUsername) {
        await sendTelegramApi(token, 'answerCallbackQuery', {
          callback_query_id: cbId,
          text: 'Configuration Missing',
          show_alert: true,
        });
        return;
      }

      const channelUsername = adminConfig.mainChannelUsername.replace(/^@/, '');
      const groupUsername = adminConfig.mainGroupUsername.replace(/^@/, '');
      const autoVerificationEnabled = adminConfig.autoVerificationEnabled !== false;

      let channelJoined = true;
      let groupJoined = true;

      if (autoVerificationEnabled) {
        channelJoined = await checkChatMember(token, channelUsername, chatId);
        groupJoined = await checkChatMember(token, groupUsername, chatId);
      }

      if (channelJoined && groupJoined) {
        const currentSess = userSessions.get(chatId);
        userSessions.set(chatId, {
          step: 'WAITING_NAME',
          channelVerified: true,
          groupVerified: true,
          referrerUid: currentSess?.referrerUid,
        });

        await sendTelegramApi(token, 'answerCallbackQuery', {
          callback_query_id: cbId,
          text: '✅ Membership Verified!',
          show_alert: false,
        });

        await sendTelegramApi(token, 'sendMessage', {
          chat_id: chatId,
          text: '✅ <b>Membership Verified!</b>\n\nLet\'s complete your registration.\n\n<b>Step 1/3:</b> Please enter your <b>Full Name</b>:',
          parse_mode: 'HTML',
        });
      } else {
        const missing = [];
        if (!channelJoined) missing.push(`Channel (@${channelUsername})`);
        if (!groupJoined) missing.push(`Group (@${groupUsername})`);

        await sendTelegramApi(token, 'answerCallbackQuery', {
          callback_query_id: cbId,
          text: `❌ Verification Failed! You have not joined: ${missing.join(' and ')}`,
          show_alert: true,
        });
      }
    }
    return;
  }

  // 3. HANDLE MESSAGES (STRICTLY PRIVATE CHAT ONLY)
  const message = update.message;
  if (!message) {
    console.log('Ignored Group Update');
    return;
  }

  // Check Chat Type - MUST be 'private'
  if (!message.chat || message.chat.type !== 'private') {
    console.log('Ignored Group Update');
    return;
  }

  // Ignore anonymous admin messages or bot messages
  if (!message.from || message.from.is_bot || message.from.id === 1087968824) {
    console.log('Ignored Group Update');
    return;
  }

  const chatId = String(message.chat.id);
  const text = message.text ? message.text.trim() : '';
  const contact = message.contact;

  // Query database to see if user is already registered
  const existingUser = await getUserByTelegramId(chatId);

  if (existingUser && (existingUser.status === 'banned' || existingUser.banned === true)) {
    await sendTelegramApi(token, 'sendMessage', {
      chat_id: chatId,
      text: `🚫 <b>Your account has been suspended.</b>\n\nContact Admin.`,
      parse_mode: 'HTML',
    });
    return;
  }

  // A. COMMAND: /start
  if (text === '/start' || text.startsWith('/start')) {
    if (existingUser) {
      // Requirement 1: If user exists in DB -> Open Main Menu
      userSessions.delete(chatId);

      await sendTelegramApi(token, 'sendMessage', {
        chat_id: chatId,
        text: `👋 <b>Welcome back, ${existingUser.firstName}!</b>\n\n` +
          `🆔 <b>UID:</b> <code>${existingUser.uid}</code>\n` +
          `📱 <b>Mobile:</b> <code>${existingUser.mobile}</code>\n` +
          `👛 <b>Wallet Balance:</b> ₹${existingUser.walletBalance || 0}`,
        parse_mode: 'HTML',
        reply_markup: {
          keyboard: [
            [{ text: '👛 Wallet' }, { text: '💸 Withdraw' }],
            [{ text: '🎁 Refer & Earn' }, { text: '☎ Contact Us' }],
          ],
          resize_keyboard: true,
        },
      });
      return;
    }

    // Parse referral parameter from command (e.g. /start 149595 or /start=149595)
    let refParam = '';
    const parts = text.split(/\s+/);
    if (parts.length > 1 && parts[1]) {
      refParam = parts[1].replace(/^(?:start=|\?start=)/i, '').trim();
    } else {
      const match = text.match(/^\/start(?:=|\?start=)?(\S+)/i);
      if (match && match[1] && match[1].toLowerCase() !== '/start') {
        refParam = match[1].trim();
      }
    }

    let referrerUid: string | undefined = undefined;
    if (refParam) {
      const referrer = await getUserByUid(refParam);
      if (referrer && String(referrer.telegramId) !== String(chatId)) {
        referrerUid = String(referrer.uid);
      }
    }

    // Load dynamic configuration from Firestore settings/config
    const adminConfig = await getAdminConfig();

    if (!adminConfig || !adminConfig.mainChannelUsername || !adminConfig.mainGroupUsername) {
      await sendTelegramApi(token, 'sendMessage', {
        chat_id: chatId,
        text: 'Configuration Missing',
        parse_mode: 'HTML',
      });
      return;
    }

    const channelUsername = adminConfig.mainChannelUsername.replace(/^@/, '');
    const groupUsername = adminConfig.mainGroupUsername.replace(/^@/, '');
    const forceJoinEnabled = adminConfig.forceJoinEnabled !== false;

    const existingSess = userSessions.get(chatId);
    const finalReferrerUid = referrerUid || existingSess?.referrerUid;

    if (!forceJoinEnabled) {
      // Skip force join if disabled
      userSessions.set(chatId, {
        step: 'WAITING_NAME',
        channelVerified: true,
        groupVerified: true,
        referrerUid: finalReferrerUid,
      });

      await sendTelegramApi(token, 'sendMessage', {
        chat_id: chatId,
        text: '👋 <b>Welcome to Roy Share Wallet Bot!</b>\n\nLet\'s complete your registration.\n\n<b>Step 1/3:</b> Please enter your <b>Full Name</b>:',
        parse_mode: 'HTML',
      });
      return;
    }

    userSessions.set(chatId, { step: 'FORCE_JOIN', referrerUid: finalReferrerUid });

    await sendTelegramApi(token, 'sendMessage', {
      chat_id: chatId,
      text: `👋 <b>Welcome to Roy Share Wallet Bot!</b>\n\n` +
        `To continue using this bot, please join our official Telegram Channel and Group:\n\n` +
        `1️⃣ Join Channel: <b>@${channelUsername}</b>\n` +
        `2️⃣ Join Group: <b>@${groupUsername}</b>\n\n` +
        `After joining both, click the <b>Verify Join</b> button below.`,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📢 Join Channel', url: `https://t.me/${channelUsername}` },
            { text: '👥 Join Group', url: `https://t.me/${groupUsername}` },
          ],
          [
            { text: '✅ Verify Join', callback_data: 'check_membership' },
          ],
        ],
      },
    });
    return;
  }

  // B. MAIN MENU BUTTON CLICK FOR EXISTING REGISTERED USERS
  if (existingUser) {
    const adminConfig = await getAdminConfig();

    if (text === '👛 Wallet') {
      await sendTelegramApi(token, 'sendMessage', {
        chat_id: chatId,
        text: `👛 <b>My Wallet</b>\n\n` +
          `👤 <b>Name:</b> ${existingUser.firstName}\n` +
          `🆔 <b>UID:</b> <code>${existingUser.uid}</code>\n` +
          `📱 <b>Mobile:</b> <code>${existingUser.mobile}</code>\n` +
          `💰 <b>Balance:</b> ₹${existingUser.walletBalance || 0}`,
        parse_mode: 'HTML',
      });
      return;
    }

    if (text === '💸 Withdraw') {
      await sendTelegramApi(token, 'sendMessage', {
        chat_id: chatId,
        text: `💸 <b>Withdraw Funds</b>\n\n` +
          `💰 <b>Current Balance:</b> ₹${existingUser.walletBalance || 0}\n` +
          `📉 <b>Minimum Withdrawal:</b> ₹${adminConfig?.minWithdrawal ?? 100}\n` +
          `📈 <b>Maximum Withdrawal:</b> ₹${adminConfig?.maxWithdrawal ?? 10000}\n\n` +
          `ℹ <b>Notice:</b> ${adminConfig?.processingTimeNotice || 'Withdrawal requests are processed within 24 hours.'}`,
        parse_mode: 'HTML',
      });
      return;
    }

    if (text === '🎁 Refer & Earn') {
      let botUser = adminConfig?.botUsername || '';
      if (!botUser) {
        const getMe = await sendTelegramApi(token, 'getMe', {});
        if (getMe && getMe.ok) {
          botUser = getMe.result.username;
        }
      }
      botUser = botUser.replace(/^@/, '');

      const rewardRate = Number(adminConfig?.rewardPerReferral ?? adminConfig?.referralBonus ?? 5);
      const totalRefs = Number(existingUser.totalReferrals ?? existingUser.successfulReferrals ?? 0);
      const successRefs = Number(existingUser.successfulReferrals ?? existingUser.totalReferrals ?? 0);
      const totalEarned = existingUser.totalReferralEarnings !== undefined
        ? Number(existingUser.totalReferralEarnings)
        : (successRefs * rewardRate);

      await sendTelegramApi(token, 'sendMessage', {
        chat_id: chatId,
        text: `🎁 <b>Refer & Earn</b>\n\n` +
          `Earn <b>₹${rewardRate}</b> for every friend you invite!\n\n` +
          `🔗 <b>Your Referral Link:</b>\n` +
          `<code>https://t.me/${botUser || 'RoyShareWalletBot'}?start=${existingUser.uid}</code>\n\n` +
          `📊 <b>Your Referral Stats:</b>\n` +
          `👥 <b>Referral Count:</b> ${totalRefs}\n` +
          `✅ <b>Successful Referrals:</b> ${successRefs}\n` +
          `💰 <b>Total Reward Earned:</b> ₹${totalEarned}\n` +
          `🎁 <b>Current Referral Reward:</b> ₹${rewardRate}`,
        parse_mode: 'HTML',
      });
      return;
    }

    if (text === '☎ Contact Us') {
      const supportUsername = (adminConfig?.supportUsername || '').replace(/^@/, '');
      const supportGroup = (adminConfig?.supportGroup || '').replace(/^@/, '');

      let supportText = `☎ <b>Contact Support</b>\n\nFor assistance or inquiries, please contact:\n`;
      if (supportUsername) supportText += `💬 <b>Support Admin:</b> @${supportUsername}\n`;
      if (supportGroup) supportText += `👥 <b>Support Group:</b> @${supportGroup}\n`;
      if (!supportUsername && !supportGroup) supportText += `Please check back later or reach out in the main group.`;

      await sendTelegramApi(token, 'sendMessage', {
        chat_id: chatId,
        text: supportText,
        parse_mode: 'HTML',
      });
      return;
    }
  }

  // C. ONBOARDING SESSION FLOW
  const session = userSessions.get(chatId);

  // If no session exists and user is not registered, start onboarding
  if (!session && !existingUser) {
    const adminConfig = await getAdminConfig();

    if (!adminConfig || !adminConfig.mainChannelUsername || !adminConfig.mainGroupUsername) {
      await sendTelegramApi(token, 'sendMessage', {
        chat_id: chatId,
        text: 'Configuration Missing',
        parse_mode: 'HTML',
      });
      return;
    }

    const channelUsername = adminConfig.mainChannelUsername.replace(/^@/, '');
    const groupUsername = adminConfig.mainGroupUsername.replace(/^@/, '');

    userSessions.set(chatId, { step: 'FORCE_JOIN' });

    await sendTelegramApi(token, 'sendMessage', {
      chat_id: chatId,
      text: `👋 Please complete onboarding first!\n\n1️⃣ Join Channel: @${channelUsername}\n2️⃣ Join Group: @${groupUsername}`,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📢 Join Channel', url: `https://t.me/${channelUsername}` },
            { text: '👥 Join Group', url: `https://t.me/${groupUsername}` },
          ],
          [
            { text: '✅ Verify Join', callback_data: 'check_membership' },
          ],
        ],
      },
    });
    return;
  }

  if (!session) return;

  // STEP 1: FORCE JOIN CHECK
  if (session.step === 'FORCE_JOIN') {
    const adminConfig = await getAdminConfig();

    if (!adminConfig || !adminConfig.mainChannelUsername || !adminConfig.mainGroupUsername) {
      await sendTelegramApi(token, 'sendMessage', {
        chat_id: chatId,
        text: 'Configuration Missing',
        parse_mode: 'HTML',
      });
      return;
    }

    const channelUsername = adminConfig.mainChannelUsername.replace(/^@/, '');
    const groupUsername = adminConfig.mainGroupUsername.replace(/^@/, '');

    await sendTelegramApi(token, 'sendMessage', {
      chat_id: chatId,
      text: `⚠️ Please click the <b>Verify Join</b> button after joining @${channelUsername} and @${groupUsername}.`,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📢 Join Channel', url: `https://t.me/${channelUsername}` },
            { text: '👥 Join Group', url: `https://t.me/${groupUsername}` },
          ],
          [
            { text: '✅ Verify Join', callback_data: 'check_membership' },
          ],
        ],
      },
    });
    return;
  }

  // STEP 2: STEP_WAITING_NAME -> Save Full Name
  if (session.step === 'WAITING_NAME') {
    if (!text || text.length < 2) {
      await sendTelegramApi(token, 'sendMessage', {
        chat_id: chatId,
        text: '❌ Please enter a valid <b>Full Name</b> (at least 2 characters):',
        parse_mode: 'HTML',
      });
      return;
    }

    session.fullName = text.trim();
    session.step = 'WAITING_MOBILE';

    await sendTelegramApi(token, 'sendMessage', {
      chat_id: chatId,
      text: `👤 <b>Full Name:</b> ${session.fullName}\n\n` +
        `<b>Step 2/3:</b> Please enter your <b>10-digit Mobile Number</b> (starts with 6, 7, 8, or 9):`,
      parse_mode: 'HTML',
    });
    return;
  }

  // STEP 3: STEP_WAITING_MOBILE -> Validate Mobile
  if (session.step === 'WAITING_MOBILE') {
    const cleanMobile = text.replace(/\D/g, '');
    const isValidIndianMobile = /^[6-9]\d{9}$/.test(cleanMobile);

    if (!isValidIndianMobile) {
      await sendTelegramApi(token, 'sendMessage', {
        chat_id: chatId,
        text: `❌ <b>Invalid Mobile Number</b>\n\n` +
          `Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9 (e.g. 9876543210):`,
        parse_mode: 'HTML',
      });
      return;
    }

    session.mobile = cleanMobile;
    session.step = 'WAITING_CONTACT';

    await sendTelegramApi(token, 'sendMessage', {
      chat_id: chatId,
      text: `📱 <b>Entered Mobile:</b> ${session.mobile}\n\n` +
        `<b>Step 3/3:</b> To verify your identity, please tap the button below to <b>Share Contact</b>.`,
      parse_mode: 'HTML',
      reply_markup: {
        keyboard: [
          [{ text: '📱 Share Contact', request_contact: true }],
        ],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    });
    return;
  }

  // STEP 4: STEP_WAITING_CONTACT -> Verify Shared Contact vs Entered Mobile
  if (session.step === 'WAITING_CONTACT') {
    if (!contact) {
      const cleanInput = text.replace(/\D/g, '');
      if (/^[6-9]\d{9}$/.test(cleanInput)) {
        session.mobile = cleanInput;
      }

      await sendTelegramApi(token, 'sendMessage', {
        chat_id: chatId,
        text: `⚠️ Please tap the <b>📱 Share Contact</b> button below to complete verification:`,
        parse_mode: 'HTML',
        reply_markup: {
          keyboard: [
            [{ text: '📱 Share Contact', request_contact: true }],
          ],
          resize_keyboard: true,
          one_time_keyboard: true,
        },
      });
      return;
    }

    const sharedDigits = contact.phone_number ? contact.phone_number.replace(/\D/g, '').slice(-10) : '';
    const enteredDigits = (session.mobile || '').replace(/\D/g, '').slice(-10);

    // Compare: Entered Number == Shared Contact Number
    if (!sharedDigits || sharedDigits !== enteredDigits) {
      session.step = 'WAITING_MOBILE';

      await sendTelegramApi(token, 'sendMessage', {
        chat_id: chatId,
        text: `❌ <b>Verification Failed</b>\n\n` +
          `The shared phone number (<code>${contact.phone_number || 'Unknown'}</code>) does NOT match the entered number (<code>${session.mobile}</code>).\n\n` +
          `Please re-enter your 10-digit mobile number:`,
        parse_mode: 'HTML',
        reply_markup: {
          remove_keyboard: true,
        },
      });
      return;
    }

    const adminConfig = await getAdminConfig();
    const uid = await generateUniqueUid();
    const bonus = Number(adminConfig?.registrationBonus) || 0;
    const referralReward = Number(adminConfig?.rewardPerReferral ?? adminConfig?.referralBonus ?? 5);

    const newUserData: Record<string, any> = {
      uid,
      telegramId: String(chatId),
      username: message.from.username ? `@${message.from.username.replace('@', '')}` : '',
      firstName: session.fullName || message.from.first_name || 'User',
      mobile: enteredDigits,
      walletBalance: bonus,
      channelVerified: session.channelVerified ?? true,
      groupVerified: session.groupVerified ?? true,
      createdAt: new Date().toISOString(),
      referrerUid: session.referrerUid || null,
      referredBy: session.referrerUid || null,
      referralRewardReceived: false,
      totalReferrals: 0,
      successfulReferrals: 0,
      totalReferralEarnings: 0,
    };

    let newUserDocRef;
    try {
      newUserDocRef = await addDoc(collection(db, 'users'), newUserData);
    } catch (dbErr) {
      console.error('Failed to create user account in Firestore:', dbErr);
    }

    // Create pending referral token for Anti Self-Referral Verification
    if (newUserDocRef && session.referrerUid && session.referrerUid !== uid) {
      try {
        const uniqueToken = 'ref_' + Date.now() + '_' + Math.random().toString(36).substring(2, 10);
        
        await addDoc(collection(db, 'referralTokens'), {
          token: uniqueToken,
          referrerUid: String(session.referrerUid),
          referredUid: String(uid),
          referredTelegramId: String(chatId),
          referredName: newUserData.firstName,
          status: 'pending',
          createdAt: new Date().toISOString(),
        });

        // Determine domain URL for verification link
        const hostUrl = process.env.APP_URL || 'https://ais-dev-iecssl5uoae4d72ttmqrhh-963220536272.asia-southeast1.run.app';
        const verifyUrl = `${hostUrl.replace(/\/$/, '')}/referral-verify?token=${uniqueToken}`;

        // Send Anti Self-Referral Verification Link to User
        await sendTelegramApi(token, 'sendMessage', {
          chat_id: chatId,
          text: `🔗 <b>Referral Device Verification Required</b>\n\n` +
            `To complete your referral and credit rewards, please verify your device by tapping the link below:\n\n` +
            `<code>${verifyUrl}</code>\n\n` +
            `<i>Note: Self-referrals and multiple accounts on the same device are strictly prohibited.</i>`,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '🛡️ Verify Referral Device', url: verifyUrl },
              ],
            ],
          },
        });

        // Add log entry
        try {
          await addDoc(collection(db, 'logs'), {
            type: 'referral_verification_sent',
            message: `Pending referral token ${uniqueToken} created for referred UID #${uid} (Referrer: UID #${session.referrerUid}). Verification link sent.`,
            timestamp: new Date().toISOString(),
            details: {
              token: uniqueToken,
              referrerUid: session.referrerUid,
              referredUid: uid,
            },
          });
        } catch (logErr) {
          console.warn('Failed to add referral token log:', logErr);
        }
      } catch (refErr) {
        console.error('Error creating referral verification token:', refErr);
      }
    }

    // Clear session
    userSessions.delete(chatId);

    // SHOW SUCCESS MESSAGE
    await sendTelegramApi(token, 'sendMessage', {
      chat_id: chatId,
      text: `🎉 <b>Registration Successful</b>\n\n` +
        `Wallet Created Successfully!\n\n` +
        `🆔 <b>UID:</b> <code>${uid}</code>\n` +
        `👛 <b>Balance:</b> ₹${bonus}`,
      parse_mode: 'HTML',
      reply_markup: {
        remove_keyboard: true,
      },
    });

    // SHOW MAIN MENU
    await sendTelegramApi(token, 'sendMessage', {
      chat_id: chatId,
      text: ` Welcome to <b>Roy Share Wallet Bot</b>! Use the menu below to navigate:`,
      parse_mode: 'HTML',
      reply_markup: {
        keyboard: [
          [{ text: '👛 Wallet' }, { text: '💸 Withdraw' }],
          [{ text: '🎁 Refer & Earn' }, { text: '☎ Contact Us' }],
        ],
        resize_keyboard: true,
      },
    });
  }
}
