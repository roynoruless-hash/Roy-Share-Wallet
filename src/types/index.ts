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
  platformFeePercent?: number;
  uidLength: number;

  // Withdrawal Settings V2
  enableWithdraw: boolean;
  allWithdrawalsEnabled?: boolean;
  globalWithdrawalsEnabled?: boolean;
  enableUpi: boolean;
  upiEnabled?: boolean;
  upiMin?: number;
  upiFeeType?: 'PERCENTAGE' | 'FIXED';
  upiFee?: number;
  upiTax?: number;

  enableQr: boolean;
  qrEnabled?: boolean;
  qrMin?: number;
  qrFeeType?: 'PERCENTAGE' | 'FIXED';
  qrFee?: number;
  qrTax?: number;

  enableRedeemCode: boolean;
  redeemEnabled?: boolean;
  redeemMin?: number;
  redeemFeeType?: 'PERCENTAGE' | 'FIXED';
  redeemFee?: number;
  redeemTax?: number;
  redeemExpiryDays?: number;

  ultraPayEnabled?: boolean;
  ultraPayMin?: number;
  ultraPayFeeType?: 'PERCENTAGE' | 'FIXED';
  ultraPayFee?: number;
  ultraPayTax?: number;

  ultraPayApiToken?: string;
  ultraPayApiKey?: string;
  ultraPayEndpoint?: string;

  calculationModel?: 'OPTION_A' | 'OPTION_B';

  dailyWithdrawalLimit?: number;
  weeklyWithdrawalLimit?: number;
  maxSingleWithdrawal?: number;
  maxPendingWithdrawals?: number;

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
  adminMobileNumber?: string;
  diagnosticError?: string;
  imgbbApiKey?: string;

  // OTP & Account Security Settings
  otpLength?: number;
  otpExpiry?: number;
  allowDeviceLimit?: boolean;
  maxAccountsPerDevice?: number;
  contactVerificationRequired?: boolean;
  telegramVerificationRequired?: boolean;

  // Metadata
  updatedAt?: string;
  verificationVersion?: number;
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
  | 'voting_contests'
  | 'giveaways'
  | 'wallet'
  | 'users'
  | 'ai_broadcast'
  | 'analytics'
  | 'history'
  | 'advanced'
  | 'settings'
  | 'transactions'
  | 'telegram'
  | 'channel'
  | 'withdrawal'
  | 'referral'
  | 'milestones'
  | 'tasks'
  | 'support'
  | 'security'
  | 'security_review'
  | 'logs'
  | 'diagnostics'
  | 'feedback_campaigns'
  | 'feedback_reviews'
  | 'enterprise_ops'
  | 'earning_bots'
  | 'ai_revenue_automation';

export interface FraudReport {
  userId: string;
  username: string;
  riskScore: number; // 0-100
  riskLevel: 'Safe' | 'Review' | 'Ban Recommended';
  reason: string;
  fingerprint: string;
  vpnDetected: boolean;
  duplicateAccountsCount: number;
  avgTypingWpm: number;
  totalClaims: number;
  referralsCount: number;
  voteCount: number;
  createdAt: string;
}

export interface AutoRewardRule {
  id: string;
  name: string;
  triggerEvent: 'First Claim' | 'Golden Claim' | 'Top Typist' | 'Milestone Streak' | 'Referral Multiplier' | string;
  rewardAmount: number;
  conditions: string;
  isActive: boolean;
  totalPaidOut: number;
  createdAt: string;
}

export interface RevenueAnalytics {
  period: 'Daily' | 'Weekly' | 'Monthly' | 'Yearly';
  platformRevenue: number;
  withdrawalFees: number;
  referralCost: number;
  prizeCost: number;
  netProfit: number;
  history: Array<{
    label: string;
    revenue: number;
    fees: number;
    prizes: number;
    referrals: number;
    profit: number;
  }>;
}

export interface EventSummary {
  eventId: string;
  eventName: string;
  telegramResultPost: string;
  winnerAnnouncement: string;
  statistics: {
    totalClaims: number;
    totalAmountAwarded: number;
    fastestClaimSeconds: number;
    fastestUser: string;
    durationMinutes: number;
  };
  highlights: string[];
  createdAt: string;
}

export interface AdminInsights {
  date: string;
  todaysSuggestions: string[];
  inactiveUsersCount: number;
  mostActiveHours: string;
  fraudTrends: string;
  bestEventTime: string;
  revenueTrends: string;
  growthSuggestions: string[];
}

