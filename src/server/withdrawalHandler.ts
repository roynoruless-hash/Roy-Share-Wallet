import { collection, query, where, getDocs, doc, runTransaction, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { recordWalletTransaction } from './transactionService';
import { decrypt } from '../utils/encryption';

async function sendTelegramMessage(token: string, chatId: string, text: string) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
    return await res.json();
  } catch (e) {
    console.error('Failed sending telegram notification:', e);
    return null;
  }
}

export async function approveWithdrawal(botToken: string, withdrawalDocId: string) {
  if (!withdrawalDocId) {
    return { success: false, error: 'Withdrawal ID required' };
  }

  try {
    const wDocRef = doc(db, 'withdrawals', withdrawalDocId);
    let wSnap = await getDoc(wDocRef);

    // Fallback lookup if not found directly by ID in withdrawals
    if (!wSnap.exists()) {
      const activeSnap = await getDocs(query(collection(db, 'withdrawals'), where('withdrawalId', '==', withdrawalDocId)));
      if (!activeSnap.empty) {
        wSnap = activeSnap.docs[0];
      } else {
        // Look up in withdraw_requests
        const wrSnap = await getDoc(doc(db, 'withdraw_requests', withdrawalDocId));
        if (wrSnap.exists()) {
          wSnap = wrSnap;
        } else {
          const activeSnap2 = await getDocs(query(collection(db, 'withdraw_requests'), where('requestId', '==', withdrawalDocId)));
          if (!activeSnap2.empty) {
            wSnap = activeSnap2.docs[0];
          }
        }
      }
    }

    if (!wSnap.exists()) {
      return { success: false, error: 'Withdrawal record not found.' };
    }

    const wData = wSnap.data() as any;
    const withdrawalId = wData.withdrawalId || wData.requestId || wSnap.id;
    const currentStatus = String(wData.status || '').toUpperCase();

    if (currentStatus === 'PAID' || currentStatus === 'APPROVED' || currentStatus === 'COMPLETED') {
      return { success: false, error: 'Withdrawal has already been processed.' };
    }

    if (wData.providerPaymentStarted === true && currentStatus === 'PROCESSING') {
      return { success: false, error: 'Payment is currently in progress with provider.' };
    }

    // Fetch config
    const configDoc = await getDoc(doc(db, 'settings', 'config'));
    const configData = configDoc.exists() ? configDoc.data() : {};
    const decryptedBotToken = decrypt(configData.botToken || '');
    const activeBotToken = botToken || decryptedBotToken;
    const nowIso = new Date().toISOString();

    // Lock provider call atomic start
    await updateDoc(doc(db, 'withdrawals', withdrawalId), {
      providerPaymentStarted: true,
      status: 'PROCESSING',
      updatedAt: nowIso,
    }).catch(() => {});

    await updateDoc(doc(db, 'withdraw_requests', withdrawalId), {
      providerPaymentStarted: true,
      status: 'PROCESSING',
      updatedAt: nowIso,
    }).catch(() => {});

    const normMethod = String(wData.method || '').toUpperCase();
    const telegramId = wData.telegramId || wData.uid || '';
    const totalDeduction = Number(wData.totalDeduction) || Number(wData.amount) || 0;

    // ULTRA PAY EXECUTION
    if (normMethod === 'ULTRA_PAY') {
      const apiToken = decrypt(configData.ultraPayApiToken || '');
      const apiKey = decrypt(configData.ultraPayApiKey || '');
      const endpoint = configData.ultraPayEndpoint || 'https://www.ultra-pay.store/APIs/api';
      const paytoNumber = wData.paymentDetails?.paytoNumber || wData.paytoNumber || '';

      if (!apiToken || !apiKey) {
        // Reset state
        await updateDoc(doc(db, 'withdrawals', withdrawalId), { providerPaymentStarted: false, status: 'PENDING' }).catch(() => {});
        await updateDoc(doc(db, 'withdraw_requests', withdrawalId), { providerPaymentStarted: false, status: 'PENDING' }).catch(() => {});
        return { success: false, error: 'Ultra Pay API credentials are not configured.' };
      }

      try {
        const ultraUrl = new URL(endpoint);
        ultraUrl.searchParams.append('token', apiToken);
        ultraUrl.searchParams.append('key', apiKey);
        ultraUrl.searchParams.append('paytoNumber', paytoNumber);
        ultraUrl.searchParams.append('amount', String(wData.finalPayout || wData.amount));
        ultraUrl.searchParams.append('comment', `RoyShare Withdrawal ${withdrawalId}`);

        console.log(`[Ultra Pay Bot Call] Executing payout for ${withdrawalId}...`);
        const apiRes = await fetch(ultraUrl.toString(), { method: 'GET', headers: { 'Accept': 'application/json' } });
        const resText = await apiRes.text();

        let resData: any = {};
        try {
          resData = JSON.parse(resText);
        } catch {
          resData = { raw: resText };
        }

        const statusStr = String(resData.status || '').toLowerCase();
        const isSuccess = apiRes.ok && (statusStr === 'success' || statusStr === '1' || resData.success === true || String(resData.code) === '200');
        const isFailed = !apiRes.ok || statusStr === 'failed' || statusStr === 'failure' || statusStr === '0' || resData.success === false;

        if (isSuccess) {
          const providerRef = resData.ref || resData.txn_id || resData.transaction_id || `UP_${Date.now()}`;
          
          // Finalize Deduction
          await runTransaction(db, async (tx) => {
            const uRef = doc(db, 'users', telegramId);
            const uSnap = await tx.get(uRef);
            if (uSnap.exists()) {
              const u = uSnap.data();
              const newBal = Math.max(0, (Number(u.walletBalance) || 0) - totalDeduction);
              const newLock = Math.max(0, (Number(u.lockedBalance) || 0) - totalDeduction);
              tx.update(uRef, { walletBalance: newBal, lockedBalance: newLock, updatedAt: nowIso });
            }

            const updateData = {
              status: 'PAID',
              paidAt: nowIso,
              approvedAt: nowIso,
              providerReference: providerRef,
              providerResponse: resData,
              updatedAt: nowIso,
            };

            tx.update(doc(db, 'withdrawals', withdrawalId), updateData);
            tx.update(doc(db, 'withdraw_requests', withdrawalId), { ...updateData, status: 'Approved' });
          });

          // Ledger
          try {
            await recordWalletTransaction({
              uid: wData.uid,
              type: 'Withdrawal Paid',
              amount: 0,
              status: 'completed',
              description: `Ultra Pay Withdrawal Paid #${withdrawalId} (Ref: ${providerRef})`,
              transactionId: `TXN_PAID_${withdrawalId}`,
            });
          } catch (e) {}

          // Send Telegram Notification
          if (activeBotToken && telegramId) {
            const msg =
              `✅ <b>Withdrawal Successful!</b>\n\n` +
              `💰 <b>Amount Requested:</b> ₹${wData.amountRequested || wData.amount}\n` +
              `💳 <b>Method:</b> Ultra Pay\n` +
              `🏦 <b>Payout Sent:</b> ₹${wData.finalPayout || wData.amount}\n` +
              `📱 <b>Pay Number:</b> <code>${paytoNumber}</code>\n` +
              `🆔 <b>Withdrawal ID:</b> <code>${withdrawalId}</code>\n` +
              `📌 <b>Provider Ref:</b> <code>${providerRef}</code>\n\n` +
              `Status: PAID`;
            await sendTelegramMessage(activeBotToken, telegramId, msg);
          }

          return { success: true, message: 'Ultra Pay payout executed successfully!' };
        } else if (isFailed) {
          const failReason = resData.message || resData.error || 'Provider rejected payment';
          
          // Unlock Balance & Refund
          await runTransaction(db, async (tx) => {
            const uRef = doc(db, 'users', telegramId);
            const uSnap = await tx.get(uRef);
            if (uSnap.exists()) {
              const u = uSnap.data();
              const newLock = Math.max(0, (Number(u.lockedBalance) || 0) - totalDeduction);
              tx.update(uRef, { lockedBalance: newLock, updatedAt: nowIso });
            }

            const updateData = {
              status: 'FAILED',
              failureReason: failReason,
              providerResponse: resData,
              providerPaymentStarted: false,
              updatedAt: nowIso,
            };

            tx.update(doc(db, 'withdrawals', withdrawalId), updateData);
            tx.update(doc(db, 'withdraw_requests', withdrawalId), { ...updateData, status: 'Rejected' });
          });

          // Ledger entry for refund
          try {
            await recordWalletTransaction({
              uid: wData.uid,
              type: 'Withdrawal Refund',
              amount: totalDeduction,
              status: 'rejected',
              description: `Refund for failed Ultra Pay withdrawal #${withdrawalId}: ${failReason}`,
              transactionId: `TXN_REFUND_${withdrawalId}`,
              botToken: activeBotToken,
            });
          } catch (e) {}

          return { success: false, error: failReason };
        } else {
          // Ambiguous
          await updateDoc(doc(db, 'withdrawals', withdrawalId), {
            status: 'PROVIDER_UNKNOWN',
            failureReason: 'Ambiguous provider response',
            providerResponse: resData,
            updatedAt: nowIso,
          }).catch(() => {});
          await updateDoc(doc(db, 'withdraw_requests', withdrawalId), {
            status: 'PROVIDER_UNKNOWN',
            failureReason: 'Ambiguous provider response',
            providerResponse: resData,
            updatedAt: nowIso,
          }).catch(() => {});

          return { success: false, error: 'Ultra Pay response was ambiguous.' };
        }
      } catch (err: any) {
        await updateDoc(doc(db, 'withdrawals', withdrawalId), {
          status: 'PROVIDER_UNKNOWN',
          failureReason: err.message,
          updatedAt: nowIso,
        }).catch(() => {});
        await updateDoc(doc(db, 'withdraw_requests', withdrawalId), {
          status: 'PROVIDER_UNKNOWN',
          failureReason: err.message,
          updatedAt: nowIso,
        }).catch(() => {});

        return { success: false, error: `Error reaching Ultra Pay: ${err.message}` };
      }
    }

    // REDEEM CODE METHOD EXECUTION
    if (normMethod === 'REDEEM_CODE') {
      const redeemCode = `RSW-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      const expiryDays = configData?.redeemExpiryDays || 30;
      const expiresAtIso = new Date(Date.now() + expiryDays * 86400000).toISOString();

      await setDoc(doc(db, 'redeemCodes', redeemCode), {
        code: redeemCode,
        withdrawalId,
        uid: wData.uid,
        telegramId,
        amount: wData.finalPayout || wData.amount,
        createdAt: nowIso,
        expiresAt: expiresAtIso,
        status: 'ACTIVE',
      });

      await runTransaction(db, async (tx) => {
        const uRef = doc(db, 'users', telegramId);
        const uSnap = await tx.get(uRef);
        if (uSnap.exists()) {
          const u = uSnap.data();
          const newBal = Math.max(0, (Number(u.walletBalance) || 0) - totalDeduction);
          const newLock = Math.max(0, (Number(u.lockedBalance) || 0) - totalDeduction);
          tx.update(uRef, { walletBalance: newBal, lockedBalance: newLock, updatedAt: nowIso });
        }

        const updateData = {
          status: 'PAID',
          paidAt: nowIso,
          approvedAt: nowIso,
          paymentDetails: { ...(wData.paymentDetails || {}), redeemCode },
          redeemCodeDetails: redeemCode,
          updatedAt: nowIso,
        };

        tx.update(doc(db, 'withdrawals', withdrawalId), updateData);
        tx.update(doc(db, 'withdraw_requests', withdrawalId), { ...updateData, status: 'Approved' });
      });

      if (activeBotToken && telegramId) {
        const msg =
          `🎟️ <b>Redeem Code Withdrawal Ready!</b>\n\n` +
          `🎁 <b>Your Redeem Code:</b> <code>${redeemCode}</code>\n` +
          `💵 <b>Value:</b> ₹${wData.finalPayout || wData.amount}\n` +
          `⏱ <b>Expires:</b> ${new Date(expiresAtIso).toLocaleDateString()}\n` +
          `🆔 <b>Withdrawal ID:</b> <code>${withdrawalId}</code>\n\n` +
          `Use this redeem code to claim your payout!`;
        await sendTelegramMessage(activeBotToken, telegramId, msg);
      }

      return { success: true, message: 'Redeem Code generated successfully.' };
    }

    // MANUAL UPI / QR APPROVAL
    await runTransaction(db, async (tx) => {
      const uRef = doc(db, 'users', telegramId);
      const uSnap = await tx.get(uRef);
      if (uSnap.exists()) {
        const u = uSnap.data();
        const newBal = Math.max(0, (Number(u.walletBalance) || 0) - totalDeduction);
        const newLock = Math.max(0, (Number(u.lockedBalance) || 0) - totalDeduction);
        tx.update(uRef, { walletBalance: newBal, lockedBalance: newLock, updatedAt: nowIso });
      }

      const updateData = {
        status: 'PAID',
        paidAt: nowIso,
        approvedAt: nowIso,
        processedBy: 'Admin',
        updatedAt: nowIso,
      };

      tx.update(doc(db, 'withdrawals', withdrawalId), updateData);
      tx.update(doc(db, 'withdraw_requests', withdrawalId), { ...updateData, status: 'Approved' });
    });

    if (activeBotToken && telegramId) {
      const msg =
        `✅ <b>Withdrawal Approved & Paid!</b>\n\n` +
        `💰 <b>Requested Amount:</b> ₹${wData.amountRequested || wData.amount}\n` +
        `🎁 <b>Payout Sent:</b> ₹${wData.finalPayout || wData.amount}\n` +
        `📌 <b>Method:</b> ${normMethod}\n` +
        `🆔 <b>Withdrawal ID:</b> <code>${withdrawalId}</code>\n\n` +
        `Thank you for using Roy Share Wallet!`;
      await sendTelegramMessage(activeBotToken, telegramId, msg);
    }

    return { success: true, message: 'Withdrawal approved successfully.' };
  } catch (err: any) {
    console.error('approveWithdrawal Error:', err);
    return { success: false, error: err.message || 'Failed to approve withdrawal.' };
  }
}

export async function rejectWithdrawal(botToken: string, withdrawalDocId: string, reason: string) {
  if (!withdrawalDocId) {
    return { success: false, error: 'Withdrawal ID required' };
  }

  const cleanReason = (reason || 'Details verification failed').trim();

  try {
    const wDocRef = doc(db, 'withdrawals', withdrawalDocId);
    let wSnap = await getDoc(wDocRef);

    if (!wSnap.exists()) {
      const activeSnap = await getDocs(query(collection(db, 'withdrawals'), where('withdrawalId', '==', withdrawalDocId)));
      if (!activeSnap.empty) {
        wSnap = activeSnap.docs[0];
      } else {
        const wrSnap = await getDoc(doc(db, 'withdraw_requests', withdrawalDocId));
        if (wrSnap.exists()) {
          wSnap = wrSnap;
        } else {
          const activeSnap2 = await getDocs(query(collection(db, 'withdraw_requests'), where('requestId', '==', withdrawalDocId)));
          if (!activeSnap2.empty) {
            wSnap = activeSnap2.docs[0];
          }
        }
      }
    }

    if (!wSnap.exists()) {
      return { success: false, error: 'Withdrawal record not found.' };
    }

    const wData = wSnap.data() as any;
    const withdrawalId = wData.withdrawalId || wData.requestId || wSnap.id;
    const currentStatus = String(wData.status || '').toUpperCase();

    if (currentStatus === 'REJECTED') {
      return { success: false, error: 'Withdrawal is already REJECTED.' };
    }
    if (currentStatus === 'PAID') {
      return { success: false, error: 'Cannot reject a completed withdrawal.' };
    }

    const configDoc = await getDoc(doc(db, 'settings', 'config'));
    const configData = configDoc.exists() ? configDoc.data() : {};
    const decryptedBotToken = decrypt(configData.botToken || '');
    const activeBotToken = botToken || decryptedBotToken;
    const nowIso = new Date().toISOString();

    const telegramId = wData.telegramId || wData.uid || '';
    const totalDeduction = Number(wData.totalDeduction) || Number(wData.amount) || 0;

    // Atomic Release of Locked Balance
    await runTransaction(db, async (tx) => {
      const uRef = doc(db, 'users', telegramId);
      const uSnap = await tx.get(uRef);
      if (uSnap.exists()) {
        const u = uSnap.data();
        const newLock = Math.max(0, (Number(u.lockedBalance) || 0) - totalDeduction);
        tx.update(uRef, { lockedBalance: newLock, updatedAt: nowIso });
      }

      const updateData = {
        status: 'REJECTED',
        rejectedBy: 'Admin',
        rejectedAt: nowIso,
        rejectionReason: cleanReason,
        rejectReason: cleanReason,
        providerPaymentStarted: false,
        updatedAt: nowIso,
      };

      tx.update(doc(db, 'withdrawals', withdrawalId), updateData);
      tx.update(doc(db, 'withdraw_requests', withdrawalId), { ...updateData, status: 'Rejected' });
    });

    // Ledger entry for refund
    try {
      await recordWalletTransaction({
        uid: wData.uid,
        type: 'Withdrawal Release',
        amount: totalDeduction,
        status: 'rejected',
        description: `Withdrawal Release #${withdrawalId}: ${cleanReason}`,
        transactionId: `TXN_REL_${withdrawalId}`,
      });
    } catch (e) {}

    // Send Telegram Notification
    if (activeBotToken && telegramId) {
      const msg =
        `❌ <b>Withdrawal Rejected</b>\n\n` +
        `💰 <b>Amount:</b> ₹${totalDeduction} has been returned to your wallet.\n\n` +
        `<b>Reason:</b> ${cleanReason}\n` +
        `<b>Withdrawal ID:</b> <code>${withdrawalId}</code>`;
      await sendTelegramMessage(activeBotToken, telegramId, msg);
    }

    return { success: true, message: 'Withdrawal rejected and refunded successfully.' };
  } catch (err: any) {
    console.error('rejectWithdrawal Error:', err);
    return { success: false, error: err.message || 'Failed to reject withdrawal.' };
  }
}
