import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  runTransaction
} from 'firebase/firestore';
import { db } from './firebase';
import {
  GiveawayWar,
  WarMember,
  WarActivityLog,
  WarTeam,
  WarPointRules,
  WarRewardConfig,
  WarChallenge,
  WarSecretMission,
  WarAirdrop,
  WarTimelineEvent,
  WarPendingReward,
  WarPointBooster
} from '../types';

const WARS_COLLECTION = 'giveawayWars';
const MEMBERS_COLLECTION = 'warMembers';
const LOGS_COLLECTION = 'warActivityLogs';

export const DEFAULT_POINT_RULES: WarPointRules = {
  registrationPoints: 5,
  registrationEnabled: true,
  referralPoints: 10,
  referralEnabled: true,
  verifiedVotePoints: 8,
  verifiedVoteEnabled: true,
  feedbackPoints: 3,
  feedbackEnabled: true,
  dailyLoginPoints: 1,
  dailyLoginEnabled: true,
  walletTaskPoints: 5,
  walletTaskEnabled: true,
};

export const DEFAULT_REWARD_CONFIG: WarRewardConfig = {
  winningTeamReward: 50,
  topContributorReward: 100,
  mvpReward: 150,
  runnerUpReward: 20,
  rewardType: 'wallet'
};

/**
 * Resolve Active War and Team by alias e.g. teamA, teamB, team_teamA
 */
export async function getActiveWarAndTeamByAlias(alias: string, specificWarId?: string): Promise<{ warId: string; teamId: string; teamName: string } | null> {
  try {
    let war: GiveawayWar | null = null;
    if (specificWarId) {
      war = await getGiveawayWarById(specificWarId);
      if (!war && !specificWarId.startsWith('war_')) {
        war = await getGiveawayWarById(`war_${specificWarId}`);
      }
    }
    if (!war) {
      const warsQuery = query(collection(db, WARS_COLLECTION), orderBy('createdAt', 'desc'));
      const warsSnap = await getDocs(warsQuery);
      if (!warsSnap.empty) {
        const warsList = warsSnap.docs.map((d) => ({ ...(d.data() as GiveawayWar), id: d.id }));
        const liveWar = warsList.find((w) => w.status === 'live');
        war = liveWar || warsList[0];
      }
    }
    if (!war) return null;

    const cleanAlias = alias.toLowerCase().trim();

    let matchedTeam = war.teams.find((t, idx) => {
      const tId = t.id.toLowerCase();
      const tName = t.name.toLowerCase().replace(/\s+/g, '');
      if (cleanAlias === 'teama' || cleanAlias === 'team_a' || cleanAlias === 'a') return idx === 0;
      if (cleanAlias === 'teamb' || cleanAlias === 'team_b' || cleanAlias === 'b') return idx === 1;
      return (
        tId === cleanAlias ||
        tName === cleanAlias ||
        tId.includes(cleanAlias) ||
        cleanAlias.includes(tId)
      );
    });

    if (!matchedTeam && war.teams.length > 0) {
      matchedTeam = cleanAlias.includes('b') || cleanAlias.includes('2') ? (war.teams[1] || war.teams[0]) : war.teams[0];
    }

    if (matchedTeam) {
      return { warId: war.id, teamId: matchedTeam.id, teamName: matchedTeam.name };
    }
    return null;
  } catch (err) {
    console.error('Error resolving team alias:', err);
    return null;
  }
}

/**
 * ACTIVE MEMBER VALIDATION SYSTEM
 * Validates whether a user meets all 5 Active criteria:
 * 1. Registered successfully
 * 2. Telegram account verified
 * 3. Joined all required channels/groups
 * 4. Completed bot verification
 * 5. Account is not blocked or banned
 */
export async function validateAndActivateMember(
  warId: string,
  telegramId: string,
  options?: { deviceFingerprint?: string; ipHash?: string }
): Promise<{ isActive: boolean; member?: WarMember; reason?: string }> {
  try {
    const memberDocId = `${warId}_${telegramId}`;
    const memberRef = doc(db, MEMBERS_COLLECTION, memberDocId);
    const memberSnap = await getDoc(memberRef);

    if (!memberSnap.exists()) {
      return { isActive: false, reason: 'Member not found in Giveaway War' };
    }

    const member = memberSnap.data() as WarMember;

    // Fetch user record from Firestore
    const qTg = query(collection(db, 'users'), where('telegramId', '==', String(telegramId)), limit(1));
    const snapTg = await getDocs(qTg);

    let isRegistered = false;
    let isTelegramVerified = false;
    let isChannelJoined = false;
    let isBotVerified = false;
    let isNotBanned = true;

    if (!snapTg.empty) {
      const uData = snapTg.docs[0].data();
      isRegistered = true;
      isTelegramVerified = Boolean(uData.telegramId && String(uData.telegramId) === String(telegramId));
      isChannelJoined = uData.mustJoinGroup === false || uData.isForceJoined === true || uData.forceJoined === true;
      isBotVerified = uData.verificationStatus === 'verified' || uData.isVerified === true || Boolean(uData.firstName && uData.phoneNumber);
      isNotBanned = uData.isBlocked !== true && uData.isBanned !== true && uData.status !== 'blocked';
    }

    // Anti-fraud checks
    let isNotDuplicateDevice = true;
    const deviceFp = options?.deviceFingerprint || member.deviceFingerprint;
    if (deviceFp) {
      const qDev = query(
        collection(db, MEMBERS_COLLECTION),
        where('warId', '==', warId),
        where('deviceFingerprint', '==', deviceFp)
      );
      const devSnap = await getDocs(qDev);
      if (devSnap.size > 3) {
        isNotDuplicateDevice = false;
      }
    }

    const isNotSelfReferral = member.invitedByTelegramId
      ? String(member.invitedByTelegramId) !== String(telegramId)
      : true;

    const isActive =
      isRegistered &&
      isTelegramVerified &&
      isChannelJoined &&
      isBotVerified &&
      isNotBanned &&
      isNotDuplicateDevice &&
      isNotSelfReferral;

    const nowIso = new Date().toISOString();

    if (isActive) {
      if (member.status !== 'ACTIVE') {
        await updateDoc(memberRef, {
          status: 'ACTIVE',
          activationDetails: {
            isRegistered,
            isTelegramVerified,
            isChannelJoined,
            isBotVerified,
            isNotBanned,
            activatedAt: nowIso
          },
          rejectionReason: ''
        });

        // Credit Active registration & referral points
        await creditActiveMemberPoints(warId, member);
      }
      return { isActive: true, member: { ...member, status: 'ACTIVE' } };
    } else {
      let reason = 'Incomplete verification steps';
      if (!isNotBanned) reason = 'Account blocked or banned';
      else if (!isNotDuplicateDevice) reason = 'Multiple accounts on same device';
      else if (!isNotSelfReferral) reason = 'Self-referral fraud';
      else if (!isChannelJoined) reason = 'Required Telegram channels not joined';
      else if (!isBotVerified) reason = 'Bot verification incomplete';

      await updateDoc(memberRef, {
        status: 'PENDING',
        rejectionReason: reason,
        activationDetails: {
          isRegistered,
          isTelegramVerified,
          isChannelJoined,
          isBotVerified,
          isNotBanned
        }
      });

      return { isActive: false, member: { ...member, status: 'PENDING' }, reason };
    }
  } catch (err: any) {
    console.error('Error validating member:', err);
    return { isActive: false, reason: err.message || 'Validation error' };
  }
}

/**
 * Helper to credit points upon active verification
 */
async function creditActiveMemberPoints(warId: string, member: WarMember) {
  try {
    const warDoc = await getDoc(doc(db, WARS_COLLECTION, warId));
    if (!warDoc.exists()) return;
    const war = warDoc.data() as GiveawayWar;
    const rules = war.pointRules || DEFAULT_POINT_RULES;

    const nowIso = new Date().toISOString();
    const regPts = rules.registrationEnabled ? rules.registrationPoints : 0;
    const refPts = rules.referralEnabled ? rules.referralPoints : 0;

    // 1. Credit Active Member's Registration Points
    if (regPts > 0) {
      const memberRef = doc(db, MEMBERS_COLLECTION, `${warId}_${member.telegramId}`);
      await updateDoc(memberRef, {
        points: (member.points || 0) + regPts,
        'activityBreakdown.registration': regPts,
        lastActivityAt: nowIso
      });

      const logId = 'log_act_reg_' + Date.now();
      await setDoc(doc(db, LOGS_COLLECTION, logId), {
        id: logId,
        warId,
        telegramId: String(member.telegramId),
        teamId: member.teamId,
        activityType: 'registration',
        pointsEarned: regPts,
        description: `✅ Active Registration Verified (+${regPts} Pts)`,
        isValid: true,
        createdAt: nowIso
      });
    }

    // 2. Credit Referrer (+Configured Referral Points) if invited
    if (member.invitedByTelegramId) {
      const refDocId = `${warId}_${member.invitedByTelegramId}`;
      const refRef = doc(db, MEMBERS_COLLECTION, refDocId);
      const refSnap = await getDoc(refRef);

      if (refSnap.exists()) {
        const referrer = refSnap.data() as WarMember;
        const newRefPts = (referrer.points || 0) + refPts;
        const currentBreakdown = referrer.activityBreakdown || {};

        await updateDoc(refRef, {
          points: newRefPts,
          activityBreakdown: {
            ...currentBreakdown,
            referral: (currentBreakdown.referral || 0) + refPts
          },
          lastActivityAt: nowIso
        });

        const logIdRef = 'log_act_ref_' + Date.now();
        await setDoc(doc(db, LOGS_COLLECTION, logIdRef), {
          id: logIdRef,
          warId,
          telegramId: String(member.invitedByTelegramId),
          teamId: referrer.teamId,
          activityType: 'referral',
          pointsEarned: refPts,
          description: `🎁 Active Referral Bonus (+${refPts} Pts): ${member.name} completed active verification`,
          isValid: true,
          createdAt: nowIso
        });
      }
    }

    // 3. Credit Team Leader Bonus (+2 Leader Pts)
    const team = war.teams.find((t) => t.id === member.teamId);
    if (team?.leaderTelegramId && String(team.leaderTelegramId) !== String(member.telegramId)) {
      const leaderDocId = `${warId}_${team.leaderTelegramId}`;
      const leaderRef = doc(db, MEMBERS_COLLECTION, leaderDocId);
      const leaderSnap = await getDoc(leaderRef);

      if (leaderSnap.exists()) {
        const leader = leaderSnap.data() as WarMember;
        const leaderAddPts = 2;
        await updateDoc(leaderRef, {
          points: (leader.points || 0) + leaderAddPts,
          leaderPoints: (leader.leaderPoints || 0) + leaderAddPts,
          lastActivityAt: nowIso
        });
      }
    }

    // 4. Update Team Score & Active Members Count in War doc
    const updatedTeams = war.teams.map((t) => {
      if (t.id === member.teamId) {
        return {
          ...t,
          score: (t.score || 0) + regPts + (member.invitedByTelegramId ? refPts : 0)
        };
      }
      return t;
    });

    await updateDoc(doc(db, WARS_COLLECTION, warId), {
      teams: updatedTeams,
      updatedAt: nowIso
    });
  } catch (err) {
    console.error('Error crediting active member points:', err);
  }
}

