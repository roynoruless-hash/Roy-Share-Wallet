import {
  collection,
  query,
  where,
  getDocs,
  doc,
  addDoc,
  setDoc,
  deleteDoc,
  getDoc,
  updateDoc,
  orderBy,
  runTransaction
} from 'firebase/firestore';
import { db } from './firebase';
import { ReferralMilestone, MilestoneClaimRecord } from '../types';

/**
 * Fetch all milestones ordered by position ascending
 */
export async function fetchMilestonesFromDb(): Promise<ReferralMilestone[]> {
  try {
    const ref = collection(db, 'referralMilestones');
    const q = query(ref, orderBy('position', 'asc'));
    const snap = await getDocs(q);
    
    const list: ReferralMilestone[] = [];
    snap.forEach((docSnap) => {
      const d = docSnap.data();
      list.push({
        id: docSnap.id,
        requiredReferrals: Number(d.requiredReferrals) || 0,
        rewardAmount: Number(d.rewardAmount) || 0,
        rewardType: d.rewardType || 'wallet',
        active: d.active !== false,
        position: Number(d.position) || 0,
        createdAt: d.createdAt || new Date().toISOString(),
      });
    });
    
    // Fallback manual sort if orderby index is building
    list.sort((a, b) => a.position - b.position);
    return list;
  } catch (err) {
    console.error('Error fetching milestones from DB:', err);
    // Try to query without orderBy just in case index is not created yet
    try {
      const snap = await getDocs(collection(db, 'referralMilestones'));
      const list: ReferralMilestone[] = [];
      snap.forEach((docSnap) => {
        const d = docSnap.data();
        list.push({
          id: docSnap.id,
          requiredReferrals: Number(d.requiredReferrals) || 0,
          rewardAmount: Number(d.rewardAmount) || 0,
          rewardType: d.rewardType || 'wallet',
          active: d.active !== false,
          position: Number(d.position) || 0,
          createdAt: d.createdAt || new Date().toISOString(),
        });
      });
      list.sort((a, b) => a.position - b.position);
      return list;
    } catch (e2) {
      console.error('Secondary milestone fetch failed:', e2);
      return [];
    }
  }
}

/**
 * Save or Update Milestone
 */
export async function saveMilestoneToDb(m: Partial<ReferralMilestone>): Promise<string> {
  const ref = collection(db, 'referralMilestones');
  if (m.id) {
    const docRef = doc(db, 'referralMilestones', m.id);
    const dataToSave = { ...m };
    delete dataToSave.id;
    await updateDoc(docRef, dataToSave);
    return m.id;
  } else {
    // Determine next position
    const existing = await fetchMilestonesFromDb();
    const nextPos = existing.length > 0 ? Math.max(...existing.map(x => x.position)) + 1 : 1;
    
    const newDoc = await addDoc(ref, {
      requiredReferrals: m.requiredReferrals || 5,
      rewardAmount: m.rewardAmount || 20,
      rewardType: m.rewardType || 'wallet',
      active: m.active !== false,
      position: m.position !== undefined ? m.position : nextPos,
      createdAt: new Date().toISOString(),
    });
    return newDoc.id;
  }
}

/**
 * Delete a milestone
 */
export async function deleteMilestoneFromDb(id: string): Promise<void> {
  await deleteDoc(doc(db, 'referralMilestones', id));
}

/**
 * Update positions of milestones in bulk
 */
export async function updateMilestonePositionsInDb(milestones: ReferralMilestone[]): Promise<void> {
  await runTransaction(db, async (transaction) => {
    for (let i = 0; i < milestones.length; i++) {
      const m = milestones[i];
      const docRef = doc(db, 'referralMilestones', m.id);
      transaction.update(docRef, { position: i + 1 });
    }
  });
}

/**
 * Fetch all claim records for milestones
 */
export async function fetchMilestoneClaimsFromDb(): Promise<MilestoneClaimRecord[]> {
  try {
    const ref = collection(db, 'milestoneClaimRecords');
    const snap = await getDocs(ref);
    const list: MilestoneClaimRecord[] = [];
    
    snap.forEach((docSnap) => {
      const d = docSnap.data();
      list.push({
        id: docSnap.id,
        uid: d.uid || '',
        telegramId: d.telegramId || '',
        userName: d.userName || 'User',
        telegramUsername: d.telegramUsername || '',
        milestoneId: d.milestoneId || '',
        requiredReferrals: Number(d.requiredReferrals) || 0,
        rewardAmount: Number(d.rewardAmount) || 0,
        rewardType: d.rewardType || 'wallet',
        claimToken: d.claimToken || '',
        status: d.status || 'pending',
        rejectReason: d.rejectReason || '',
        ip: d.ip || '',
        deviceFingerprint: d.deviceFingerprint || '',
        deviceHash: d.deviceHash || '',
        localStorageId: d.localStorageId || '',
        userAgent: d.userAgent || '',
        timezone: d.timezone || '',
        platform: d.platform || '',
        location: d.location || null,
        claimTime: d.claimTime || d.createdAt || new Date().toISOString(),
        verifiedAt: d.verifiedAt || '',
      });
    });
    
    list.sort((a, b) => new Date(b.claimTime).getTime() - new Date(a.claimTime).getTime());
    return list;
  } catch (err) {
    console.error('Error fetching milestone claim records:', err);
    return [];
  }
}

