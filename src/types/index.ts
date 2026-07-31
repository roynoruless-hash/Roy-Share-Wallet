export interface TelegramChannelItem {
  id: string;
  type: 'channel' | 'group';
  username: string;
  chatId: string;
  displayName: string;
  required: boolean;
  active: boolean;
  position: number;
  createdAt: string;
  status?: 'verified' | 'unverified' | 'checking' | 'error';
  verifyError?: string;
}

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
  referralRewardType?: 'wallet' | 'coins' | 'bonus';
  referralRewardCredit?: 'automatic' | 'manual';
  minReferralsBeforeClaim?: number;
  maxMilestoneLimit?: number;
  allowOnlyOneClaimPerMilestone?: boolean;
  resetMilestoneOption?: boolean;
  requireDeviceVerification?: boolean;
  requireIpCheck?: boolean;
  requireFingerprintCheck?: boolean;
  rejectSameDevice?: boolean;
  rejectSelfReferral?: boolean;
  rejectDuplicateBrowser?: boolean;

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
  | 'users'
  | 'telegram'
  | 'channel'
  | 'wallet'
  | 'withdrawal'
  | 'referral'
  | 'milestones'
  | 'support'
  | 'security'
  | 'logs'
  | 'diagnostics'
  | 'feedback_campaigns'
  | 'feedback_reviews';

export interface BotUser {
  id: string;
  uid: string;
  telegramId: string;
  username?: string;
  firstName: string;
  mobile: string;
  walletBalance: number;
  channelVerified: boolean;
  groupVerified: boolean;
  createdAt: string;
  lastActive?: string;
  referrerUid?: string;
  referredBy?: string;
  referralRewardReceived?: boolean;
  totalReferrals?: number;
  successfulReferrals?: number;
  totalReferralEarnings?: number;
  status?: 'active' | 'banned' | string;
  banned?: boolean;
  banReason?: string;
}

export interface WalletTransaction {
  id: string;
  userId?: string;
  uid: string;
  type: 'admin_credit' | 'admin_debit' | 'referral' | 'withdrawal' | 'registration_bonus' | string;
  amount: number;
  balanceAfter: number;
  reason?: string;
  createdAt: string;
}

export interface AdminLog {
  id: string;
  adminId: string;
  action: 'credit' | 'debit' | 'ban' | 'unban' | 'send_message' | 'referral_rejected' | 'referral_verified' | string;
  targetUid: string;
  targetTelegramId?: string;
  amount?: number;
  reason?: string;
  timestamp: string;
}

export interface ReferralVerificationToken {
  id?: string;
  token: string;
  referrerUid: string;
  referredUid: string;
  referredTelegramId: string;
  referredName: string;
  deviceFingerprint?: string;
  ipAddress?: string;
  userAgent?: string;
  status: 'pending' | 'verified' | 'rejected';
  rejectReason?: string;
  createdAt: string;
  verifiedAt?: string;
}

export interface DeviceFingerprintRecord {
  id?: string;
  fingerprint: string;
  uids: string[];
  telegramIds: string[];
  referralTokens?: string[];
  count: number;
  lastUsedAt: string;
}

export interface WithdrawalRecord {
  id?: string;
  withdrawalId: string;
  userId?: string;
  uid: string;
  telegramId: string;
  userName?: string;
  amount: number;
  method: 'upi' | 'qr' | 'redeem_code';
  upiId?: string;
  qrImageUrl?: string;
  redeemCodeDetails?: string;
  status: 'pending' | 'completed' | 'rejected';
  rejectReason?: string;
  createdAt: string;
  processedAt?: string;
}

export interface ReferralMilestone {
  id: string;
  requiredReferrals: number;
  rewardAmount: number;
  rewardType: 'wallet' | 'coins' | 'bonus';
  active: boolean;
  position: number;
  createdAt: string;
}

export interface MilestoneToken {
  id?: string;
  token: string;
  uid: string;
  telegramId: string;
  milestoneId: string;
  requiredReferrals: number;
  rewardAmount: number;
  rewardType: 'wallet' | 'coins' | 'bonus' | string;
  createdAt: string;
  expiresAt: string;
  used: boolean;
  usedAt?: string;
}

export interface MilestoneClaimRecord {
  id: string;
  uid: string;
  telegramId: string;
  userName?: string;
  telegramUsername?: string;
  milestoneId: string;
  requiredReferrals: number;
  rewardAmount: number;
  rewardType: string;
  claimToken: string;
  status: 'approved' | 'rejected' | 'pending';
  rejectReason?: string;
  ip: string;
  deviceFingerprint: string;
  deviceHash: string;
  localStorageId: string;
  userAgent: string;
  timezone: string;
  platform: string;
  location?: { latitude: number; longitude: number } | null;
  claimTime: string;
  verifiedAt?: string;
}

export interface FeedbackCampaign {
  id: string;
  name: string;
  bonusAmount: number;
  startDate: string;
  endDate: string;
  maxBonusLimit: number;
  active: boolean;
  thankYouMessage: string;
  rejectMessage: string;
  createdAt: string;
  publicLink: string;
}

export interface FeedbackReview {
  id: string;
  campaignId: string;
  campaignName: string;
  uid: string;
  name: string;
  mobile: string;
  telegramId: string;
  telegramUsername: string;
  rating: number;
  category: 'wallet' | 'referral' | 'withdraw' | 'ui' | 'speed' | 'support';
  title: string;
  message?: string;
  screenshotUrl?: string; // stores base64 data url or standard url
  status: 'pending' | 'approved' | 'rejected';
  rewardAmount: number;
  rejectReason?: string;
  approveReason?: string;
  submittedAt: string;
  processedAt?: string;
}

