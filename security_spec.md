# Security & Verification Specification

## Module Security Rules & System Invariants

### 1. Wallet & Ledger Transactions
* **Atomic Balances:** Wallet updates MUST use atomic increment (`FieldValue.increment`) or transaction batch operations to prevent race conditions.
* **Immutability:** Once created, entries in `/transactions` cannot be updated or deleted.
* **Non-Negative Balance:** Balance cannot drop below 0. Debit transactions verify current balance >= debit amount.

### 2. Withdrawals & Payout Systems
* **Anti-Double-Spend:** Payout requests atomically deduct balance upfront. Rejecting a withdrawal refunds the amount atomically.
* **Input Validation:** Amounts must be positive numbers between system configured min/max limits.
* **Verification:** Admin operations require valid session token (`requireAdminSession`).

### 3. Live Redeem & Anti-Cheat Engine
* **Concurrent Queue:** Request queuing (`SmartServerQueue`) guarantees order and prevents race conditions during high-concurrency drops.
* **Device Fingerprinting:** Block multiple accounts attempting to claim from the same device hash.
* **Paste & Spam Guard:** Typing speed detection blocks automated script paste (<0.05s).
* **Golden & Pool Code Limits:** Exact claim counter decrementing preventing over-claiming.

### 4. Referral System & Anti Self-Referral
* **Token Verification:** Referral links require cryptographic verification tokens.
* **Self-Referral Block:** Device fingerprint matching and IP risk checks prevent self-referrals.

### 5. Admin Panel & Role-Based Access Control (RBAC)
* **Session Guard:** Secret header token validation (`requireAdminSession`) on sensitive management APIs.
* **Credential Encryption:** Sensitive credentials (bot tokens, mobile numbers, chat IDs) stored encrypted in Firestore.
* **Audit Trail:** Every administrative action logged to `/auditLogs` and `/adminLogs`.