export interface BudgetPlan {
  totalBudget: number;
  prizePool: number;
  goldenCodes: number;
  winnerCount: number;
  rewardDistribution: string[];
  expectedCost: number;
  estimatedRoi: string;
}

export interface RetentionCampaign {
  id: string;
  type: 'Comeback Bonus' | 'Reminder' | 'Special Event Invite';
  targetUsersCount: number;
  bonusAmount?: number;
  message: string;
  sentAt?: string;
  status: 'PENDING' | 'EXECUTED';
}

export interface IncidentAlert {
  id: string;
  type: 'High Fraud' | 'Telegram API Failure' | 'Firestore Failure' | 'Queue Overflow' | 'Payment Failure' | 'High Error Rate';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  message: string;
  timestamp: string;
  isResolved: boolean;
  affectedCount?: number;
}

export interface ScheduledEvent {
  id: string;
  name: string;
  startDate: string;
  codeReleaseDate: string;
  endDate: string;
  rewardAmount: number;
  maxClaims: number;
  code: string;
  templateId?: string;
  status: 'SCHEDULED' | 'ACTIVE' | 'ENDED' | 'CANCELLED';
  createdAt: string;
}

export interface EventTemplate {
  id: string;
  name: string;
  category: 'Flash Event' | 'Golden Event' | 'Giveaway Event' | 'VIP Event' | string;
  rewardAmount: number;
  maxClaims: number;
  codePrefix: string;
  durationMinutes: number;
  description: string;
  updatedAt?: string;
}

export interface AdminRole {
  id: string;
  name: string;
  description: string;
  permissions: string[];
}

export interface AuditLogEntry {
  id: string;
  action: string;
  category: 'EVENT' | 'SECURITY' | 'USER' | 'SYSTEM' | 'BACKUP' | 'ROLE' | string;
  details: string;
  adminId: string;
  ip: string;
  createdAt: string;
  timestamp: number;
}

export interface SystemAnnouncement {
  id: string;
  title: string;
  message: string;
  priority: 'Info' | 'Warning' | 'Maintenance';
  isActive: boolean;
  createdAt: string;
}

export interface FeatureFlags {
  redeem: boolean;
  vote: boolean;
  flashMode: boolean;
  aiAssistant: boolean;
  referrals: boolean;
  withdrawals: boolean;
  spectatorMode: boolean;
  [key: string]: boolean;
}

export interface HealthServiceCheck {
  name: string;
  status: 'HEALTHY' | 'DEGRADED' | 'CRITICAL' | 'NOT_CONFIGURED' | string;
  lastChecked: string;
}

export interface HealthCheckResult {
  overallStatus: 'HEALTHY' | 'DEGRADED' | 'CRITICAL' | string;
  latencyMs: number;
  services: HealthServiceCheck[];
}