/**
  * Fetch all Giveaway Wars
  */
export async function getGiveawayWars(): Promise<GiveawayWar[]> {
  try {
    const q = query(collection(db, WARS_COLLECTION), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    const list: GiveawayWar[] = [];
    snap.forEach((d) => {
      const data = d.data() as GiveawayWar;
      list.push({ ...data, id: d.id });
    });
    return list;
  } catch (err) {
    console.error('Error fetching giveaway wars:', err);
    return [];
  }
}

/**
 * Fetch a single Giveaway War by ID
 */
export async function getGiveawayWarById(id: string): Promise<GiveawayWar | null> {
  try {
    const docRef = doc(db, WARS_COLLECTION, id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return { ...(snap.data() as GiveawayWar), id: snap.id };
  } catch (err) {
    console.error(`Error fetching giveaway war ${id}:`, err);
    return null;
  }
}

/**
 * Create or Update a Giveaway War
 */
export async function saveGiveawayWar(war: Partial<GiveawayWar> & { id?: string }): Promise<string> {
  const warId = war.id || 'war_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const docRef = doc(db, WARS_COLLECTION, warId);

  const defaultTeams: WarTeam[] = [
    { id: 'team_red', name: '🔴 Team Red', color: '#EF4444', score: 0, membersCount: 0 },
    { id: 'team_blue', name: '🔵 Team Blue', color: '#3B82F6', score: 0, membersCount: 0 }
  ];

  const nowIso = new Date().toISOString();

  const dataToSave: GiveawayWar = {
    id: warId,
    title: war.title || 'Giveaway War Event',
    bannerUrl: war.bannerUrl || '',
    description: war.description || '',
    rules: war.rules || '1. Complete daily tasks and earn points for your team.\n2. Fraudulent activities will be disqualified.',
    totalTeams: war.totalTeams || (war.teams ? war.teams.length : 2),
    teams: war.teams && war.teams.length > 0 ? war.teams : defaultTeams,
    prizePool: war.prizePool !== undefined ? Number(war.prizePool) : 500,
    status: war.status || 'draft',
    pointRules: war.pointRules || DEFAULT_POINT_RULES,
    rewards: war.rewards || DEFAULT_REWARD_CONFIG,
    startDate: war.startDate || nowIso,
    endDate: war.endDate || '',
    totalPoints: war.totalPoints || 0,
    totalParticipants: war.totalParticipants || 0,
    winnerTeamId: war.winnerTeamId || '',
    mvpUserId: war.mvpUserId || '',
    mvpUserName: war.mvpUserName || '',
    mvpUserPoints: war.mvpUserPoints || 0,
    topContributors: war.topContributors || [],
    createdAt: war.createdAt || nowIso,
    updatedAt: nowIso
  };

  await setDoc(docRef, dataToSave, { merge: true });

  // Send bot notification if event status transitioned to 'live'
  if (war.status === 'live') {
    notifyTelegramWarEvent('WAR_STARTED', {
      warId,
      title: dataToSave.title,
      description: dataToSave.description,
      teams: dataToSave.teams,
      prizePool: dataToSave.prizePool
    });
  }

  return warId;
}

/**
 * Update Status of a Giveaway War (Draft -> Live / Paused / Ended)
 */
export async function updateWarStatus(warId: string, status: GiveawayWar['status']): Promise<boolean> {
  try {
    const docRef = doc(db, WARS_COLLECTION, warId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return false;

    const war = snap.data() as GiveawayWar;
    await updateDoc(docRef, { status, updatedAt: new Date().toISOString() });

    if (status === 'live') {
      notifyTelegramWarEvent('WAR_STARTED', {
        warId,
        title: war.title,
        description: war.description,
        teams: war.teams,
        prizePool: war.prizePool
      });
    }

    return true;
  } catch (err) {
    console.error('Error updating war status:', err);
    return false;
  }
}

/**
 * Team Achievement Badge Calculator based on total points
 */
export function getTeamAchievementBadge(score: number): {
  badge: 'Bronze' | 'Silver' | 'Gold' | 'Diamond' | 'Starter';
  icon: string;
  name: string;
  color: string;
  minPoints: number;
} {
  if (score >= 2500) {
    return { badge: 'Diamond', icon: '💎', name: 'Diamond Team', color: '#38BDF8', minPoints: 2500 };
  } else if (score >= 1000) {
    return { badge: 'Gold', icon: '🥇', name: 'Gold Team', color: '#F59E0B', minPoints: 1000 };
  } else if (score >= 500) {
    return { badge: 'Silver', icon: '🥈', name: 'Silver Team', color: '#9CA3AF', minPoints: 500 };
  } else if (score >= 100) {
    return { badge: 'Bronze', icon: '🥉', name: 'Bronze Team', color: '#D97706', minPoints: 100 };
  } else {
    return { badge: 'Starter', icon: '🛡️', name: 'Starter Team', color: '#6B7280', minPoints: 0 };
  }
}

/**
 * User Joins a Team in a Giveaway War
 * Phase 2 Rules:
 * 1. User can choose only ONE team (Team Lock).
 * 2. Capacity Check: Cannot join if team is full (maxMembers).
 * 3. Referral tracking: Auto-joins same team if invited via team referral link.
 * 4. Anti-Abuse: Checks multiple accounts per device fingerprint/IP.
 */
export async function joinWarTeam(
  warId: string,
  user: { telegramId: string; username?: string; name: string },
  teamId: string,
  options?: {
    invitedByTelegramId?: string;
    deviceFingerprint?: string;
    ipHash?: string;
  }
): Promise<{ success: boolean; message: string; member?: WarMember; team?: WarTeam }> {
  try {
    const war = await getGiveawayWarById(warId);
    if (!war) {
      return { success: false, message: 'Giveaway War event not found' };
    }

    if (war.status !== 'live') {
      return { success: false, message: 'Giveaway War is not currently live' };
    }

    const team = war.teams.find((t) => t.id === teamId);
    if (!team) {
      return { success: false, message: 'Invalid team selected' };
    }

    // 1. Team Capacity Check
    if (team.maxMembers && team.maxMembers > 0 && (team.membersCount || 0) >= team.maxMembers) {
      return {
        success: false,
        message: `⚠️ ${team.name} is full! Maximum capacity (${team.maxMembers} members) reached.`
      };
    }

    // 2. Team Lock Check (User can join only one team)
    const memberDocId = `${warId}_${user.telegramId}`;
    const memberRef = doc(db, MEMBERS_COLLECTION, memberDocId);
    const memberSnap = await getDoc(memberRef);

    if (memberSnap.exists()) {
      const existingMember = memberSnap.data() as WarMember;
      return {
        success: false,
        message: ` You have already joined ${existingMember.teamName}. Team choice is locked!`,
        member: existingMember
      };
    }

    // 3. Anti-Abuse: Device Fingerprint Check (Detect multiple accounts on same device)
    if (options?.deviceFingerprint) {
      const deviceQuery = query(
        collection(db, MEMBERS_COLLECTION),
        where('warId', '==', warId),
        where('deviceFingerprint', '==', options.deviceFingerprint)
      );
      const devSnap = await getDocs(deviceQuery);
      if (devSnap.size >= 3) {
        // Flag or block if > 3 accounts on same device fingerprint
        console.warn(`Anti-abuse warning: Device ${options.deviceFingerprint} joined multiple accounts`);
      }
    }

    // First Join Leader Check
    const isFirstJoinLeader = !team.leaderTelegramId || team.leaderTelegramId === '';
    const botUsername = 'Roy_wallett_bot';
    const leaderLink = `https://t.me/${botUsername}?start=TEAMA_LEADER_${warId}_${user.telegramId}`;

    const nowIso = new Date().toISOString();
    const newMember: WarMember = {
      id: memberDocId,
      warId,
      telegramId: String(user.telegramId),
      username: user.username || '',
      name: user.name || 'Anonymous User',
      teamId: team.id,
      teamName: team.name,
      points: 0,
      isTeamLeader: isFirstJoinLeader,
      invitedByTelegramId: options?.invitedByTelegramId || '',
      deviceFingerprint: options?.deviceFingerprint || '',
      ipHash: options?.ipHash || '',
      joinedAt: nowIso,
      lastActivityAt: nowIso,
      activityBreakdown: {
        registration: 0,
        referral: 0,
        verifiedVote: 0,
        feedback: 0,
        dailyLogin: 0,
        walletTask: 0
      }
    };

    await setDoc(memberRef, newMember);

    // Validate Active Member Status immediately
    const valResult = await validateAndActivateMember(warId, String(user.telegramId), options);
    const activeMember = valResult.member || newMember;

    // Update team member count, leader, and totalParticipants in War doc
    const updatedTeams = war.teams.map((t) => {
      if (t.id === teamId) {
        return {
          ...t,
          membersCount: (t.membersCount || 0) + 1,
          totalReferrals: options?.invitedByTelegramId
            ? (t.totalReferrals || 0) + 1
            : t.totalReferrals || 0,
          ...(isFirstJoinLeader ? {
            leaderTelegramId: String(user.telegramId),
            leaderName: user.name || 'Team Leader',
            leaderUsername: user.username || '',
            leaderInviteLink: leaderLink,
            leaderPoints: 0
          } : {})
        };
      }
      return t;
    });

    await updateDoc(doc(db, WARS_COLLECTION, warId), {
      teams: updatedTeams,
      totalParticipants: (war.totalParticipants || 0) + 1,
      updatedAt: nowIso
    });

    // Record User Joined Activity Log
    const logId = 'war_log_join_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const joinLog: WarActivityLog = {
      id: logId,
      warId,
      telegramId: String(user.telegramId),
      teamId: team.id,
      activityType: 'user_joined',
      pointsEarned: 0,
      description: isFirstJoinLeader
        ? `👑 FIRST JOIN: Assigned as Team Leader of ${team.name}`
        : `Joined ${team.name}${options?.invitedByTelegramId ? ` (Invited by ${options.invitedByTelegramId})` : ''}`,
      deviceFingerprint: options?.deviceFingerprint || '',
      ipHash: options?.ipHash || '',
      isValid: true,
      createdAt: nowIso
    };
    await setDoc(doc(db, LOGS_COLLECTION, logId), joinLog);

    // Notify Telegram
    notifyTelegramWarEvent('TEAM_JOINED', {
      warId,
      warTitle: war.title,
      userName: activeMember.name,
      telegramId: user.telegramId,
      teamName: team.name
    });

    const updatedTeam = updatedTeams.find((t) => t.id === teamId) || team;

    return {
      success: true,
      message: isFirstJoinLeader
        ? `👑 CONGRATULATIONS! You are the FIRST user to join ${team.name}! You are now automatically assigned as 👑 Team Leader!`
        : (valResult.isActive
            ? `Successfully joined ${team.name} as an ACTIVE member!`
            : `Joined ${team.name}! Status: PENDING verification. Complete channel join and bot onboarding to activate points.`),
      member: { ...activeMember, isTeamLeader: isFirstJoinLeader },
      team: updatedTeam
    };
  } catch (err: any) {
    console.error('Error joining war team:', err);
    return { success: false, message: err.message || 'Failed to join team' };
  }
}

/**
 * Fetch War Members for a War
 */
export async function getWarMembers(warId: string): Promise<WarMember[]> {
  try {
    const q = query(
      collection(db, MEMBERS_COLLECTION),
      where('warId', '==', warId),
      orderBy('points', 'desc')
    );
    const snap = await getDocs(q);
    const list: WarMember[] = [];
    snap.forEach((d) => list.push(d.data() as WarMember));
    return list;
  } catch (err) {
    console.error(`Error fetching war members for ${warId}:`, err);
    return [];
  }
}

/**
 * Fetch a single War Member by Telegram ID
 */
export async function getWarMemberByTelegramId(warId: string, telegramId: string): Promise<WarMember | null> {
  try {
    const memberDocId = `${warId}_${telegramId}`;
    const snap = await getDoc(doc(db, MEMBERS_COLLECTION, memberDocId));
    if (!snap.exists()) return null;
    return snap.data() as WarMember;
  } catch (err) {
    console.error(`Error fetching war member ${telegramId}:`, err);
    return null;
  }
}

/**
 * Anti-Fraud & Points Adder for completed activities
 */
export async function addWarPointsForActivity(params: {
  telegramId: string;
  activityType: 'registration' | 'referral' | 'verified_vote' | 'feedback' | 'daily_login' | 'wallet_task';
  description: string;
  ipHash?: string;
  deviceFingerprint?: string;
  referralTargetTgId?: string;
}): Promise<{ success: boolean; pointsEarned: number; message: string }> {
  try {
    // 1. Find live Giveaway Wars
    const warsQuery = query(collection(db, WARS_COLLECTION), where('status', '==', 'live'));
    const warsSnap = await getDocs(warsQuery);

    if (warsSnap.empty) {
      return { success: false, pointsEarned: 0, message: 'No live Giveaway War event' };
    }

    let totalEarnedInAllWars = 0;

    for (const warDoc of warsSnap.docs) {
      const war = warDoc.data() as GiveawayWar;
      const warId = war.id;

      // Check if user is a member of this war
      const memberDocId = `${warId}_${params.telegramId}`;
      const memberRef = doc(db, MEMBERS_COLLECTION, memberDocId);
      const memberSnap = await getDoc(memberRef);

      if (!memberSnap.exists()) {
        continue; // User hasn't joined this war yet
      }

      const member = memberSnap.data() as WarMember;

      // Check point rules for activity & apply Double Point Booster if active
      const rules = war.pointRules || DEFAULT_POINT_RULES;
      let pts = 0;
      let isEnabled = false;

      switch (params.activityType) {
        case 'registration':
          pts = rules.registrationPoints;
          isEnabled = rules.registrationEnabled;
          break;
        case 'referral':
          pts = rules.referralPoints;
          isEnabled = rules.referralEnabled;
          break;
        case 'verified_vote':
          pts = rules.verifiedVotePoints;
          isEnabled = rules.verifiedVoteEnabled;
          break;
        case 'feedback':
          pts = rules.feedbackPoints;
          isEnabled = rules.feedbackEnabled;
          break;
        case 'daily_login':
          pts = rules.dailyLoginPoints;
          isEnabled = rules.dailyLoginEnabled;
          break;
        case 'wallet_task':
          pts = rules.walletTaskPoints;
          isEnabled = rules.walletTaskEnabled;
          break;
      }

      if (!isEnabled || pts <= 0) {
        continue;
      }

      // Check Active Double Point Booster
      const booster = war.booster;
      if (booster && booster.isActive && booster.expiresAt) {
        const nowMs = new Date().getTime();
        const expMs = new Date(booster.expiresAt).getTime();
        if (nowMs < expMs) {
          const mult = booster.multiplier || 2;
          if (
            (params.activityType === 'referral' && booster.boostReferrals) ||
            (params.activityType === 'verified_vote' && booster.boostVotes) ||
            (params.activityType === 'feedback' && booster.boostFeedbacks)
          ) {
            pts = pts * mult;
            console.log(`🔥 Double Point Booster applied! ${params.activityType} x${mult} = ${pts} pts`);
          }
        }
      }

      // --- Anti-Fraud Verification ---
      let isValid = true;
      let rejectReason = '';

      // Check 1: Self referral
      if (params.activityType === 'referral' && params.referralTargetTgId) {
        if (String(params.telegramId) === String(params.referralTargetTgId)) {
          isValid = false;
          rejectReason = 'Self referral detected';
        }
      }

      // Check 2: Duplicate daily login on same date
      if (params.activityType === 'daily_login') {
        const todayStr = new Date().toISOString().substring(0, 10);
        const qDup = query(
          collection(db, LOGS_COLLECTION),
          where('warId', '==', warId),
          where('telegramId', '==', String(params.telegramId)),
          where('activityType', '==', 'daily_login')
        );
        const dupSnap = await getDocs(qDup);
        const alreadyClaimedToday = dupSnap.docs.some(
          (d) => d.data().createdAt?.substring(0, 10) === todayStr && d.data().isValid === true
        );
        if (alreadyClaimedToday) {
          isValid = false;
          rejectReason = 'Daily login points already claimed today';
        }
      }

      // Record Activity Log
      const nowIso = new Date().toISOString();
      const logId = 'war_log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      const logEntry: WarActivityLog = {
        id: logId,
        warId,
        telegramId: String(params.telegramId),
        teamId: member.teamId,
        activityType: params.activityType,
        pointsEarned: isValid ? pts : 0,
        description: params.description || `Earned ${pts} points for ${params.activityType}`,
        ipHash: params.ipHash || '',
        deviceFingerprint: params.deviceFingerprint || '',
        isValid,
        rejectReason,
        createdAt: nowIso
      };

      await setDoc(doc(db, LOGS_COLLECTION, logId), logEntry);

      if (!isValid) {
        continue;
      }

      // Update Member Points & Activity Breakdown
      const currentBreakdown = member.activityBreakdown || {};
      const updatedBreakdown = {
        ...currentBreakdown,
        [params.activityType]: (currentBreakdown[params.activityType] || 0) + pts
      };
      const newMemberPoints = (member.points || 0) + pts;

      await updateDoc(memberRef, {
        points: newMemberPoints,
        lastActivityAt: nowIso,
        activityBreakdown: updatedBreakdown
      });

      // --- TEAM LEADER SYSTEM: Credit points to Team Leader as well ---
      const freshWarDoc = await getDoc(doc(db, WARS_COLLECTION, warId));
      if (freshWarDoc.exists()) {
        const freshWar = freshWarDoc.data() as GiveawayWar;
        const targetTeam = freshWar.teams.find((t) => t.id === member.teamId);

        if (targetTeam?.leaderTelegramId && String(targetTeam.leaderTelegramId) !== String(params.telegramId)) {
          const leaderMemberDocId = `${warId}_${targetTeam.leaderTelegramId}`;
          const leaderMemberRef = doc(db, MEMBERS_COLLECTION, leaderMemberDocId);
          const leaderSnap = await getDoc(leaderMemberRef);

          if (leaderSnap.exists()) {
            const leaderMember = leaderSnap.data() as WarMember;
            const newLeaderPoints = (leaderMember.points || 0) + pts;
            const newLeadershipPoints = (leaderMember.leaderPoints || 0) + pts;

            await updateDoc(leaderMemberRef, {
              points: newLeaderPoints,
              leaderPoints: newLeadershipPoints,
              lastActivityAt: nowIso
            });

            // Log Team Leader leadership credit
            const leaderLogId = 'war_log_lead_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
            await setDoc(doc(db, LOGS_COLLECTION, leaderLogId), {
              id: leaderLogId,
              warId,
              telegramId: String(targetTeam.leaderTelegramId),
              teamId: member.teamId,
              activityType: 'admin_action',
              pointsEarned: pts,
              description: `👑 Team Leader Bonus (+${pts} Pts): Member ${member.name} completed ${params.activityType}`,
              isValid: true,
              createdAt: nowIso
            });
          }
        }

        // Calculate Team Wallet Bonus Contribution
        let teamWalletAdd = 0;
        if (params.activityType === 'registration') teamWalletAdd = rules.teamWalletRegistrationBonus || 0;
        if (params.activityType === 'referral') teamWalletAdd = rules.teamWalletReferralBonus || 0;
        if (params.activityType === 'verified_vote') teamWalletAdd = rules.teamWalletVoteBonus || 0;
        if (params.activityType === 'feedback') teamWalletAdd = rules.teamWalletFeedbackBonus || 0;

        let unlockedMilestoneMessage = '';

        const updatedTeams = freshWar.teams.map((t) => {
          if (t.id === member.teamId) {
            const newScore = (t.score || 0) + pts;
            const newWalletBal = (t.teamWalletBalance || 0) + teamWalletAdd;
            const newRefs = (t.totalReferrals || 0) + (params.activityType === 'referral' ? 1 : 0);
            const newVotes = (t.totalVerifiedVotes || 0) + (params.activityType === 'verified_vote' ? 1 : 0);
            const newFeedbacks = (t.totalFeedbacks || 0) + (params.activityType === 'feedback' ? 1 : 0);

            return {
              ...t,
              score: newScore,
              teamWalletBalance: newWalletBal,
              totalReferrals: newRefs,
              totalVerifiedVotes: newVotes,
              totalFeedbacks: newFeedbacks
            };
          }
          return t;
        });

        // Check Team Missions
        const updatedMissions = (freshWar.missions || []).map((m) => {
          if (m.isCompleted) return m;
          const myTeam = updatedTeams.find((t) => t.id === member.teamId);
          if (!myTeam) return m;

          let currentCount = 0;
          if (m.targetType === 'referrals') currentCount = myTeam.totalReferrals || 0;
          if (m.targetType === 'votes') currentCount = myTeam.totalVerifiedVotes || 0;
          if (m.targetType === 'feedbacks') currentCount = myTeam.totalFeedbacks || 0;
          if (m.targetType === 'activities') currentCount = (myTeam.totalReferrals || 0) + (myTeam.totalVerifiedVotes || 0) + (myTeam.totalFeedbacks || 0);

          if (currentCount >= m.targetCount) {
            // Reward unlocked to Team Wallet
            myTeam.teamWalletBalance = (myTeam.teamWalletBalance || 0) + (m.rewardAmount || 0);
            return {
              ...m,
              isCompleted: true,
              completedAt: nowIso
            };
          }
          return m;
        });

        // Check Team Milestones & Lucky Member Selection
        const updatedMilestones = await Promise.all(
          (freshWar.milestones || []).map(async (ms) => {
            if (ms.isUnlocked) return ms;
            const myTeam = updatedTeams.find((t) => t.id === member.teamId);
            if (!myTeam) return ms;

            if (myTeam.score >= ms.pointThreshold) {
              // Unlock milestone & pick Lucky Member
              const teamMembers = await getWarMembers(warId);
              const luckyWinner = teamMembers.length > 0
                ? teamMembers[Math.floor(Math.random() * teamMembers.length)]
                : member;

              unlockedMilestoneMessage = `🎉 Milestone ${ms.pointThreshold} Pts reached by ${myTeam.name}! Lucky Winner: ${luckyWinner.name}`;

              // Notify Telegram
              notifyTelegramWarEvent('MILESTONE_UNLOCKED', {
                warId,
                teamName: myTeam.name,
                milestone: ms.pointThreshold,
                luckyWinnerName: luckyWinner.name,
                rewardAmount: ms.luckyMemberReward
              });

              return {
                ...ms,
                isUnlocked: true,
                unlockedAt: nowIso,
                luckyWinnerTelegramId: luckyWinner.telegramId,
                luckyWinnerName: luckyWinner.name
              };
            }
            return ms;
          })
        );

        await updateDoc(doc(db, WARS_COLLECTION, warId), {
          teams: updatedTeams,
          missions: updatedMissions,
          milestones: updatedMilestones,
          totalPoints: (freshWar.totalPoints || 0) + pts,
          updatedAt: nowIso
        });
      }

      totalEarnedInAllWars += pts;

      // Notify Telegram Bot
      notifyTelegramWarEvent('POINTS_EARNED', {
        warId,
        userName: member.name,
        telegramId: params.telegramId,
        teamName: member.teamName,
        pointsEarned: pts,
        newTotalPoints: newMemberPoints,
        activityType: params.activityType
      });
    }

    return {
      success: true,
      pointsEarned: totalEarnedInAllWars,
      message: `Added ${totalEarnedInAllWars} points to active Giveaway War!`
    };
  } catch (err: any) {
    console.error('Error adding war points for activity:', err);
    return { success: false, pointsEarned: 0, message: err.message };
  }
}

/**
 * Fetch Activity Logs for a War
 */
export async function getWarActivityLogs(warId: string): Promise<WarActivityLog[]> {
  try {
    const q = query(
      collection(db, LOGS_COLLECTION),
      where('warId', '==', warId),
      orderBy('createdAt', 'desc'),
      limit(100)
    );
    const snap = await getDocs(q);
    const list: WarActivityLog[] = [];
    snap.forEach((d) => list.push(d.data() as WarActivityLog));
    return list;
  } catch (err) {
    console.error(`Error fetching activity logs for ${warId}:`, err);
    return [];
  }
}

/**
 * End Giveaway War (🛑 End War)
 * Freezes points, calculates Winning Team, MVP, Top Contributors,
 * credits rewards to wallets automatically, generates results.
 */
export async function endGiveawayWar(warId: string): Promise<{
  success: boolean;
  message: string;
  winningTeam?: WarTeam;
  mvpMember?: WarMember;
  topContributors?: WarMember[];
  totalRewardsCredited?: number;
}> {
  try {
    const war = await getGiveawayWarById(warId);
    if (!war) {
      return { success: false, message: 'Giveaway War event not found' };
    }

    if (war.status === 'ended') {
      return { success: false, message: 'Giveaway War is already ended' };
    }

    // 1. Fetch all members and filter strictly to ACTIVE MEMBERS
    const allMembers = await getWarMembers(warId);
    
    // Validate each member to ensure status is up to date
    const activeMembers: WarMember[] = [];
    for (const m of allMembers) {
      if (m.status === 'ACTIVE') {
        activeMembers.push(m);
      } else {
        const valRes = await validateAndActivateMember(warId, m.telegramId);
        if (valRes.isActive && valRes.member) {
          activeMembers.push(valRes.member);
        }
      }
    }

    // 2. Re-calculate Team Scores based strictly on ACTIVE MEMBERS & VALID POINTS
    const teamScoresMap: { [teamId: string]: number } = {};
    activeMembers.forEach((m) => {
      teamScoresMap[m.teamId] = (teamScoresMap[m.teamId] || 0) + (m.points || 0);
    });

    const calculatedTeams = war.teams.map((t) => ({
      ...t,
      score: teamScoresMap[t.id] ?? t.score ?? 0
    }));

    const sortedTeams = [...calculatedTeams].sort((a, b) => (b.score || 0) - (a.score || 0));
    const winningTeam = sortedTeams[0] || war.teams[0];
    const runnerUpTeam = sortedTeams[1];

    // 3. Determine MVP & Top Contributors strictly from ACTIVE MEMBERS
    const sortedMembers = [...activeMembers].sort((a, b) => (b.points || 0) - (a.points || 0));
    const mvpMember = sortedMembers[0] || null;

    // Top 5 Contributors (Active Only)
    const topContributors = sortedMembers.slice(0, 5);

    // 4. Calculate & Credit Rewards
    const rewardConfig = war.rewards || DEFAULT_REWARD_CONFIG;
    let totalCreditedAmount = 0;
    let creditedCount = 0;

    const nowIso = new Date().toISOString();
    const usersRef = collection(db, 'users');

    // Helper to credit a user's wallet
    const creditWallet = async (
      telegramId: string,
      amount: number,
      reason: string
    ): Promise<boolean> => {
      if (amount <= 0 || !telegramId) return false;
      try {
        const qTg = query(usersRef, where('telegramId', '==', String(telegramId)), limit(1));
        const snapTg = await getDocs(qTg);
        if (snapTg.empty) return false;

        const userDoc = snapTg.docs[0];
        const userData = userDoc.data();
        const curBal = Number(userData.walletBalance) || 0;
        const newBal = curBal + amount;

        await updateDoc(userDoc.ref, {
          walletBalance: newBal,
          updatedAt: nowIso
        });

        const txnId = 'TXN_WAR_' + Math.random().toString(36).substring(2, 10).toUpperCase();
        await setDoc(doc(db, 'transactions', txnId), {
          id: txnId,
          transactionId: txnId,
          userId: userDoc.id,
          uid: userData.uid || '',
          telegramId: String(telegramId),
          fullName: userData.firstName || 'War Winner',
          type: 'Giveaway War Prize',
          amount,
          balanceBefore: curBal,
          balanceAfter: newBal,
          status: 'completed',
          description: `⚔️ ${reason} in "${war.title}"`,
          createdAt: nowIso
        });

        const wTxnId = 'WTX_WAR_' + Math.random().toString(36).substring(2, 10).toUpperCase();
        await setDoc(doc(db, 'walletTransactions', wTxnId), {
          transactionId: wTxnId,
          userId: userDoc.id,
          uid: userData.uid || '',
          type: 'Giveaway War Prize',
          amount,
          status: 'completed',
          description: `⚔️ ${reason} in "${war.title}"`,
          createdAt: nowIso
        });

        totalCreditedAmount += amount;
        creditedCount++;
        return true;
      } catch (err) {
        console.error(`Failed to credit war wallet for ${telegramId}:`, err);
        return false;
      }
    };

    // Credit Winning Team Members
    if (rewardConfig.winningTeamReward > 0 && winningTeam) {
      const winningMembers = activeMembers.filter((m) => m.teamId === winningTeam.id);
      for (const m of winningMembers) {
        await creditWallet(
          m.telegramId,
          rewardConfig.winningTeamReward,
          `Winning Team (${winningTeam.name}) Reward`
        );
      }
    }

    // Credit MVP
    if (rewardConfig.mvpReward > 0 && mvpMember) {
      await creditWallet(
        mvpMember.telegramId,
        rewardConfig.mvpReward,
        `MVP (#1 Contributor) Prize`
      );
    }

    // Credit #1 Top Contributor (if separate)
    if (rewardConfig.topContributorReward > 0 && topContributors.length > 0) {
      const top1 = topContributors[0];
      if (!mvpMember || top1.telegramId !== mvpMember.telegramId) {
        await creditWallet(
          top1.telegramId,
          rewardConfig.topContributorReward,
          `Top Contributor Rank #1 Prize`
        );
      }
    }

    // 5. Update War Doc status to 'ended' with results
    const topContributorsFormatted = topContributors.map((c, idx) => ({
      userId: c.id,
      telegramId: c.telegramId,
      name: c.name,
      points: c.points,
      teamId: c.teamId,
      rewardAmount: idx === 0 ? rewardConfig.topContributorReward : 0
    }));

    await updateDoc(doc(db, WARS_COLLECTION, warId), {
      status: 'ended',
      winnerTeamId: winningTeam ? winningTeam.id : '',
      mvpUserId: mvpMember ? mvpMember.telegramId : '',
      mvpUserName: mvpMember ? mvpMember.name : '',
      mvpUserPoints: mvpMember ? mvpMember.points : 0,
      topContributors: topContributorsFormatted,
      endDate: nowIso,
      updatedAt: nowIso
    });

    // 6. Notify Telegram Bot
    notifyTelegramWarEvent('WINNER_ANNOUNCEMENT', {
      warId,
      warTitle: war.title,
      winningTeamName: winningTeam ? winningTeam.name : 'N/A',
      winningTeamScore: winningTeam ? winningTeam.score : 0,
      runnerUpTeamName: runnerUpTeam ? runnerUpTeam.name : 'N/A',
      mvpName: mvpMember ? mvpMember.name : 'N/A',
      mvpPoints: mvpMember ? mvpMember.points : 0,
      totalRewardsCredited: totalCreditedAmount,
      creditedCount
    });

    return {
      success: true,
      message: `🛑 Giveaway War ended! ${winningTeam?.name} declared winner. ₹${totalCreditedAmount} credited to ${creditedCount} winners!`,
      winningTeam,
      mvpMember,
      topContributors,
      totalRewardsCredited: totalCreditedAmount
    };
  } catch (err: any) {
    console.error('Error ending giveaway war:', err);
    return { success: false, message: err.message || 'Failed to end giveaway war' };
  }
}

/**
 * ADMIN RESET: Reset Team Scores
 */
export async function resetWarTeamScores(warId: string): Promise<{ success: boolean; message: string }> {
  try {
    const war = await getGiveawayWarById(warId);
    if (!war) return { success: false, message: 'War not found' };

    const resetTeams = war.teams.map((t) => ({ ...t, score: 0 }));
    await updateDoc(doc(db, WARS_COLLECTION, warId), {
      teams: resetTeams,
      totalPoints: 0,
      updatedAt: new Date().toISOString()
    });

    // Record Admin Action Log
    const logId = 'log_admin_reset_scores_' + Date.now();
    await setDoc(doc(db, LOGS_COLLECTION, logId), {
      id: logId,
      warId,
      telegramId: 'ADMIN',
      teamId: '',
      activityType: 'admin_action',
      pointsEarned: 0,
      description: 'Reset Team Scores to 0',
      isValid: true,
      createdAt: new Date().toISOString()
    });

    return { success: true, message: 'Team scores successfully reset to 0.' };
  } catch (err: any) {
    return { success: false, message: err.message || 'Failed to reset team scores' };
  }
}

/**
 * ADMIN RESET: Reset User Contributions
 */
export async function resetWarUserContributions(warId: string): Promise<{ success: boolean; message: string }> {
  try {
    const members = await getWarMembers(warId);
    const nowIso = new Date().toISOString();

    for (const m of members) {
      await updateDoc(doc(db, MEMBERS_COLLECTION, m.id), {
        points: 0,
        activityBreakdown: {
          registration: 0,
          referral: 0,
          verifiedVote: 0,
          feedback: 0,
          dailyLogin: 0,
          walletTask: 0
        },
        lastActivityAt: nowIso
      });
    }

    // Reset war total points as well
    await updateDoc(doc(db, WARS_COLLECTION, warId), {
      totalPoints: 0,
      updatedAt: nowIso
    });

    return { success: true, message: `Reset contributions for ${members.length} members.` };
  } catch (err: any) {
    return { success: false, message: err.message || 'Failed to reset user contributions' };
  }
}

/**
 * ADMIN RESET: Reset Entire War (Deletes all member records and clears stats)
 */
export async function resetEntireWar(warId: string): Promise<{ success: boolean; message: string }> {
  try {
    const war = await getGiveawayWarById(warId);
    if (!war) return { success: false, message: 'War not found' };

    // Delete members
    const members = await getWarMembers(warId);
    for (const m of members) {
      await deleteDoc(doc(db, MEMBERS_COLLECTION, m.id));
    }

    // Reset war doc
    const resetTeams = war.teams.map((t) => ({
      ...t,
      score: 0,
      membersCount: 0,
      totalReferrals: 0,
      totalVerifiedVotes: 0,
      totalFeedbacks: 0
    }));

    await updateDoc(doc(db, WARS_COLLECTION, warId), {
      teams: resetTeams,
      totalPoints: 0,
      totalParticipants: 0,
      winnerTeamId: '',
      mvpUserId: '',
      mvpUserName: '',
      mvpUserPoints: 0,
      topContributors: [],
      dailyMvpHistory: [],
      updatedAt: new Date().toISOString()
    });

    return { success: true, message: 'Entire Giveaway War reset successfully!' };
  } catch (err: any) {
    return { success: false, message: err.message || 'Failed to reset entire war' };
  }
}

/**
 * ADMIN RESET: Reset Single User Team Lock
 */
export async function resetUserWarTeam(warId: string, telegramId: string): Promise<{ success: boolean; message: string }> {
  try {
    const memberDocId = `${warId}_${telegramId}`;
    const memberSnap = await getDoc(doc(db, MEMBERS_COLLECTION, memberDocId));
    if (!memberSnap.exists()) {
      return { success: false, message: 'Member record not found' };
    }

    const member = memberSnap.data() as WarMember;
    await deleteDoc(doc(db, MEMBERS_COLLECTION, memberDocId));

    // Decrement team member count
    const war = await getGiveawayWarById(warId);
    if (war) {
      const updatedTeams = war.teams.map((t) => {
        if (t.id === member.teamId) {
          return { ...t, membersCount: Math.max(0, (t.membersCount || 1) - 1) };
        }
        return t;
      });

      await updateDoc(doc(db, WARS_COLLECTION, warId), {
        teams: updatedTeams,
        totalParticipants: Math.max(0, (war.totalParticipants || 1) - 1),
        updatedAt: new Date().toISOString()
      });
    }

    return { success: true, message: `Team selection reset for Telegram ID ${telegramId}. User can now join a new team.` };
  } catch (err: any) {
    return { success: false, message: err.message || 'Failed to reset user team' };
  }
}

/**
 * DAILY MVP: Calculate and record Daily MVP
 */
export async function awardDailyMvp(warId: string): Promise<{
  success: boolean;
  message: string;
  mvp?: { name: string; points: number; teamName: string; telegramId: string };
}> {
  try {
    const war = await getGiveawayWarById(warId);
    if (!war) return { success: false, message: 'War not found' };

    const members = await getWarMembers(warId);
    if (members.length === 0) return { success: false, message: 'No participants in this war yet' };

    const todayStr = new Date().toISOString().substring(0, 10);
    const sorted = [...members].sort((a, b) => (b.points || 0) - (a.points || 0));
    const top = sorted[0];

    if (!top || top.points <= 0) {
      return { success: false, message: 'No points earned by any user yet today' };
    }

    const rewardAmount = war.rewards?.dailyMvpReward || 20;
    const nowIso = new Date().toISOString();

    const record = {
      date: todayStr,
      telegramId: top.telegramId,
      name: top.name,
      points: top.points,
      teamName: top.teamName,
      rewardAmount,
      awardedAt: nowIso
    };

    const updatedHistory = [...(war.dailyMvpHistory || []), record];

    await updateDoc(doc(db, WARS_COLLECTION, warId), {
      dailyMvpHistory: updatedHistory,
      updatedAt: nowIso
    });

    // Notify Telegram
    notifyTelegramWarEvent('DAILY_MVP', {
      warId,
      warTitle: war.title,
      date: todayStr,
      mvpName: top.name,
      telegramId: top.telegramId,
      points: top.points,
      teamName: top.teamName,
      rewardAmount
    });

    return {
      success: true,
      message: `👑 Daily MVP awarded to ${top.name} (${top.points} Pts) with ₹${rewardAmount} reward!`,
      mvp: top
    };
  } catch (err: any) {
    return { success: false, message: err.message || 'Failed to award Daily MVP' };
  }
}

/**
 * CSV EXPORT GENERATOR
 */
export async function exportWarDataCSV(
  warId: string,
  exportType: 'teams' | 'members' | 'contributions' | 'rewards'
): Promise<string> {
  const war = await getGiveawayWarById(warId);
  const members = await getWarMembers(warId);
  const logs = await getWarActivityLogs(warId);

  if (exportType === 'teams') {
    let csv = 'Team ID,Team Name,Score,Members Count,Badge\n';
    (war?.teams || []).forEach((t) => {
      const badge = getTeamAchievementBadge(t.score || 0).name;
      csv += `"${t.id}","${t.name}",${t.score || 0},${t.membersCount || 0},"${badge}"\n`;
    });
    return csv;
  }

  if (exportType === 'members') {
    let csv = 'Telegram ID,Name,Username,Team Name,Total Points,Joined Date,Invited By\n';
    members.forEach((m) => {
      csv += `"${m.telegramId}","${m.name.replace(/"/g, '""')}","${m.username || ''}","${m.teamName}",${m.points || 0},"${m.joinedAt}","${m.invitedByTelegramId || ''}"\n`;
    });
    return csv;
  }

  if (exportType === 'contributions') {
    let csv = 'Telegram ID,Name,Team,Registration,Referrals,Verified Votes,Feedbacks,Daily Login,Wallet Task,Total Points\n';
    members.forEach((m) => {
      const b = m.activityBreakdown || {};
      csv += `"${m.telegramId}","${m.name.replace(/"/g, '""')}","${m.teamName}",${b.registration || 0},${b.referral || 0},${b.verifiedVote || 0},${b.feedback || 0},${b.dailyLogin || 0},${b.walletTask || 0},${m.points || 0}\n`;
    });
    return csv;
  }

  if (exportType === 'rewards') {
    let csv = 'User/Team,Role/Category,Points,Reward Amount,Status\n';
    if (war?.winnerTeamId) {
      const winningTeam = war.teams.find((t) => t.id === war.winnerTeamId);
      csv += `"${winningTeam?.name || 'Winner'}","Winning Team",${winningTeam?.score || 0},₹${war.rewards?.winningTeamReward || 0},"Credited"\n`;
    }
    if (war?.mvpUserName) {
      csv += `"${war.mvpUserName}","War MVP",${war.mvpUserPoints || 0},₹${war.rewards?.mvpReward || 0},"Credited"\n`;
    }
    members.slice(0, 10).forEach((m, idx) => {
      csv += `"${m.name}","Top Contributor Rank #${idx + 1}",${m.points},₹${idx === 0 ? war?.rewards?.topContributorReward || 0 : 0},"Processed"\n`;
    });
    return csv;
  }

  return 'No data';
}

/**
 * Telegram Notification Dispatcher helper
 */
async function notifyTelegramWarEvent(type: string, payload: any) {
  try {
    fetch('/api/telegram/war-notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, payload })
    }).catch((e) => console.warn('War notification dispatch error:', e));
  } catch (err) {
    // Non-blocking
  }
}

