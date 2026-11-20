# PontoPlus Security Specification

## 1. Data Invariants
1. **Strict Ownership Isolation**: Every document in `/users/{userId}` and its subcollections (`holders`, `accounts`, `transactions`, `flightAlerts`, `sales`) is strictly private to `request.auth.uid == userId` with `request.auth.token.email_verified == true`.
2. **Identity Integrity**: Every document's `uid` or `ownerId` must strictly equal `request.auth.uid` on create and remain immutable on update.
3. **Referential Existence**: Creating a `LoyaltyAccount` requires the referenced `holderId` to exist under `/users/{userId}/holders/{holderId}`. Creating a `PointTransaction` or `SaleQuote` requires the referenced `accountId` to exist under `/users/{userId}/accounts/{accountId}`.
4. **Numeric & String Boundaries**: Balances, expiring points, CPM, miles amounts, and CPF counts are strictly bounded (`>= 0` and reasonable upper limits). All strings have explicit `.size()` bounds and IDs match `^[a-zA-Z0-9_\\-]+$`.
5. **Temporal Integrity**: `createdAt` and `updatedAt` must equal `request.time`. `createdAt` is immutable on update.
6. **Terminal State Locking**: Once a `SaleQuote` reaches `paga` or `cancelada`, no further client updates are allowed.

## 2. Dirty Dozen Attack Payloads (Expected: PERMISSION_DENIED)
1. **Cross-Tenant Read**: User B attempts `get(/users/{userA}/accounts/acc1)`.
2. **Unverified Email Write**: User A with `email_verified: false` attempts to create a `LoyaltyAccount`.
3. **OwnerId Spoofing**: User A creates a `LoyaltyAccount` under `/users/{userA}/accounts/acc1` with `ownerId: "userB"`.
4. **Shadow Ghost Field**: User A creates a `UserProfile` with an unallowed extra key `isAdmin: true`.
5. **Path ID Poisoning**: User A attempts to create `/users/{userA}/accounts/invalid$id!@#` or a 300-char document ID.
6. **Negative Balance Injection**: User A updates a `LoyaltyAccount` setting `balance: -50000`.
7. **Orphaned Account**: User A creates a `LoyaltyAccount` with a non-existent `holderId: "ghost_holder"`.
8. **Orphaned Transaction**: User A creates a `PointTransaction` with a non-existent `accountId: "ghost_acc"`.
9. **Immutable Timestamp Tampering**: User A updates a `LoyaltyAccount` modifying `createdAt`.
10. **Client-Forged Timestamp**: User A creates a `FlightAlert` with `createdAt` set to a past client timestamp instead of `request.time`.
11. **Terminal Sale Modification**: User A attempts to update a `SaleQuote` whose existing `status == "paga"` back to `"em_analise"`.
12. **Blanket List Scraping**: User B attempts `list` on `/users/{userA}/transactions`.
