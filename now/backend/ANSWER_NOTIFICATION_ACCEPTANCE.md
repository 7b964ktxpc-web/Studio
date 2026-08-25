# Answer + notification consistency acceptance

1. **First answer does not close the request**
   - Request is `SEARCHING`.
   - User A answers.
   - Expected: one `answers` row, one `REQUEST_ANSWERED` event for requester, request remains `SEARCHING`.

2. **Second user can answer**
   - Same request remains `SEARCHING`.
   - User B answers.
   - Expected: second answer is accepted and a single deduplicated requester event remains.

3. **Same user cannot answer twice**
   - User A submits another answer for the same request.
   - Expected: `23505` / `Already answered`.

4. **Requester cannot answer own request**
   - Expected: authorization error.

5. **Expired request rejects answers**
   - Expected: `Request expired`.

6. **Requester can explicitly finalize**
   - Authenticated owner calls `finalize_request` while `SEARCHING`.
   - Expected: status becomes `ANSWERED`.

7. **Notification delivery is idempotent**
   - Repeating the answer flow does not create duplicate `(user_id, request_id, kind)` events.

8. **Realtime remains a hint**
   - `answer.created` may refresh UI, but authoritative state is read from the database.
