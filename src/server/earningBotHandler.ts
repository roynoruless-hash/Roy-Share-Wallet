import { collection, query, where, getDocs, addDoc, doc, getDoc, runTransaction, setDoc, limit, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { recordWalletTransaction } from './transactionService';
import { sendTelegramApi } from './botHandler';

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
    if (update.message) {
      const message = update.message;
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

      // Default fallback for active users or unregistered
      const userDoc = await getEarningUser(bot.botId, userId);
      if (userDoc) {
        await sendTelegramApi(token, 'sendMessage', {
          chat_id: chatId,
          text: `🤖 <b>Hello, ${userDoc.firstName}!</b>\n\nHow can I help you today? Please use the menu below.`,
          parse_mode: 'HTML',
          reply_markup: buildUserMenuMarkup(),
        });
      } else {
        await handleStartCommand(bot, message, '/start', sessionRef);
      }
    } else if (update.callback_query) {
      const callback = update.callback_query;
      const chatId = String(callback.message.chat.id);
      const userId = String(callback.from?.id || chatId);
      const data = String(callback.data);

      await sendTelegramApi(bot.token, 'answerCallbackQuery', {
        callback_query_id: callback.id,
      });

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
          chat_id: chatId,
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
 * Handle /start and Referral Tracking
 */
async function handleStartCommand(bot: any, message: any, text: string, sessionRef: any) {
  const token = bot.token;
  const chatId = String(message.chat.id);
  const userId = String(message.from?.id || chatId);
  const firstName = message.from?.first_name || 'User';
  const username = message.from?.username || '';

  // Check if already registered
  const userDoc = await getEarningUser(bot.botId, userId);
  if (userDoc) {
    if (userDoc.status === 'BANNED') {
      await sendTelegramApi(token, 'sendMessage', {
        chat_id: chatId,
        text: `🚫 <b>Your account has been suspended.</b>\n\nContact Admin.`,
        parse_mode: 'HTML',
      });
      return;
    }
    await sendTelegramApi(token, 'sendMessage', {
      chat_id: chatId,
      text: `👋 <b>Welcome back, ${userDoc.firstName}!</b>\n\n👛 <b>Wallet Balance:</b> ₹${userDoc.walletBalance || 0}`,
      parse_mode: 'HTML',
      reply_markup: buildUserMenuMarkup(),
    });
    return;
  }

  // Parse deep link referrer code (ref_CODE)
  let referrerUid = '';
  if (text.includes('start=')) {
    const payload = text.split('start=')[1] || '';
    if (payload.startsWith('ref_')) {
      referrerUid = payload.substring(4).trim();
    }
  }

  // Create or update pending session
  const sessionSnap = await getDoc(sessionRef);
  let savedReferrer = referrerUid;
  if (sessionSnap.exists()) {
    const sData = sessionSnap.data() as any;
    // Referral relationship is immutable after creation
    if (sData?.referrerUid) {
      savedReferrer = sData.referrerUid;
    }
  }

  await setDoc(sessionRef, {
    botId: bot.botId,
    telegramId: userId,
    firstName,
    username,
    referrerUid: savedReferrer,
    channelVerified: false,
    groupVerified: false,
    contactVerified: false,
    updatedAt: new Date().toISOString(),
  }, { merge: true });

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
    chat_id: chatId,
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
      chat_id: chatId,
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
    chat_id: chatId,
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
 * Handle contact sharing
 */
async function handleContactSharing(bot: any, message: any, sessionRef: any) {
  const chatId = String(message.chat.id);
  const userId = String(message.from?.id || chatId);
  const contact = message.contact;

  const contactUserId = String(contact.user_id || '');
  if (contactUserId !== userId) {
    await sendTelegramApi(bot.token, 'sendMessage', {
      chat_id: chatId,
      text: `❌ <b>This contact does not belong to your Telegram account.</b>\n\nDo not share someone else's contact.`,
      parse_mode: 'HTML',
    });
    return;
  }

  const phone = String(contact.phone_number).replace(/[^0-9]/g, '');

  await setDoc(sessionRef, {
    contactVerified: true,
    phone,
    updatedAt: new Date().toISOString(),
  }, { merge: true });

  const baseUrl = (process.env.PUBLIC_APP_URL || process.env.APP_URL || 'https://roy-share-wallet.onrender.com').replace(/\/$/, '');
  const miniAppUrl = `${baseUrl}/?action=register&botId=${bot.botId}&tgId=${userId}`;

  await sendTelegramApi(bot.token, 'sendMessage', {
    chat_id: chatId,
    text: `✅ <b>Contact Shared Successfully!</b>\n\nTap the button below to open the Mini App and complete registration securely.`,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [{
          text: '🚀 OPEN MINI APP',
          web_app: { url: miniAppUrl },
        }]
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
function buildUserMenuMarkup() {
  return {
    keyboard: [
      [{ text: '👤 ACCOUNT' }, { text: '💰 BALANCE' }],
      [{ text: '🎁 REFER & EARN' }, { text: '💸 WITHDRAW' }],
      [{ text: '📊 HISTORY' }, { text: '☎ Contact Us' }]
    ],
    resize_keyboard: true,
  };
}

/**
 * Interactive Account Screen
 */
async function handleShowAccount(bot: any, userId: string) {
  const user = await getEarningUser(bot.botId, userId);
  if (!user) return;

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
  if (!user) return;

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
  if (!user) return;

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
    `For any queries or issues regarding <b>@${bot.botUsername}</b>, please contact our support team:\n\n` +
    `• <b>Telegram Admin:</b> @Roy_Support_Agent\n` +
    `• <b>Email:</b> support@roysharewallet.com\n\n` +
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
  if (!user) return;

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
    const bal = user?.walletBalance || 0;

    if (amount > bal) {
      await sendTelegramApi(bot.token, 'sendMessage', {
        chat_id: userId,
        text: `❌ <b>Insufficient balance!</b>\n\n• Your balance: ₹${bal}\n• Attempted: ₹${amount}\n\nPlease enter a lower amount:`,
        parse_mode: 'HTML',
      });
      return;
    }

    if (amount < bot.minWithdrawal) {
      await sendTelegramApi(bot.token, 'sendMessage', {
        chat_id: userId,
        text: `❌ <b>Minimum withdrawal threshold is ₹${bot.minWithdrawal}.</b>\n\nPlease enter a higher amount:`,
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

      // Update user balances
      transaction.update(userRef, {
        walletBalance: currentBal - totalDeduction,
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
