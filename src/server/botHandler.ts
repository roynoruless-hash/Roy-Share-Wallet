import { collection, query, where, getDocs, addDoc, doc, getDoc, runTransaction, setDoc, limit, deleteDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { recordWalletTransaction } from './transactionService';
import { getContests, getContestants, submitVote } from '../services/contestService';
import { sendAdminWithdrawalNotification, handleAdminWithdrawalCallback } from './adminWithdrawalBot';
import { getWarStatsForTelegram, joinWarTeam, addWarPointsForActivity, getActiveWarAndTeamByAlias, validateAndActivateMember } from '../services/giveawayWarService';

interface UserSession {
  step: 'FORCE_JOIN' | 'WITHDRAW_METHOD_SELECT' | 'WITHDRAW_AMOUNT' | 'WITHDRAW_DETAILS' | 'WITHDRAW_CONFIRM';
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
  pendingVote?: { contestId: string; contestantId: string };
  pendingWarJoin?: { warId: string; teamId: string; inviterTgId?: string };
  referrerUid?: string;
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
 * Helper to construct Telegram inline buttons for Mini Apps safely
 */
function buildMiniAppButton(label: string, customUrl?: string, eventId?: string, isChannel = false, botUsername = 'Roy_wallett_bot') {
  const cleanBot = (botUsername || 'Roy_wallett_bot').replace(/^@/, '');
  const activeEventId = eventId || 'live_event';

  const configuredAppUrl = process.env.PUBLIC_APP_URL || process.env.APP_URL;
  if (!configuredAppUrl) {
    const errorMsg = "[CRITICAL_PRODUCTION_FAIL] PUBLIC_APP_URL is not configured. Refusing to generate the Telegram WebApp/URL button.";
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  let appBaseUrl = configuredAppUrl;
  if (customUrl && customUrl.startsWith('http') && !customUrl.includes('t.me/')) {
    // Prevent malicious or leftover AI Studio fallback URLs in custom urls
    if (customUrl.includes('ais-dev') || customUrl.includes('ais-pre') || customUrl.includes('asia-southeast1.run.app') || customUrl.includes('run.app')) {
      const errorMsg = `[CRITICAL_SECURITY_FAIL] Refusing to use fallback custom URL containing AI Studio subdomain: ${customUrl}`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
    appBaseUrl = customUrl;
  }

  let webAppHttpsUrl = appBaseUrl;
  try {
    const u = new URL(appBaseUrl);
    u.searchParams.set('liveEventId', activeEventId);
    u.searchParams.set('startapp', activeEventId);
    webAppHttpsUrl = u.toString();
  } catch (e) {
    webAppHttpsUrl = `${appBaseUrl}?liveEventId=${activeEventId}&startapp=${activeEventId}`;
  }

  const shortAppLink = `https://t.me/${cleanBot}/roy_share_wallet?startapp=${activeEventId}`;

  if (isChannel) {
    const finalUrl = (customUrl && customUrl.includes('startapp=')) ? customUrl : shortAppLink;
    console.log(`[TELEGRAM_SEND_URL] Sending to Telegram channel: ${finalUrl}`);
    console.log(`[BOT_BUTTON_GEN] Target: Channel | Type: URL | URL: ${finalUrl} | EventID: ${activeEventId} | DocID: liveRedeem/current`);
    return { text: label, url: finalUrl };
  }

  console.log(`[TELEGRAM_SEND_URL] Sending to Telegram direct/group: ${webAppHttpsUrl}`);
  console.log(`[BOT_BUTTON_GEN] Target: Direct/Group | Type: WEB_APP | WebApp URL: ${webAppHttpsUrl} | EventID: ${activeEventId} | DocID: liveRedeem/current`);
  return { text: label, web_app: { url: webAppHttpsUrl } };
}

/**
 * Helper to display Registration V2 Welcome & Open Mini App button
 */
export async function sendCreateAccountPrompt(token: string, chatId: string | number) {
  const baseUrl = (process.env.PUBLIC_APP_URL || process.env.APP_URL || process.env.APP_BASE_URL || 'https://roy-share-wallet.onrender.com').replace(/\/$/, '');
  const miniAppUrl = `${baseUrl}/?action=register&tgId=${chatId}`;

  const welcomeText =
    `✅ <b>Membership Verified!</b>\n\n` +
    `👋 <b>Welcome to Roy Share Wallet</b>\n\n` +
    `Your membership has been verified.\n\n` +
    `Please create your account securely using our Registration Mini App.\n\n` +
    `🌐 <b>Open Registration Mini App</b>`;

  await sendTelegramApi(token, 'sendMessage', {
    chat_id: chatId,
    text: welcomeText,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: '🌐 Open Registration Mini App',
            web_app: { url: miniAppUrl }
          }
        ]
      ]
    }
  });
}

export function buildMainMenuKeyboard(hasActiveLiveEvent: boolean = false) {
  const keyboard: any[][] = [
    [{ text: '👛 Wallet' }, { text: '💸 Withdraw' }],
    [{ text: '🎁 Refer & Earn' }, { text: '☎ Contact Us' }],
    [{ text: '🎁 Lucky Draw' }],
  ];

  return {
    keyboard,
    resize_keyboard: true,
  };
}

export async function checkLiveEventActive(): Promise<{
  hasActiveEvent: boolean;
  liveEventState: 'IDLE' | 'WAITING_FOR_ADMIN' | 'WAITING_FOR_READY' | 'LIVE_COUNTDOWN' | 'UNLOCKED' | 'PAUSED' | 'LOCKED' | 'ENDED';
  activeData: any;
}> {
  return { hasActiveEvent: false, liveEventState: 'IDLE', activeData: null };
}

