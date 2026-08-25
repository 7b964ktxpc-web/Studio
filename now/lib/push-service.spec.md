# Web Push service acceptance cases

1. Permission is unsupported
   - Expected state: `UNSUPPORTED`
   - No backend subscription is saved.

2. Permission is denied
   - Expected state: `BLOCKED`
   - No backend subscription is saved.

3. Permission is granted
   - Browser subscription is created/reused.
   - Backend `saveSubscription` is called exactly once.
   - Expected state: `ENABLED`.

4. Backend save fails
   - Expected state: `OFF`.
   - Error callback is invoked.
   - A partial client-side success must not be reported.

5. Disable with an active subscription
   - Backend removes the exact endpoint first.
   - Browser subscription is unsubscribed.
   - Expected state: `OFF`.

6. Disable without an active subscription
   - Expected state: `OFF`.
   - No exception is thrown.

7. Subscription endpoint changes
   - New endpoint is stored as a separate current subscription.
   - Old endpoint can be removed explicitly.

8. Nearby matching
   - Push subscription availability never changes proximity rules.
   - Users outside 250 m must never receive an automatic nearby push.
