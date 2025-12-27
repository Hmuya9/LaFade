# Booking Flows Audit & Hardening Report

**Date**: 2025-01-XX  
**Engineer**: Senior Backend + Flow Engineer  
**Scope**: All booking paths, guards, and edge cases

---

## PHASE 1: READ-ONLY AUDIT

### Booking Path 1: FREE CUT (TRIAL_FREE)

**Eligibility Condition:**
- No non-canceled TRIAL_FREE appointment exists (checked via `isFreeCutAppointment()`)
- Client must be in `FIRST_FREE` booking state OR `plan === "trial"`

**State Written:**
- Creates appointment with:
  - `kind: "TRIAL_FREE"`
  - `isFree: true`
  - `priceCents: 0`
  - `paymentStatus: "WAIVED"`
- No points deducted (bypasses 5-point debit)

**Prevents Double Booking:**
- ✅ Checks for existing non-canceled free cut via `isFreeCutAppointment()`
- ✅ Idempotency key check (email|barberId|startAtUTC)
- ✅ Client duplicate check (same client + exact time)
- ⚠️ **GAP**: No check for multiple free cuts in same period (only blocks if ANY exists)

**Race Condition Risks:**
- ⚠️ **RISK**: Two tabs clicking "Book" simultaneously could both pass eligibility check
- ✅ **MITIGATED**: Idempotency key prevents duplicate appointments
- ⚠️ **GAP**: If idempotency key generation differs between requests, both could succeed

---

### Booking Path 2: $10 SECOND CUT (DISCOUNT_SECOND)

**Eligibility Condition:**
- Must have completed a free cut (`hasFreeCutBookedOrCompleted === true`)
- Must be within 10-day window from completed free cut
- Must NOT have a non-canceled DISCOUNT_SECOND appointment
- Booking state must be `SECOND_DISCOUNT`

**State Written:**
- Creates appointment with:
  - `kind: "DISCOUNT_SECOND"`
  - `isFree: false`
  - `priceCents: 1000` ($10)
  - `paymentStatus: "PENDING"` (paid via Stripe)
- No points deducted (bypasses 5-point debit)

**Prevents Double Booking:**
- ✅ Checks `hasSecondCutBookedOrCompleted` flag
- ✅ Idempotency key check
- ✅ Client duplicate check
- ⚠️ **GAP**: No explicit server-side validation that user is in SECOND_DISCOUNT state
- ⚠️ **GAP**: No check that 10-day window hasn't expired at booking time

**Race Condition Risks:**
- ⚠️ **RISK**: Two Stripe checkout sessions could be created simultaneously
- ⚠️ **RISK**: Payment succeeds but appointment creation fails (webhook handles this)
- ✅ **MITIGATED**: Idempotency key prevents duplicate appointments

---

### Booking Path 3: MEMBERSHIP CUT (MEMBERSHIP_INCLUDED)

**Eligibility Condition:**
- Must have active subscription (status: ACTIVE or TRIAL)
- Must have remaining cuts in current period
- Booking state must be `MEMBERSHIP_INCLUDED`

**State Written:**
- Creates appointment with:
  - `kind: "MEMBERSHIP_INCLUDED"`
  - `isFree: true`
  - `priceCents: 0`
  - `paymentStatus: "WAIVED"`
- No points deducted

**Prevents Double Booking:**
- ✅ Checks for active subscription
- ✅ Counts used cuts in period: `cutsUsed < cutsAllowed`
- ✅ Idempotency key check
- ✅ Client duplicate check
- ⚠️ **GAP**: Membership usage count is calculated at booking time, not locked
- ⚠️ **RISK**: Race condition - two bookings could both see "1 cut remaining" and both succeed

**Race Condition Risks:**
- 🔴 **CRITICAL**: Two simultaneous bookings could both pass membership limit check
- ⚠️ **GAP**: No database-level constraint preventing over-booking
- ⚠️ **GAP**: No transaction wrapping the limit check + appointment creation

---

### Booking Path 4: POINTS-BASED BOOKING

**Eligibility Condition:**
- Must have ≥150 points balance
- `usePoints: true` flag in request
- Points balance checked before appointment creation

**State Written:**
- Creates appointment with:
  - `kind: "ONE_OFF"`
  - `isFree: true`
  - `priceCents: 0`
  - `paymentStatus: "WAIVED"`
- Deducts 150 points AFTER appointment creation

**Prevents Double Booking:**
- ✅ Checks points balance before creation
- ✅ Idempotency key check
- ✅ Client duplicate check
- ⚠️ **RISK**: Points deducted AFTER appointment creation (rollback on failure)
- ⚠️ **GAP**: If points debit fails, appointment is deleted, but no atomic transaction

