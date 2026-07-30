import { doc, getDoc, setDoc, collection, addDoc, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from './firebase';
import { AdminConfig, LogEntry, LogType } from '../types';

export const DEFAULT_CONFIG: AdminConfig = {
  // Telegram Configuration
  botToken: '',
  botUsername: '',
  botName: '',
  botId: '',
  adminTelegramId: '',
  adminChatId: '',
  botTokenValidated: false,
  botVerifyError: '',
  webhookError: '',

  // Channel & Group
  mainChannelUsername: '',
  mainGroupUsername: '',
  forceJoinEnabled: true,
  autoVerificationEnabled: true,
  channelVerified: false,
  groupVerified: false,
  channelVerifyError: '',
  groupVerifyError: '',

  // Wallet Settings
  registrationBonus: 0,
  referralBonus: 0,
  minWithdrawal: 100,
  maxWithdrawal: 300,
  withdrawalTax: 5,
  uidLength: 6,

  // Withdrawal Settings
  enableWithdraw: true,
  enableUpi: true,
  enableQr: true,
  enableRedeemCode: true,
  processingTimeNotice: 'Withdrawals are processed within 24 hours.',

  // Referral Settings
  referralEnable: true,
  rewardPerReferral: 5,
  selfReferralProtection: true,
  duplicateReferralProtection: true,

  // Support Settings
  supportUsername: '@royshare',
  supportGroup: '',

  // Security
  maintenanceMode: false,
  allowedAdminIds: '',
  sessionTimeout: 60,
  adminPin: 'admin123',
  diagnosticError: '',

  // Metadata
  updatedAt: new Date().toISOString(),
};

const SETTINGS_COLLECTION = 'settings';
const CONFIG_DOC_ID = 'config';
const LOGS_COLLECTION = 'logs';
const LOCAL_CACHE_KEY = 'royshare_admin_config_cache';

/**
 * Reusable function that recursively converts or strips `undefined` values from an object before Firestore writes.
 * - String/error fields => ""
 * - Boolean fields => false
 * - Number fields => 0
 * Ensures setDoc and addDoc never fail with 'Unsupported field value: undefined'.
 */
export function sanitizeFirestoreData<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return null as any;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeFirestoreData(item)) as any;
  }

  if (typeof obj === 'object') {
    const cleaned: Record<string, any> = {};
    for (const key of Object.keys(obj)) {
      const val = (obj as any)[key];

      if (val === undefined) {
        if (
          key.endsWith('Error') ||
          key.endsWith('Message') ||
          key.endsWith('Notice') ||
          key.endsWith('Id') ||
          key.endsWith('Token') ||
          key.endsWith('Username') ||
          key.endsWith('Group') ||
          key.endsWith('Name') ||
          key.endsWith('Pin') ||
          key.endsWith('At')
        ) {
          cleaned[key] = '';
        } else if (
          key.endsWith('Enabled') ||
          key.endsWith('Verified') ||
          key.endsWith('Protection') ||
          key.endsWith('Mode') ||
          key.endsWith('Enable') ||
          key.endsWith('Validated')
        ) {
          cleaned[key] = false;
        } else if (
          key.endsWith('Bonus') ||
          key.endsWith('Tax') ||
          key.endsWith('Length') ||
          key.endsWith('Timeout') ||
          key.endsWith('Withdrawal') ||
          key.endsWith('Referral')
        ) {
          cleaned[key] = 0;
        } else {
          cleaned[key] = '';
        }
      } else if (val !== null && typeof val === 'object') {
        cleaned[key] = sanitizeFirestoreData(val);
      } else {
        cleaned[key] = val;
      }
    }
    return cleaned as T;
  }

  return obj;
}

export interface LoadConfigResult {
  config: AdminConfig;
  isError: boolean;
  errorMessage?: string;
}

/**
 * Loads the admin configuration from Firestore settings/config document.
 * Caches loaded config to local storage to preserve form state if Firestore is unavailable.
 */
export async function loadAdminConfig(): Promise<LoadConfigResult> {
  let cachedConfig: AdminConfig = DEFAULT_CONFIG;
  try {
    const rawLocal = localStorage.getItem(LOCAL_CACHE_KEY);
    if (rawLocal) {
      cachedConfig = {
        ...DEFAULT_CONFIG,
        ...JSON.parse(rawLocal),
      };
    }
  } catch (e) {
    // ignore JSON parse error
  }

  try {
    const configDocRef = doc(db, SETTINGS_COLLECTION, CONFIG_DOC_ID);
    const docSnap = await getDoc(configDocRef);

    if (docSnap.exists()) {
      const data = docSnap.data() as Partial<AdminConfig>;
      const merged: AdminConfig = {
        ...DEFAULT_CONFIG,
        ...data,
      };

      const sanitizedMerged = sanitizeFirestoreData(merged);

      // Update local storage backup
      try {
        localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(sanitizedMerged));
      } catch (e) {
        console.warn('Unable to write local storage config cache:', e);
      }

      return { config: sanitizedMerged, isError: false };
    } else {
      // Document does not exist in Firestore yet. Return cached or default config.
      return { config: sanitizeFirestoreData(cachedConfig), isError: false };
    }
  } catch (error: any) {
    console.error('Error loading configuration from Firestore:', error);
    // If Firestore is unavailable, return cached configuration and report error without clearing form values
    return {
      config: sanitizeFirestoreData(cachedConfig),
      isError: true,
      errorMessage: error?.message || 'Firestore connection unavailable.',
    };
  }
}

/**
 * Saves all settings into Firestore collection 'settings', document 'config'.
 * Also updates local storage cache.
 */
export async function saveAdminConfig(config: AdminConfig): Promise<void> {
  const rawPayload: AdminConfig = {
    ...config,
    updatedAt: new Date().toISOString(),
  };

  const payload = sanitizeFirestoreData(rawPayload);

  // Always sync to local storage cache first so values survive refresh even offline
  try {
    localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn('Unable to cache config to local storage:', e);
  }

  const configDocRef = doc(db, SETTINGS_COLLECTION, CONFIG_DOC_ID);
  await setDoc(configDocRef, payload, { merge: true });
}

/**
 * Adds an activity or error log entry to Firestore logs collection.
 */
export async function logSystemEvent(
  type: LogType,
  message: string,
  details: Record<string, any> = {}
): Promise<void> {
  try {
    const logsRef = collection(db, LOGS_COLLECTION);
    const sanitizedDetails = sanitizeFirestoreData(details);
    const sanitizedEntry = sanitizeFirestoreData({
      type,
      message,
      timestamp: new Date().toISOString(),
      details: sanitizedDetails,
    });
    await addDoc(logsRef, sanitizedEntry);
  } catch (err) {
    console.warn('Failed to record system log to Firestore:', err);
  }
}

/**
 * Fetches recent logs from Firestore if available.
 */
export async function fetchSystemLogs(filterType?: LogType): Promise<LogEntry[]> {
  try {
    const logsRef = collection(db, LOGS_COLLECTION);
    const q = query(logsRef, orderBy('timestamp', 'desc'), limit(50));
    const snapshot = await getDocs(q);

    const logs: LogEntry[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      logs.push({
        id: docSnap.id,
        type: data.type || 'activity',
        message: data.message || '',
        timestamp: data.timestamp || new Date().toISOString(),
        details: data.details || {},
      });
    });

    if (filterType) {
      return logs.filter((l) => l.type === filterType);
    }
    return logs;
  } catch (err) {
    console.warn('Error fetching logs from Firestore:', err);
    return [];
  }
}
