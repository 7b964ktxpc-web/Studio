# Matching invariants — manual test cases

These cases define the behaviour required before connecting push notifications.

1. **Far-away user is excluded**
   - Request place: point A.
   - User: 700 m from point A.
   - Expected: no match, no push.

2. **Nearby user is eligible**
   - User: 30 m from point A.
   - Fresh presence and `available=true`.
   - Expected: eligible at stage 0 (0–50 m).

3. **Stage expansion is sequential**
   - One candidate at 120 m, none at 0–100 m.
   - Expected: candidate is considered only after 50 m and 100 m stages are exhausted.

4. **250 m is a hard ceiling**
   - User: 251 m from point A.
   - Expected: excluded permanently from automatic matching.

5. **Stale presence is excluded**
   - `updatedAt` older than 5 minutes.
   - Expected: excluded even if physically close.

6. **Poor location accuracy is excluded**
   - `accuracyM > 50`.
   - Expected: excluded from push matching to avoid false proximity.

7. **Requester never receives their own request**
   - Same `userId` as request author.
   - Expected: excluded.

8. **Push distance is measured to the request place**
   - Requester is 700 m from the place.
   - Another user is 30 m from the place.
   - Expected: the nearby user may receive the request; the requester’s distance is irrelevant.

9. **No location leak**
   - Client response contains status/freshness/distance band only.
   - Expected: exact responder coordinates are never returned.