export async function sendLiveEventInfoMessage(
  token: string,
  chatId: number | string,
  liveEventState: string,
  activeData: any
) {
  // Retired in favor of Lucky Number Giveaway V2
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
 * Send Contestant Details Card with Profile Photo, Name, Username, Bio, Vote Count, and Vote Button
 */
async function sendContestantVoteCard(token: string, chatId: string, contestId: string, contestantId: string) {
  const contests = await getContests();
  const contest = contests.find((c) => c.id === contestId);

  const now = new Date();
  if (!contest) {
    await sendTelegramApi(token, 'sendMessage', {
      chat_id: chatId,
      text: '❌ <b>Contest not found.</b>',
      parse_mode: 'HTML',
    });
    return;
  }

  if (contest.status === 'completed' || contest.votingEndedProcessed) {
    await sendTelegramApi(token, 'sendMessage', {
      chat_id: chatId,
      text: '🔒 <b>Voting Ended</b>\n\nVoting for this contest has concluded and voting links are now disabled.',
      parse_mode: 'HTML',
    });
    return;
  }

  if (!contest.votingStarted) {
    await sendTelegramApi(token, 'sendMessage', {
      chat_id: chatId,
      text: '⏳ <b>Voting Not Started</b>\n\nVoting for this contest has not been started yet by the administrator.',
      parse_mode: 'HTML',
    });
    return;
  }

  const contestants = await getContestants(contestId);
  const contestant = contestants.find((cn) => cn.id === contestantId);

  if (!contestant || contestant.status !== 'approved') {
    await sendTelegramApi(token, 'sendMessage', {
      chat_id: chatId,
      text: '❌ <b>Contestant not found or not approved.</b>',
      parse_mode: 'HTML',
    });
    return;
  }

  const rewardNotice =
    contest.voterRewardAmount && contest.voterRewardAmount > 0
      ? `\n💰 <b>Voter Reward:</b> ₹${contest.voterRewardAmount} per vote!`
      : '';

  let cardText =
    `🏆 <b>Voting Contest:</b> ${contest.title}\n\n` +
    `👤 <b>Contestant Details:</b>\n` +
    `• <b>Name:</b> ${contestant.name}\n`;

  if (contestant.username) {
    const formattedUser = contestant.username.startsWith('@') ? contestant.username : `@${contestant.username}`;
    cardText += `• <b>Username:</b> ${formattedUser}\n`;
  }
  if (contestant.description) {
    cardText += `• <b>Bio:</b> <i>${contestant.description}</i>\n`;
  }
  cardText +=
    `• <b>Current Vote Count:</b> ${contestant.votesCount || 0} votes${rewardNotice}\n\n` +
    `Click the button below to cast your verified vote!`;

  const inline_keyboard = [
    [
      {
        text: `🗳 Vote for ${contestant.name}`,
        callback_data: `vote_cast:${contestId}:${contestantId}`,
      },
    ],
  ];

  if (contestant.imageUrl && (contestant.imageUrl.startsWith('http://') || contestant.imageUrl.startsWith('https://'))) {
    const photoRes = await sendTelegramApi(token, 'sendPhoto', {
      chat_id: chatId,
      photo: contestant.imageUrl,
      caption: cardText,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard },
    });

    if (!photoRes || photoRes.ok === false) {
      await sendTelegramApi(token, 'sendMessage', {
        chat_id: chatId,
        text: cardText,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard },
      });
    }
  } else {
    await sendTelegramApi(token, 'sendMessage', {
      chat_id: chatId,
      text: cardText,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard },
    });
  }
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
    const tgStr = String(telegramId).trim();
    if (!tgStr) return null;

    // 1. Check direct document users/{telegramId}
    const directDocRef = doc(db, 'users', tgStr);
    const directSnap = await getDoc(directDocRef);
    if (directSnap.exists()) {
      const data = directSnap.data();
      const currentAppUid = data.appUid ? String(data.appUid).trim() : '';
      const currentUid = data.uid ? String(data.uid).trim() : '';

      const needsUidFix = !currentAppUid || currentAppUid === tgStr || currentUid === tgStr || !currentUid;
      if (needsUidFix) {
        const newUid = await generateUniqueUid();
        await setDoc(directDocRef, { appUid: newUid, uid: newUid }, { merge: true });
        console.log(`[Auto-Repair UID] Assigned separate appUid ${newUid} to user ID ${directSnap.id} (telegramId: ${tgStr})`);
        return { id: directSnap.id, ...data, appUid: newUid, uid: newUid } as any;
      }
      return { id: directSnap.id, ...data, appUid: currentAppUid || currentUid, uid: currentUid || currentAppUid } as any;
    }

    // 2. Query collection where telegramId == tgStr
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('telegramId', '==', tgStr));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      // Prioritize banned document if multiple documents exist for same telegramId
      const bannedDoc = querySnapshot.docs.find(d => {
        const data = d.data();
        return data.banned === true || data.status === 'banned' || data.isBanned === true || data.status === 'blocked';
      });
      const docSnap = bannedDoc || querySnapshot.docs[0];
      const data = docSnap.data();
      const currentAppUid = data.appUid ? String(data.appUid).trim() : '';
      const currentUid = data.uid ? String(data.uid).trim() : '';

      const needsUidFix = !currentAppUid || currentAppUid === tgStr || currentUid === tgStr || !currentUid;
      if (needsUidFix) {
        const newUid = await generateUniqueUid();
        await setDoc(doc(db, 'users', docSnap.id), { appUid: newUid, uid: newUid }, { merge: true });
        console.log(`[Auto-Repair UID] Assigned separate appUid ${newUid} to user ID ${docSnap.id} (telegramId: ${tgStr})`);
        return { id: docSnap.id, ...data, appUid: newUid, uid: newUid } as any;
      }
      return { id: docSnap.id, ...data, appUid: currentAppUid || currentUid, uid: currentUid || currentAppUid } as any;
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
    const searchStr = String(uid).trim();
    const usersRef = collection(db, 'users');
    const qApp = query(usersRef, where('appUid', '==', searchStr));
    const snapApp = await getDocs(qApp);
    if (!snapApp.empty) {
      const docSnap = snapApp.docs[0];
      return { id: docSnap.id, ...docSnap.data() } as any;
    }
    const qUid = query(usersRef, where('uid', '==', searchStr));
    const snapUid = await getDocs(qUid);
    if (!snapUid.empty) {
      const docSnap = snapUid.docs[0];
      return { id: docSnap.id, ...docSnap.data() } as any;
    }
  } catch (err) {
    console.error('Error fetching user by uid:', err);
  }
  return null;
}

/**
 * Generate a unique numeric UID based on the configured UID Length
 */
async function generateUniqueUid(): Promise<string> {
  const adminConfig = await getAdminConfig();
  let len = Number(adminConfig?.uidLength) || 6;
  len = Math.min(12, Math.max(4, len)); // safe bounds: 4 to 12 digits

  let uid = '';
  let exists = true;
  let attempts = 0;

  while (exists && attempts < 25) {
    const min = Math.pow(10, len - 1);
    const max = Math.pow(10, len) - 1;
    uid = Math.floor(min + Math.random() * (max - min + 1)).toString();
    attempts++;
    try {
      const qApp = query(collection(db, 'users'), where('appUid', '==', uid));
      const snapApp = await getDocs(qApp);
      const qUid = query(collection(db, 'users'), where('uid', '==', uid));
      const snapUid = await getDocs(qUid);
      if (snapApp.empty && snapUid.empty) {
        exists = false;
      }
    } catch (e) {
      exists = false;
    }
  }
  return uid || String(Date.now()).slice(-len);
}

