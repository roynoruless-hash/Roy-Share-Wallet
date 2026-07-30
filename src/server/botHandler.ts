import { collection, query, where, getDocs, addDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

interface UserSession {
  step: 'FORCE_JOIN' | 'WAITING_NAME' | 'WAITING_MOBILE' | 'WAITING_CONTACT';
  fullName?: string;
  mobile?: string;
  channelVerified?: boolean;
  groupVerified?: boolean;
}

// In-memory session state store for onboarding users
const userSessions: Map<string, UserSession> = new Map();

/**
 * Fetch bot admin configuration from Firestore
 */
async function getAdminConfig() {
  try {
    const configDoc = await getDoc(doc(db, 'settings', 'admin_config'));
    if (configDoc.exists()) {
      return configDoc.data();
    }
  } catch (err) {
    console.warn('Failed to load admin_config from Firestore:', err);
  }
  return {
    mainChannelUsername: 'RoyShareChannel',
    mainGroupUsername: 'RoyShareGroup',
    registrationBonus: 0,
    referralBonus: 5,
    rewardPerReferral: 5,
    minWithdrawal: 100,
    maxWithdrawal: 10000,
    processingTimeNotice: 'Withdrawal requests are processed within 24 hours.',
    supportUsername: 'RoyShareSupport',
    supportGroup: 'RoyShareGroup',
  };
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

  const adminConfig = await getAdminConfig();

  // 1. HANDLE CALLBACK QUERIES (Inline Buttons like "Verify Join")
  if (update.callback_query) {
    const cb = update.callback_query;
    const chatId = String(cb.message?.chat?.id || cb.from?.id);
    const cbId = cb.id;
    const data = cb.data;

    if (data === 'check_membership') {
      const channelUsername = adminConfig.mainChannelUsername || 'RoyShareChannel';
      const groupUsername = adminConfig.mainGroupUsername || 'RoyShareGroup';

      const channelJoined = await checkChatMember(token, channelUsername, chatId);
      const groupJoined = await checkChatMember(token, groupUsername, chatId);

      if (channelJoined && groupJoined) {
        userSessions.set(chatId, {
          step: 'WAITING_NAME',
          channelVerified: true,
          groupVerified: true,
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
        if (!channelJoined) missing.push(`Channel (@${channelUsername.replace('@', '')})`);
        if (!groupJoined) missing.push(`Group (@${groupUsername.replace('@', '')})`);

        await sendTelegramApi(token, 'answerCallbackQuery', {
          callback_query_id: cbId,
          text: `❌ Verification Failed! You have not joined: ${missing.join(' and ')}`,
          show_alert: true,
        });
      }
    }
    return;
  }

  // 2. HANDLE MESSAGES
  const message = update.message || update.edited_message;
  if (!message) return;

  const chatId = String(message.chat.id);
  const text = message.text ? message.text.trim() : '';
  const contact = message.contact;

  // Query database to see if user is already registered
  const existingUser = await getUserByTelegramId(chatId);

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

    // Requirement 1: If user NOT in DB -> Start Onboarding Flow
    userSessions.set(chatId, { step: 'FORCE_JOIN' });

    const channelUsername = (adminConfig.mainChannelUsername || 'RoyShareChannel').replace('@', '');
    const groupUsername = (adminConfig.mainGroupUsername || 'RoyShareGroup').replace('@', '');

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
          `📉 <b>Minimum Withdrawal:</b> ₹${adminConfig.minWithdrawal || 100}\n` +
          `📈 <b>Maximum Withdrawal:</b> ₹${adminConfig.maxWithdrawal || 10000}\n\n` +
          `ℹ <b>Notice:</b> ${adminConfig.processingTimeNotice || 'Withdrawal requests are processed within 24 hours.'}`,
        parse_mode: 'HTML',
      });
      return;
    }

    if (text === '🎁 Refer & Earn') {
      // Get bot username dynamically or fallback
      let botUser = adminConfig.botUsername || '';
      if (!botUser) {
        const getMe = await sendTelegramApi(token, 'getMe', {});
        if (getMe && getMe.ok) {
          botUser = getMe.result.username;
        }
      }
      botUser = botUser.replace('@', '');

      await sendTelegramApi(token, 'sendMessage', {
        chat_id: chatId,
        text: `🎁 <b>Refer & Earn</b>\n\n` +
          `Earn ₹${adminConfig.rewardPerReferral || adminConfig.referralBonus || 5} for every friend you invite!\n\n` +
          `🔗 <b>Your Referral Link:</b>\n` +
          `<code>https://t.me/${botUser || 'RoyShareWalletBot'}?start=${existingUser.uid}</code>`,
        parse_mode: 'HTML',
      });
      return;
    }

    if (text === '☎ Contact Us') {
      const supportUsername = (adminConfig.supportUsername || 'RoyShareSupport').replace('@', '');
      const supportGroup = (adminConfig.supportGroup || 'RoyShareGroup').replace('@', '');

      await sendTelegramApi(token, 'sendMessage', {
        chat_id: chatId,
        text: `☎ <b>Contact Support</b>\n\n` +
          `For assistance or inquiries, please contact:\n` +
          `💬 <b>Support Admin:</b> @${supportUsername}\n` +
          `👥 <b>Support Group:</b> @${supportGroup}`,
        parse_mode: 'HTML',
      });
      return;
    }
  }

  // C. ONBOARDING SESSION FLOW
  const session = userSessions.get(chatId);

  // If no session exists and user is not registered, start onboarding
  if (!session && !existingUser) {
    userSessions.set(chatId, { step: 'FORCE_JOIN' });
    const channelUsername = (adminConfig.mainChannelUsername || 'RoyShareChannel').replace('@', '');
    const groupUsername = (adminConfig.mainGroupUsername || 'RoyShareGroup').replace('@', '');

    await sendTelegramApi(token, 'sendMessage', {
      chat_id: chatId,
      text: `👋 Please complete onboarding first!\n\nJoin Channel: @${channelUsername}\nJoin Group: @${groupUsername}`,
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
    const channelUsername = (adminConfig.mainChannelUsername || 'RoyShareChannel').replace('@', '');
    const groupUsername = (adminConfig.mainGroupUsername || 'RoyShareGroup').replace('@', '');

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
      // User entered text instead of pressing Share Contact button
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

    // REQUIREMENT 9: CREATE USER ACCOUNT & WALLET IN FIRESTORE
    const uid = await generateUniqueUid();
    const bonus = Number(adminConfig.registrationBonus) || 0;

    const newUserData = {
      uid,
      telegramId: String(chatId),
      username: message.from.username ? `@${message.from.username.replace('@', '')}` : '',
      firstName: session.fullName || message.from.first_name || 'User',
      mobile: enteredDigits,
      walletBalance: bonus,
      channelVerified: session.channelVerified ?? true,
      groupVerified: session.groupVerified ?? true,
      createdAt: new Date().toISOString(),
    };

    try {
      await addDoc(collection(db, 'users'), newUserData);
    } catch (dbErr) {
      console.error('Failed to create user account in Firestore:', dbErr);
    }

    // Clear session
    userSessions.delete(chatId);

    // REQUIREMENT 10: SHOW SUCCESS MESSAGE
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

    // REQUIREMENT 11: SHOW MAIN MENU
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
