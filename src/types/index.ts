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
  | 'giveaway_war'
  | 'enterprise_ops'
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
  giveaway: boolean;
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
// ⚔️ GIVEAWAY WAR SYSTEM TYPES
// ============================================

export interface WarTeam {
  id: string;
  name: string;
  logoUrl?: string;
  color?: string;
  score: number;
  membersCount: number;
  maxMembers?: number; // Team capacity (0 or undefined = unlimited)
  totalReferrals?: number;
  totalVerifiedVotes?: number;
  totalFeedbacks?: number;
  teamWalletBalance?: number; // Shared Team Wallet Balance
  // Team Leader System
  leaderTelegramId?: string;
  leaderName?: string;
  leaderUsername?: string;
  leaderInviteLink?: string;
  leaderPoints?: number;
}

export interface WarPointRules {
  registrationPoints: number;
  registrationEnabled: boolean;
  referralPoints: number;
  referralEnabled: boolean;
  verifiedVotePoints: number;
  verifiedVoteEnabled: boolean;
  feedbackPoints: number;
  feedbackEnabled: boolean;
  dailyLoginPoints: number;
  dailyLoginEnabled: boolean;
  walletTaskPoints: number;
  walletTaskEnabled: boolean;
  // Team Wallet Bonus Contributions
  teamWalletRegistrationBonus?: number;
  teamWalletReferralBonus?: number;
  teamWalletVoteBonus?: number;
  teamWalletFeedbackBonus?: number;
}

export interface WarMission {
  id: string;
  title: string;
  targetType: 'referrals' | 'votes' | 'feedbacks' | 'activities';
  targetCount: number;
  rewardAmount: number;
  isCompleted: boolean;
  completedAt?: string;
}

export interface WarMilestone {
  id: string;
  pointThreshold: number; // 1000, 5000, 10000 etc.
  rewardAmount: number;
  luckyMemberReward: number;
  isUnlocked: boolean;
  unlockedAt?: string;
  luckyWinnerTelegramId?: string;
  luckyWinnerName?: string;
}

export interface WarPointBooster {
  isActive: boolean;
  multiplier: number; // Default 2x
  boostReferrals: boolean;
  boostVotes: boolean;
  boostFeedbacks: boolean;
  expiresAt?: string; // ISO timestamp
}

export interface WarRewardConfig {
  winningTeamReward: number; // Reward amount for winning team members
  topContributorReward: number; // Cash or wallet prize for #1 top contributor
  mvpReward: number; // Special prize for MVP
  dailyMvpReward?: number; // Daily MVP cash/points reward
  runnerUpReward?: number; // Prize for runner-up team members/leaders
  rewardType: 'wallet' | 'cash';
}

export interface DailyMvpRecord {
  date: string; // YYYY-MM-DD
  telegramId: string;
  name: string;
  points: number;
  teamName: string;
  rewardAmount: number;
  awardedAt: string;
}

export interface WarChallenge {
  id: string;
  title: string;
  targetType: 'referrals' | 'votes' | 'feedbacks' | 'points';
  targetCount: number;
  bonusPoints: number;
  isCompleted: boolean;
  winningTeamId?: string;
  winningTeamName?: string;
  completedAt?: string;
}

export interface WarSecretMission {
  id: string;
  title: string;
  description: string;
  targetType: 'referrals' | 'votes' | 'feedbacks' | 'points';
  targetCount: number;
  rewardAmount: number; // Wallet or points reward
  rewardType: 'points' | 'wallet';
  isCompleted: boolean;
  unlockedByTelegramId?: string;
  unlockedByName?: string;
  completedAt?: string;
}

export interface WarAirdrop {
  id: string;
  warId: string;
  amount: number;
  rewardType: 'points' | 'wallet';
  recipientsCount: number;
  recipients: {
    telegramId: string;
    name: string;
    teamName: string;
    amount: number;
  }[];
  createdAt: string;
}

export interface WarTimelineEvent {
  id: string;
  timestamp: string;
  eventType: 'war_start' | 'lead_change' | 'milestone_unlocked' | 'challenge_won' | 'booster_activated' | 'airdrop' | 'mvp_awarded' | 'war_ended';
  title: string;
  description: string;
  teamId?: string;
  teamName?: string;
  badge?: string;
}

