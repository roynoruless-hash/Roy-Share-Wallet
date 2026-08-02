import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  deleteDoc,
  query,
  orderBy,
  writeBatch,
  increment,
} from 'firebase/firestore';
import { db } from './firebase';
import { TelegramChannelItem } from '../types';
import { formatTelegramUsername, testBotToken } from './telegramService';

const CHANNELS_COLLECTION = 'telegramChannels';

/**
 * Auto-increment the global verificationVersion inside settings/config
 */
async function incrementVerificationVersion() {
  try {
    const configRef = doc(db, 'settings', 'config');
    await setDoc(configRef, { verificationVersion: increment(1) }, { merge: true });
  } catch (err) {
    console.warn('Failed to increment verificationVersion:', err);
  }
}

/**
 * Fetch all Telegram channels and groups from Firestore ordered by position
 */
export async function getTelegramChannels(): Promise<TelegramChannelItem[]> {
  try {
    const colRef = collection(db, CHANNELS_COLLECTION);
    const q = query(colRef, orderBy('position', 'asc'));
    const snapshot = await getDocs(q);

    const list: TelegramChannelItem[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      list.push({
        id: docSnap.id,
        type: data.type === 'group' ? 'group' : 'channel',
        username: data.username || '',
        chatId: data.chatId || '',
        displayName: data.displayName || (data.type === 'group' ? 'Main Group' : 'Main Channel'),
        required: data.required !== false,
        active: data.active !== false,
        position: typeof data.position === 'number' ? data.position : list.length,
        createdAt: data.createdAt || new Date().toISOString(),
        status: data.status || 'unverified',
        verifyError: data.verifyError || '',
      });
    });

    // Sort by position explicitly
    return list.sort((a, b) => a.position - b.position);
  } catch (err) {
    console.error('Error fetching telegram channels:', err);
    return [];
  }
}

/**
 * Save or create a channel/group document in Firestore
 */
export async function saveTelegramChannel(
  item: Omit<TelegramChannelItem, 'id'> & { id?: string }
): Promise<TelegramChannelItem> {
  const cleanUsername = formatTelegramUsername(item.username);
  const cleanChatId = item.chatId ? item.chatId.trim() : cleanUsername;

  const dataToSave = {
    type: item.type,
    username: cleanUsername,
    chatId: cleanChatId,
    displayName: item.displayName.trim() || (item.type === 'group' ? 'Group' : 'Channel'),
    required: Boolean(item.required),
    active: Boolean(item.active),
    position: typeof item.position === 'number' ? item.position : 0,
    createdAt: item.createdAt || new Date().toISOString(),
    status: item.status || 'unverified',
    verifyError: item.verifyError || '',
  };

  if (item.id) {
    const docRef = doc(db, CHANNELS_COLLECTION, item.id);
    await setDoc(docRef, dataToSave, { merge: true });
    await incrementVerificationVersion();
    return { id: item.id, ...dataToSave };
  } else {
    const colRef = collection(db, CHANNELS_COLLECTION);
    const docRef = await addDoc(colRef, dataToSave);
    await incrementVerificationVersion();
    return { id: docRef.id, ...dataToSave };
  }
}

/**
 * Delete a channel/group document from Firestore
 */
export async function deleteTelegramChannel(id: string): Promise<void> {
  if (!id) return;
  const docRef = doc(db, CHANNELS_COLLECTION, id);
  await deleteDoc(docRef);
  await incrementVerificationVersion();
}

/**
 * Batch update positions of channel items
 */
export async function updateChannelsPositions(items: TelegramChannelItem[]): Promise<void> {
  if (!items || items.length === 0) return;
  const batch = writeBatch(db);

  items.forEach((item, index) => {
    if (item.id) {
      const ref = doc(db, CHANNELS_COLLECTION, item.id);
      batch.update(ref, { position: index });
    }
  });

  await batch.commit();
}

/**
 * Enable or Disable All channels/groups
 */
export async function setAllChannelsActiveStatus(
  items: TelegramChannelItem[],
  active: boolean
): Promise<TelegramChannelItem[]> {
  const updatedList: TelegramChannelItem[] = [];
  const batch = writeBatch(db);

  items.forEach((item) => {
    const updated = { ...item, active };
    updatedList.push(updated);

    if (item.id) {
      const ref = doc(db, CHANNELS_COLLECTION, item.id);
      batch.update(ref, { active });
    }
  });

  if (items.length > 0) {
    await batch.commit();
  }

  return updatedList;
}

export interface ChannelVerificationResult {
  success: boolean;
  status: 'Connected' | 'Chat Not Found' | 'Bot is not Admin' | 'Invalid Chat ID';
  statusMessage: string;
  error?: string;
  details?: any;
  debugInfo: {
    savedChatId: string;
    savedUsername: string;
    chatIdUsed: string;
    apiUrl: string;
    apiResponse: any;
    errorReason: string;
  };
}

