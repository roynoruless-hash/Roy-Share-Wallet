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

      const regStartDateStr = contest.registrationStartDate; // "YYYY-MM-DD"
      const regEndDateStr = contest.registrationEndDate;     // "YYYY-MM-DDTHH:MM"
      const voteEndDateStr = contest.votingEndDate;         // "YYYY-MM-DDTHH:MM"

      if (!regStartDateStr || !regEndDateStr || !voteEndDateStr) {
        continue;
      }

      const regStartDate = new Date(regStartDateStr + 'T00:00:00');
      const regEndDate = new Date(regEndDateStr);
      const voteEndDate = new Date(voteEndDateStr);

      // 1. Transition: Upcoming -> Active (When registration opens)
      if (contest.status === 'upcoming' && now >= regStartDate && now < regEndDate) {
        console.log(`[Scheduler] Transitioning contest "${contest.title}" (${contest.id}) to active status (Registration Opened)`);
        await setDoc(doc(db, 'contests', contest.id), { status: 'active' }, { merge: true });
        continue;
      }

      // 2. Transition: Registration Ends -> Generate & Send Unique Voting Links to participants
      if (now >= regEndDate && now < voteEndDate && !contest.registrationClosedProcessed) {
        console.log(`[Scheduler] Closing registration for contest "${contest.title}" (${contest.id}) and sending voting links`);
        
        // Mark as processed immediately to lock other executions
        await setDoc(doc(db, 'contests', contest.id), {
          registrationClosedProcessed: true,
          status: 'active' // Ensure it is active for voting
        }, { merge: true });

        // Retrieve config and bot details
        const config = await getDecryptedConfig();
        if (config && config.botToken) {
          const token = config.botToken;
          const botUsername = config.botUsername || 'RoyShareWalletBot';

          // Get contestants for this contest
          const contestantsRef = collection(db, 'contestants');
          const q = query(contestantsRef, where('contestId', '==', contest.id));
          const contestantsSnap = await getDocs(q);

          for (const contestantDoc of contestantsSnap.docs) {
            const contestant = contestantDoc.data();
            // Send links to approved contestants
            if (contestant.status === 'approved' && contestant.telegramId) {
              const uniqueLink = `https://t.me/${botUsername}?start=vote_${contest.id}_${contestantDoc.id}`;
              const messageText = `🏁 <b>Registration Closed! Voting has officially started!</b>\n\n` +
                `🏆 Contest: <b>${contest.title}</b>\n` +
                `👤 Contestant: <b>${contestant.name}</b>\n\n` +
                `🗳 Here is your unique voting link. Share this link with your friends, groups, and channels to gather votes:\n` +
                `👉 ${uniqueLink}\n\n` +
                `Good luck! 🚀`;

              await sendTelegramMessage(token, contestant.telegramId, messageText);
            }
          }
        }
        continue;
      }

      // 3. Transition: Voting End -> Stop votes, Lock leaderboard, Calculate final results, Mark contest completed
      if (now >= voteEndDate && !contest.votingEndedProcessed) {
        console.log(`[Scheduler] Ending voting and calculating final standings for contest "${contest.title}" (${contest.id})`);

        // Mark as processed immediately to lock other executions
        await setDoc(doc(db, 'contests', contest.id), {
          votingEndedProcessed: true,
          status: 'completed'
        }, { merge: true });

        // Get contestants for this contest
        const contestantsRef = collection(db, 'contestants');
        const q = query(contestantsRef, where('contestId', '==', contest.id));
        const contestantsSnap = await getDocs(q);
        
        const contestantsList = contestantsSnap.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data()
        })) as any[];

        // Sort desc by votesCount
        contestantsList.sort((a, b) => (b.votesCount || 0) - (a.votesCount || 0));

        let standingsText = `🏁 <b>The contest "${contest.title}" has ended!</b>\n\n` +
          `🏆 <b>Final Leaderboard Standing:</b>\n\n`;

        if (contestantsList.length === 0) {
          standingsText += `No contestants participated in this contest.`;
        } else {
          contestantsList.forEach((cn, idx) => {
            const medal = idx === 0 ? '👑' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '🔹';
            standingsText += `${medal} #${idx + 1} <b>${cn.name}</b> - ${cn.votesCount || 0} votes\n`;
          });
        }

        const config = await getDecryptedConfig();
        if (config && config.botToken) {
          const token = config.botToken;

          // Notify all contestants
          for (const cn of contestantsList) {
            if (cn.telegramId) {
              let personalMessage = standingsText;
              if (contestantsList[0] && contestantsList[0].id === cn.id) {
                personalMessage += `\n🎉 <b>Congratulations! You are the WINNER of this contest!</b>`;
                if (contest.winnerRewardAmount && contest.winnerRewardAmount > 0) {
                  personalMessage += `\n🎁 Winner Reward: <b>₹${contest.winnerRewardAmount}</b> has been awarded or will be distributed!`;
                }
              }
              await sendTelegramMessage(token, cn.telegramId, personalMessage);
            }
          }

          // Notify Admin
          if (config.adminChatId) {
            await sendTelegramMessage(token, config.adminChatId, `🔔 <b>Contest Completed Automatically!</b>\n\n${standingsText}`);
          }
        }
      }
    }
  } catch (error) {
    console.error('[Scheduler] Error running automatic contest schedule checks:', error);
  }
}
