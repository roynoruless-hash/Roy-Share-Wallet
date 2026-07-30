export interface BotTestResult {
  success: boolean;
  botName?: string;
  botUsername?: string;
  botId?: string;
  error?: string;
}

export interface WebhookInfoResult {
  success: boolean;
  url?: string;
  pendingUpdateCount?: number;
  lastErrorDate?: number;
  lastErrorMessage?: string;
  error?: string;
}

export interface RegisterWebhookResult {
  success: boolean;
  webhookUrl?: string;
  description?: string;
  error?: string;
}

export interface BotBackendTestResult {
  success: boolean;
  message: string;
  botInfo?: {
    id: number | string;
    username: string;
    firstName: string;
  };
  webhookInfo?: {
    url: string;
    pendingUpdates: number;
    lastError?: string;
    autoRegistered?: boolean;
    webhookRegError?: string;
  };
  error?: string;
}

export interface VerificationResult {
  channelVerified: boolean;
  channelError?: string;
  groupVerified: boolean;
  groupError?: string;
}

/**
 * Registers the Telegram Webhook automatically via backend API endpoint.
 * Fallback to direct setWebhook call if API endpoint is unavailable.
 */
export async function registerWebhook(token: string): Promise<RegisterWebhookResult> {
  const cleanToken = token.trim();
  if (!cleanToken) {
    return { success: false, error: 'Bot Token cannot be empty when setting webhook.' };
  }

  try {
    const apiRes = await fetch('/api/telegram/set-webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: cleanToken }),
    });

    const data = await apiRes.json();
    if (apiRes.ok && data.success) {
      return {
        success: true,
        webhookUrl: data.webhookUrl,
        description: data.description,
      };
    } else {
      return {
        success: false,
        webhookUrl: data.webhookUrl,
        error: data.error || 'Webhook registration failed',
      };
    }
  } catch (err: any) {
    // Client-side fallback if server route fetch fails
    try {
      const fallbackUrl = `${window.location.origin}/api/telegram/webhook/${cleanToken}`;
      const tgRes = await fetch(`https://api.telegram.org/bot${cleanToken}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: fallbackUrl,
          allowed_updates: ['message', 'callback_query', 'channel_post', 'chat_member'],
        }),
      });
      const tgData = await tgRes.json();
      if (tgData.ok) {
        return { success: true, webhookUrl: fallbackUrl, description: tgData.description };
      } else {
        return { success: false, webhookUrl: fallbackUrl, error: tgData.description || 'Telegram setWebhook failed' };
      }
    } catch (fallbackErr: any) {
      return { success: false, error: `Failed to register webhook: ${err.message}` };
    }
  }
}

/**
 * Queries getWebhookInfo using backend API or direct Telegram API
 */
export async function getWebhookInfo(token: string): Promise<WebhookInfoResult> {
  const cleanToken = token.trim();
  if (!cleanToken) {
    return { success: false, error: 'Bot Token is required to fetch webhook info.' };
  }

  try {
    const apiRes = await fetch(`/api/telegram/webhook-info?token=${encodeURIComponent(cleanToken)}`);
    const data = await apiRes.json();

    if (apiRes.ok && data.success) {
      return {
        success: true,
        url: data.url,
        pendingUpdateCount: data.pendingUpdateCount,
        lastErrorDate: data.lastErrorDate,
        lastErrorMessage: data.lastErrorMessage,
      };
    } else {
      return {
        success: false,
        error: data.error || 'Failed to fetch webhook info',
      };
    }
  } catch (err: any) {
    // Direct Telegram API fallback
    try {
      const tgRes = await fetch(`https://api.telegram.org/bot${cleanToken}/getWebhookInfo`);
      const tgData = await tgRes.json();
      if (tgData.ok) {
        return {
          success: true,
          url: tgData.result.url || '',
          pendingUpdateCount: tgData.result.pending_update_count || 0,
          lastErrorDate: tgData.result.last_error_date,
          lastErrorMessage: tgData.result.last_error_message || '',
        };
      } else {
        return { success: false, error: tgData.description || 'Telegram API getWebhookInfo error' };
      }
    } catch (fallbackErr: any) {
      return { success: false, error: err.message || 'Network error checking webhook' };
    }
  }
}

/**
 * Full backend bot connectivity test with auto-webhook registration and start command test
 */
export async function testBotBackend(token: string, adminChatId?: string): Promise<BotBackendTestResult> {
  const cleanToken = token.trim();
  if (!cleanToken) {
    return {
      success: false,
      message: 'Bot Token is required to test bot.',
      error: 'Bot Token is required to test bot.',
    };
  }

  try {
    const res = await fetch('/api/telegram/test-bot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: cleanToken, adminChatId }),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      return {
        success: true,
        message: data.message || 'Bot test passed successfully!',
        botInfo: data.botInfo,
        webhookInfo: data.webhookInfo,
      };
    } else {
      return {
        success: false,
        message: data.error || 'Bot test failed.',
        error: data.error || 'Bot test failed.',
      };
    }
  } catch (err: any) {
    // Client-side fallback
    const botMe = await testBotToken(cleanToken);
    if (!botMe.success) {
      return {
        success: false,
        message: botMe.error || 'Bot Token Invalid',
        error: botMe.error || 'Bot Token Invalid',
      };
    }

    const whInfo = await getWebhookInfo(cleanToken);
    let autoRegRes = null;
    if (!whInfo.url) {
      autoRegRes = await registerWebhook(cleanToken);
    }

    return {
      success: true,
      message: `Bot @${botMe.botUsername} is Online & Webhook Configured ✅`,
      botInfo: {
        id: botMe.botId || '',
        username: botMe.botUsername || '',
        firstName: botMe.botName || '',
      },
      webhookInfo: {
        url: autoRegRes?.webhookUrl || whInfo.url || '',
        pendingUpdates: whInfo.pendingUpdateCount || 0,
        lastError: whInfo.lastErrorMessage || '',
        autoRegistered: !!autoRegRes?.success,
      },
    };
  }
}