export interface WarPendingReward {
  id: string;
  warId: string;
  warTitle: string;
  telegramId: string;
  rewardType: 'points' | 'wallet';
  amount: number;
  title: string;
  description: string;
  isClaimed: boolean;
  claimedAt?: string;
  createdAt: string;
}

export interface GiveawayWar {
  id: string;
  title: string;
  bannerUrl?: string;
  description: string;
  rules: string;
  totalTeams: number; // default 2
  teams: WarTeam[];
  prizePool: number;
  status: 'draft' | 'registration_open' | 'live' | 'paused' | 'ended';
  pointRules: WarPointRules;
  rewards: WarRewardConfig;
  startDate?: string;
  endDate?: string;
  totalPoints: number;
  totalParticipants: number;
  winnerTeamId?: string;
  mvpUserId?: string;
  mvpUserName?: string;
  mvpUserPoints?: number;
  topContributors?: {
    userId: string;
    telegramId?: string;
    name: string;
    points: number;
    teamId: string;
    rewardAmount?: number;
  }[];
  dailyMvpHistory?: DailyMvpRecord[];
  // Phase 3 Extensions
  season?: number; // e.g. Season 1
  seasonName?: string; // e.g. "Season 1 - August 2026"
  missions?: WarMission[];
  milestones?: WarMilestone[];
  booster?: WarPointBooster;
  // Phase 4 Extensions
  challenges?: WarChallenge[];
  secretMissions?: WarSecretMission[];
  airdrops?: WarAirdrop[];
  timelineEvents?: WarTimelineEvent[];
  teamGallery?: {
    bannerUrl?: string;
    winnerPosterUrl?: string;
    mvpPosterUrl?: string;
    resultPosterUrl?: string;
  };
  createdAt: string;
  updatedAt?: string;
}

export interface WarMember {
  id: string; // doc ID e.g. `${warId}_${telegramId}`
  warId: string;
  telegramId: string;
  username?: string;
  name: string;
  teamId: string;
  teamName: string;
  points: number;
  invitedByTelegramId?: string;
  isTeamLeader?: boolean;
  leaderPoints?: number;
  deviceFingerprint?: string;
  ipHash?: string;
  joinedAt: string;
  lastActivityAt?: string;
  activityBreakdown?: {
    registration?: number;
    referral?: number;
    verifiedVote?: number;
    feedback?: number;
    dailyLogin?: number;
    walletTask?: number;
  };
  // Phase 4 Extensions
  fairPlayScore?: number; // e.g. 100, 95, 80, 40
  achievements?: string[]; // e.g. ['FIRST_REFERRAL', '100_POINTS', 'MVP', 'TEAM_WINNER', 'LEGEND']
  lastSpinDate?: string; // YYYY-MM-DD
  dailyComboTracker?: {
    date: string;
    referralsCount: number;
    votesCount: number;
    feedbacksCount: number;
    claimedCombos: string[]; // e.g. ['5_REF_COMBO', '10_VOTE_COMBO']
  };
  pendingRewards?: WarPendingReward[];
  // Active Member Validation & Fraud Control
  status?: 'ACTIVE' | 'PENDING' | 'REJECTED';
  activationDetails?: {
    isRegistered?: boolean;
    isTelegramVerified?: boolean;
    isChannelJoined?: boolean;
    isBotVerified?: boolean;
    isNotBanned?: boolean;
    activatedAt?: string;
  };
  rejectionReason?: string;
}

export interface WarActivityLog {
  id: string;
  warId: string;
  telegramId: string;
  teamId: string;
  activityType:
    | 'registration'
    | 'referral'
    | 'verified_vote'
    | 'feedback'
    | 'daily_login'
    | 'wallet_task'
    | 'user_joined'
    | 'admin_action'
    | 'reward_credited';
  pointsEarned: number;
  description: string;
  ipHash?: string;
  deviceFingerprint?: string;
  isValid: boolean;
  rejectReason?: string;
  createdAt: string;
}

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
  coins: number; // in Coins
  verificationType: 'automatic' | 'manual' | 'none';
  icon: string; // lucide icon name (e.g. "CheckSquare", "Users", "Tv", "Share2")
  sortOrder: number;
  url?: string; // external link if any
  active: boolean;
  createdAt: string;
}

export interface TaskCompletionRecord {
  id?: string;
  taskId: string;
  telegramId: string;
  status: 'pending' | 'completed' | 'rejected';
  createdAt: string;
  verifiedAt?: string;
}