/**
 * Send Telegram message helper
 */
export async function sendTelegramApi(token: string, method: string, payload: any) {
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

  const activeItems = await getActiveChannelsAndGroups();
  const requiredItems = activeItems.filter((i) => i.required !== false && i.active !== false);

  if (!forceJoinEnabled || requiredItems.length === 0) {
    console.log(`[FORCE JOIN] Loaded Channels: ${activeItems.length}, Checking User: ${chatId}, Required Join Count: 0, Passed, Failed, Cache Cleared`);
    return { verified: true, missingItems: [] };
  }

  const missingItems: TelegramChannelGroupRecord[] = [];
  let passedCount = 0;
  let failedCount = 0;

  for (const item of requiredItems) {
    const targetKey = item.chatId || item.username;
    if (!targetKey) continue;

    const isMember = await checkChatMember(token, targetKey, chatId);
    if (isMember) {
      passedCount++;
    } else {
      failedCount++;
      missingItems.push(item);
    }
  }

  console.log(`[FORCE JOIN] Loaded Channels: ${activeItems.length}, Checking User: ${chatId}, Required Join Count: ${requiredItems.length}, Passed, Failed, Cache Cleared`);

  if (missingItems.length === 0) {
    return { verified: true, missingItems: [] };
  } else {
    return { verified: false, missingItems };
  }
}

function logTelegramPayload(payload: string, detectedType: string, warId: string, userId: string, action: string) {
  console.log(`========================================`);
  console.log(`Received payload:\n${payload || 'none'}\n`);
  console.log(`Detected type:\n${detectedType || 'NONE'}\n`);
  console.log(`War ID:\n${warId || 'none'}\n`);
  console.log(`User ID:\n${userId}\n`);
  console.log(`Action:\n${action}`);
  console.log(`========================================`);
}

function detectWarPayloadType(startParam: string): { type: 'TEAM_A' | 'TEAM_B' | 'WAR'; teamAlias: string } | null {
  if (!startParam) return null;
  const lower = startParam.toLowerCase().trim();

  const isWar = lower.startsWith('teama') || lower.startsWith('teamb') || lower.startsWith('war_') || lower.includes('team');
  if (!isWar) return null;

  if (lower.includes('teamb') || lower.includes('team_b') || lower.includes('_b_')) {
    return { type: 'TEAM_B', teamAlias: 'teamB' };
  } else if (lower.includes('teama') || lower.includes('team_a') || lower.includes('_a_')) {
    return { type: 'TEAM_A', teamAlias: 'teamA' };
  } else {
    return { type: 'WAR', teamAlias: 'teamA' };
  }
}

interface ParsedWarParam {
  type: 'TEAM_A' | 'TEAM_B' | 'WAR';
  warId: string;
  teamId: string;
  teamName: string;
  inviterTgId: string;
}

async function parseWarStartParam(startParam: string): Promise<ParsedWarParam | null> {
  if (!startParam) return null;
  const raw = startParam.trim();
  const lower = raw.toLowerCase();

  const detected = detectWarPayloadType(raw);
  if (!detected) return null;

  let warId = '';
  let inviterTgId = '';

  const parts = raw.split('_');

  if (lower.startsWith('teama_leader_') || lower.startsWith('teamb_leader_')) {
    warId = parts[2] || '';
    inviterTgId = parts[3] || '';
  } else if (lower.startsWith('war_')) {
    warId = parts[1] || '';
    for (let i = 2; i < parts.length; i++) {
      const p = parts[i].toLowerCase();
      if ((p === 'ref' || p === 'lead') && parts[i + 1]) {
        inviterTgId = parts[i + 1];
      }
    }
  } else if (lower.startsWith('teama_war_') || lower.startsWith('teamb_war_')) {
    warId = parts[2] || '';
    inviterTgId = parts[3] || '';
  } else if (lower.startsWith('teama_') || lower.startsWith('teamb_')) {
    warId = parts[1] || '';
    inviterTgId = parts[2] || '';
  }

  const resolved = await getActiveWarAndTeamByAlias(detected.teamAlias, warId);
  if (!resolved) {
    const fallback = await getActiveWarAndTeamByAlias(detected.teamAlias);
    if (fallback) {
      return {
        type: detected.type,
        warId: fallback.warId,
        teamId: fallback.teamId,
        teamName: fallback.teamName,
        inviterTgId,
      };
    }
    return null;
  }

  return {
    type: detected.type,
    warId: resolved.warId,
    teamId: resolved.teamId,
    teamName: resolved.teamName,
    inviterTgId,
  };
}

/**
 * Main Telegram Webhook Update Processor
 */