/**
 * Record Timeline Event for Replay
 */
export async function recordWarTimelineEvent(
  warId: string,
  event: {
    eventType: 'war_start' | 'lead_change' | 'milestone_unlocked' | 'challenge_won' | 'booster_activated' | 'airdrop' | 'mvp_awarded' | 'war_ended';
    title: string;
    description: string;
    teamId?: string;
    teamName?: string;
    badge?: string;
  }
): Promise<void> {
  try {
    const warDoc = await getDoc(doc(db, WARS_COLLECTION, warId));
    if (!warDoc.exists()) return;
    const war = warDoc.data() as GiveawayWar;

    const timelineItem: WarTimelineEvent = {
      id: 'tl_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      timestamp: new Date().toISOString(),
      ...event
    };

    const existingEvents = war.timelineEvents || [];
    const updatedEvents = [timelineItem, ...existingEvents].slice(0, 50);

    await updateDoc(doc(db, WARS_COLLECTION, warId), {
      timelineEvents: updatedEvents,
      updatedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('Error recording timeline event:', err);
  }
}

/**
 * Create Team vs Team Challenge
 */
export async function createWarChallenge(
  warId: string,
  challenge: {
    title: string;
    targetType: 'referrals' | 'votes' | 'feedbacks' | 'points';
    targetCount: number;
    bonusPoints: number;
  }
): Promise<{ success: boolean; message: string }> {
  try {
    const war = await getGiveawayWarById(warId);
    if (!war) return { success: false, message: 'War not found' };

    const newChallenge: WarChallenge = {
      id: 'ch_' + Date.now(),
      title: challenge.title,
      targetType: challenge.targetType,
      targetCount: challenge.targetCount,
      bonusPoints: challenge.bonusPoints,
      isCompleted: false
    };

    const updatedChallenges = [...(war.challenges || []), newChallenge];

    await updateDoc(doc(db, WARS_COLLECTION, warId), {
      challenges: updatedChallenges,
      updatedAt: new Date().toISOString()
    });

    recordWarTimelineEvent(warId, {
      eventType: 'challenge_won',
      title: `⚔️ New Team Challenge: ${challenge.title}`,
      description: `First team to reach ${challenge.targetCount} ${challenge.targetType} gets +${challenge.bonusPoints} bonus points!`,
      badge: '⚔️ Challenge'
    });

    return { success: true, message: `Team Challenge "${challenge.title}" created successfully!` };
  } catch (err: any) {
    return { success: false, message: err.message || 'Failed to create challenge' };
  }
}

/**
 * Create Secret Mission
 */
export async function createWarSecretMission(
  warId: string,
  mission: {
    title: string;
    description: string;
    targetType: 'referrals' | 'votes' | 'feedbacks' | 'points';
    targetCount: number;
    rewardAmount: number;
    rewardType: 'points' | 'wallet';
  }
): Promise<{ success: boolean; message: string }> {
  try {
    const war = await getGiveawayWarById(warId);
    if (!war) return { success: false, message: 'War not found' };

    const newMission: WarSecretMission = {
      id: 'sm_' + Date.now(),
      title: mission.title,
      description: mission.description,
      targetType: mission.targetType,
      targetCount: mission.targetCount,
      rewardAmount: mission.rewardAmount,
      rewardType: mission.rewardType,
      isCompleted: false
    };

    const updatedMissions = [...(war.secretMissions || []), newMission];

    await updateDoc(doc(db, WARS_COLLECTION, warId), {
      secretMissions: updatedMissions,
      updatedAt: new Date().toISOString()
    });

    return { success: true, message: `Secret Mission created! Users will discover it as they progress.` };
  } catch (err: any) {
    return { success: false, message: err.message || 'Failed to create secret mission' };
  }
}

/**
 * Trigger Random AirDrop
 */
export async function triggerWarAirdrop(
  warId: string,
  options?: {
    amount?: number;
    rewardType?: 'points' | 'wallet';
    count?: number;
  }
): Promise<{ success: boolean; message: string; recipients?: any[] }> {
  try {
    const war = await getGiveawayWarById(warId);
    if (!war) return { success: false, message: 'War not found' };

    const members = await getWarMembers(warId);
    if (members.length === 0) return { success: false, message: 'No participants in this war' };

    const amount = options?.amount || 50;
    const rewardType = options?.rewardType || 'points';
    const count = Math.min(options?.count || 3, members.length);

    // Shuffle & pick
    const shuffled = [...members].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, count);

    const nowIso = new Date().toISOString();
    const recipientsList: { telegramId: string; name: string; teamName: string; amount: number }[] = [];

    for (const m of selected) {
      recipientsList.push({
        telegramId: m.telegramId,
        name: m.name,
        teamName: m.teamName,
        amount
      });

      if (rewardType === 'points') {
        // Add points directly
        const memberRef = doc(db, MEMBERS_COLLECTION, `${warId}_${m.telegramId}`);
        await updateDoc(memberRef, {
          points: (m.points || 0) + amount,
          lastActivityAt: nowIso
        });
      } else {
        // Add pending wallet reward
        const memberRef = doc(db, MEMBERS_COLLECTION, `${warId}_${m.telegramId}`);
        const pendingReward: WarPendingReward = {
          id: 'reward_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
          warId,
          warTitle: war.title,
          telegramId: m.telegramId,
          rewardType: 'wallet',
          amount,
          title: '🎁 Random AirDrop Reward',
          description: `Surprise AirDrop from Admin! Claim your ₹${amount} wallet cash.`,
          isClaimed: false,
          createdAt: nowIso
        };
        const existingPending = m.pendingRewards || [];
        await updateDoc(memberRef, {
          pendingRewards: [...existingPending, pendingReward]
        });
      }
    }

    const newAirdrop: WarAirdrop = {
      id: 'airdrop_' + Date.now(),
      warId,
      amount,
      rewardType,
      recipientsCount: recipientsList.length,
      recipients: recipientsList,
      createdAt: nowIso
    };

    const updatedAirdrops = [newAirdrop, ...(war.airdrops || [])];

    await updateDoc(doc(db, WARS_COLLECTION, warId), {
      airdrops: updatedAirdrops,
      updatedAt: nowIso
    });

    const recipientNames = recipientsList.map((r) => r.name).join(', ');
    recordWarTimelineEvent(warId, {
      eventType: 'airdrop',
      title: `🎁 Random AirDrop Triggered!`,
      description: `Surprise ${amount} ${rewardType} awarded to ${recipientsList.length} warriors: ${recipientNames}`,
      badge: '🎁 AirDrop'
    });

    notifyTelegramWarEvent('AIRDROP_TRIGGERED', {
      warId,
      warTitle: war.title,
      amount,
      rewardType,
      recipients: recipientsList
    });

    return {
      success: true,
      message: `🎁 AirDrop successfully delivered to ${recipientsList.length} random participants! (${recipientNames})`,
      recipients: recipientsList
    };
  } catch (err: any) {
    return { success: false, message: err.message || 'Failed to trigger AirDrop' };
  }
}

/**
 * Trigger Surprise Booster (Random Multiplier & Duration)
 */
export async function triggerSurpriseBooster(warId: string): Promise<{ success: boolean; message: string }> {
  try {
    const multipliers = [2, 3, 5];
    const durations = [30, 60, 120];
    const randMult = multipliers[Math.floor(Math.random() * multipliers.length)];
    const randDur = durations[Math.floor(Math.random() * durations.length)];

    const res = await activatePointBooster(warId, randDur, {
      multiplier: randMult,
      boostReferrals: true,
      boostVotes: true,
      boostFeedbacks: true
    });

    if (res.success) {
      recordWarTimelineEvent(warId, {
        eventType: 'booster_activated',
        title: `🔥 SURPRISE BOOSTER ACTIVATED! (${randMult}X)`,
        description: `Surprise ${randMult}X Multiplier active on all activities for the next ${randDur} minutes!`,
        badge: '⚡ Booster'
      });
    }

    return res;
  } catch (err: any) {
    return { success: false, message: err.message || 'Failed to trigger surprise booster' };
  }
}

/**
 * Spin Daily Lucky Wheel
 */
export async function spinDailyWarWheel(
  warId: string,
  telegramId: string
): Promise<{
  success: boolean;
  message: string;
  outcome?: {
    type: 'points' | 'wallet' | 'team_score' | 'nothing';
    label: string;
    amount: number;
  };
}> {
  try {
    const todayStr = new Date().toISOString().substring(0, 10);
    const memberRef = doc(db, MEMBERS_COLLECTION, `${warId}_${telegramId}`);
    const memberSnap = await getDoc(memberRef);

    if (!memberSnap.exists()) {
      return { success: false, message: 'You must join a team first before spinning!' };
    }

    const member = memberSnap.data() as WarMember;

    if (member.lastSpinDate === todayStr) {
      return { success: false, message: '❌ You have already spun today! Return tomorrow for your free spin.' };
    }

    // Wheel Outcomes Weighted Pool
    const outcomes: {
      type: 'points' | 'wallet' | 'team_score' | 'nothing';
      label: string;
      amount: number;
      weight: number;
    }[] = [
      { type: 'points', label: '⭐ +25 Bonus Points', amount: 25, weight: 35 },
      { type: 'points', label: '🌟 +50 Mega Points', amount: 50, weight: 25 },
      { type: 'wallet', label: '💰 ₹10 Wallet Reward', amount: 10, weight: 15 },
      { type: 'team_score', label: '🛡️ +30 Team Score Contribution', amount: 30, weight: 15 },
      { type: 'nothing', label: '🎯 Better Luck Tomorrow!', amount: 0, weight: 10 }
    ];

    // Pick outcome by weight
    const totalWeight = outcomes.reduce((acc, o) => acc + o.weight, 0);
    let rand = Math.floor(Math.random() * totalWeight);
    let selectedOutcome = outcomes[0];

    for (const o of outcomes) {
      if (rand < o.weight) {
        selectedOutcome = o;
        break;
      }
      rand -= o.weight;
    }

    const nowIso = new Date().toISOString();

    if (selectedOutcome.type === 'points') {
      await updateDoc(memberRef, {
        points: (member.points || 0) + selectedOutcome.amount,
        lastSpinDate: todayStr,
        lastActivityAt: nowIso
      });
    } else if (selectedOutcome.type === 'wallet') {
      const pendingReward: WarPendingReward = {
        id: 'spin_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        warId,
        warTitle: 'Giveaway War Daily Wheel',
        telegramId,
        rewardType: 'wallet',
        amount: selectedOutcome.amount,
        title: '🎰 Daily Lucky Spin Reward',
        description: `Won ₹${selectedOutcome.amount} cash from Daily Lucky Spin!`,
        isClaimed: false,
        createdAt: nowIso
      };
      const existingPending = member.pendingRewards || [];
      await updateDoc(memberRef, {
        pendingRewards: [...existingPending, pendingReward],
        lastSpinDate: todayStr,
        lastActivityAt: nowIso
      });
    } else if (selectedOutcome.type === 'team_score') {
      await updateDoc(memberRef, {
        points: (member.points || 0) + selectedOutcome.amount,
        lastSpinDate: todayStr,
        lastActivityAt: nowIso
      });
      // Boost Team Score
      const warDoc = await getDoc(doc(db, WARS_COLLECTION, warId));
      if (warDoc.exists()) {
        const war = warDoc.data() as GiveawayWar;
        const updatedTeams = war.teams.map((t) =>
          t.id === member.teamId ? { ...t, score: (t.score || 0) + selectedOutcome.amount } : t
        );
        await updateDoc(doc(db, WARS_COLLECTION, warId), { teams: updatedTeams });
      }
    } else {
      await updateDoc(memberRef, {
        lastSpinDate: todayStr
      });
    }

    return {
      success: true,
      message: `🎉 Spin Result: ${selectedOutcome.label}`,
      outcome: {
        type: selectedOutcome.type,
        label: selectedOutcome.label,
        amount: selectedOutcome.amount
      }
    };
  } catch (err: any) {
    return { success: false, message: err.message || 'Failed to perform daily spin' };
  }
}

/**
 * Get Advanced Statistics for Giveaway War
 */
export async function getAdvancedWarStats(warId: string): Promise<{
  mostActiveHour: string;
  bestDay: string;
  highestReferralUser: { name: string; count: number };
  highestVoteUser: { name: string; count: number };
  highestFeedbackUser: { name: string; count: number };
  topGrowthTeam: { name: string; score: number };
}> {
  try {
    const logsQuery = query(collection(db, LOGS_COLLECTION), where('warId', '==', warId));
    const logsSnap = await getDocs(logsQuery);
    const members = await getWarMembers(warId);
    const war = await getGiveawayWarById(warId);

    const hourCounts: { [hour: number]: number } = {};
    const dayPoints: { [day: string]: number } = {};

    logsSnap.forEach((d) => {
      const data = d.data() as WarActivityLog;
      if (!data.createdAt) return;
      const dt = new Date(data.createdAt);
      const hr = dt.getHours();
      const dy = data.createdAt.substring(0, 10);

      hourCounts[hr] = (hourCounts[hr] || 0) + 1;
      if (data.isValid && data.pointsEarned) {
        dayPoints[dy] = (dayPoints[dy] || 0) + data.pointsEarned;
      }
    });

    // Most Active Hour
    let bestHour = 12;
    let maxHourCount = 0;
    Object.entries(hourCounts).forEach(([h, cnt]) => {
      if (cnt > maxHourCount) {
        maxHourCount = cnt;
        bestHour = Number(h);
      }
    });
    const mostActiveHourStr = `${bestHour}:00 - ${bestHour + 1}:00`;

    // Best Day
    let bestDayStr = 'N/A';
    let maxDayPts = 0;
    Object.entries(dayPoints).forEach(([d, pts]) => {
      if (pts > maxDayPts) {
        maxDayPts = pts;
        bestDayStr = d;
      }
    });

    // User Highest Counters
    let topRefUser = { name: 'None', count: 0 };
    let topVoteUser = { name: 'None', count: 0 };
    let topFeedbackUser = { name: 'None', count: 0 };

    members.forEach((m) => {
      const refs = m.activityBreakdown?.referral || 0;
      const votes = m.activityBreakdown?.verifiedVote || 0;
      const fbs = m.activityBreakdown?.feedback || 0;

      if (refs > topRefUser.count) topRefUser = { name: m.name, count: refs };
      if (votes > topVoteUser.count) topVoteUser = { name: m.name, count: votes };
      if (fbs > topFeedbackUser.count) topFeedbackUser = { name: m.name, count: fbs };
    });

    // Top Growth Team
    let topTeam = { name: 'N/A', score: 0 };
    if (war && war.teams) {
      const sorted = [...war.teams].sort((a, b) => (b.score || 0) - (a.score || 0));
      if (sorted[0]) topTeam = { name: sorted[0].name, score: sorted[0].score };
    }

    return {
      mostActiveHour: mostActiveHourStr,
      bestDay: bestDayStr,
      highestReferralUser: topRefUser,
      highestVoteUser: topVoteUser,
      highestFeedbackUser: topFeedbackUser,
      topGrowthTeam: topTeam
    };
  } catch (err) {
    console.error('Error fetching advanced war stats:', err);
    return {
      mostActiveHour: 'N/A',
      bestDay: 'N/A',
      highestReferralUser: { name: 'N/A', count: 0 },
      highestVoteUser: { name: 'N/A', count: 0 },
      highestFeedbackUser: { name: 'N/A', count: 0 },
      topGrowthTeam: { name: 'N/A', score: 0 }
    };
  }
}

/**
 * Calculate AI Fair Play Score for a Member
 */
export function calculateFairPlayScore(
  member: WarMember,
  allLogs: WarActivityLog[],
  allMembers: WarMember[]
): number {
  let score = 100;

  // Check 1: Device Fingerprint duplication
  if (member.deviceFingerprint) {
    const sameFpCount = allMembers.filter((m) => m.deviceFingerprint === member.deviceFingerprint).length;
    if (sameFpCount > 2) score -= 20;
  }

  // Check 2: IP Hash duplication
  if (member.ipHash) {
    const sameIpCount = allMembers.filter((m) => m.ipHash === member.ipHash).length;
    if (sameIpCount > 3) score -= 20;
  }

  // Check 3: Reject Rate in Logs
  const userLogs = allLogs.filter((l) => String(l.telegramId) === String(member.telegramId));
  if (userLogs.length > 0) {
    const invalidCount = userLogs.filter((l) => !l.isValid).length;
    const rejectRate = invalidCount / userLogs.length;
    if (rejectRate > 0.3) score -= 30;
    else if (rejectRate > 0.1) score -= 15;
  }

  return Math.max(40, score);
}

/**
 * Claim Pending Reward from Claim Center
 */
export async function claimPendingReward(
  warId: string,
  telegramId: string,
  rewardId: string
): Promise<{ success: boolean; message: string }> {
  try {
    const memberRef = doc(db, MEMBERS_COLLECTION, `${warId}_${telegramId}`);
    const memberSnap = await getDoc(memberRef);

    if (!memberSnap.exists()) {
      return { success: false, message: 'Member profile not found' };
    }

    const member = memberSnap.data() as WarMember;
    const pendingList = member.pendingRewards || [];
    const rewardIndex = pendingList.findIndex((r) => r.id === rewardId);

    if (rewardIndex === -1) {
      return { success: false, message: 'Pending reward not found' };
    }

    const reward = pendingList[rewardIndex];
    if (reward.isClaimed) {
      return { success: false, message: 'Reward already claimed' };
    }

    const nowIso = new Date().toISOString();

    // Mark as claimed
    const updatedPending = [...pendingList];
    updatedPending[rewardIndex] = {
      ...reward,
      isClaimed: true,
      claimedAt: nowIso
    };

    if (reward.rewardType === 'points') {
      await updateDoc(memberRef, {
        points: (member.points || 0) + reward.amount,
        pendingRewards: updatedPending
      });
    } else {
      // Wallet Cash Reward - Update Pending list and credit user wallet via transaction
      await updateDoc(memberRef, {
        pendingRewards: updatedPending
      });

      // Credit wallet
      await setDoc(doc(db, 'wallet_transactions', 'tx_' + Date.now()), {
        telegramId: String(telegramId),
        type: 'CREDIT',
        amount: reward.amount,
        description: `🎁 Giveaway War Claim: ${reward.title}`,
        status: 'SUCCESS',
        createdAt: nowIso
      });
    }

    return {
      success: true,
      message: `🎉 Successfully claimed reward: ${reward.title} (${reward.rewardType === 'wallet' ? '₹' : '+'}${reward.amount})!`
    };
  } catch (err: any) {
    return { success: false, message: err.message || 'Failed to claim reward' };
  }
}

/**
 * Activate Double Point Booster
 */
export async function activatePointBooster(
  warId: string,
  durationMinutes: number,
  options?: {
    multiplier?: number;
    boostReferrals?: boolean;
    boostVotes?: boolean;
    boostFeedbacks?: boolean;
  }
): Promise<{ success: boolean; message: string }> {
  try {
    const war = await getGiveawayWarById(warId);
    if (!war) return { success: false, message: 'War not found' };

    const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();
    const boosterConfig: WarPointBooster = {
      isActive: true,
      multiplier: options?.multiplier || 2,
      boostReferrals: options?.boostReferrals ?? true,
      boostVotes: options?.boostVotes ?? true,
      boostFeedbacks: options?.boostFeedbacks ?? true,
      expiresAt
    };

    await updateDoc(doc(db, WARS_COLLECTION, warId), {
      booster: boosterConfig,
      updatedAt: new Date().toISOString()
    });

    notifyTelegramWarEvent('BOOSTER_ACTIVATED', {
      warId,
      warTitle: war.title,
      multiplier: boosterConfig.multiplier,
      durationMinutes
    });

    return {
      success: true,
      message: `🔥 ${boosterConfig.multiplier}x Double Point Booster activated for ${durationMinutes} minutes!`
    };
  } catch (err: any) {
    return { success: false, message: err.message || 'Failed to activate booster' };
  }
}

/**
 * Get Hall of Fame Wars (Ended Wars sorted by endDate descending)
 */
export async function getHallOfFameWars(): Promise<GiveawayWar[]> {
  try {
    const q = query(
      collection(db, WARS_COLLECTION),
      where('status', '==', 'ended'),
      orderBy('endDate', 'desc')
    );
    const snap = await getDocs(q);
    const list: GiveawayWar[] = [];
    snap.forEach((d) => list.push(d.data() as GiveawayWar));
    return list;
  } catch (err) {
    console.error('Error fetching Hall of Fame wars:', err);
    return [];
  }
}

/**
 * Get War Stats for Telegram Bot /war command
 */
export async function getWarStatsForTelegram(telegramId: string): Promise<{
  hasActiveWar: boolean;
  warTitle?: string;
  userName?: string;
  teamName?: string;
  points?: number;
  userRank?: number;
  teamRank?: number;
  teamScore?: number;
  topTeamName?: string;
  topTeamScore?: number;
  leaderboardTop3?: { name: string; points: number; teamName: string }[];
  remainingTime?: string;
}> {
  try {
    const warsQuery = query(
      collection(db, WARS_COLLECTION),
      where('status', '==', 'live'),
      limit(1)
    );
    const warsSnap = await getDocs(warsQuery);
    if (warsSnap.empty) {
      return { hasActiveWar: false };
    }

    const war = warsSnap.docs[0].data() as GiveawayWar;
    const members = await getWarMembers(war.id);
    const sortedMembers = [...members].sort((a, b) => (b.points || 0) - (a.points || 0));

    const myIndex = sortedMembers.findIndex((m) => String(m.telegramId) === String(telegramId));
    const myMember = myIndex >= 0 ? sortedMembers[myIndex] : null;

    const sortedTeams = [...war.teams].sort((a, b) => (b.score || 0) - (a.score || 0));
    const topTeam = sortedTeams[0];

    let teamRank = 0;
    if (myMember) {
      teamRank = sortedTeams.findIndex((t) => t.id === myMember.teamId) + 1;
    }

    const top3 = sortedMembers.slice(0, 3).map((m) => ({
      name: m.name,
      points: m.points,
      teamName: m.teamName
    }));

    return {
      hasActiveWar: true,
      warTitle: war.title,
      userName: myMember ? myMember.name : 'Not Joined',
      teamName: myMember ? myMember.teamName : 'None',
      points: myMember ? myMember.points : 0,
      userRank: myIndex >= 0 ? myIndex + 1 : 0,
      teamRank,
      teamScore: myMember ? (war.teams.find((t) => t.id === myMember.teamId)?.score || 0) : 0,
      topTeamName: topTeam ? topTeam.name : 'N/A',
      topTeamScore: topTeam ? topTeam.score : 0,
      leaderboardTop3: top3,
      remainingTime: war.endDate ? new Date(war.endDate).toLocaleString() : 'Live Event'
    };
  } catch (err) {
    console.error('Error fetching war stats for telegram:', err);
    return { hasActiveWar: false };
  }
}

/**
 * TEAM LEADER SYSTEM: Assign Team Leader
 */
export async function assignTeamLeader(
  warId: string,
  teamId: string,
  leader: { telegramId: string; name: string; username?: string; botUsername?: string }
): Promise<{ success: boolean; message: string }> {
  try {
    const war = await getGiveawayWarById(warId);
    if (!war) return { success: false, message: 'Giveaway War not found' };

    const team = war.teams.find((t) => t.id === teamId);
    if (!team) return { success: false, message: 'Team not found' };

    const botUser = leader.botUsername || 'Roy_wallett_bot';
    const leaderInviteLink = `https://t.me/${botUser.replace(/^@/, '')}?start=war_${warId}_team_${teamId}_lead_${leader.telegramId}`;

    const updatedTeams = war.teams.map((t) => {
      if (t.id === teamId) {
        return {
          ...t,
          leaderTelegramId: String(leader.telegramId),
          leaderName: leader.name,
          leaderUsername: leader.username || '',
          leaderInviteLink
        };
      }
      return t;
    });

    const nowIso = new Date().toISOString();
    await updateDoc(doc(db, WARS_COLLECTION, warId), {
      teams: updatedTeams,
      updatedAt: nowIso
    });

    // Also register or update leader in War Members collection as team leader
    const memberDocId = `${warId}_${leader.telegramId}`;
    const memberRef = doc(db, MEMBERS_COLLECTION, memberDocId);
    const memberSnap = await getDoc(memberRef);

    if (memberSnap.exists()) {
      await updateDoc(memberRef, {
        teamId,
        teamName: team.name,
        isTeamLeader: true,
        lastActivityAt: nowIso
      });
    } else {
      const newLeaderMember: WarMember = {
        id: memberDocId,
        warId,
        telegramId: String(leader.telegramId),
        username: leader.username || '',
        name: leader.name,
        teamId,
        teamName: team.name,
        points: 0,
        isTeamLeader: true,
        leaderPoints: 0,
        joinedAt: nowIso,
        lastActivityAt: nowIso,
        activityBreakdown: {
          registration: 0,
          referral: 0,
          verifiedVote: 0,
          feedback: 0,
          dailyLogin: 0,
          walletTask: 0
        }
      };
      await setDoc(memberRef, newLeaderMember);
    }

    // Audit Log
    const logId = 'log_admin_assign_leader_' + Date.now();
    await setDoc(doc(db, LOGS_COLLECTION, logId), {
      id: logId,
      warId,
      telegramId: 'ADMIN',
      teamId,
      activityType: 'admin_action',
      pointsEarned: 0,
      description: `👑 Assigned ${leader.name} (ID: ${leader.telegramId}) as Team Leader for ${team.name}`,
      isValid: true,
      createdAt: nowIso
    });

    return {
      success: true,
      message: `👑 ${leader.name} assigned as Team Leader for ${team.name}!`
    };
  } catch (err: any) {
    console.error('Error assigning team leader:', err);
    return { success: false, message: err.message || 'Failed to assign team leader' };
  }
}

/**
 * ADMIN MANUAL POINTS: Add manual points to Leader or Member
 */
export async function addManualWarPoints(params: {
  warId: string;
  telegramId: string;
  points: number;
  reason: string;
  adminTgId?: string;
}): Promise<{ success: boolean; message: string; newPoints?: number }> {
  try {
    const war = await getGiveawayWarById(params.warId);
    if (!war) return { success: false, message: 'War not found' };

    const memberDocId = `${params.warId}_${params.telegramId}`;
    const memberRef = doc(db, MEMBERS_COLLECTION, memberDocId);
    const memberSnap = await getDoc(memberRef);

    if (!memberSnap.exists()) {
      return { success: false, message: 'User is not a member of this Giveaway War.' };
    }

    const member = memberSnap.data() as WarMember;
    const nowIso = new Date().toISOString();
    const pts = Number(params.points);
    const newMemberPts = (member.points || 0) + pts;

    await updateDoc(memberRef, {
      points: newMemberPts,
      lastActivityAt: nowIso
    });

    // Update Team Total Score in War doc
    const updatedTeams = war.teams.map((t) => {
      if (t.id === member.teamId) {
        return { ...t, score: (t.score || 0) + pts };
      }
      return t;
    });

    await updateDoc(doc(db, WARS_COLLECTION, params.warId), {
      teams: updatedTeams,
      totalPoints: (war.totalPoints || 0) + pts,
      updatedAt: nowIso
    });

    // Audit Log
    const logId = 'log_admin_manual_pts_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    await setDoc(doc(db, LOGS_COLLECTION, logId), {
      id: logId,
      warId: params.warId,
      telegramId: String(params.telegramId),
      teamId: member.teamId,
      activityType: 'admin_action',
      pointsEarned: pts,
      description: `🎁 Manual Admin Award (+${pts} Pts) to ${member.name} - Reason: ${params.reason || 'Special Bonus'}`,
      isValid: true,
      createdAt: nowIso
    });

    return {
      success: true,
      message: `✅ Added +${pts} manual points to ${member.name}. Reason: ${params.reason}`,
      newPoints: newMemberPts
    };
  } catch (err: any) {
    console.error('Error adding manual war points:', err);
    return { success: false, message: err.message || 'Failed to add manual points' };
  }
}

