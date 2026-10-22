# Claim review (manual mode)

While the X API has no credits, claims run with `CLAIM_VERIFY=manual` (the default). Step 3 on the claim page queues a review instead of calling X. A reviewer checks each handle on X and approves or rejects it.

For each pending claim, check on X:
1. The handle follows @playgoldilocks.
2. It reposted and liked the claim post (`tweetId` in the list response).
3. It replied to that post with a reply that contains the claim `code` (for example `GL-3F9A2`). The code proves the handle belongs to the wallet.

Approve gives the wallet a reserved planet. The planet becomes final once an invite qualifies (`REQ_INVITES`, default 1). An invite qualifies only if the invitee's X account is at least 30 days old and has at least 10 followers, so pass `account_age_days` and `followers` when approving. Without them the invite is not credited.

## Setup (never print the key)

```bash
API=https://goldilocks-api-x4j1.onrender.com
K="$(cat /workspace/goldilocks-devnet/admin.key)"
```

## List

```bash
curl -s -H "x-admin-key: $K" "$API/api/admin/claims?status=pending"
# status: pending | approved | rejected | all
```

Response: `{mode, tweetId, claims:[{id, handle, x_user_id, wallet, code, ref, invited_by, invites, qualified_invites, status, reason, created_at, reviewed_at}]}`. `id` equals `code`.

## Approve

```bash
curl -s -X POST -H "x-admin-key: $K" -H 'content-type: application/json' \
  "$API/api/admin/claims/GL-3F9A2/approve" \
  -d '{"x_user_id":"1234567890","account_age_days":420,"followers":85}'
```

All body fields are optional. `x_user_id` makes the one-X-account-per-planet rule match on id as well as handle. Approving twice returns 409.

## Reject

```bash
curl -s -X POST -H "x-admin-key: $K" -H 'content-type: application/json' \
  "$API/api/admin/claims/GL-3F9A2/reject" -d '{"reason":"No reply with the code found"}'
```

The user sees the reason on the claim page and can fix it on X, then sign and verify again. This re-queues the same code.

## Other

- Web page: https://goldilockszone.fun/admin.html (paste the key; it is kept in the tab session only).
- Change the claim post without a redeploy:
  `curl -s -X POST -H "x-admin-key: $K" -H 'content-type: application/json' "$API/api/admin/claimcfg" -d '{"tweetId":"2113372352214159852"}'`
- Switch back to automatic X API checks once credits exist: set `CLAIM_VERIFY=auto` on Render and redeploy. Consider `REQ_FOLLOW=0`: the follower list download is the most expensive call.
- Requirement toggles: `REQ_FOLLOW`, `REQ_REPOST`, `REQ_LIKE`, `REQ_REPLY` (1 or 0), `REQ_INVITES` (number), `INVITE_MIN_AGE_DAYS`, `INVITE_MIN_FOLLOWERS`, `RESERVE_HOLD_MS`, `RESERVE_HOLDS`.
