import {
  collection,
  query,
  getDocs,
  doc,
  addDoc,
  setDoc,
  deleteDoc,
  updateDoc,
  orderBy
} from 'firebase/firestore';
import { db } from './firebase';
import { TaskItem } from '../types';

/**
 * Fetch all tasks ordered by sortOrder ascending
 */
export async function fetchTasksFromDb(): Promise<TaskItem[]> {
  try {
    const ref = collection(db, 'tasks');
    const q = query(ref, orderBy('sortOrder', 'asc'));
    const snap = await getDocs(q);
    
    const list: TaskItem[] = [];
    snap.forEach((docSnap) => {
      const d = docSnap.data();
      list.push({
        id: docSnap.id,
        title: d.title || 'Untitled Task',
        reward: Number(d.reward) || 0,
        coins: Number(d.coins) || 0,
        verificationType: d.verificationType || 'none',
        icon: d.icon || 'CheckSquare',
        sortOrder: Number(d.sortOrder) || 0,
        url: d.url || '',
        active: d.active !== false,
        createdAt: d.createdAt || new Date().toISOString(),
      });
    });
    
    list.sort((a, b) => a.sortOrder - b.sortOrder);
    return list;
  } catch (err) {
    console.error('Error fetching tasks from DB:', err);
    try {
      const snap = await getDocs(collection(db, 'tasks'));
      const list: TaskItem[] = [];
      snap.forEach((docSnap) => {
        const d = docSnap.data();
        list.push({
          id: docSnap.id,
          title: d.title || 'Untitled Task',
          reward: Number(d.reward) || 0,
          coins: Number(d.coins) || 0,
          verificationType: d.verificationType || 'none',
          icon: d.icon || 'CheckSquare',
          sortOrder: Number(d.sortOrder) || 0,
          url: d.url || '',
          active: d.active !== false,
          createdAt: d.createdAt || new Date().toISOString(),
        });
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
  if (t.id) {
    const docRef = doc(db, 'tasks', t.id);
    const dataToSave = { ...t };
    delete dataToSave.id;
    await updateDoc(docRef, dataToSave);
    return t.id;
  } else {
    const existing = await fetchTasksFromDb();
    const nextOrder = existing.length > 0 ? Math.max(...existing.map(x => x.sortOrder)) + 10 : 10;
    
    const newDoc = await addDoc(ref, {
      title: t.title || 'New Task',
      reward: Number(t.reward) || 0,
      coins: Number(t.coins) || 0,
      verificationType: t.verificationType || 'none',
      icon: t.icon || 'CheckSquare',
      sortOrder: t.sortOrder !== undefined ? Number(t.sortOrder) : nextOrder,
      url: t.url || '',
      active: t.active !== false,
      createdAt: new Date().toISOString(),
    });
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
