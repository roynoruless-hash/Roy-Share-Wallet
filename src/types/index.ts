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
  adminMobileNumber?: string;
  diagnosticError?: string;
  imgbbApiKey?: string;

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
  | 'users'
  | 'transactions'
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
  | 'feedback_reviews'
  | 'voting_contests'
  | 'giveaway_war';

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
  status: 'draft' | 'live' | 'paused' | 'ended';
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

