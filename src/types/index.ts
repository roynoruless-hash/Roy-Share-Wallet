export interface AdminConfig {
  // Telegram Configuration
  botToken: string;
  botUsername: string;
  botName: string;
  botId: string;
  adminTelegramId: string;
  adminChatId: string;
  botTokenValidated: boolean;
  botVerifyError?: string;
  webhookError?: string;

  // Channel & Group
  mainChannelUsername: string;
  mainGroupUsername: string;
  forceJoinEnabled: boolean;
  autoVerificationEnabled: boolean;
  channelVerified: boolean;
  groupVerified: boolean;
  channelVerifyError?: string;
  groupVerifyError?: string;

  // Wallet Settings
  registrationBonus: number;
  referralBonus: number;
  minWithdrawal: number;
  maxWithdrawal: number;
  withdrawalTax: number;
  uidLength: number;

  // Withdrawal Settings
  enableWithdraw: boolean;
  enableUpi: boolean;
  enableQr: boolean;
  enableRedeemCode: boolean;
  processingTimeNotice: string;

  // Referral Settings
  referralEnable: boolean;
  rewardPerReferral: number;
  selfReferralProtection: boolean;
  duplicateReferralProtection: boolean;

  // Support Settings
  supportUsername: string;
  supportGroup: string;

  // Security
  maintenanceMode: boolean;
  allowedAdminIds: string;
  sessionTimeout: number;
  adminPin?: string;
  diagnosticError?: string;

  // Metadata
  updatedAt?: string;
}

export type LogType = 'registration' | 'withdrawal' | 'referral' | 'error' | 'activity';

export interface LogEntry {
  id: string;
  type: LogType;
  message: string;
  timestamp: string;
  details?: Record<string, any>;
}

export interface DiagnosticItem {
  id: string;
  name: string;
  key: string;
  status: 'green' | 'red' | 'pending' | 'checking';
  message: string;
  details?: string;
  lastChecked?: string;
}

export type TabType =
  | 'dashboard'
  | 'telegram'
  | 'channel'
  | 'wallet'
  | 'withdrawal'
  | 'referral'
  | 'support'
  | 'security'
  | 'logs'
  | 'diagnostics';