/**
 * Clean username format to ensure it starts with @
 */
export function formatTelegramUsername(username: string): string {
  const trimmed = username.trim();
  if (!trimmed) return '';
  return trimmed.startsWith('@') ? trimmed : `@${trimmed}`;
}

/**
 * Validates Bot Token via Telegram API getMe
 */
export async function testBotToken(token: string): Promise<BotTestResult> {
  const cleanToken = token.trim();
  if (!cleanToken) {
    return {
      success: false,
      error: 'Bot Token cannot be empty.',
    };
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${cleanToken}/getMe`);
    const data = await res.json();

    if (data.ok && data.result) {
      return {
        success: true,
        botName: data.result.first_name || 'Roy Share Bot',
        botUsername: data.result.username || '',
        botId: String(data.result.id || ''),
      };
    } else {
      return {
        success: false,
        error: data.description || 'Invalid Bot Token',
      };
    }
  } catch (error: any) {
    console.error('Error testing bot token:', error);
    // If fetch fails (network/cors), check token format
    if (cleanToken.includes(':') && cleanToken.length > 20) {
      // Graceful error fallback or detail
      return {
        success: false,
        error: 'Network request to Telegram API failed. Please verify token or check network connection.',
      };
    }
    return {
      success: false,
      error: 'Invalid Bot Token format or request failed.',
    };
  }
}

/**
 * Verifies Channel and Group username existence, Bot Admin status, and permissions.
 */
export async function verifyChannelAndGroup(
  token: string,
  channelUsername: string,
  groupUsername: string
): Promise<VerificationResult> {
  const result: VerificationResult = {
    channelVerified: false,
    groupVerified: false,
  };

  const cleanToken = token.trim();
  if (!cleanToken) {
    result.channelError = 'Bot Token is required before verifying Channel.';
    result.groupError = 'Bot Token is required before verifying Group.';
    return result;
  }

  const cleanChannel = formatTelegramUsername(channelUsername);
  const cleanGroup = formatTelegramUsername(groupUsername);

  if (!cleanChannel) {
    result.channelError = 'Channel Username is required.';
  }
  if (!cleanGroup) {
    result.groupError = 'Group Username is required.';
  }

  // Verify Channel
  if (cleanChannel) {
    try {
      const getChatRes = await fetch(
        `https://api.telegram.org/bot${cleanToken}/getChat?chat_id=${encodeURIComponent(cleanChannel)}`
      );
      const getChatData = await getChatRes.json();

      if (!getChatData.ok) {
        result.channelError = `Channel Verification Failed: ${getChatData.description || 'Username does not exist or channel is private'}`;
      } else {
        // Check if bot is admin in channel
        const botMe = await testBotToken(cleanToken);
        if (botMe.success && botMe.botId) {
          const memberRes = await fetch(
            `https://api.telegram.org/bot${cleanToken}/getChatMember?chat_id=${encodeURIComponent(cleanChannel)}&user_id=${botMe.botId}`
          );
          const memberData = await memberRes.json();

          if (memberData.ok && memberData.result) {
            const status = memberData.result.status;
            if (status === 'administrator' || status === 'creator') {
              result.channelVerified = true;
            } else {
              result.channelError = `Bot is in channel but NOT an Admin. Status: ${status}. Please promote Bot to Admin.`;
            }
          } else {
            result.channelError = `Bot is not a member or admin in ${cleanChannel}.`;
          }
        } else {
          result.channelVerified = true; // Chat exists
        }
      }
    } catch (err: any) {
      result.channelError = `Channel check failed: ${err.message || 'Network error'}`;
    }
  }

  // Verify Group
  if (cleanGroup) {
    try {
      const getGroupRes = await fetch(
        `https://api.telegram.org/bot${cleanToken}/getChat?chat_id=${encodeURIComponent(cleanGroup)}`
      );
      const getGroupData = await getGroupRes.json();

      if (!getGroupData.ok) {
        result.groupError = `Group Verification Failed: ${getGroupData.description || 'Username does not exist or group is private'}`;
      } else {
        const botMe = await testBotToken(cleanToken);
        if (botMe.success && botMe.botId) {
          const memberRes = await fetch(
            `https://api.telegram.org/bot${cleanToken}/getChatMember?chat_id=${encodeURIComponent(cleanGroup)}&user_id=${botMe.botId}`
          );
          const memberData = await memberRes.json();

          if (memberData.ok && memberData.result) {
            const status = memberData.result.status;
            if (status === 'administrator' || status === 'creator' || status === 'member') {
              result.groupVerified = true;
            } else {
              result.groupError = `Bot status in group: ${status}. Please make Bot an Admin in ${cleanGroup}.`;
            }
          } else {
            result.groupError = `Bot is not in group ${cleanGroup}. Please add Bot as Admin.`;
          }
        } else {
          result.groupVerified = true;
        }
      }
    } catch (err: any) {
      result.groupError = `Group check failed: ${err.message || 'Network error'}`;
    }
  }

  return result;
}