/**
 * Reset all claims for a specific User UID (allowing them to earn milestones again)
 */
export async function resetUserMilestonesInDb(userUid: string): Promise<void> {
  if (!userUid) return;
  
  // 1. Fetch claims for this user
  const claimsRef = collection(db, 'milestoneClaimRecords');
  const qClaims = query(claimsRef, where('uid', '==', String(userUid).trim()));
  const snapClaims = await getDocs(qClaims);
  
  await runTransaction(db, async (transaction) => {
    snapClaims.forEach((claimDoc) => {
      // We can delete the claims, or mark them as status 'reset'
      transaction.delete(doc(db, 'milestoneClaimRecords', claimDoc.id));
    });
  });

  // Also remove milestone tokens
  const tokensRef = collection(db, 'milestoneTokens');
  const qTokens = query(tokensRef, where('uid', '==', String(userUid).trim()));
  const snapTokens = await getDocs(qTokens);
  
  await runTransaction(db, async (transaction) => {
    snapTokens.forEach((tokenDoc) => {
      transaction.delete(doc(db, 'milestoneTokens', tokenDoc.id));
    });
  });
}

/**
 * Manually approve a claim (credits reward to user wallet if not already done)
 */
export async function approveMilestoneClaimInDb(claimId: string, adminId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const claimDocRef = doc(db, 'milestoneClaimRecords', claimId);
    const claimSnap = await getDoc(claimDocRef);
    if (!claimSnap.exists()) {
      return { success: false, error: 'Claim record not found' };
    }
    
    const data = claimSnap.data();
    if (data.status === 'approved') {
      return { success: false, error: 'Claim is already approved' };
    }
    
    // Find user to credit
    const userQuery = query(collection(db, 'users'), where('uid', '==', String(data.uid)));
    const userSnap = await getDocs(userQuery);
    if (userSnap.empty) {
      return { success: false, error: 'User associated with this claim not found' };
    }
    
    const userDocRef = doc(db, 'users', userSnap.docs[0].id);
    const rewardAmt = Number(data.rewardAmount) || 0;
    const rewardType = data.rewardType || 'wallet';
    
    await runTransaction(db, async (transaction) => {
      const userFresh = await transaction.get(userDocRef);
      if (!userFresh.exists()) {
        throw new Error('User not found in transaction');
      }
      
      const userData = userFresh.data();
      const curBal = Number(userData.walletBalance || 0);
      const curCoins = Number(userData.coinsBalance || 0);
      const curBonus = Number(userData.bonusBalance || 0);
      
      let updateFields: any = {};
      let balanceAfter = curBal;
      
      if (rewardType === 'coins') {
        updateFields.coinsBalance = curCoins + rewardAmt;
        balanceAfter = curCoins + rewardAmt;
      } else if (rewardType === 'bonus') {
        updateFields.bonusBalance = curBonus + rewardAmt;
        balanceAfter = curBonus + rewardAmt;
      } else {
        updateFields.walletBalance = curBal + rewardAmt;
        balanceAfter = curBal + rewardAmt;
      }
      
      transaction.update(userDocRef, updateFields);
      transaction.update(claimDocRef, {
        status: 'approved',
        verifiedAt: new Date().toISOString(),
        approvedBy: adminId,
      });
      
      // Generate strict Transaction ID format: TXNXXXXXXXX
      const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let randStr = '';
      for (let i = 0; i < 8; i++) {
        randStr += characters.charAt(Math.floor(Math.random() * characters.length));
      }
      const transactionId = `TXN${randStr}`;

      // Add wallet/coins transaction
      const txRef = doc(db, 'transactions', transactionId);
      transaction.set(txRef, {
        id: transactionId,
        transactionId: transactionId,
        userId: userSnap.docs[0].id,
        uid: String(data.uid),
        telegramId: String(userData.telegramId || ''),
        fullName: String(userData.firstName || 'User'),
        mobile: String(userData.mobile || ''),
        type: 'Referral Milestone Reward',
        amount: rewardAmt,
        balanceBefore: rewardType === 'coins' ? curCoins : rewardType === 'bonus' ? curBonus : curBal,
        balanceAfter: balanceAfter,
        status: 'completed',
        description: `Milestone Claim Approved: ${data.requiredReferrals} referrals (${rewardType})`,
        createdAt: new Date().toISOString(),
      });
    });
    
    return { success: true };
  } catch (err: any) {
    console.error('Error approving claim:', err);
    return { success: false, error: err.message || 'Error processing transaction' };
  }
}

/**
 * Manually reject a claim
 */
export async function rejectMilestoneClaimInDb(claimId: string, reason: string, adminId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const claimDocRef = doc(db, 'milestoneClaimRecords', claimId);
    await updateDoc(claimDocRef, {
      status: 'rejected',
      rejectReason: reason || 'Rejected by administrator',
      verifiedAt: new Date().toISOString(),
      rejectedBy: adminId,
    });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error updating claim record' };
  }
}
