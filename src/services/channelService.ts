import {
  collection,
  doc,
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
}

/**
 * Verify bot admin permissions for a single channel or group with detailed status codes
 */
export async function verifySingleChannelGroup(
  token: string,
  item: TelegramChannelItem
): Promise<ChannelVerificationResult> {
  const cleanToken = token.trim();
  if (!cleanToken) {
    return {
      success: false,
      status: 'Bot is not Admin',
      statusMessage: '❌ Bot Token Required',
      error: 'Bot Token is required for testing.',
    };
  }

  const targetIdentifier = item.chatId?.trim() || formatTelegramUsername(item.username);
  if (!targetIdentifier) {
    return {
      success: false,
      status: 'Invalid Chat ID',
      statusMessage: '❌ Invalid Chat ID',
      error: 'Channel/Group Username or Chat ID is missing.',
    };
  }

  let cleanTarget = targetIdentifier.trim();
  if (!cleanTarget.startsWith('@') && !cleanTarget.startsWith('-')) {
    cleanTarget = `@${cleanTarget}`;
  }

  try {
    // 1. Get Chat details
    const getChatRes = await fetch(
      `https://api.telegram.org/bot${cleanToken}/getChat?chat_id=${encodeURIComponent(cleanTarget)}`
    );
    const getChatData = await getChatRes.json();

    if (!getChatData.ok) {
      const desc = (getChatData.description || '').toLowerCase();
      if (desc.includes('not found') || desc.includes('chat not found')) {
        return {
          success: false,
          status: 'Chat Not Found',
          statusMessage: '❌ Chat Not Found',
          error: `Telegram Chat Not Found: ${getChatData.description || 'Target chat not found or private.'}`,
        };
      } else if (desc.includes('invalid') || desc.includes('wrong') || desc.includes('format')) {
        return {
          success: false,
          status: 'Invalid Chat ID',
          statusMessage: '❌ Invalid Chat ID',
          error: `Invalid Chat ID: ${getChatData.description}`,
        };
      } else {
        return {
          success: false,
          status: 'Chat Not Found',
          statusMessage: `❌ Chat Not Found (${getChatData.description || 'Chat unavailable'})`,
          error: getChatData.description,
        };
      }
    }

    // 2. Check Bot Admin status via getChatMember
    const botMe = await testBotToken(cleanToken);
    if (botMe.success && botMe.botId) {
      const memberRes = await fetch(
        `https://api.telegram.org/bot${cleanToken}/getChatMember?chat_id=${encodeURIComponent(cleanTarget)}&user_id=${botMe.botId}`
      );
      const memberData = await memberRes.json();

      if (memberData.ok && memberData.result) {
        const status = memberData.result.status;
        if (status === 'administrator' || status === 'creator' || (item.type === 'group' && status === 'member')) {
          return {
            success: true,
            status: 'Connected',
            statusMessage: '✅ Connected',
            details: getChatData.result,
          };
        } else {
          return {
            success: false,
            status: 'Bot is not Admin',
            statusMessage: `❌ Bot is not Admin (Current Status: "${status}")`,
            error: `Please promote Bot to Admin in ${cleanTarget}.`,
          };
        }
      } else {
        return {
          success: false,
          status: 'Bot is not Admin',
          statusMessage: '❌ Bot is not Admin',
          error: `Bot is not in ${cleanTarget}: ${memberData.description || 'Add Bot to chat'}`,
        };
      }
    }

    return {
      success: true,
      status: 'Connected',
      statusMessage: '✅ Connected',
      details: getChatData.result,
    };
  } catch (err: any) {
    return {
      success: false,
      status: 'Invalid Chat ID',
      statusMessage: `❌ Test Failed (${err.message || 'Network error'})`,
      error: err.message || 'Network error during test.',
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