/**
  * Pure helper to resolve target Chat ID without wrongly forcing numeric IDs into usernames
  */
export function resolveTargetChatId(chatId?: string, username?: string, type?: string): string {
  const rawChatId = (chatId || '').trim();
  const rawUsername = (username || '').trim();

  // 1. If chatId is provided, prioritize chatId directly!
  if (rawChatId) {
    // If it already starts with @ or -, return as is
    if (rawChatId.startsWith('@') || rawChatId.startsWith('-')) {
      return rawChatId;
    }
    // If it's numeric digits only
    if (/^\d+$/.test(rawChatId)) {
      if (rawChatId.startsWith('100')) {
        return `-${rawChatId}`;
      } else {
        return `-100${rawChatId}`;
      }
    }
    // If user typed e.g. "roy_official_channel" into chatId field
    if (/^[a-zA-Z0-9_]+$/.test(rawChatId)) {
      return `@${rawChatId}`;
    }
    return rawChatId;
  }

  // 2. Only if chatId is missing, use username
  if (rawUsername) {
    const cleanUser = rawUsername.replace(/^@/, '').trim();
    if (cleanUser) {
      return `@${cleanUser}`;
    }
  }

  return '';
}

/**
 * Verify bot admin permissions for a single channel or group with detailed status codes
 */