export async function processTelegramUpdate(token: string, update: any) {
  if (!token || !update) return;

  console.log('Received Telegram Update:', JSON.stringify(update));
  if (update?.message?.web_app_data) {
    console.log('Received Web App Data:', JSON.stringify(update.message.web_app_data));
  }

  // 1. IGNORE EDITED MESSAGES, CHANNEL POSTS, AND NON-PRIVATE UPDATES
  if (update.edited_message || update.channel_post || update.edited_channel_post || update.my_chat_member || update.chat_member) {
    console.log('Ignored Group Update');
    return;
  }

  // 2. HANDLE CALLBACK QUERIES (Inline Buttons like "Verify Join")
  if (update.callback_query) {
    const cb = update.callback_query;
    const data = cb.data;

    // Telegram Admin Withdrawal Management callbacks
    if (data && data.startsWith('wdr_')) {
      const adminConfig = await getAdminConfig();
      const handled = await handleAdminWithdrawalCallback(token, cb, adminConfig);
      if (handled) return;
    }

    const chatType = cb.message?.chat?.type;

    // Reject callback queries from non-private chats for general users
    if (chatType !== 'private') {
      console.log('Ignored Group Update');
      return;
    }

    const chatId = String(cb.message?.chat?.id || cb.from?.id);
    const cbId = cb.id;

    // Enforce Required Join for all callbacks except check_membership and wdr_ admin actions
    if (data && data !== 'check_membership' && !data.startsWith('wdr_')) {
      const existingUser = await getUserByTelegramId(chatId);
      const verifyRes = await verifyUserSmartJoin(token, chatId, existingUser);
      if (!verifyRes.verified) {
        await sendTelegramApi(token, 'answerCallbackQuery', {
          callback_query_id: cbId,
          text: '⚠️ Please join required channels/groups first!',
          show_alert: true,
        });

        await sendTelegramApi(token, 'sendMessage', {
          chat_id: chatId,
          text: buildForceJoinText(verifyRes.missingItems, existingUser !== null),
          parse_mode: 'HTML',
          reply_markup: buildForceJoinKeyboard(verifyRes.missingItems),
        });
        return;
      }
    }

    // COPY / CLAIM REDEEM CODE CALLBACK
    if (data && (data === 'claim_event_code' || data === 'claim_live_code' || data.startsWith('claim_code_') || data.startsWith('copy_code_'))) {
      try {
        let liveDocSnap = await getDoc(doc(db, 'liveRedeem', 'current'));
        if (!liveDocSnap.exists()) {
          liveDocSnap = await getDoc(doc(db, 'liveRedeemEvents', 'active'));
        }

        const adminConfig = await getAdminConfig();
        const botUsername = adminConfig?.botUsername || 'Roy_wallett_bot';
        const cleanBotName = botUsername.replace(/^@/, '');
        const eventData = liveDocSnap.exists() ? liveDocSnap.data() as any : null;
        let miniAppUrl = eventData?.miniAppUrl || eventData?.miniAppLink || `https://t.me/${cleanBotName}/roy_share_wallet?startapp=live_event`;

        await sendTelegramApi(token, 'answerCallbackQuery', {
          callback_query_id: cbId,
          text: '🎁 Please claim and view your code securely inside the Roy Wallet Mini App!',
          show_alert: true,
        });

        if (cb.message?.message_id) {
          const inline_keyboard = [
            [{ text: '🤖 Open Roy Wallet', web_app: { url: miniAppUrl } }],
          ];
          await sendTelegramApi(token, 'editMessageText', {
            chat_id: chatId,
            message_id: cb.message.message_id,
            text:
              `🎁 <b>Roy Wallet Live Redeem Event</b>\n\n` +
              `Redeem codes are now securely managed inside the Roy Wallet Mini App to prevent bot scraping.\n\n` +
              `Tap the button below to claim and view your code!`,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard },
          });
        }
        return;
      } catch (err) {
        console.error('Error in callback handler redirect:', err);
      }
    }

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
          const session = userSessions.get(chatId);
          if (session?.pendingVote) {
            const { contestId, contestantId } = session.pendingVote;
            userSessions.delete(chatId);
            await sendContestantVoteCard(token, chatId, contestId, contestantId);
          } else {
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
          }
        } else {
          // Unregistered user -> Prompt to open Registration Mini App
          await sendCreateAccountPrompt(token, chatId);
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

    // WITHDRAWAL FLOW CALLBACK QUERIES (DECOMMISSIONED LEGACY SYSTEMS REPLACED BY SECURE MINI APP V2)
    if (data === 'withdraw_continue' || data === 'withdraw_method_upi' || data === 'withdraw_method_qr' || data === 'withdraw_method_redeem' || data === 'withdraw_confirm' || data === 'withdraw_cancel') {
      const baseUrl = (process.env.PUBLIC_APP_URL || process.env.APP_URL || process.env.APP_BASE_URL || 'https://roy-share-wallet.onrender.com').replace(/\/$/, '');
      const withdrawMiniAppUrl = `${baseUrl}/?action=withdraw&tgId=${chatId}`;

      await sendTelegramApi(token, 'answerCallbackQuery', {
        callback_query_id: cbId,
        text: '🔧 Please use the secure Withdrawal Mini App.',
        show_alert: true,
      });

      await sendTelegramApi(token, 'sendMessage', {
        chat_id: chatId,
        text: `⚠️ <b>Legacy Withdrawal Path Disabled</b>\n\n` +
          `To ensure maximum transaction security and support our updated fee system, all withdrawals must be processed through our new <b>Withdrawal Mini App V2</b>.\n\n` +
          `Please tap the button below to complete your request securely:`,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '💸 Open Withdrawal Mini App',
                web_app: { url: withdrawMiniAppUrl },
              },
            ],
          ],
        },
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
        listText += `📌 <b>Status:</b> ${c.votingStarted ? 'Voting Live 🔵' : 'Registration Open 🟢'}\n`;
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

      if (contest.status === 'completed' || contest.votingEndedProcessed) {
        const contestants = await getContestants(contestId);
        const sorted = contestants.sort((a, b) => (b.votesCount || 0) - (a.votesCount || 0));
        const totalVotes = sorted.reduce((acc, curr) => acc + (curr.votesCount || 0), 0);

        let viewText = `🏆 <b>${contest.title} - FINAL RESULTS</b> 🏆\n\n`;
        if (contest.description) viewText += `${contest.description}\n\n`;
        viewText += `📊 <b>Total Votes Cast:</b> ${totalVotes}\n\n`;

        if (sorted.length === 0) {
          viewText += `No participants recorded.`;
        } else {
          viewText += `<b>Final Winner Standings:</b>\n\n`;
          sorted.forEach((cn, idx) => {
            const medal = idx === 0 ? '🏆 WINNER:' : idx === 1 ? '🥈 RUNNER-UP:' : idx === 2 ? '🥉 THIRD PLACE:' : `#${idx + 1}`;
            viewText += `${medal} <b>${cn.name}</b> ${cn.username ? `(${cn.username})` : ''} - <b>${cn.votesCount || 0} votes</b>\n`;
          });
        }

        const inline_keyboard = [[{
          text: '⬅ Back to Contests',
          callback_data: 'vote_list_contests'
        }]];

        await sendTelegramApi(token, 'editMessageText', {
          chat_id: chatId,
          message_id: cb.message?.message_id,
          text: viewText,
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard }
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

      // Verify channel/group membership
      const existingUser = await getUserByTelegramId(chatId);
      const verifyRes = await verifyUserSmartJoin(token, chatId, existingUser);

      if (!verifyRes.verified) {
        await sendTelegramApi(token, 'answerCallbackQuery', {
          callback_query_id: cbId,
          text: '⚠️ Please join required channels/groups first!',
          show_alert: true,
        });

        const session = userSessions.get(chatId) || { step: 'FORCE_JOIN' };
        session.pendingVote = { contestId, contestantId };
        userSessions.set(chatId, session);

        await sendTelegramApi(token, 'sendMessage', {
          chat_id: chatId,
          text: buildForceJoinText(verifyRes.missingItems, existingUser !== null),
          parse_mode: 'HTML',
          reply_markup: buildForceJoinKeyboard(verifyRes.missingItems),
        });
        return;
      }

      const voteRes = await submitVote({
        contestId,
        contestantId,
        voterTelegramId: chatId,
        voterName,
        voterUsername,
        botToken: token,
      });

      if (voteRes.success) {
        const rewardText =
          voteRes.rewardEarned && voteRes.rewardEarned > 0
            ? `\n💰 <b>You earned a ₹${voteRes.rewardEarned} wallet bonus!</b>`
            : '';

        await sendTelegramApi(token, 'answerCallbackQuery', {
          callback_query_id: cbId,
          text: `✅ Vote Submitted Successfully!`,
          show_alert: true,
        });

        await sendTelegramApi(token, 'sendMessage', {
          chat_id: chatId,
          text: `✅ <b>Vote Submitted Successfully!</b>${rewardText}`,
          parse_mode: 'HTML',
        });
      } else {
        await sendTelegramApi(token, 'answerCallbackQuery', {
          callback_query_id: cbId,
          text: `${voteRes.error || 'Failed to submit vote.'}`,
          show_alert: true,
        });

        await sendTelegramApi(token, 'sendMessage', {
          chat_id: chatId,
          text: `${voteRes.error || 'Failed to submit vote.'}`,
          parse_mode: 'HTML',
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

  // TELEGRAM CONTACT VERIFICATION HANDLER
  if (contact) {
    const sessionDocRef = doc(db, 'registrationSessions', chatId);
    const sessionSnap = await getDoc(sessionDocRef);

    if (sessionSnap.exists()) {
      const pendingSession = sessionSnap.data();

      // Check 1: contact.user_id === current Telegram user ID
      const contactUserId = String(contact.user_id || message.from?.id || '');
      if (contactUserId !== String(chatId)) {
        await sendTelegramApi(token, 'sendMessage', {
          chat_id: chatId,
          text: `❌ <b>This contact does not belong to your Telegram account.</b>`,
          parse_mode: 'HTML',
        });
        return;
      }

      // Check 2: normalize phone numbers and compare
      const normalizePhone = (p: string) => (p || '').replace(/\D/g, '').slice(-10);
      const sharedPhoneNorm = normalizePhone(contact.phone_number);
      const registeredPhoneNorm = normalizePhone(pendingSession.mobile);

      if (!sharedPhoneNorm || sharedPhoneNorm !== registeredPhoneNorm) {
        await sendTelegramApi(token, 'sendMessage', {
          chat_id: chatId,
          text: `❌ <b>The shared contact number does not match the number entered during registration.</b>\n\n` +
            `Entered: <code>${pendingSession.mobile}</code>\n` +
            `Shared: <code>${contact.phone_number || 'Unknown'}</code>\n\n` +
            `Please tap <b>📱 Share Contact</b> below to share the correct contact number.`,
          parse_mode: 'HTML',
          reply_markup: {
            keyboard: [
              [{ text: '📱 Share Contact', request_contact: true }]
            ],
            resize_keyboard: true,
            one_time_keyboard: true
          }
        });
        return;
      }

      // Both checks pass! Mark contactVerified, generate 6-digit OTP code & set 2 min expiry
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const otpExpiry = Date.now() + 120000;

      await setDoc(sessionDocRef, {
        contactVerified: true,
        sharedContactMobile: sharedPhoneNorm,
        otp,
        otpExpiry,
        attempts: 0,
      }, { merge: true });

      // Send bot message: Mobile Number Verified!
      await sendTelegramApi(token, 'sendMessage', {
        chat_id: chatId,
        text: `✅ <b>Mobile Number Verified!</b>\n\nYour mobile number has been successfully verified.`,
        parse_mode: 'HTML',
        reply_markup: {
          remove_keyboard: true
        }
      });

      // Send bot message: OTP Code
      const otpMessage =
        `━━━━━━━━━━━━━━\n` +
        `🔐 <b>Roy Share OTP Code</b>\n\n` +
        `Your 6-digit OTP for registration is:\n` +
        `<code>${otp}</code>\n\n` +
        `⏱ This code will expire in <b>02:00</b> minutes.\n` +
        `━━━━━━━━━━━━━━`;

      await sendTelegramApi(token, 'sendMessage', {
        chat_id: chatId,
        text: otpMessage,
        parse_mode: 'HTML',
      });

      return;
    } else {
      await sendTelegramApi(token, 'sendMessage', {
        chat_id: chatId,
        text: `❌ <b>No active registration session found.</b>\n\nPlease create an account via the Registration Mini App first.`,
        parse_mode: 'HTML',
        reply_markup: {
          remove_keyboard: true
        }
      });
      return;
    }
  }

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

  // Log incoming raw update and message text for debugging
  console.log('[TELEGRAM WEBHOOK] Incoming RAW UPDATE:', JSON.stringify(update));
  console.log('[TELEGRAM WEBHOOK] Message Text:', text, 'Chat ID:', chatId);

  // Enforce Required Join check for all non-verified messages
  const verifyRes = await verifyUserSmartJoin(token, chatId, existingUser);
  if (!verifyRes.verified) {
    if (text.startsWith('/start')) {
      let startParam = '';
      const parts = text.split(/\s+/);
      if (parts.length > 1 && parts[1]) {
        startParam = parts[1].replace(/^(?:start=|\?start=)/i, '').trim();
      } else {
        const match = text.match(/^\/start(?:=|\?start=)?(\S+)/i);
        if (match && match[1] && match[1].toLowerCase() !== '/start') {
          startParam = match[1].trim();
        }
      }

      if (startParam) {
        const sess = userSessions.get(chatId) || { step: 'FORCE_JOIN' };
        
        if (startParam.startsWith('vote_')) {
          const vParts = startParam.split('_');
          sess.pendingVote = { contestId: vParts[1], contestantId: vParts[2] };
        } else if (detectWarPayloadType(startParam)) {
          const warParam = await parseWarStartParam(startParam);
          if (warParam) {
            sess.pendingWarJoin = { warId: warParam.warId, teamId: warParam.teamId, inviterTgId: warParam.inviterTgId };
          }
        } else {
          const referrer = await getUserByUid(startParam);
          if (referrer) {
            sess.referrerUid = String(referrer.uid);
          }
        }
        userSessions.set(chatId, sess);
      }
    }

    await sendTelegramApi(token, 'sendMessage', {
      chat_id: chatId,
      text: buildForceJoinText(verifyRes.missingItems, existingUser !== null),
      parse_mode: 'HTML',
      reply_markup: buildForceJoinKeyboard(verifyRes.missingItems),
    });
    return;
  }

  // A. COMMAND: /start
  if (text === '/start' || text.startsWith('/start')) {
    let startParam = '';
    const parts = text.split(/\s+/);
    if (parts.length > 1 && parts[1]) {
      startParam = parts[1].replace(/^(?:\?|\/)?(?:start=|startapp=)/i, '').trim();
    } else {
      const match = text.match(/^\/start(?:=|\?start=|\?startapp=|startapp=)?(\S+)/i);
      if (match && match[1] && match[1].toLowerCase() !== '/start') {
        startParam = match[1].trim().replace(/^(?:\?|\/)?(?:start=|startapp=)/i, '');
      }
    }

    console.log('Received Payload:', startParam || 'none');

    const lowerParam = (startParam || '').toLowerCase();
    const isLivePayload = lowerParam !== '' && (
      lowerParam === 'live' ||
      lowerParam.includes('live_event') ||
      lowerParam.includes('live_redeem') ||
      lowerParam.includes('redeem_live') ||
      lowerParam.startsWith('redeem_') ||
      lowerParam.startsWith('live_') ||
      lowerParam.startsWith('live')
    );

    const { hasActiveEvent, liveEventState, activeData } = await checkLiveEventActive();
    console.log('Detected Live Event:', hasActiveEvent ? 'true' : 'false', 'State:', liveEventState);

      // 1. VOTE FLOW
      if (startParam.startsWith('vote_')) {
        const vParts = startParam.split('_');
        const contestId = vParts[1];
        const contestantId = vParts[2];

        console.log('PAYLOAD TYPE: VOTE');
        console.log('WAR ID: none');
        console.log('USER ID:', chatId);
        console.log('JOIN SUCCESS: pending/executing');
        logTelegramPayload(startParam, 'VOTE', 'none', chatId, 'Vote Flow Initiated');

        const contests = await getContests();
        const contest = contests.find((c) => c.id === contestId);

        if (!contest) {
          await sendTelegramApi(token, 'sendMessage', {
            chat_id: chatId,
            text: '❌ <b>Contest not found.</b>',
            parse_mode: 'HTML',
          });
          return;
        }

        if (contest.status === 'completed' || contest.votingEndedProcessed) {
          await sendTelegramApi(token, 'sendMessage', {
            chat_id: chatId,
            text: '🔒 <b>Voting Ended</b>\n\nVoting for this contest has concluded.',
            parse_mode: 'HTML',
          });
          return;
        }

        if (!contest.votingStarted) {
          await sendTelegramApi(token, 'sendMessage', {
            chat_id: chatId,
            text: '⏳ <b>Voting Not Started</b>\n\nVoting for this contest has not been started yet by admin.',
            parse_mode: 'HTML',
          });
          return;
        }

        if (existingUser) {
          await sendContestantVoteCard(token, chatId, contestId, contestantId);
          return;
        } else {
          await sendCreateAccountPrompt(token, chatId);
          return;
        }
      }

      // 2. GIVEAWAY WAR FLOW
      const warTypeDetected = detectWarPayloadType(startParam);
      if (warTypeDetected) {
        const warParam = await parseWarStartParam(startParam);

        if (warParam) {
          const { type, warId, teamId, teamName, inviterTgId } = warParam;
          console.log('PAYLOAD TYPE:', type);
          console.log('WAR ID:', warId);
          console.log('USER ID:', chatId);

          if (existingUser) {
            const result = await joinWarTeam(
              warId,
              {
                telegramId: String(chatId),
                name: existingUser.firstName,
                username: existingUser.username,
              },
              teamId,
              { invitedByTelegramId: inviterTgId }
            );

            if (result.success && result.team) {
              const botUsername = 'Roy_wallett_bot';
              const isLeader = result.member?.isTeamLeader || String(result.team.leaderTelegramId) === String(chatId);
              const actionText = isLeader ? 'Leader Created' : 'Team Joined';

              console.log('JOIN SUCCESS: true');
              logTelegramPayload(startParam, type, warId, chatId, actionText);

              if (isLeader) {
                const isTeamB = result.team.id.toLowerCase().includes('b') || result.team.name.toLowerCase().includes('b');
                const leaderLink = result.team.leaderInviteLink || `https://t.me/${botUsername}/roy_share_wallet?startapp=${isTeamB ? 'TEAMB_LEADER' : 'TEAMA_LEADER'}_${warId}_${chatId}`;
                await sendTelegramApi(token, 'sendMessage', {
                  chat_id: chatId,
                  text: `👑 <b>CONGRATULATIONS! You are the FIRST user to join ${result.team.name}!</b>\n\n` +
                    `You are now automatically assigned as the <b>👑 Official Team Leader</b> for <b>${result.team.name}</b>!\n\n` +
                    `🔗 <b>Your Personal Team Leader Invite Link:</b>\n` +
                    `<code>${leaderLink}</code>\n\n` +
                    `Share this link to recruit warriors directly to your team! Anyone joining through your link earns leadership bonus points for you!`,
                  parse_mode: 'HTML',
                });
              } else {
                const myTeamRefLink = `https://t.me/${botUsername}/roy_share_wallet?startapp=war_${warId}_team_${teamId}_ref_${chatId}`;
                await sendTelegramApi(token, 'sendMessage', {
                  chat_id: chatId,
                  text: `⚔️ <b>Joined Team ${result.team.name}!</b>\n\n` +
                    `You are now registered for <b>${result.team.name}</b> in Giveaway War!\n` +
                    `🔒 <b>Team Choice Locked.</b>\n\n` +
                    `🔗 <b>Your Unique Team Referral Link:</b>\n` +
                    `<code>${myTeamRefLink}</code>\n\n` +
                    `Share your referral link with friends! Anyone joining through your link automatically joins <b>${result.team.name}</b> and earns points for both you and your Team Leader!`,
                  parse_mode: 'HTML',
                });
              }
            } else {
              console.log('JOIN SUCCESS: false');
              logTelegramPayload(startParam, type, warId, chatId, `Team Join Status: ${result.message}`);
              await sendTelegramApi(token, 'sendMessage', {
                chat_id: chatId,
                text: `⚔️ <b>Giveaway War Team Status:</b>\n\n${result.message}`,
                parse_mode: 'HTML',
              });
            }
            return;
          } else {
            await sendCreateAccountPrompt(token, chatId);
            return;
          }
        } else {
          console.log('PAYLOAD TYPE:', warTypeDetected.type);
          console.log('WAR ID: none');
          console.log('USER ID:', chatId);
          console.log('JOIN SUCCESS: false');
          logTelegramPayload(startParam, warTypeDetected.type, 'none', chatId, 'War Event Not Found or Inactive');

          await sendTelegramApi(token, 'sendMessage', {
            chat_id: chatId,
            text: `⚔️ <b>Giveaway War Event Not Found</b>\n\nUnable to find an active Giveaway War matching this link. Please check the link or contact admin.`,
            parse_mode: 'HTML',
          });
          return;
        }
      }

      // 3. REFERRAL FLOW
      const referrer = await getUserByUid(startParam);
      if (referrer) {
        console.log('PAYLOAD TYPE: REFERRAL');
        console.log('WAR ID: none');
        console.log('USER ID:', chatId);
        console.log('JOIN SUCCESS: true');
        logTelegramPayload(startParam, 'REFERRAL', 'none', chatId, 'Referral Flow Initiated');

        if (existingUser) {
          await sendTelegramApi(token, 'sendMessage', {
            chat_id: chatId,
            text: `👋 <b>Welcome back, ${existingUser.firstName}!</b>\n\n` +
              `You are already registered in Roy Share Wallet.\n` +
              `👛 <b>Wallet Balance:</b> ₹${existingUser.walletBalance || 0}`,
            parse_mode: 'HTML',
            reply_markup: buildMainMenuKeyboard(hasActiveEvent),
          });
          if (hasActiveEvent || isLivePayload) {
            await sendLiveEventInfoMessage(token, chatId, liveEventState, activeData);
          }
          return;
        } else {
          await sendCreateAccountPrompt(token, chatId);
          return;
        }
      }

      // 4. UNRECOGNIZED PAYLOAD
      if (startParam) {
        console.log('PAYLOAD TYPE: UNKNOWN');
        console.log('WAR ID: none');
        console.log('USER ID:', chatId);
        console.log('JOIN SUCCESS: false');
        logTelegramPayload(startParam, 'UNKNOWN', 'none', chatId, 'Unrecognized Payload');

        await sendTelegramApi(token, 'sendMessage', {
          chat_id: chatId,
          text: `⚠️ <b>Invalid or Expired Link</b>\n\nThe deep link you clicked is invalid or has expired.`,
          parse_mode: 'HTML',
        });
        return;
      }

    // NO PAYLOAD - NORMAL WELCOME FLOW
    console.log('Reason if redirected to Welcome Screen:', 'No active live event in Firestore and no startParam provided. Reached normal welcome flow.');
    console.log('PAYLOAD: none');
    console.log('PAYLOAD TYPE: NONE');
    console.log('WAR ID: none');
    console.log('USER ID:', chatId);
    console.log('JOIN SUCCESS: N/A');
    logTelegramPayload('none', 'NONE', 'none', chatId, 'Normal Welcome Flow');

    if (existingUser) {
      userSessions.delete(chatId);
      await sendTelegramApi(token, 'sendMessage', {
        chat_id: chatId,
        text: `👋 <b>Welcome back, ${existingUser.firstName}!</b>\n\n` +
          `🆔 <b>UID:</b> <code>${existingUser.uid}</code>\n` +
          `📱 <b>Mobile:</b> <code>${existingUser.mobile}</code>\n` +
          `👛 <b>Wallet Balance:</b> ₹${existingUser.walletBalance || 0}`,
        parse_mode: 'HTML',
        reply_markup: buildMainMenuKeyboard(hasActiveEvent),
      });

      if (hasActiveEvent || isLivePayload) {
        await sendLiveEventInfoMessage(token, chatId, liveEventState, activeData);
      }
      return;
    } else {
      await sendCreateAccountPrompt(token, chatId);
      return;
    }
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

        const amt = activeSession.withdrawAmount || 0;
        const feePercent = adminConfig?.platformFeePercent !== undefined ? Number(adminConfig.platformFeePercent) : 6;
        const platformFee = Number(((amt * feePercent) / 100).toFixed(2));
        const payoutAmount = Number((amt - platformFee).toFixed(2));

        const walletBal = Number(existingUser.walletBalance) || 0;
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
            `💵 <b>Withdrawal Amount:</b> ₹${amt}\n` +
            `⚡ <b>Platform Fee (${feePercent}%):</b> ₹${platformFee}\n` +
            `🎁 <b>Amount You Will Receive:</b> ₹${payoutAmount}\n` +
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
    if (text === '👛 Wallet' || text === '💸 Withdraw' || text === '🎁 Refer & Earn' || text === '☎ Contact Us' || text === '🎁 Lucky Draw') {
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
        listText += `📌 <b>Status:</b> ${c.votingStarted ? 'Voting Live 🔵' : 'Registration Open 🟢'}\n`;
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

    if (text === '/war' || text === '⚔️ Giveaway War' || text.startsWith('/war')) {
      const warStats = await getWarStatsForTelegram(chatId);

      if (!warStats.hasActiveWar) {
        await sendTelegramApi(token, 'sendMessage', {
          chat_id: chatId,
          text: `⚔️ <b>Giveaway War System</b>\n\nThere is currently no live Giveaway War running. Check back soon for the next event!`,
          parse_mode: 'HTML',
        });
        return;
      }

      let warMsg = `⚔️ <b>${warStats.warTitle || 'Giveaway War'}</b>\n\n`;
      if (warStats.teamName && warStats.teamName !== 'None') {
        warMsg += `🛡 <b>Your Team:</b> <b>${warStats.teamName}</b>\n`;
        warMsg += `⭐ <b>Your Contribution:</b> <b>${warStats.points} Pts</b>\n`;
        warMsg += `🏅 <b>Your Rank:</b> #${warStats.userRank || '-'}\n`;
        warMsg += `📊 <b>Team Rank:</b> #${warStats.teamRank || '-'}\n\n`;
      } else {
        warMsg += `⚠️ <b>You haven't joined a team yet!</b>\nOpen the Mini App to choose your team and earn points.\n\n`;
      }

      warMsg += `👑 <b>Top Team:</b> ${warStats.topTeamName} (${warStats.topTeamScore} Pts)\n\n`;

      if (warStats.leaderboardTop3 && warStats.leaderboardTop3.length > 0) {
        warMsg += `🏆 <b>Top Contributors:</b>\n`;
        warStats.leaderboardTop3.forEach((m, idx) => {
          const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉';
          warMsg += `${medal} ${m.name} (${m.teamName}) - <b>${m.points} Pts</b>\n`;
        });
        warMsg += `\n`;
      }

      warMsg += `⏱ <b>End Date / Status:</b> ${warStats.remainingTime}`;

      await sendTelegramApi(token, 'sendMessage', {
        chat_id: chatId,
        text: warMsg,
        parse_mode: 'HTML',
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

    if (text === '💸 Withdraw' || text === '/withdraw') {
      const baseUrl = (process.env.PUBLIC_APP_URL || process.env.APP_URL || process.env.APP_BASE_URL || 'https://roy-share-wallet.onrender.com').replace(/\/$/, '');
      const withdrawMiniAppUrl = `${baseUrl}/?action=withdraw&tgId=${chatId}`;

      const allEnabled = adminConfig?.globalWithdrawalsEnabled !== false &&
                         adminConfig?.allWithdrawalsEnabled !== false &&
                         adminConfig?.enableWithdraw !== false;

      console.log(`[BOT WITHDRAWAL CHECK] chatId=${chatId}, globalWithdrawalsEnabled=${adminConfig?.globalWithdrawalsEnabled}, allWithdrawalsEnabled=${adminConfig?.allWithdrawalsEnabled}, enableWithdraw=${adminConfig?.enableWithdraw}, allEnabled=${allEnabled}`);

      if (!allEnabled) {
        await sendTelegramApi(token, 'sendMessage', {
          chat_id: chatId,
          text: `🔧 <b>Withdrawals Temporarily Unavailable</b>\n\n` +
            `Withdrawal service is currently under maintenance.\n` +
            `Please try again later.`,
          parse_mode: 'HTML',
        });
        return;
      }

      await sendTelegramApi(token, 'sendMessage', {
        chat_id: chatId,
        text: `💸 <b>Withdraw Funds</b>\n\n` +
          `💰 <b>Available Balance:</b> ₹${existingUser.walletBalance || 0}\n\n` +
          `Please tap the button below to open the secure Withdrawal Mini App and complete your request.`,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '💸 Open Withdrawal Mini App',
                web_app: { url: withdrawMiniAppUrl },
              },
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
          `<code>https://t.me/${(botUser || 'Roy_wallett_bot').replace(/^@/, '')}/roy_share_wallet?startapp=refer_${existingUser.uid}</code>\n\n` +
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

    if (text === '🎁 Lucky Draw' || text === '👥 Open Waiting Lobby' || text === 'Open Waiting Lobby' || text === '/lobby' || text === '/waitingroom' || text === '/lucky' || text === '/giveaway') {
      console.log('[LUCKY_DRAW_CLICK] Lucky Draw command clicked or typed:', text, 'Chat ID:', chatId);
      console.log('[LUCKY_DRAW_HANDLER] Beginning processing for Lucky Draw action...');

      try {
        // Query Firestore to get active giveaway
        let activeGiveaway: any = null;
        const giveawaysRef = collection(db, 'giveaways');
        const q = query(giveawaysRef, where('status', '==', 'active'), limit(1));
        const snap = await getDocs(q);

        if (!snap.empty) {
          activeGiveaway = snap.docs[0].data();
          console.log('[LUCKY_DRAW_HANDLER] Successfully loaded active giveaway from Firestore:', JSON.stringify(activeGiveaway));
        } else {
          console.log('[LUCKY_DRAW_HANDLER] Checked Firestore but no active giveaway was found.');
        }

        if (!activeGiveaway) {
          console.log('[LUCKY_DRAW_RESPONSE] Sending no active giveaway response');
          const res = await sendTelegramApi(token, 'sendMessage', {
            chat_id: chatId,
            text: '🎁 <b>No Lucky Giveaway is currently running.</b>\n\nStay tuned for upcoming draws!',
            parse_mode: 'HTML',
          });
          console.log('[LUCKY_DRAW_RESPONSE] Telegram API response for no active giveaway:', JSON.stringify(res));
          if (res && !res.ok) {
            console.error('[LUCKY_DRAW_RESPONSE] Failed to send "No active giveaway" message:', JSON.stringify(res));
          }
          return;
        }

        // We have an active giveaway. Prepare Mini App button
        let miniAppUrl = process.env.TELEGRAM_MINI_APP_URL || process.env.PUBLIC_APP_URL || process.env.APP_URL || '';
        if (miniAppUrl.includes('t.me/')) {
          miniAppUrl = process.env.PUBLIC_APP_URL || process.env.APP_URL || '';
        }

        if (!miniAppUrl) {
          console.warn('[LUCKY_DRAW_HANDLER] Both TELEGRAM_MINI_APP_URL and PUBLIC_APP_URL are empty. Using current environment host as fallback.');
          miniAppUrl = 'https://ais-dev-iecssl5uoae4d72ttmqrhh-963220536272.asia-southeast1.run.app';
        }

        const separator = miniAppUrl.includes('?') ? '&' : '?';
        const webAppUrl = `${miniAppUrl}${separator}startapp=giveaways`;

        console.log('[LUCKY_DRAW_HANDLER] Final web_app URL resolved to:', webAppUrl);

        const inlineKeyboard = {
          inline_keyboard: [
            [
              {
                text: '🎟️ Open Lucky Draw Grid',
                web_app: { url: webAppUrl }
              }
            ]
          ]
        };

        const res = await sendTelegramApi(token, 'sendMessage', {
          chat_id: chatId,
          text: `🎁 <b>Lucky Number Giveaway System V2</b>\n\n` +
                `Active Giveaway: <b>${activeGiveaway.title}</b>\n` +
                `Prize Pool: <b>₹${activeGiveaway.prizeAmount !== undefined ? activeGiveaway.prizeAmount : activeGiveaway.prizePool}</b>\n\n` +
                `Claim your lucky number slot directly in the Roy Wallet Mini App to win real cash prizes!\n\n` +
                `Click the button below to choose your number!`,
          parse_mode: 'HTML',
          reply_markup: inlineKeyboard,
        });

        console.log('[LUCKY_DRAW_RESPONSE] Telegram API response for active giveaway button:', JSON.stringify(res));
        if (res && !res.ok) {
          console.error('[LUCKY_DRAW_RESPONSE] Failed to send active giveaway Mini App button:', JSON.stringify(res));
        }

      } catch (err: any) {
        console.error('[LUCKY_DRAW_HANDLER] ERROR: Exception occurred in Lucky Draw handler:', err);
        if (err && err.stack) {
          console.error('[LUCKY_DRAW_HANDLER] Stack trace:', err.stack);
        }
        
        // Try to send fallback error message so user is not left hanging
        try {
          await sendTelegramApi(token, 'sendMessage', {
            chat_id: chatId,
            text: `❌ <b>An error occurred while opening the Lucky Draw.</b>\n\nPlease try again later.`,
            parse_mode: 'HTML',
          });
        } catch (sendErr) {
          console.error('[LUCKY_DRAW_HANDLER] Failed to send fallback error message to user:', sendErr);
        }
      }
      return;
    }
  }

  // C. UNREGISTERED USER FALLBACK
  if (!existingUser) {
    await sendCreateAccountPrompt(token, chatId);
    return;
  }

    // SHOW MAIN MENU
    const eventCheck = await checkLiveEventActive();
    await sendTelegramApi(token, 'sendMessage', {
      chat_id: chatId,
      text: ` Welcome to <b>Roy Share Wallet Bot</b>! Use the menu below to navigate:`,
      parse_mode: 'HTML',
      reply_markup: buildMainMenuKeyboard(eventCheck.hasActiveEvent),
    });

    if (eventCheck.hasActiveEvent) {
      await sendLiveEventInfoMessage(token, chatId, eventCheck.liveEventState, eventCheck.activeData);
    }
}