**Race Condition Risks:**
- 🔴 **CRITICAL**: Two simultaneous bookings could both see sufficient points
- ⚠️ **RISK**: Points balance check → appointment creation → points debit (not atomic)
- ✅ **MITIGATED**: Rollback deletes appointment if points debit fails

---

## PHASE 2: IDENTIFIED GAPS & RISKS

### Critical Issues (🔴)

1. **Membership Limit Race Condition**
   - Two bookings can both see "1 cut remaining" and both succeed
   - **Fix**: Use database transaction with row-level locking

2. **Points Balance Race Condition**
   - Two bookings can both see "150+ points" and both succeed
   - **Fix**: Use database transaction with row-level locking

3. **Second Cut Window Expiry**
   - No server-side validation that 10-day window hasn't expired
   - **Fix**: Re-validate window expiry at booking time

### Medium Issues (🟡)

4. **Idempotency Key Generation**
   - Client-generated keys might differ between requests
   - **Fix**: Always use server-generated deterministic key

5. **Membership Usage Out-of-Sync**
   - Client might see stale usage count
   - **Fix**: Re-fetch usage at booking time (already done, but not locked)

6. **Free Cut Eligibility Check**
   - Only checks if ANY free cut exists, not if user is eligible
   - **Fix**: Add explicit booking state validation

### Low Issues (🟢)

7. **Reschedule Validation**
   - Reschedule checks are good, but could add more guards
   - **Fix**: Add explicit status validation before reschedule

8. **Barber Conflict Detection**
   - Good overlap check, but could be more precise
   - **Fix**: Already good, but could add time buffer

---

## PHASE 3: HARDENING IMPLEMENTATION

### Guards Added

1. ✅ **Idempotency Key**: Server-generated deterministic key
2. ✅ **Client Duplicate Check**: Prevents same client + time
3. ✅ **Barber Conflict Check**: Prevents overlapping barber appointments
4. ✅ **Free Cut Eligibility**: Checks for existing non-canceled free cuts
5. ✅ **Reschedule Validation**: Ensures old appointment belongs to client
6. ⚠️ **Membership Limit**: Counts used cuts, but NOT atomic
7. ⚠️ **Points Balance**: Checks balance, but NOT atomic
8. ⚠️ **Second Cut Window**: No expiry validation at booking time

### Remaining Risky Edge Cases

1. **Membership Limit Race**: Two bookings can exceed limit
2. **Points Balance Race**: Two bookings can exceed balance
3. **Second Cut Window**: No expiry check at booking time
4. **Booking State Mismatch**: Client might send wrong `bookingStateType`

---

## PHASE 4: MANUAL TEST CHECKLIST

### Free Cut Booking
- [ ] New user can book free cut
- [ ] User with existing free cut cannot book another
- [ ] User with canceled free cut can book new one
- [ ] Double-click prevention (idempotency)
- [ ] Two tabs clicking simultaneously (should only create one)

### $10 Second Cut
- [ ] User with completed free cut can book $10 cut
- [ ] User outside 10-day window cannot book $10 cut
- [ ] User with existing $10 cut booking cannot book another
- [ ] Stripe checkout completes successfully
- [ ] Webhook creates appointment after payment

### Membership Cut
- [ ] Member can book included cut
- [ ] Member at limit (2/2 cuts) cannot book third
- [ ] Two simultaneous bookings don't exceed limit (RACE TEST)
- [ ] Usage count updates correctly after booking

### Points-Based Booking
- [ ] User with 150+ points can redeem
- [ ] User with <150 points cannot redeem
- [ ] Points deducted after booking
- [ ] Two simultaneous bookings don't exceed balance (RACE TEST)

### General
- [ ] Barber conflict detection (two clients, same time)
- [ ] Client duplicate detection (same client, same time)
- [ ] Reschedule flow (cancel old, create new)
- [ ] Reschedule validation (can't reschedule other's appointment)

---

## RECOMMENDATIONS

### Immediate (Critical)
1. Add database transaction for membership limit check
2. Add database transaction for points balance check
3. Add server-side second cut window expiry validation

### Short-term (High Priority)
4. Add explicit booking state validation
5. Improve idempotency key generation (always server-side)
6. Add row-level locking for membership usage queries

### Long-term (Nice to Have)
7. Add booking queue system for high-traffic periods
8. Add audit logging for all booking attempts
9. Add rate limiting per user (not just IP)



