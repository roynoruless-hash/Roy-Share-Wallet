import {
  collection,
  query,
  getDocs,
  doc,
  addDoc,
  deleteDoc,
  updateDoc,
  setDoc,
  orderBy,
  where,
  getDoc
} from 'firebase/firestore';
import { db } from './firebase';
import { TaskItem, ManualTaskSubmission, TaskCampaign, TaskAttempt } from '../types';

/**
 * Helper to map Firestore doc to TaskItem
 */
function mapDocToTask(docSnap: any): TaskItem {
  const d = docSnap.data();
  return {
    id: docSnap.id,
    title: d.title || 'Untitled Task',
    reward: Number(d.reward) || 0,
    rewardType: d.rewardType || 'fixed',
    coins: Number(d.coins) || 0,
    verificationType: d.verificationType || 'none',
    icon: d.icon || 'CheckSquare',
    sortOrder: Number(d.sortOrder) || 0,
    url: d.url || d.externalDestinationUrl || '',
    externalDestinationUrl: d.externalDestinationUrl || d.url || '',
    taskImage: d.taskImage || '',
    description: d.description || '',
    detailedInstructions: d.detailedInstructions || '',
    proofDemoImage: d.proofDemoImage || '',
    privateAdminGroupChatId: d.privateAdminGroupChatId || '',
    telegramAdminChatId: d.telegramAdminChatId || '',
    allowResubmission: d.allowResubmission !== false,
    maxResubmissions: Number(d.maxResubmissions) || 2,
    maxSubmissionsPerUser: Number(d.maxSubmissionsPerUser) || 1,
    deadlineEnabled: Boolean(d.deadlineEnabled),
    deadlineMinutes: Number(d.deadlineMinutes) || 1440,
    maxApprovedUsers: Number(d.maxApprovedUsers) || 0,
    approvedCount: Number(d.approvedCount) || 0,
    isFull: Boolean(d.isFull),
    campaignId: d.campaignId || '',
    earningBotId: d.earningBotId || '',
    active: d.active !== false,
    createdAt: d.createdAt || new Date().toISOString(),
  };
}

/**
 * Fetch all tasks ordered by sortOrder ascending
 */
export async function fetchTasksFromDb(earningBotId?: string): Promise<TaskItem[]> {
  try {
    const ref = collection(db, 'tasks');
    let snap;
    if (earningBotId) {
      const q = query(ref, where('earningBotId', '==', earningBotId));
      snap = await getDocs(q);
    } else {
      const q = query(ref, orderBy('sortOrder', 'asc'));
      snap = await getDocs(q);
    }
    
    const list: TaskItem[] = [];
    snap.forEach((docSnap) => {
      list.push(mapDocToTask(docSnap));
    });
    
    list.sort((a, b) => a.sortOrder - b.sortOrder);
    return list;
  } catch (err) {
    console.error('Error fetching tasks from DB:', err);
    try {
      const snap = await getDocs(collection(db, 'tasks'));
      const list: TaskItem[] = [];
      snap.forEach((docSnap) => {
        list.push(mapDocToTask(docSnap));
      });
      list.sort((a, b) => a.sortOrder - b.sortOrder);
      return list;
    } catch (e2) {
      console.error('Secondary tasks fetch failed:', e2);
      return [];
    }
  }
}

/**
 * Save or Update Task
 */
export async function saveTaskToDb(t: Partial<TaskItem>): Promise<string> {
  const ref = collection(db, 'tasks');
  const payload = {
    title: t.title || 'New Task',
    reward: Number(t.reward) || 0,
    rewardType: t.rewardType || 'fixed',
    coins: Number(t.coins) || 0,
    verificationType: t.verificationType || 'none',
    icon: t.icon || 'CheckSquare',
    sortOrder: t.sortOrder !== undefined ? Number(t.sortOrder) : 10,
    url: t.url || t.externalDestinationUrl || '',
    externalDestinationUrl: t.externalDestinationUrl || t.url || '',
    taskImage: t.taskImage || '',
    description: t.description || '',
    detailedInstructions: t.detailedInstructions || '',
    proofDemoImage: t.proofDemoImage || '',
    privateAdminGroupChatId: t.privateAdminGroupChatId || '',
    telegramAdminChatId: t.telegramAdminChatId || '',
    allowResubmission: t.allowResubmission !== false,
    maxResubmissions: Number(t.maxResubmissions) || 2,
    maxSubmissionsPerUser: Number(t.maxSubmissionsPerUser) || 1,
    deadlineEnabled: Boolean(t.deadlineEnabled),
    deadlineMinutes: Number(t.deadlineMinutes) || 1440,
    maxApprovedUsers: Number(t.maxApprovedUsers) || 0,
    approvedCount: Number(t.approvedCount) || 0,
    isFull: Boolean(t.isFull),
    campaignId: t.campaignId || '',
    earningBotId: t.earningBotId || '',
    active: t.active !== false,
    createdAt: t.createdAt || new Date().toISOString(),
  };

  if (t.id) {
    const docRef = doc(db, 'tasks', t.id);
    await updateDoc(docRef, payload);
    return t.id;
  } else {
    const existing = await fetchTasksFromDb(t.earningBotId);
    const nextOrder = existing.length > 0 ? Math.max(...existing.map(x => x.sortOrder)) + 10 : 10;
    payload.sortOrder = t.sortOrder !== undefined ? Number(t.sortOrder) : nextOrder;
    
    const newDoc = await addDoc(ref, payload);
    return newDoc.id;
  }
}

