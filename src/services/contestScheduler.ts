import { collection, query, where, getDocs, setDoc, doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { decrypt } from '../utils/encryption';

// Helper to load settings/config and decrypt sensitive fields
async function getDecryptedConfig(): Promise<any> {
  try {
    const configDoc = await getDoc(doc(db, 'settings', 'config'));
    if (configDoc.exists()) {
      const data = configDoc.data() || {};
      return {
        ...data,
        botToken: decrypt(data.botToken || ''),
        adminChatId: decrypt(data.adminChatId || ''),
        adminMobileNumber: decrypt(data.adminMobileNumber || ''),
      };
    }
  } catch (err) {
    console.error('Error fetching decrypted config in scheduler:', err);
  }
  return null;
}

// Helper to send Telegram message
async function sendTelegramMessage(token: string, chatId: number | string, text: string) {
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
      }),
    });
    return await response.json();
  } catch (err) {
    console.error('Error sending Telegram message in scheduler:', err);
    return null;
  }
}

export function startContestScheduler() {
  console.log('🏁 Starting Automatic Contest Workflow Scheduler (Interval: 1 minute)...');
  
  // Run once immediately on startup, then every 1 minute
  runSchedulerCycle().catch(err => console.error('Error in initial scheduler cycle:', err));
  
  setInterval(() => {
    runSchedulerCycle().catch(err => console.error('Error in scheduler cycle:', err));
  }, 60 * 1000);
}

async function runSchedulerCycle() {
  const now = new Date();

  try {
    const contestsRef = collection(db, 'contests');
    const querySnapshot = await getDocs(contestsRef);
    
    for (const contestDoc of querySnapshot.docs) {
      const contest = { id: contestDoc.id, ...contestDoc.data() } as any;
      
      if (contest.status === 'completed') {
        continue;
      }

      const regStartDateStr = contest.registrationStartDate;

      if (!regStartDateStr) {
        continue;
      }

      const regStartDate = new Date(regStartDateStr + (regStartDateStr.includes('T') ? '' : 'T00:00:00'));

      // Transition: Upcoming -> Active (When registration start date & time arrives)
      if (contest.status === 'upcoming' && now >= regStartDate) {
        console.log(`[Scheduler] Transitioning contest "${contest.title}" (${contest.id}) to active status (Registration Opened)`);
        await setDoc(doc(db, 'contests', contest.id), { status: 'active' }, { merge: true });
        continue;
      }
    }
  } catch (error) {
    console.error('[Scheduler] Error running automatic contest schedule checks:', error);
  }
}
