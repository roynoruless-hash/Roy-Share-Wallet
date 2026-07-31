import { collection, query, where, getDocs, addDoc, doc, getDoc, runTransaction, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { recordWalletTransaction } from './transactionService';
import { getContests, getContestants, submitVote } from '../services/contestService';

interface UserSession {
  step: 'FORCE_JOIN' | 'WAITING_NAME' | 'WAITING_MOBILE' | 'WAITING_CONTACT' | 'WITHDRAW_METHOD_SELECT' | 'WITHDRAW_AMOUNT' | 'WITHDRAW_DETAILS' | 'WITHDRAW_CONFIRM';
  fullName?: string;
  mobile?: string;
  channelVerified?: boolean;
  groupVerified?: boolean;
  referrerUid?: string;
  withdrawMethod?: 'upi' | 'qr' | 'redeem_code';
  withdrawAmount?: number;
  withdrawUpi?: string;
  withdrawQrUrl?: string;
  withdrawRedeemDetails?: string;
  // Verification Cache
  verifiedChannels?: string[];
  verifiedGroups?: string[];
  lastVerificationTime?: string;
  verificationVersion?: number;
  lastJoinMessageSentTime?: number;
}

// In-memory session state store for onboarding users
const userSessions: Map<string, UserSession> = new Map();

interface TelegramChannelGroupRecord {
  id: string;
  type: 'channel' | 'group';
  username: string;
  chatId?: string;
  displayName: string;
  required: boolean;
  active: boolean;
  position: number;
}

/**
 * Fetch all active Telegram channels and groups from Firestore collection 'telegramChannels'
 */
async function getActiveChannelsAndGroups(): Promise<TelegramChannelGroupRecord[]> {
  try {
    const colRef = collection(db, 'telegramChannels');
    const q = query(colRef, where('active', '==', true));
    const snap = await getDocs(q);

    if (!snap.empty) {
      const items: TelegramChannelGroupRecord[] = [];
      snap.forEach((docSnap) => {
        const d = docSnap.data();
        items.push({
          id: docSnap.id,
          type: d.type === 'group' ? 'group' : 'channel',
          username: d.username ? String(d.username).trim() : '',
          chatId: d.chatId ? String(d.chatId).trim() : '',
          displayName: d.displayName ? String(d.displayName).trim() : (d.type === 'group' ? 'Group' : 'Channel'),
          required: d.required !== false,
          active: d.active !== false,
          position: typeof d.position === 'number' ? d.position : 0,
        });
      });
      items.sort((a, b) => a.position - b.position);
      if (items.length > 0) {
        return items;
      }
    }
  } catch (err) {
    console.warn('Error fetching telegramChannels collection:', err);
  }

  // Fallback to settings/config if collection is empty
  const adminConfig = await getAdminConfig();
  if (adminConfig && (adminConfig.mainChannelUsername || adminConfig.mainGroupUsername)) {
    const fallbackList: TelegramChannelGroupRecord[] = [];
    if (adminConfig.mainChannelUsername) {
      fallbackList.push({
        id: 'legacy_channel',
        type: 'channel',
        username: adminConfig.mainChannelUsername,
        chatId: adminConfig.mainChannelUsername,
        displayName: 'Main Channel',
        required: true,
        active: true,
        position: 0,
      });
    }
    if (adminConfig.mainGroupUsername) {
      fallbackList.push({
        id: 'legacy_group',
        type: 'group',
        username: adminConfig.mainGroupUsername,
        chatId: adminConfig.mainGroupUsername,
        displayName: 'Main Group',
        required: true,
        active: true,
        position: 1,
      });
    }
    return fallbackList;
  }

  return [];
}

/**
 * Build force join inline keyboard buttons for active channels & groups
 */
function buildForceJoinKeyboard(channels: TelegramChannelGroupRecord[]) {
  const inline_keyboard: any[][] = [];

  channels.forEach((item) => {
    const cleanUser = item.username.replace(/^@/, '');
    const icon = item.type === 'channel' ? '📢' : '👥';
    const label = `${icon} Join ${item.displayName || (item.type === 'channel' ? 'Channel' : 'Group')}`;
    const url = cleanUser ? `https://t.me/${cleanUser}` : `https://t.me/`;

    inline_keyboard.push([{ text: label, url }]);
  });

  inline_keyboard.push([{ text: '✅ Verify Join', callback_data: 'check_membership' }]);

  return { inline_keyboard };
}

/**
 * Build force join html message text
 */
function buildForceJoinText(channels: TelegramChannelGroupRecord[], isReverification = false) {
  let text = '';

  if (isReverification) {
    text = `⚠️ <b>Join Verification Required!</b>\n\nPlease join the required channels and groups below to continue using the bot:\n\n`;
  } else {
    text = `👋 <b>Welcome to Roy Share Wallet Bot!</b>\n\nTo continue using this bot, please join our official channels and groups:\n\n`;
  }

  const channelsList = channels.filter((c) => c.type === 'channel');
  const groupsList = channels.filter((c) => c.type === 'group');

  if (channelsList.length > 0) {
    text += `<b>📢 Channels:</b>\n`;
    channelsList.forEach((c) => {
      const formatted = c.username.startsWith('@') ? c.username : `@${c.username}`;
      text += `❌ ${c.displayName}: <b>${formatted}</b>\n`;
    });
    text += `\n`;
  }

  if (groupsList.length > 0) {
    text += `<b>👥 Groups:</b>\n`;
    groupsList.forEach((g) => {
      const formatted = g.username.startsWith('@') ? g.username : `@${g.username}`;
      text += `❌ ${g.displayName}: <b>${formatted}</b>\n`;
    });
    text += `\n`;
  }

  text += `After joining all required chats, click <b>✅ Verify Join</b> below or send any command again to verify.`;
  return text;
}

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
 * Verify if the user is a member of all active required channels/groups
 */
async function verifyUserSmartJoin(
  token: string,
  chatId: string,
  existingUser: any
): Promise<{ verified: boolean; missingItems: TelegramChannelGroupRecord[] }> {
  const adminConfig = await getAdminConfig();
  const forceJoinEnabled = adminConfig?.forceJoinEnabled !== false;

  if (!forceJoinEnabled) {
    return { verified: true, missingItems: [] };
  }

  const activeItems = await getActiveChannelsAndGroups();
  const requiredItems = activeItems.filter((i) => i.required !== false && i.active !== false);

  if (requiredItems.length === 0) {
    return { verified: true, missingItems: [] };
  }

  const targetVersion = adminConfig?.verificationVersion || 1;

  // Fetch lists of already verified items
  let verifiedChannels: string[] = [];
  let verifiedGroups: string[] = [];
  let userVersion = 0;

  if (existingUser) {
    verifiedChannels = Array.isArray(existingUser.verifiedChannels) ? existingUser.verifiedChannels : [];
    verifiedGroups = Array.isArray(existingUser.verifiedGroups) ? existingUser.verifiedGroups : [];
    userVersion = Number(existingUser.verificationVersion) || 0;
  } else {
    const session = userSessions.get(chatId);
    if (session) {
      verifiedChannels = Array.isArray(session.verifiedChannels) ? session.verifiedChannels : [];
      verifiedGroups = Array.isArray(session.verifiedGroups) ? session.verifiedGroups : [];
      userVersion = Number(session.verificationVersion) || 0;
    }
  }

  // If user is already verified on the latest version, return verified: true
  if (userVersion >= targetVersion) {
    return { verified: true, missingItems: [] };
  }

  const missingItems: TelegramChannelGroupRecord[] = [];
  let newlyVerifiedChannels = [...verifiedChannels];
  let newlyVerifiedGroups = [...verifiedGroups];
  let updated = false;

  for (const item of requiredItems) {
    const targetKey = item.chatId || item.username;
    if (!targetKey) continue;

    const listToCheck = item.type === 'channel' ? verifiedChannels : verifiedGroups;
    const isAlreadyVerified = listToCheck.includes(targetKey);

    if (isAlreadyVerified) {
      continue;
    }

    const isMember = await checkChatMember(token, targetKey, chatId);
    if (isMember) {
      if (item.type === 'channel') {
        newlyVerifiedChannels.push(targetKey);
      } else {
        newlyVerifiedGroups.push(targetKey);
      }
      updated = true;
    } else {
      missingItems.push(item);
    }
  }

  // Save updated verification cache
  if (missingItems.length === 0) {
    if (existingUser) {
      try {
        const userRef = doc(db, 'users', existingUser.id);
        await setDoc(userRef, {
          verifiedChannels: newlyVerifiedChannels,
          verifiedGroups: newlyVerifiedGroups,
          verificationVersion: targetVersion,
          lastVerificationTime: new Date().toISOString(),
        }, { merge: true });
      } catch (err) {
        console.error('Failed to update user verification in Firestore:', err);
      }
    } else {
      const session = userSessions.get(chatId);
      if (session) {
        session.verifiedChannels = newlyVerifiedChannels;
        session.verifiedGroups = newlyVerifiedGroups;
        session.verificationVersion = targetVersion;
        session.lastVerificationTime = new Date().toISOString();
      }
    }
    return { verified: true, missingItems: [] };
  } else {
    if (updated) {
      if (existingUser) {
        try {
          const userRef = doc(db, 'users', existingUser.id);
          await setDoc(userRef, {
            verifiedChannels: newlyVerifiedChannels,
            verifiedGroups: newlyVerifiedGroups,
          }, { merge: true });
        } catch (err) {
          console.error('Failed to update user partial verification in Firestore:', err);
        }
      } else {
        const session = userSessions.get(chatId);
        if (session) {
          session.verifiedChannels = newlyVerifiedChannels;
          session.verifiedGroups = newlyVerifiedGroups;
        }
      }
    }
    return { verified: false, missingItems };
  }
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
      const existingUser = await getUserByTelegramId(chatId);
      const verifyRes = await verifyUserSmartJoin(token, chatId, existingUser);

      if (verifyRes.verified) {
        await sendTelegramApi(token, 'answerCallbackQuery', {
          callback_query_id: cbId,
          text: '✅ Membership Verified!',
          show_alert: false,
        });

        await sendTelegramApi(token, 'sendMessage', {
          chat_id: chatId,
          text: `✅ <b>Verification Successful!</b>`,
          parse_mode: 'HTML',
        });

        if (existingUser) {
          // Show main menu for registered user
          await sendTelegramApi(token, 'sendMessage', {
            chat_id: chatId,
            text: `👋 <b>Welcome back, ${existingUser.firstName}!</b>\n\n👛 <b>Wallet Balance:</b> ₹${existingUser.walletBalance || 0}`,
            parse_mode: 'HTML',
            reply_markup: {
              keyboard: [
                [{ text: '👛 Wallet' }, { text: '💸 Withdraw' }],
                [{ text: '🎁 Refer & Earn' }, { text: '☎ Contact Us' }],
              ],
              resize_keyboard: true,
            },
          });
        } else {
          // Onboarding registration flow for unregistered user
          const currentSess = userSessions.get(chatId);
          userSessions.set(chatId, {
            ...currentSess,
            step: 'WAITING_NAME',
            channelVerified: true,
            groupVerified: true,
          } as any);

          await sendTelegramApi(token, 'sendMessage', {
            chat_id: chatId,
            text: 'Let\'s complete your registration.\n\n<b>Step 1/3:</b> Please enter your <b>Full Name</b>:',
            parse_mode: 'HTML',
          });
        }
      } else {
        await sendTelegramApi(token, 'answerCallbackQuery', {
          callback_query_id: cbId,
          text: `❌ Verification Failed! Please join required chats.`,
          show_alert: true,
        });

        const now = Date.now();
        if (existingUser) {
          try {
            await setDoc(doc(db, 'users', existingUser.id), {
              lastJoinMessageSentTime: now,
            }, { merge: true });
          } catch (err) {
            console.error('Failed to update user lastJoinMessageSentTime:', err);
          }
        } else {
          const session = userSessions.get(chatId);
          if (session) {
            session.lastJoinMessageSentTime = now;
          }
        }

        await sendTelegramApi(token, 'sendMessage', {
          chat_id: chatId,
          text: buildForceJoinText(verifyRes.missingItems, existingUser !== null),
          parse_mode: 'HTML',
          reply_markup: buildForceJoinKeyboard(verifyRes.missingItems),
        });
      }
      return;
    }

    // WITHDRAWAL FLOW CALLBACK QUERIES
    if (data === 'withdraw_continue') {
      const adminConfig = await getAdminConfig();
      if (adminConfig?.enableWithdraw === false) {
        await sendTelegramApi(token, 'answerCallbackQuery', {
          callback_query_id: cbId,
          text: '❌ Withdrawals are currently disabled by Admin.',
          show_alert: true,
        });
        return;
      }

      const existingUser = await getUserByTelegramId(chatId);
      if (!existingUser) {
        await sendTelegramApi(token, 'answerCallbackQuery', {
          callback_query_id: cbId,
          text: '❌ Account not found. Please register first.',
          show_alert: true,
        });
        return;
      }

      const minW = adminConfig?.minWithdrawal ?? 100;
      const maxW = adminConfig?.maxWithdrawal ?? 10000;
      const walletBal = Number(existingUser.walletBalance) || 0;

      if (walletBal < minW) {
        await sendTelegramApi(token, 'answerCallbackQuery', {
          callback_query_id: cbId,
          text: `❌ Insufficient Balance! Minimum withdrawal is ₹${minW}. Your balance is ₹${walletBal}.`,
          show_alert: true,
        });
        return;
      }

      userSessions.set(chatId, { step: 'WITHDRAW_METHOD_SELECT' });

      await sendTelegramApi(token, 'answerCallbackQuery', {
        callback_query_id: cbId,
        text: 'Choose withdrawal method',
        show_alert: false,
      });

      await sendTelegramApi(token, 'sendMessage', {
        chat_id: chatId,
        text: `💸 <b>Select Withdrawal Method</b>\n\n` +
          `💰 <b>Available Balance:</b> ₹${walletBal}\n` +
          `📉 <b>Minimum:</b> ₹${minW} | 📈 <b>Maximum:</b> ₹${maxW}\n\n` +
          `Please select your preferred withdrawal option below:`,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '💳 UPI ID', callback_data: 'withdraw_method_upi' }],
            [{ text: '🖼 QR Code Image Upload', callback_data: 'withdraw_method_qr' }],
            [{ text: '🎁 Redeem Code', callback_data: 'withdraw_method_redeem' }],
          ],
        },
      });
      return;
    }

    if (data === 'withdraw_method_upi' || data === 'withdraw_method_qr' || data === 'withdraw_method_redeem') {
      const existingUser = await getUserByTelegramId(chatId);
      if (!existingUser) {
        await sendTelegramApi(token, 'answerCallbackQuery', {
          callback_query_id: cbId,
          text: '❌ Session expired.',
          show_alert: true,
        });
        return;
      }

      const adminConfig = await getAdminConfig();
      const minW = adminConfig?.minWithdrawal ?? 100;
      const maxW = adminConfig?.maxWithdrawal ?? 10000;
      const walletBal = Number(existingUser.walletBalance) || 0;

      const chosenMethod = data === 'withdraw_method_upi'
        ? 'upi'
        : data === 'withdraw_method_qr'
        ? 'qr'
        : 'redeem_code';

      const methodNameText = chosenMethod === 'upi'
        ? 'UPI ID'
        : chosenMethod === 'qr'
        ? 'QR Code Image Upload'
        : 'Redeem Code';

      userSessions.set(chatId, {
        step: 'WITHDRAW_AMOUNT',
        withdrawMethod: chosenMethod,
      });

      await sendTelegramApi(token, 'answerCallbackQuery', {
        callback_query_id: cbId,
        text: `Selected ${methodNameText}`,
        show_alert: false,
      });

      await sendTelegramApi(token, 'sendMessage', {
        chat_id: chatId,
        text: `💸 <b>Enter Withdrawal Amount</b>\n\n` +
          `📌 <b>Method:</b> ${methodNameText}\n` +
          `💰 <b>Available Balance:</b> ₹${walletBal}\n` +
          `📉 <b>Minimum:</b> ₹${minW} | 📈 <b>Maximum:</b> ₹${maxW}\n\n` +
          `Please enter the withdrawal amount in Rupees (e.g. <code>500</code>):`,
        parse_mode: 'HTML',
      });
      return;
    }

    if (data === 'withdraw_confirm') {
      const session = userSessions.get(chatId);
      if (
        !session ||
        session.step !== 'WITHDRAW_CONFIRM' ||
        !session.withdrawAmount ||
        !session.withdrawMethod
      ) {
        await sendTelegramApi(token, 'answerCallbackQuery', {
          callback_query_id: cbId,
          text: '❌ Withdrawal session expired. Please tap 💸 Withdraw again.',
          show_alert: true,
        });
        return;
      }

      const adminConfig = await getAdminConfig();
      const amount = session.withdrawAmount;
      const method = session.withdrawMethod;
      const upiId = session.withdrawUpi || '';
      const qrImageUrl = session.withdrawQrUrl || '';
      const redeemCodeDetails = session.withdrawRedeemDetails || '';

      try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('telegramId', '==', String(chatId)));
        const qSnap = await getDocs(q);

        if (qSnap.empty) {
          throw new Error('User record not found.');
        }

        const userDocRef = qSnap.docs[0].ref;
        const userDocId = qSnap.docs[0].id;
        const freshUserData = qSnap.docs[0].data();
        const currentBal = Number(freshUserData.walletBalance) || 0;

        if (currentBal < amount) {
          userSessions.delete(chatId);
          await sendTelegramApi(token, 'answerCallbackQuery', {
            callback_query_id: cbId,
            text: '❌ Insufficient balance for this withdrawal.',
            show_alert: true,
          });
          return;
        }

        const withdrawalId = `WDR_${Date.now().toString().slice(-6)}_${Math.floor(1000 + Math.random() * 9000)}`;

        // Add document to withdrawals collection first (maintaining status: pending)
        await addDoc(collection(db, 'withdrawals'), {
          withdrawalId,
          userId: userDocId,
          uid: freshUserData.uid,
          telegramId: String(chatId),
          userName: freshUserData.firstName || 'User',
          amount: amount,
          method: method,
          upiId: upiId,
          qrImageUrl: qrImageUrl,
          redeemCodeDetails: redeemCodeDetails,
          status: 'pending',
          createdAt: new Date().toISOString(),
        });

        // Method label for transaction log
        let methodDetailLog = '';
        if (method === 'upi') methodDetailLog = `UPI (${upiId})`;
        else if (method === 'qr') methodDetailLog = `QR Code Upload`;
        else if (method === 'redeem_code') methodDetailLog = `Redeem Code (${redeemCodeDetails})`;

        // Deduct balance and write immutable transaction atomically
        const txResult = await recordWalletTransaction({
          uid: freshUserData.uid,
          type: 'Withdrawal Request',
          amount: -amount, // debit is negative
          status: 'pending',
          description: `Withdrawal Request #${withdrawalId} via ${methodDetailLog}`,
          botToken: token,
        });

        const newBalance = txResult.success && txResult.balanceAfter !== undefined
          ? txResult.balanceAfter
          : Math.max(0, (Number(freshUserData.walletBalance) || 0) - amount);

        // Clear session
        userSessions.delete(chatId);

        await sendTelegramApi(token, 'answerCallbackQuery', {
          callback_query_id: cbId,
          text: '✅ Withdrawal request submitted!',
          show_alert: false,
        });

        let userMsgDetail = '';
        if (method === 'upi') userMsgDetail = `💳 <b>UPI ID:</b> <code>${upiId}</code>\n`;
        else if (method === 'qr') userMsgDetail = `🖼 <b>QR Image:</b> Received 📷\n`;
        else if (method === 'redeem_code') userMsgDetail = `🎁 <b>Redeem Code Details:</b> <code>${redeemCodeDetails}</code>\n`;

        await sendTelegramApi(token, 'sendMessage', {
          chat_id: chatId,
          text: `🎉 <b>Withdrawal Request Submitted!</b>\n\n` +
            `🆔 <b>Withdrawal ID:</b> <code>${withdrawalId}</code>\n` +
            `💵 <b>Amount:</b> ₹${amount}\n` +
            `📌 <b>Method:</b> ${method.toUpperCase()}\n` +
            userMsgDetail +
            `⏱ <b>Processing Time:</b> ${adminConfig?.processingTimeNotice || '24 Hours'}\n` +
            `💰 <b>New Balance:</b> ₹${newBalance}\n` +
            `⌛ <b>Status:</b> Pending Approval\n\n` +
            `Your request has been submitted to admin for verification. You will be notified once processed!`,
          parse_mode: 'HTML',
        });

        // Notify Admin via Telegram
        const adminChat = adminConfig?.adminTelegramId || adminConfig?.adminChatId;
        if (adminChat) {
          let adminMsgDetail = '';
          if (method === 'upi') adminMsgDetail = `💳 <b>UPI ID:</b> <code>${upiId}</code>\n`;
          else if (method === 'qr') adminMsgDetail = `🖼 <b>QR Image:</b> ${qrImageUrl ? `<a href="${qrImageUrl}">View QR Photo</a>` : 'Uploaded'}\n`;
          else if (method === 'redeem_code') adminMsgDetail = `🎁 <b>Redeem Code:</b> <code>${redeemCodeDetails}</code>\n`;

          await sendTelegramApi(token, 'sendMessage', {
            chat_id: adminChat,
            text: `🔔 <b>New Pending Withdrawal Request!</b>\n\n` +
              `🆔 <b>Withdrawal ID:</b> <code>${withdrawalId}</code>\n` +
              `👤 <b>User:</b> ${freshUserData.firstName} (UID: <code>${freshUserData.uid}</code>)\n` +
              `💵 <b>Amount:</b> ₹${amount}\n` +
              `📌 <b>Method:</b> ${method.toUpperCase()}\n` +
              adminMsgDetail +
              `📱 <b>Mobile:</b> <code>${freshUserData.mobile}</code>`,
            parse_mode: 'HTML',
          });
        }
      } catch (err: any) {
        console.error('Error confirming withdrawal:', err);
        await sendTelegramApi(token, 'answerCallbackQuery', {
          callback_query_id: cbId,
          text: `❌ Error submitting withdrawal: ${err.message}`,
          show_alert: true,
        });
      }
      return;
    }

    if (data === 'withdraw_cancel') {
      userSessions.delete(chatId);
      await sendTelegramApi(token, 'answerCallbackQuery', {
        callback_query_id: cbId,
        text: 'Withdrawal cancelled.',
        show_alert: false,
      });

      await sendTelegramApi(token, 'sendMessage', {
        chat_id: chatId,
        text: `❌ <b>Withdrawal Cancelled</b>\n\nYour withdrawal request has been cancelled. Your wallet balance remains unchanged.`,
        parse_mode: 'HTML',
      });
      return;
    }

    // VOTING CONTESTS CALLBACK QUERIES
    if (data === 'vote_list_contests') {
      await sendTelegramApi(token, 'answerCallbackQuery', {
        callback_query_id: cbId,
        text: 'Loading contests...',
        show_alert: false,
      });

      const contests = await getContests();
      const activeContests = contests.filter(c => c.status === 'active' || c.status === 'paused');

      let listText = `🏆 <b>Active Voting Contests</b>\n\nSelect a contest from below to view contestants and cast your vote!\n\n`;
      const inline_keyboard: any[][] = [];

      activeContests.forEach(c => {
        listText += `🔹 <b>${c.title}</b>\n`;
        if (c.description) listText += `${c.description}\n`;
        listText += `📅 <b>Ends:</b> ${c.endDate}\n`;
        if (c.voterRewardAmount && c.voterRewardAmount > 0) {
          listText += `💰 <b>Voter Bonus:</b> ₹${c.voterRewardAmount} per vote!\n`;
        }
        listText += `\n`;

        inline_keyboard.push([{
          text: `🏆 View: ${c.title}`,
          callback_data: `contest_view:${c.id}`
        }]);
      });

      await sendTelegramApi(token, 'editMessageText', {
        chat_id: chatId,
        message_id: cb.message?.message_id,
        text: listText,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard }
      });
      return;
    }

    if (data && data.startsWith('contest_view:')) {
      const contestId = data.split(':')[1];
      await sendTelegramApi(token, 'answerCallbackQuery', {
        callback_query_id: cbId,
        text: 'Loading contestants...',
        show_alert: false,
      });

      const contests = await getContests();
      const contest = contests.find(c => c.id === contestId);

      if (!contest) {
        await sendTelegramApi(token, 'sendMessage', {
          chat_id: chatId,
          text: '❌ <b>Contest not found</b>',
          parse_mode: 'HTML'
        });
        return;
      }

      const contestants = await getContestants(contestId);
      const approvedContestants = contestants.filter(cn => cn.status === 'approved');

      let viewText = `🏆 <b>${contest.title}</b>\n\n`;
      if (contest.description) viewText += `${contest.description}\n\n`;
      if (contest.rules) viewText += `📋 <b>Rules:</b> ${contest.rules}\n\n`;

      viewText += `👥 <b>Contestants List:</b>\n\n`;
      const inline_keyboard: any[][] = [];

      if (approvedContestants.length === 0) {
        viewText += `No contestants registered for this contest yet.`;
      } else {
        approvedContestants.forEach((cn, index) => {
          viewText += `${index + 1}. <b>${cn.name}</b>\n`;
          if (cn.username) viewText += `🔗 Username: ${cn.username}\n`;
          viewText += `🗳 <b>Votes Count:</b> ${cn.votesCount || 0} votes\n`;
          if (cn.description) viewText += `📝 Bio: <i>${cn.description}</i>\n`;
          viewText += `\n`;

          inline_keyboard.push([{
            text: `🗳 Vote for ${cn.name}`,
            callback_data: `vote_cast:${contestId}:${cn.id}`
          }]);
        });
      }

      inline_keyboard.push([{
        text: '⬅ Back to Contests',
        callback_data: 'vote_list_contests'
      }]);

      await sendTelegramApi(token, 'editMessageText', {
        chat_id: chatId,
        message_id: cb.message?.message_id,
        text: viewText,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard }
      });
      return;
    }

    if (data && data.startsWith('vote_cast:')) {
      const parts = data.split(':');
      const contestId = parts[1];
      const contestantId = parts[2];

      const voterUser = cb.from || {};
      const voterName = (voterUser.first_name || 'User') + (voterUser.last_name ? ' ' + voterUser.last_name : '');
      const voterUsername = voterUser.username ? '@' + voterUser.username : '';

      const voteRes = await submitVote({
        contestId,
        contestantId,
        voterTelegramId: chatId,
        voterName,
        voterUsername,
        botToken: token
      });

      if (voteRes.success) {
        await sendTelegramApi(token, 'answerCallbackQuery', {
          callback_query_id: cbId,
          text: voteRes.rewardEarned && voteRes.rewardEarned > 0 
            ? `✅ Vote Casted! You earned a ₹${voteRes.rewardEarned} wallet bonus!` 
            : `✅ Your vote was successfully recorded!`,
          show_alert: true
        });

        // Refresh the contest view
        const contests = await getContests();
        const contest = contests.find(c => c.id === contestId);
        if (contest) {
          const contestants = await getContestants(contestId);
          const approvedContestants = contestants.filter(cn => cn.status === 'approved');

          let viewText = `🏆 <b>${contest.title}</b>\n\n`;
          if (contest.description) viewText += `${contest.description}\n\n`;
          if (contest.rules) viewText += `📋 <b>Rules:</b> ${contest.rules}\n\n`;

          viewText += `👥 <b>Contestants List:</b>\n\n`;
          const inline_keyboard: any[][] = [];

          approvedContestants.forEach((cn, index) => {
            viewText += `${index + 1}. <b>${cn.name}</b>\n`;
            if (cn.username) viewText += `🔗 Username: ${cn.username}\n`;
            viewText += `🗳 <b>Votes Count:</b> ${cn.votesCount || 0} votes\n`;
            if (cn.description) viewText += `📝 Bio: <i>${cn.description}</i>\n`;
            viewText += `\n`;

            inline_keyboard.push([{
              text: `🗳 Vote for ${cn.name}`,
              callback_data: `vote_cast:${contestId}:${cn.id}`
            }]);
          });

          inline_keyboard.push([{
            text: '⬅ Back to Contests',
            callback_data: 'vote_list_contests'
          }]);

          await sendTelegramApi(token, 'editMessageText', {
            chat_id: chatId,
            message_id: cb.message?.message_id,
            text: viewText,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard }
          });
        }
      } else {
        await sendTelegramApi(token, 'answerCallbackQuery', {
          callback_query_id: cbId,
          text: `❌ ${voteRes.error || 'Failed to submit vote.'}`,
          show_alert: true
        });
      }
      return;
    }
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

  // Pre-process: Parse referral parameter from /start command for unregistered users
  if (!existingUser && (text === '/start' || text.startsWith('/start'))) {
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

    const existingSess = userSessions.get(chatId);
    const finalReferrerUid = referrerUid || existingSess?.referrerUid;

    userSessions.set(chatId, {
      step: 'FORCE_JOIN',
      referrerUid: finalReferrerUid,
    });
  }

  // Check smart join verification status
  const currentSess = userSessions.get(chatId);
  const isOnboardingInput = currentSess && ['WAITING_NAME', 'WAITING_MOBILE', 'WAITING_CONTACT'].includes(currentSess.step);

  if (!isOnboardingInput) {
    const verifyRes = await verifyUserSmartJoin(token, chatId, existingUser);

    if (!verifyRes.verified) {
      // If verification failed:
      // 1. Show the join message only once every 60 seconds.
      // 2. During that time simply reply: "⚠️ Please complete the required join first."
      const now = Date.now();
      let lastSent = 0;
      if (existingUser) {
        lastSent = Number(existingUser.lastJoinMessageSentTime) || 0;
      } else {
        lastSent = Number(currentSess?.lastJoinMessageSentTime) || 0;
      }

      if (now - lastSent < 60 * 1000) {
        await sendTelegramApi(token, 'sendMessage', {
          chat_id: chatId,
          text: `⚠️ <b>Please complete the required join first.</b>`,
          parse_mode: 'HTML',
        });
        return;
      } else {
        // Update lastSent time
        if (existingUser) {
          try {
            await setDoc(doc(db, 'users', existingUser.id), {
              lastJoinMessageSentTime: now,
            }, { merge: true });
          } catch (err) {
            console.error('Failed to update user lastJoinMessageSentTime:', err);
          }
        } else {
          let session = userSessions.get(chatId);
          if (!session) {
            session = { step: 'FORCE_JOIN' };
            userSessions.set(chatId, session);
          }
          session.lastJoinMessageSentTime = now;
        }

        // Show smart force join keyboard containing only missing items
        await sendTelegramApi(token, 'sendMessage', {
          chat_id: chatId,
          text: buildForceJoinText(verifyRes.missingItems, existingUser !== null),
          parse_mode: 'HTML',
          reply_markup: buildForceJoinKeyboard(verifyRes.missingItems),
        });
        return;
      }
    }

    // If verification is successful:
    // Check if they just transitioned from unverified to verified!
    if (existingUser) {
      const oldVersion = Number(existingUser.verificationVersion) || 0;
      const adminConfig = await getAdminConfig();
      const targetVersion = adminConfig?.verificationVersion || 1;

      if (oldVersion < targetVersion) {
        // Update the user's verification version so they are marked fully verified
        try {
          await setDoc(doc(db, 'users', existingUser.id), {
            verificationVersion: targetVersion,
            lastVerificationTime: new Date().toISOString(),
          }, { merge: true });
        } catch (err) {
          console.error('Failed to update user verificationVersion on command transition:', err);
        }

        // Send success message
        await sendTelegramApi(token, 'sendMessage', {
          chat_id: chatId,
          text: `✅ <b>Verification Successful!</b>`,
          parse_mode: 'HTML',
        });
      }
    } else {
      // Unregistered user is verified!
      // If no session exists or they were at FORCE_JOIN, transition to WAITING_NAME
      let session = userSessions.get(chatId);
      if (!session || session.step === 'FORCE_JOIN') {
        const finalReferrerUid = session?.referrerUid;
        session = {
          step: 'WAITING_NAME',
          referrerUid: finalReferrerUid,
          verifiedChannels: verifyRes.missingItems.length === 0 ? [] : undefined,
        };
        userSessions.set(chatId, session);

        await sendTelegramApi(token, 'sendMessage', {
          chat_id: chatId,
          text: `✅ <b>Verification Successful!</b>`,
          parse_mode: 'HTML',
        });

        await sendTelegramApi(token, 'sendMessage', {
          chat_id: chatId,
          text: `👋 <b>Welcome to Roy Share Wallet Bot!</b>\n\nLet's complete your registration.\n\n<b>Step 1/3:</b> Please enter your <b>Full Name</b>:`,
          parse_mode: 'HTML',
        });
        return;
      }
    }
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
    const forceJoinEnabled = adminConfig?.forceJoinEnabled !== false;

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

    const activeItems = await getActiveChannelsAndGroups();

    if (activeItems.length === 0) {
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
      text: buildForceJoinText(activeItems),
      parse_mode: 'HTML',
      reply_markup: buildForceJoinKeyboard(activeItems),
    });
    return;
  }

  // B. MAIN MENU BUTTON CLICK FOR EXISTING REGISTERED USERS
  if (existingUser) {
    const adminConfig = await getAdminConfig();

    // Check if user is in an active withdrawal input session
    const activeSession = userSessions.get(chatId);
    if (activeSession && (activeSession.step === 'WITHDRAW_METHOD_SELECT' || activeSession.step === 'WITHDRAW_AMOUNT' || activeSession.step === 'WITHDRAW_DETAILS')) {
      if (text === '/cancel') {
        userSessions.delete(chatId);
        await sendTelegramApi(token, 'sendMessage', {
          chat_id: chatId,
          text: '❌ <b>Withdrawal Cancelled</b>\n\nYour withdrawal session has been cancelled.',
          parse_mode: 'HTML',
        });
        return;
      }

      if (activeSession.step === 'WITHDRAW_METHOD_SELECT') {
        await sendTelegramApi(token, 'sendMessage', {
          chat_id: chatId,
          text: `⚠️ <b>Please Select a Method</b>\n\nPlease tap one of the withdrawal method buttons above (UPI ID, QR Code Image, or Redeem Code):`,
          parse_mode: 'HTML',
        });
        return;
      }

      if (activeSession.step === 'WITHDRAW_AMOUNT') {
        const minW = adminConfig?.minWithdrawal ?? 100;
        const maxW = adminConfig?.maxWithdrawal ?? 10000;
        const walletBal = Number(existingUser.walletBalance) || 0;

        const cleanText = text.trim();
        const amt = Number(cleanText);

        if (isNaN(amt) || amt <= 0 || !/^\d+(\.\d{1,2})?$/.test(cleanText)) {
          await sendTelegramApi(token, 'sendMessage', {
            chat_id: chatId,
            text: `❌ <b>Invalid Amount Format</b>\n\nPlease enter a valid numeric amount (e.g. <code>500</code>):`,
            parse_mode: 'HTML',
          });
          return;
        }

        if (amt < minW) {
          await sendTelegramApi(token, 'sendMessage', {
            chat_id: chatId,
            text: `❌ <b>Amount Too Low</b>\n\n` +
              `Minimum withdrawal limit is <b>₹${minW}</b>.\n` +
              `Please enter an amount equal to or greater than ₹${minW}:`,
            parse_mode: 'HTML',
          });
          return;
        }

        if (amt > maxW) {
          await sendTelegramApi(token, 'sendMessage', {
            chat_id: chatId,
            text: `❌ <b>Amount Exceeds Maximum Limit</b>\n\n` +
              `Maximum withdrawal limit is <b>₹${maxW}</b>.\n` +
              `Please enter an amount equal to or less than ₹${maxW}:`,
            parse_mode: 'HTML',
          });
          return;
        }

        if (amt > walletBal) {
          await sendTelegramApi(token, 'sendMessage', {
            chat_id: chatId,
            text: `❌ <b>Insufficient Wallet Balance</b>\n\n` +
              `Your current wallet balance is <b>₹${walletBal}</b>.\n` +
              `Please enter an amount within your wallet balance:`,
            parse_mode: 'HTML',
          });
          return;
        }

        activeSession.withdrawAmount = amt;
        activeSession.step = 'WITHDRAW_DETAILS';

        const method = activeSession.withdrawMethod || 'upi';
        let promptText = '';
        if (method === 'upi') {
          promptText = `<b>Step 2/2:</b> Please enter your <b>UPI ID</b> to receive payment (e.g. <code>example@upi</code> or <code>9876543210@paytm</code>):`;
        } else if (method === 'qr') {
          promptText = `<b>Step 2/2:</b> Please upload your <b>Payment QR Code Image</b> 📷\n\nSend your QR code photo directly as an image message in this chat:`;
        } else if (method === 'redeem_code') {
          promptText = `<b>Step 2/2:</b> Please enter your requested <b>Redeem Code type/details</b> (e.g., <code>Google Play Gift Card ₹500</code> / <code>Amazon Pay Code</code> / <code>Free Fire Voucher</code>):`;
        }

        await sendTelegramApi(token, 'sendMessage', {
          chat_id: chatId,
          text: `✅ <b>Withdrawal Amount:</b> ₹${amt}\n\n` + promptText,
          parse_mode: 'HTML',
        });
        return;
      }

      if (activeSession.step === 'WITHDRAW_DETAILS') {
        const method = activeSession.withdrawMethod || 'upi';

        if (method === 'upi') {
          const upi = text.trim();
          const upiRegex = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;

          if (!upiRegex.test(upi)) {
            await sendTelegramApi(token, 'sendMessage', {
              chat_id: chatId,
              text: `❌ <b>Invalid UPI ID Format</b>\n\n` +
                `Please enter a valid UPI address (e.g. <code>name@upi</code> or <code>9876543210@paytm</code>):`,
              parse_mode: 'HTML',
            });
            return;
          }

          activeSession.withdrawUpi = upi;
        } else if (method === 'qr') {
          const photos = message.photo;
          if (!photos || !Array.isArray(photos) || photos.length === 0) {
            await sendTelegramApi(token, 'sendMessage', {
              chat_id: chatId,
              text: `❌ <b>Photo Image Required</b>\n\n` +
                `Please upload your Payment QR Code as a photo message (attachment) in this chat 📷`,
              parse_mode: 'HTML',
            });
            return;
          }

          const highestPhoto = photos[photos.length - 1];
          let qrUrl = '';
          try {
            const fileRes = await sendTelegramApi(token, 'getFile', { file_id: highestPhoto.file_id });
            if (fileRes && fileRes.ok && fileRes.result?.file_path) {
              qrUrl = `https://api.telegram.org/file/bot${token}/${fileRes.result.file_path}`;
            } else {
              qrUrl = highestPhoto.file_id;
            }
          } catch (e) {
            qrUrl = highestPhoto.file_id;
          }

          activeSession.withdrawQrUrl = qrUrl;
        } else if (method === 'redeem_code') {
          const details = text.trim();
          if (!details || details.length < 3) {
            await sendTelegramApi(token, 'sendMessage', {
              chat_id: chatId,
              text: `❌ <b>Details Required</b>\n\n` +
                `Please specify the Redeem Code type or voucher details (e.g. <code>Google Play Gift Card ₹500</code>):`,
              parse_mode: 'HTML',
            });
            return;
          }

          activeSession.withdrawRedeemDetails = details;
        }

        activeSession.step = 'WITHDRAW_CONFIRM';

        const walletBal = Number(existingUser.walletBalance) || 0;
        const amt = activeSession.withdrawAmount || 0;
        const remaining = walletBal - amt;
        const notice = adminConfig?.processingTimeNotice || '24 Hours';

        let detailDisplay = '';
        if (method === 'upi') detailDisplay = `💳 <b>UPI ID:</b> <code>${activeSession.withdrawUpi}</code>`;
        else if (method === 'qr') detailDisplay = `🖼 <b>QR Code Image:</b> Uploaded 📷`;
        else if (method === 'redeem_code') detailDisplay = `🎁 <b>Redeem Code:</b> <code>${activeSession.withdrawRedeemDetails}</code>`;

        let methodName = 'UPI ID';
        if (method === 'qr') methodName = 'QR Code Upload';
        if (method === 'redeem_code') methodName = 'Redeem Code';

        await sendTelegramApi(token, 'sendMessage', {
          chat_id: chatId,
          text: `📋 <b>Withdrawal Summary</b>\n\n` +
            `💵 <b>Amount:</b> ₹${amt}\n` +
            `📌 <b>Method:</b> ${methodName}\n` +
            `${detailDisplay}\n` +
            `⏱ <b>Processing Time:</b> ${notice}\n` +
            `💰 <b>Remaining Balance:</b> ₹${remaining}\n\n` +
            `Please review the details above and tap <b>Confirm</b> to submit:`,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '✅ Confirm', callback_data: 'withdraw_confirm' },
                { text: '❌ Cancel', callback_data: 'withdraw_cancel' },
              ],
            ],
          },
        });
        return;
      }
    }

    // Reset active withdrawal session if user clicks a main menu button
    if (text === '👛 Wallet' || text === '💸 Withdraw' || text === '🎁 Refer & Earn' || text === '☎ Contact Us') {
      userSessions.delete(chatId);
    }

    if (text === '/contests' || text === '/vote' || text === '🏆 Contests' || text.startsWith('/contests') || text.startsWith('/vote')) {
      const contests = await getContests();
      const activeContests = contests.filter(c => c.status === 'active' || c.status === 'paused');

      if (activeContests.length === 0) {
        await sendTelegramApi(token, 'sendMessage', {
          chat_id: chatId,
          text: `🏆 <b>Voting Contests</b>\n\nThere are currently no active voting contests. Stay tuned for upcoming campaigns!`,
          parse_mode: 'HTML',
        });
        return;
      }

      let listText = `🏆 <b>Active Voting Contests</b>\n\nSelect a contest from below to view contestants and cast your vote!\n\n`;
      const inline_keyboard: any[][] = [];

      activeContests.forEach(c => {
        listText += `🔹 <b>${c.title}</b>\n`;
        if (c.description) listText += `${c.description}\n`;
        listText += `📅 <b>Ends:</b> ${c.endDate}\n`;
        if (c.voterRewardAmount && c.voterRewardAmount > 0) {
          listText += `💰 <b>Voter Bonus:</b> ₹${c.voterRewardAmount} per vote!\n`;
        }
        listText += `\n`;

        inline_keyboard.push([{
          text: `🏆 View: ${c.title}`,
          callback_data: `contest_view:${c.id}`
        }]);
      });

      await sendTelegramApi(token, 'sendMessage', {
        chat_id: chatId,
        text: listText,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard }
      });
      return;
    }

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
        reply_markup: {
          inline_keyboard: [
            [
              { text: '💸 Continue Withdrawal', callback_data: 'withdraw_continue' },
            ],
          ],
        },
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
    const activeItems = await getActiveChannelsAndGroups();
    userSessions.set(chatId, { step: 'FORCE_JOIN' });

    if (activeItems.length === 0) {
      userSessions.set(chatId, { step: 'WAITING_NAME' });
      await sendTelegramApi(token, 'sendMessage', {
        chat_id: chatId,
        text: '👋 <b>Welcome to Roy Share Wallet Bot!</b>\n\nLet\'s complete your registration.\n\n<b>Step 1/3:</b> Please enter your <b>Full Name</b>:',
        parse_mode: 'HTML',
      });
      return;
    }

    await sendTelegramApi(token, 'sendMessage', {
      chat_id: chatId,
      text: buildForceJoinText(activeItems),
      parse_mode: 'HTML',
      reply_markup: buildForceJoinKeyboard(activeItems),
    });
    return;
  }

  if (!session) return;

  // STEP 1: FORCE JOIN CHECK
  if (session.step === 'FORCE_JOIN') {
    const activeItems = await getActiveChannelsAndGroups();

    await sendTelegramApi(token, 'sendMessage', {
      chat_id: chatId,
      text: buildForceJoinText(activeItems),
      parse_mode: 'HTML',
      reply_markup: buildForceJoinKeyboard(activeItems),
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
      walletBalance: 0, // start with 0 and then record credit transaction
      channelVerified: session.channelVerified ?? true,
      groupVerified: session.groupVerified ?? true,
      createdAt: new Date().toISOString(),
      referrerUid: session.referrerUid || null,
      referredBy: session.referrerUid || null,
      referralRewardReceived: false,
      totalReferrals: 0,
      successfulReferrals: 0,
      totalReferralEarnings: 0,
      // Smart Join Verification fields
      verifiedChannels: session.verifiedChannels || [],
      verifiedGroups: session.verifiedGroups || [],
      verificationVersion: session.verificationVersion || (adminConfig?.verificationVersion || 1),
      lastVerificationTime: session.lastVerificationTime || new Date().toISOString(),
    };

    let newUserDocRef;
    try {
      newUserDocRef = await addDoc(collection(db, 'users'), newUserData);
      
      // Credit welcome bonus atomically
      if (newUserDocRef && bonus > 0) {
        await recordWalletTransaction({
          uid,
          type: 'Registration Bonus',
          amount: bonus,
          status: 'completed',
          description: 'Onboarding welcome bonus credited to wallet',
          botToken: token,
        });
      }
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

        // Determine domain URL for verification link using APP_BASE_URL
        const baseUrl = (process.env.APP_BASE_URL || process.env.APP_URL || 'https://roy-share-wallet.onrender.com').replace(/\/$/, '');
        const verifyUrl = `${baseUrl}/referral-verify?token=${uniqueToken}`;

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