/**
 * TEAM LEADER DASHBOARD DATA
 */
export async function getTeamLeaderDashboardData(warId: string, leaderTelegramId: string): Promise<{
  team?: WarTeam;
  leaderMember?: WarMember;
  totalMembers: number;
  todayNewMembers: number;
  totalReferrals: number;
  totalVotes: number;
  totalFeedbacks: number;
  totalActiveMembers?: number;
  pendingMembers?: number;
  rejectedMembers?: number;
  totalJoined?: number;
  conversionRate?: string;
  teamPoints: number;
  teamRank: number;
  topContributors: WarMember[];
  recentMembers: WarMember[];
}> {
  try {
    const war = await getGiveawayWarById(warId);
    if (!war) throw new Error('War not found');

    const sortedTeams = [...war.teams].sort((a, b) => (b.score || 0) - (a.score || 0));
    const team = war.teams.find((t) => String(t.leaderTelegramId) === String(leaderTelegramId));

    const members = await getWarMembers(warId);
    const teamMembers = team ? members.filter((m) => m.teamId === team.id) : [];

    const todayStr = new Date().toISOString().substring(0, 10);
    const todayNewMembers = teamMembers.filter((m) => m.joinedAt && m.joinedAt.substring(0, 10) === todayStr).length;

    let totalReferrals = 0;
    let totalVotes = 0;
    let totalFeedbacks = 0;

    teamMembers.forEach((m) => {
      const b = m.activityBreakdown || {};
      totalReferrals += b.referral || 0;
      totalVotes += b.verifiedVote || 0;
      totalFeedbacks += b.feedback || 0;
    });

    const totalActiveMembers = teamMembers.filter((m) => m.status === 'ACTIVE').length;
    const pendingMembers = teamMembers.filter((m) => m.status === 'PENDING' || !m.status).length;
    const rejectedMembers = teamMembers.filter((m) => m.status === 'REJECTED').length;
    const totalJoined = teamMembers.length;
    const conversionRate = totalJoined > 0 ? ((totalActiveMembers / totalJoined) * 100).toFixed(1) : '0';

    const rankIndex = team ? sortedTeams.findIndex((t) => t.id === team.id) : -1;
    const teamRank = rankIndex >= 0 ? rankIndex + 1 : 1;

    const topContributors = [...teamMembers].sort((a, b) => (b.points || 0) - (a.points || 0)).slice(0, 10);
    const recentMembers = [...teamMembers].sort((a, b) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime()).slice(0, 10);

    const leaderMember = members.find((m) => String(m.telegramId) === String(leaderTelegramId));

    return {
      team,
      leaderMember,
      totalMembers: teamMembers.length,
      todayNewMembers,
      totalReferrals,
      totalVotes,
      totalFeedbacks,
      totalActiveMembers,
      pendingMembers,
      rejectedMembers,
      totalJoined,
      conversionRate,
      teamPoints: team?.score || 0,
      teamRank,
      topContributors,
      recentMembers
    };
  } catch (err) {
    console.error('Error fetching team leader dashboard data:', err);
    return {
      totalMembers: 0,
      todayNewMembers: 0,
      totalReferrals: 0,
      totalVotes: 0,
      totalFeedbacks: 0,
      teamPoints: 0,
      teamRank: 1,
      topContributors: [],
      recentMembers: []
    };
  }
}