export interface AIBroadcastConfig {
  geminiApiKey: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface TelegramApiLogEntry {
  id: string;
  category: 'Bot Users' | 'Main Channel' | 'Main Group' | 'Additional Channels' | string;
  destinationName: string;
  chatId: string;
  method: string;
  httpStatus: number;
  telegramResponse: {
    ok: boolean;
    error_code?: number;
    description?: string;
    result?: any;
  };
  timestamp: string;
  error?: string;
}

export interface BroadcastCategoryReport {
  selected: boolean;
  target?: string;
  total?: number;
  sent: number;
  failed: number;
  blocked?: number;
  error?: string;
  httpStatus?: number;
  telegramResponse?: any;
  channelsList?: Array<{
    name: string;
    chatId: string;
    sent: boolean;
    error?: string;
    httpStatus?: number;
  }>;
}

export interface BroadcastCategoryReports {
  botUsers: BroadcastCategoryReport;
  mainChannel: BroadcastCategoryReport;
  mainGroup: BroadcastCategoryReport;
  additionalChannels: BroadcastCategoryReport;
}

export interface AIBroadcastItem {
  id: string;
  type: 'active_alert' | 'redeem_code';
  redeemCode?: string;
  message: string;
  sentByAdmin: string;
  targetChat?: string;
  targetAudience?: string;
  telegramMessageId?: string | number | null;
  status: 'Success' | 'Partial Success' | 'Failed' | 'Scheduled' | 'Completed';
  errorMessage?: string;
  timestamp: string;
  isScheduled?: boolean;
  scheduledFor?: string;
  totalUsers?: number;
  sent?: number;
  failed?: number;
  blocked?: number;
  timeTaken?: string;
  failedUsers?: Array<{ id: string; telegramId: string; name: string; error?: string }>;
  categoryReports?: BroadcastCategoryReports;
  apiLogs?: TelegramApiLogEntry[];
  inlineButtons?: { text: string; url: string; enabled: boolean }[];
  redeemSettings?: {
    expiryTime?: string;
    maxUses?: number;
    remainingUses?: number;
  };
  deliveryStats?: {
    totalSent: number;
    delivered: number;
    failed: number;
    successRate: number;
  };
  aiScores?: {
    engagementScore: number;
    urgencyScore: number;
    estimatedClickRate: number;
    suggestions: string[];
  };
}

export interface BotUser {
  id: string;
  appUid?: string;
  uid: string;
  telegramId: string;
  username?: string;
  firstName: string;
  lastName?: string;
  mobile: string;
  mobileVerified?: boolean;
  telegramVerified?: boolean;
  walletBalance: number;
  coins?: number;
  bonus?: number;
  securityScore?: number;
  deviceFingerprint?: string;
  channelVerified: boolean;
  groupVerified: boolean;
  createdAt: string;
  joinDate?: string;
  lastActive?: string;
  lastLogin?: string;
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
  transactionId: string;
  userId?: string;
  uid: string;
  telegramId: string;
  fullName: string;
  mobile: string;
  type: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  status: string;
  description: string;
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
  requestId?: string;
  userId?: string;
  uid: string;
  telegramId: string;
  userName?: string;
  username?: string;
  fullName?: string;
  mobile?: string;
  gmail?: string;
  amount: number;
  requestedAmount?: number;
  amountRequested?: number;
  platformFee?: number;
  processingFee?: number;
  taxAmount?: number;
  payoutAmount?: number;
  finalPayout?: number;
  totalDeduction?: number;
  calculationModel?: 'OPTION_A' | 'OPTION_B';
  feePercent?: number;
  method: 'UPI' | 'QR' | 'REDEEM_CODE' | 'ULTRA_PAY' | 'upi' | 'qr' | 'redeem_code';
  upiId?: string;
  qrImageUrl?: string;
  qrData?: string;
  redeemCodeDetails?: string;
  paytoNumber?: string;
  paymentDetails?: {
    upiId?: string;
    qrUrl?: string;
    qrData?: string;
    redeemCode?: string;
    paytoNumber?: string;
  };
  currentWalletBalance?: number;
  walletBalance?: number;
  status:
    | 'PENDING'
    | 'APPROVED'
    | 'PROCESSING'
    | 'PAID'
    | 'REJECTED'
    | 'FAILED'
    | 'CANCELLED'
    | 'REFUNDED'
    | 'PROVIDER_UNKNOWN'
    | 'Pending'
    | 'Approved'
    | 'Rejected'
    | 'pending'
    | 'completed'
    | 'rejected';
  riskStatus?: 'LOW' | 'MEDIUM' | 'HIGH';
  rejectReason?: string;
  rejectionReason?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  createdAt: string;
  updatedAt?: string;
  processedAt?: string;
  processedBy?: string;
  paidAt?: string;
  approvedAt?: string;
  idempotencyKey?: string;
  providerReference?: string;
  providerResponse?: any;
  providerPaymentStarted?: boolean;
  failureReason?: string;
  previousCount?: number;
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

export interface Contest {
  id: string;
  title: string;
  description: string;
  bannerUrl?: string;
  imageUrl?: string;
  registrationStartDate: string;
  registrationEndDate?: string;
  votingEndDate: string;
  votingStarted?: boolean;
  votingStartedAt?: string;
  registrationClosedProcessed?: boolean;
  votingEndedProcessed?: boolean;
  status: 'upcoming' | 'active' | 'completed' | 'paused';
  createdAt: string;
  rules?: string;
  maxVotesPerUser?: number; // e.g., 1 (default) or more
  voteIntervalHours?: number; // e.g., 24 for daily, 0 or undefined for one-time
  voterRewardAmount?: number; // wallet bonus for voting
  winnerRewardAmount?: number; // description or cash reward
  winnerPrizes?: number[]; // rank prizes array [rank1, rank2, rank3...]
  totalWinners?: number; // default: 3
}

export interface Contestant {
  id: string;
  contestId: string;
  contestTitle?: string;
  name: string;
  telegramId?: string;
  username?: string;
  description?: string;
  imageUrl?: string; // base64 or photo url
  votesCount: number;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  voteLink?: string;
  rank?: number;
  isWinner?: boolean;
  winnerPrize?: string;
  prizeAmount?: number;
  walletCreditStatus?: 'credited' | 'failed' | 'none';
  winningTime?: string;
  winnerStatus?: string;
}

export interface VoteLog {
  id: string;
  contestId: string;
  contestTitle: string;
  contestantId: string;
  contestantName: string;
  voterTelegramId: string;
  voterUsername?: string;
  voterName: string;
  createdAt: string;
  rewardEarned?: number;
  ipHash?: string;
  deviceFingerprint?: string;
  verificationStatus?: string;
}

export interface VoteLink {
  id: string;
  contestId: string;
  contestantId: string;
  voteLink: string;
  createdAt: string;
}

export interface ContestLog {
  id?: string;
  contestId: string;
  action: string;
  details: string;
  timestamp: string;
}

// ============================================
// Redeem Claim Modes
// ============================================

export type RedeemClaimMode = 'FCFS' | 'RANDOM_DRAW' | 'HYBRID';

export interface GoldenCodeItem {
  id: string;
  code: string;
  reward: number;
  maxClaims: number;
  claimedCount: number;
  remainingClaims: number;
  expiry?: number;
}

export interface FlashModeConfig {
  active: boolean;
  durationSec: number;
  activatedAt: number;
  expiresAt: number;
  bannerText?: string;
}

export interface CodeFragmentsConfig {
  enabled: boolean;
  count: number;
  fragments: string[];
}

export interface FastestTypistItem {
  telegramId: string;
  userName: string;
  typingSpeedSec: number;
  claimedAt: number;
  code: string;
  reward: number;
}

export interface HallOfFameUserStats {
  telegramId: string;
  userName: string;
  totalWins: number;
  fastestClaimSec: number;
  totalRewards: number;
  eventsJoined: number;
  rank: number;
}

export interface LiveRedeemPlatformEvent {
  id: string;
  eventId: string;
  active: boolean;
  status: 'active' | 'ended';
  eventStatus: 'IDLE' | 'WAITING_FOR_READY' | 'LIVE_COUNTDOWN' | 'UNLOCKED' | 'ENDED';
  claimMode: RedeemClaimMode;
  goldenCodes: GoldenCodeItem[];
  flashMode?: FlashModeConfig;
  codeFragments?: CodeFragmentsConfig;
  code?: string;
  maskedCode?: string;
  unlockAt: number;
  unlockTime: number;
  expiresAt: number;
  maxUses: number;
  claimedCount: number;
  remainingCodesCount: number;
  totalCodesCount: number;
  countdownSeconds: number;
  minReadyUsers: number;
  readyCount: number;
  isUserReady?: boolean;
  onlineUsersCount: number;
  waitingUsersCount: number;
  typingUsersCount: number;
  requestsPerSecond: number;
  failedClaimsCount: number;
  avgClaimTimeSec: number;
  fastestTypingSec: number;
  duplicateDeviceCount: number;
  highVpnRiskCount: number;
  blacklistedCount: number;
  fastestTypistsLeaderboard?: FastestTypistItem[];
  userAlreadyClaimedCode?: string;
  summaryStats?: {
    totalParticipants: number;
    successfulClaims: number;
    remainingCodes: number;
  };
}

export interface TaskItem {
  id: string;
  title: string;
  reward: number; // in Rupees
  rewardType?: 'fixed' | 'custom';
  coins: number; // in Coins
  verificationType: 'automatic' | 'manual' | 'none';
  icon: string; // lucide icon name (e.g. "CheckSquare", "Users", "Tv", "Share2")
  sortOrder: number;
  url?: string; // external link if any
  externalDestinationUrl?: string; // External URL for task
  taskImage?: string; // Image for task card
  description?: string; // Short Description / Instructions
  detailedInstructions?: string; // Detailed Step-by-Step Instructions
  proofDemoImage?: string; // Proof Screenshot Demo Image
  privateAdminGroupChatId?: string; // Private Telegram Admin Group Chat ID e.g. -100xxxxxxxxxx
  telegramAdminChatId?: string; // Telegram Admin/Review Chat ID e.g. -100xxxxxxxxxx
  allowResubmission?: boolean; // Allow Resubmission After Rejection: ON / OFF
  maxResubmissions?: number; // Maximum resubmissions allowed (default 2)
  maxSubmissionsPerUser?: number; // Maximum submissions per user (default 1)
  deadlineEnabled?: boolean; // Deadline feature enabled
  deadlineMinutes?: number; // Deadline duration in minutes
  maxApprovedUsers?: number; // Maximum approved users limit (0 for unlimited)
  approvedCount?: number; // Current approved user count
  isFull?: boolean; // True if maxApprovedUsers limit reached
  campaignId?: string; // Optional campaign ID
  earningBotId?: string; // Earning Bot scope ID
  active: boolean;
  createdAt: string;
}

export interface TaskCampaign {
  id: string;
  earningBotId: string;
  name: string;
  description: string;
  imageUrl?: string;
  totalBudget: number;
  rewardPerUser: number;
  maxApprovedUsers: number;
  startDate: string;
  endDate: string;
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'FULL' | 'EXPIRED' | 'COMPLETED';
  createdAt: string;
  spentBudget?: number;
  approvedUsersCount?: number;
  tasksCount?: number;
  pendingReviewsCount?: number;
}

export interface TaskAttempt {
  id: string; // `${earningBotId}_${telegramUserId}_${taskId}`
  earningBotId: string;
  taskId: string;
  telegramUserId: string;
  userId: string;
  status: 'TASK_STARTED' | 'PROOF_PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'RESUBMISSION_AVAILABLE' | 'EXPIRED';
  startedAt: string;
  expiresAt?: string | null;
  submissionId?: string | null;
  version: number;
}

export interface ManualTaskSubmission {
  id: string;
  earningBotId: string;
  taskId: string;
  taskTitle: string;
  campaignId?: string;
  campaignName?: string;
  reward: number;
  coins?: number;
  userId: string;
  telegramUserId: string;
  telegramUsername?: string;
  userFullName?: string;
  userAppUid?: string;
  registrationMobile: string;
  proofImageUrl: string;
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  submissionVersion?: number;
  attemptId?: string;
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  adminNote?: string;
  rejectionReason?: string;
  adminGroupMessageId?: number;
  adminGroupChatId?: string;
  suspiciousFlag?: 'NORMAL' | 'REVIEW' | 'SUSPICIOUS';
  suspiciousReason?: string;
  mobileUseCount?: number;
  relatedSubmissionIds?: string[];
}

export interface TaskAnalytics {
  taskId: string;
  taskTitle: string;
  earningBotId: string;
  viewsCount: number;
  startsCount: number;
  submittedCount: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  expiredCount: number;
  resubmittedCount: number;
  totalPaid: number;
  remainingBudget?: number;
  approvalRate: number;
  rejectionRate: number;
  conversionRate: number;
}

export interface TaskCompletionRecord {
  id?: string;
  taskId: string;
  telegramId: string;
  status: 'pending' | 'completed' | 'rejected';
  createdAt: string;
  verifiedAt?: string;
}

export interface EarningBotChannel {
  chatId: string;
  link: string;
  name?: string;
  username?: string;
  type?: 'channel' | 'group';
  verified?: boolean;
}

export interface EarningBot {
  id: string;
  token: string;
  botId: string;
  botUsername: string;
  botFirstName: string;
  botName: string;
  adminChatId: string;
  miniAppUrl?: string;
  referralReward: number;
  registrationBonus: number;
  minWithdrawal: number;
  withdrawalTax: number;
  withdrawalMethods: ('UPI' | 'REDEEM_CODE' | 'ULTRA_PAY')[];
  status: 'active' | 'paused' | 'archived';
  channels: EarningBotChannel[];
  groups: EarningBotChannel[];
  dailyReferralLimit: number;
  referralEarningCap: number;
  createdAt: string;
  updatedAt: string;
}

export interface EarningBotUser {
  id: string;
  uid: string;
  botId: string;
  telegramId: string;
  username: string;
  firstName: string;
  mobile: string;
  walletBalance: number;
  channelVerified: boolean;
  groupVerified: boolean;
  referrerUid: string;
  referredBy: string;
  referralRewardReceived: boolean;
  totalReferrals: number;
  successfulReferrals: number;
  totalReferralEarnings: number;
  status: 'ACTIVE' | 'BANNED' | 'PENDING';
  createdAt: string;
  lastActive: string;
  riskScore?: number;
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
  riskSignals?: string[];
  gmail?: string;
  deviceFingerprint?: string;
}

export interface EarningBotReferral {
  id: string;
  botId: string;
  referrerTelegramId: string;
  referredTelegramId: string;
  status: 'PENDING' | 'VALID' | 'REJECTED' | 'FRAUD_REVIEW';
  rewardAmount: number;
  transactionId?: string;
  createdAt: string;
  validatedAt?: string;
  riskScore?: number;
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
  riskSignals?: string[];
}