export async function verifySingleChannelGroup(
  token: string,
  item: TelegramChannelItem
): Promise<ChannelVerificationResult> {
  let savedChatId = item.chatId || '';
  let savedUsername = item.username || '';

  // Requirement 1: Read the latest saved Channel ID directly from Firestore (do not use cached values)
  if (item.id && item.id !== 'temp') {
    try {
      const docRef = doc(db, CHANNELS_COLLECTION, item.id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const fresh = docSnap.data();
        savedChatId = fresh.chatId ?? savedChatId;
        savedUsername = fresh.username ?? savedUsername;
        item = {
          ...item,
          chatId: savedChatId,
          username: savedUsername,
          displayName: fresh.displayName || item.displayName,
          type: fresh.type || item.type,
        };
      }
    } catch (err) {
      console.warn('[Telegram Verification] Failed to read fresh Firestore document:', err);
    }
  }

  const cleanToken = token.trim();
  if (!cleanToken) {
    return {
      success: false,
      status: 'Bot is not Admin',
      statusMessage: '❌ Bot Token Required',
      error: 'Bot Token is required for testing.',
      debugInfo: {
        savedChatId,
        savedUsername,
        chatIdUsed: 'N/A',
        apiUrl: 'N/A',
        apiResponse: null,
        errorReason: 'Bot Token is empty or missing in Settings.',
      },
    };
  }

  // Requirement 6: Do not resolve chats using usernames if chatId is available
  const cleanTarget = resolveTargetChatId(item.chatId, item.username, item.type);

  if (!cleanTarget) {
    return {
      success: false,
      status: 'Invalid Chat ID',
      statusMessage: '❌ Invalid Chat ID',
      error: 'Channel/Group Username or Chat ID is missing.',
      debugInfo: {
        savedChatId,
        savedUsername,
        chatIdUsed: 'N/A',
        apiUrl: 'N/A',
        apiResponse: null,
        errorReason: 'Neither Chat ID nor Username was provided.',
      },
    };
  }

  // Requirement 2: Log exact Chat ID being used for API request
  console.log('[Telegram Verification] Saved Chat ID:', savedChatId);
  console.log('[Telegram Verification] Saved Username:', savedUsername);
  console.log('[Telegram Verification] Exact Chat ID used for API request:', cleanTarget);

  const getChatUrl = `https://api.telegram.org/bot${cleanToken}/getChat?chat_id=${encodeURIComponent(cleanTarget)}`;
  // Requirement 3: Log exact Bot API URL
  console.log('[Telegram Verification] Exact Bot API URL:', getChatUrl);

  try {
    // Requirement 4: Validate using getChat(chat_id)
    const getChatRes = await fetch(getChatUrl);
    const getChatData = await getChatRes.json();

    // Requirement 3: Log API response
    console.log('[Telegram Verification] API Response:', JSON.stringify(getChatData));

    if (!getChatData.ok) {
      const desc = getChatData.description || 'Target chat not found or private.';
      const descLower = desc.toLowerCase();
      let status: 'Chat Not Found' | 'Invalid Chat ID' | 'Bot is not Admin' = 'Chat Not Found';
      let statusMsg = '❌ Chat Not Found';

      if (descLower.includes('not found') || descLower.includes('chat not found')) {
        status = 'Chat Not Found';
        statusMsg = '❌ Chat Not Found';
      } else if (descLower.includes('invalid') || descLower.includes('wrong') || descLower.includes('format')) {
        status = 'Invalid Chat ID';
        statusMsg = '❌ Invalid Chat ID';
      } else {
        status = 'Chat Not Found';
        statusMsg = `❌ Chat Not Found (${desc})`;
      }

      return {
        success: false,
        status,
        statusMessage: statusMsg,
        error: desc,
        debugInfo: {
          savedChatId,
          savedUsername,
          chatIdUsed: cleanTarget,
          apiUrl: getChatUrl,
          apiResponse: getChatData,
          errorReason: desc,
        },
      };
    }

    // Requirement 5: If getChat succeeds, check Bot Admin status via getChatMember
    const botMe = await testBotToken(cleanToken);
    let botMemberResponse: any = null;
    let botMemberUrl = 'N/A';

    if (botMe.success && botMe.botId) {
      botMemberUrl = `https://api.telegram.org/bot${cleanToken}/getChatMember?chat_id=${encodeURIComponent(cleanTarget)}&user_id=${botMe.botId}`;
      const memberRes = await fetch(botMemberUrl);
      botMemberResponse = await memberRes.json();

      console.log('[Telegram Verification] getChatMember URL:', botMemberUrl);
      console.log('[Telegram Verification] getChatMember Response:', JSON.stringify(botMemberResponse));

      if (botMemberResponse.ok && botMemberResponse.result) {
        const memberStatus = botMemberResponse.result.status;
        if (memberStatus === 'administrator' || memberStatus === 'creator' || (item.type === 'group' && memberStatus === 'member')) {
          return {
            success: true,
            status: 'Connected',
            statusMessage: '✅ Connected',
            details: getChatData.result,
            debugInfo: {
              savedChatId,
              savedUsername,
              chatIdUsed: cleanTarget,
              apiUrl: getChatUrl,
              apiResponse: { getChat: getChatData, getChatMember: botMemberResponse },
              errorReason: 'None (Connected successfully)',
            },
          };
        } else {
          const errText = `Bot is in chat but status is "${memberStatus}". Please promote Bot to Admin in ${cleanTarget}.`;
          return {
            success: false,
            status: 'Bot is not Admin',
            statusMessage: `❌ Bot is not Admin (Current Status: "${memberStatus}")`,
            error: errText,
            debugInfo: {
              savedChatId,
              savedUsername,
              chatIdUsed: cleanTarget,
              apiUrl: botMemberUrl,
              apiResponse: { getChat: getChatData, getChatMember: botMemberResponse },
              errorReason: errText,
            },
          };
        }
      } else {
        const errText = `Bot is not in ${cleanTarget}: ${botMemberResponse?.description || 'Add Bot to chat'}`;
        return {
          success: false,
          status: 'Bot is not Admin',
          statusMessage: '❌ Bot is not Admin',
          error: errText,
          debugInfo: {
            savedChatId,
            savedUsername,
            chatIdUsed: cleanTarget,
            apiUrl: botMemberUrl,
            apiResponse: { getChat: getChatData, getChatMember: botMemberResponse },
            errorReason: errText,
          },
        };
      }
    }

    return {
      success: true,
      status: 'Connected',
      statusMessage: '✅ Connected',
      details: getChatData.result,
      debugInfo: {
        savedChatId,
        savedUsername,
        chatIdUsed: cleanTarget,
        apiUrl: getChatUrl,
        apiResponse: getChatData,
        errorReason: 'None (Connected successfully)',
      },
    };
  } catch (err: any) {
    const errorMsg = err.message || 'Network error during API request.';
    console.error('[Telegram Verification] Network Exception:', err);
    return {
      success: false,
      status: 'Invalid Chat ID',
      statusMessage: `❌ Test Failed (${errorMsg})`,
      error: errorMsg,
      debugInfo: {
        savedChatId,
        savedUsername,
        chatIdUsed: cleanTarget,
        apiUrl: getChatUrl,
        apiResponse: { error: errorMsg },
        errorReason: errorMsg,
      },
    };
  }
}

/**
 * Verify all active channels/groups and update their statuses in Firestore
 */
export async function verifyAndSyncAllChannels(
  token: string,
  items: TelegramChannelItem[]
): Promise<TelegramChannelItem[]> {
  const updatedItems: TelegramChannelItem[] = [];

  for (const item of items) {
    if (!item.active) {
      updatedItems.push({
        ...item,
        status: 'unverified',
        verifyError: 'Item is currently inactive.',
      });
      continue;
    }

    const testRes = await verifySingleChannelGroup(token, item);
    const newStatus = testRes.success ? 'verified' : 'error';
    const newError = testRes.error || '';

    const updated = {
      ...item,
      status: newStatus as 'verified' | 'error',
      verifyError: newError,
    };

    updatedItems.push(updated);

    // Update in Firestore
    if (item.id) {
      try {
        const ref = doc(db, CHANNELS_COLLECTION, item.id);
        await setDoc(ref, { status: newStatus, verifyError: newError }, { merge: true });
      } catch (e) {
        console.warn('Failed to save status to Firestore:', e);
      }
    }
  }

  return updatedItems;
}