/**
 * Delete a task
 */
export async function deleteTaskFromDb(id: string): Promise<void> {
  const docRef = doc(db, 'tasks', id);
  await deleteDoc(docRef);
}

/**
 * Fetch manual task submissions from Firestore
 */
export async function fetchManualSubmissionsFromDb(earningBotId?: string): Promise<ManualTaskSubmission[]> {
  try {
    const ref = collection(db, 'manualTaskSubmissions');
    let snap;
    if (earningBotId) {
      const q = query(ref, where('earningBotId', '==', earningBotId));
      snap = await getDocs(q);
    } else {
      snap = await getDocs(ref);
    }

    const list: ManualTaskSubmission[] = [];
    snap.forEach((docSnap) => {
      const d = docSnap.data();
      list.push({
        id: docSnap.id,
        earningBotId: d.earningBotId || '',
        taskId: d.taskId || '',
        taskTitle: d.taskTitle || '',
        campaignId: d.campaignId || '',
        campaignName: d.campaignName || '',
        reward: Number(d.reward) || 0,
        coins: Number(d.coins) || 0,
        userId: d.userId || '',
        telegramUserId: d.telegramUserId || '',
        telegramUsername: d.telegramUsername || '',
        userFullName: d.userFullName || '',
        userAppUid: d.userAppUid || '',
        registrationMobile: d.registrationMobile || '',
        proofImageUrl: d.proofImageUrl || '',
        status: d.status || 'PENDING_APPROVAL',
        submissionVersion: Number(d.submissionVersion) || 1,
        attemptId: d.attemptId || '',
        submittedAt: d.submittedAt || new Date().toISOString(),
        reviewedAt: d.reviewedAt || '',
        reviewedBy: d.reviewedBy || '',
        adminNote: d.adminNote || '',
        rejectionReason: d.rejectionReason || '',
        adminGroupMessageId: d.adminGroupMessageId,
        adminGroupChatId: d.adminGroupChatId || '',
        suspiciousFlag: d.suspiciousFlag || 'NORMAL',
        suspiciousReason: d.suspiciousReason || '',
        mobileUseCount: Number(d.mobileUseCount) || 1,
        relatedSubmissionIds: Array.isArray(d.relatedSubmissionIds) ? d.relatedSubmissionIds : [],
      });
    });

    list.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
    return list;
  } catch (err) {
    console.error('Error fetching manual task submissions:', err);
    return [];
  }
}

/**
 * Fetch Task Campaigns from DB
 */
export async function fetchCampaignsFromDb(earningBotId?: string): Promise<TaskCampaign[]> {
  try {
    const ref = collection(db, 'taskCampaigns');
    let snap;
    if (earningBotId) {
      const q = query(ref, where('earningBotId', '==', earningBotId));
      snap = await getDocs(q);
    } else {
      snap = await getDocs(ref);
    }

    const list: TaskCampaign[] = [];
    snap.forEach((docSnap) => {
      const d = docSnap.data();
      list.push({
        id: docSnap.id,
        earningBotId: d.earningBotId || '',
        name: d.name || 'Untitled Campaign',
        description: d.description || '',
        imageUrl: d.imageUrl || '',
        totalBudget: Number(d.totalBudget) || 0,
        rewardPerUser: Number(d.rewardPerUser) || 0,
        maxApprovedUsers: Number(d.maxApprovedUsers) || 0,
        startDate: d.startDate || new Date().toISOString(),
        endDate: d.endDate || '',
        status: d.status || 'DRAFT',
        createdAt: d.createdAt || new Date().toISOString(),
        spentBudget: Number(d.spentBudget) || 0,
        approvedUsersCount: Number(d.approvedUsersCount) || 0,
        tasksCount: Number(d.tasksCount) || 0,
        pendingReviewsCount: Number(d.pendingReviewsCount) || 0,
      });
    });

    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return list;
  } catch (err) {
    console.error('Error fetching campaigns:', err);
    return [];
  }
}

/**
 * Save or Update Task Campaign
 */
export async function saveCampaignToDb(c: Partial<TaskCampaign>): Promise<string> {
  const ref = collection(db, 'taskCampaigns');
  const payload = {
    earningBotId: c.earningBotId || '',
    name: c.name || 'New Campaign',
    description: c.description || '',
    imageUrl: c.imageUrl || '',
    totalBudget: Number(c.totalBudget) || 0,
    rewardPerUser: Number(c.rewardPerUser) || 0,
    maxApprovedUsers: Number(c.maxApprovedUsers) || 0,
    startDate: c.startDate || new Date().toISOString(),
    endDate: c.endDate || '',
    status: c.status || 'DRAFT',
    createdAt: c.createdAt || new Date().toISOString(),
    spentBudget: Number(c.spentBudget) || 0,
    approvedUsersCount: Number(c.approvedUsersCount) || 0,
  };

  if (c.id) {
    const docRef = doc(db, 'taskCampaigns', c.id);
    await updateDoc(docRef, payload);
    return c.id;
  } else {
    const newDoc = await addDoc(ref, payload);
    return newDoc.id;
  }
}

/**
 * Delete Campaign
 */
export async function deleteCampaignFromDb(id: string): Promise<void> {
  const docRef = doc(db, 'taskCampaigns', id);
  await deleteDoc(docRef);
}

