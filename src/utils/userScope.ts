/**
 * Account Scope Isolation Helpers for Bot Data Separation
 * Every user account MUST belong to exactly one bot/platform scope:
 * - Roy Share Wallet: accountScope = "ROY_SHARE_WALLET", earningBotId = null
 * - Earning Bot: accountScope = "EARNING_BOT", earningBotId = "<bot_id>"
 * - Unresolved: accountScope = "UNRESOLVED", earningBotId = null
 */

export type AccountScope = 'ROY_SHARE_WALLET' | 'EARNING_BOT' | 'UNRESOLVED';

export interface UserScopeInfo {
  accountScope: AccountScope;
  earningBotId: string | null;
}

/**
 * Determine the strict account scope and earningBotId for any user document
 */
export function ensureUserAccountScope(docId: string, data: any): UserScopeInfo {
  if (!data) {
    return { accountScope: 'UNRESOLVED', earningBotId: null };
  }

  // 1. Explicitly tagged accountScope
  if (data.accountScope === 'ROY_SHARE_WALLET') {
    return { accountScope: 'ROY_SHARE_WALLET', earningBotId: null };
  }
  if (data.accountScope === 'EARNING_BOT') {
    const eBotId = String(data.earningBotId || data.botId || '').trim();
    if (eBotId && eBotId !== 'ROY_SHARE_WALLET') {
      return { accountScope: 'EARNING_BOT', earningBotId: eBotId };
    }
  }

  // 2. Infer from earningBotId or botId
  const rawEarningBotId = String(data.earningBotId || '').trim();
  if (rawEarningBotId && rawEarningBotId !== 'ROY_SHARE_WALLET') {
    return { accountScope: 'EARNING_BOT', earningBotId: rawEarningBotId };
  }

  const rawBotId = String(data.botId || '').trim();
  if (rawBotId && rawBotId !== 'ROY_SHARE_WALLET' && rawBotId !== 'main' && rawBotId !== 'official') {
    return { accountScope: 'EARNING_BOT', earningBotId: rawBotId };
  }

  // 3. Infer from docId format `${botId}_${telegramId}`
  if (docId && docId.includes('_')) {
    const parts = docId.split('_');
    if (parts.length >= 2 && parts[0] && parts[1]) {
      const prefix = parts[0].trim();
      if (prefix !== 'ROY' && prefix !== 'ROY_SHARE' && prefix !== 'MAIN') {
        return { accountScope: 'EARNING_BOT', earningBotId: prefix };
      }
    }
  }

  // 4. Infer Roy Share Wallet main user
  // If user has telegramId or appUid or mobile and no Earning Bot indicators
  if (data.telegramId || data.appUid || data.uid || data.mobile) {
    if (!rawBotId || rawBotId === 'ROY_SHARE_WALLET' || rawBotId === 'main' || rawBotId === 'official') {
      return { accountScope: 'ROY_SHARE_WALLET', earningBotId: null };
    }
  }

  // 5. Unresolved fallback
  return { accountScope: 'UNRESOLVED', earningBotId: null };
}

/**
 * Returns true if the user belongs strictly to the main Roy Share Wallet system
 */
export function isRoyShareWalletUser(docId: string, data: any): boolean {
  const scope = ensureUserAccountScope(docId, data);
  return scope.accountScope === 'ROY_SHARE_WALLET';
}

/**
 * Returns true if the user belongs to a specific connected Earning Bot
 */
export function isEarningBotUser(targetBotId: string, docId: string, data: any): boolean {
  if (!targetBotId) return false;
  const scope = ensureUserAccountScope(docId, data);
  if (scope.accountScope !== 'EARNING_BOT') return false;
  
  const cleanTarget = String(targetBotId).trim().toLowerCase();
  const cleanUserBot = String(scope.earningBotId || '').trim().toLowerCase();
  
  return cleanUserBot === cleanTarget;
}
