# Matching test cases

These are acceptance cases for the nearby push-matching engine.

| Case | Expected |
|---|---|
| User is 30m from request location, opted in, fresh presence | Eligible for stage 1 |
| User is 49m away | Eligible for stage 1 |
| User is 50m away | Eligible for stage 1 |
| User is 75m away and stage 1 has insufficient recipients | Eligible for stage 2 |
| User is 120m away and earlier stages are insufficient | Eligible for stage 3 |
| User is 220m away and earlier stages are insufficient | Eligible for stage 4 |
| User is 250m away | Eligible for final stage |
| User is 251m away | Never eligible for automatic push |
| User is 700m away | Never eligible for automatic push |
| User presence is older than 5 minutes | Not eligible |
| User has `available=false` | Not eligible |
| User is the requester | Not eligible |
| User accuracy is worse than 50m | Not eligible |
| 10 eligible users exist | At most 8 receive the request in MVP |
| 2 users exist at 30m, 5 at 80m | Use the 30m users first, then expand only as needed |
| 8 users exist at <=50m | Do not send to anyone farther away |
| Push is triggered for a map-only event | Never; map visibility does not imply notification |

Privacy acceptance:

- Exact recipient coordinates are never returned to the requester.
- Matching is performed using the request/place coordinates.
- Push payloads contain no exact coordinates of other users.
