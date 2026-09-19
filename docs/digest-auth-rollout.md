# Digest scheduler authentication rollout

This patch replaces public Supabase-key authentication on POST
`/api/public/digest/run` with a dedicated `Authorization: Bearer` credential.
There is no fallback to an anon/publishable key. Missing configuration fails closed.

The existing hourly job is `sixvox-daily-digest` in SixVox's Supabase project
`wexrmtvalqtnczuliouh`. Its checked-in schedule is `5 * * * *`; inspect the live
job before rollout because its schedule or active state may have changed.

## Coordinated deployment

1. Confirm the correct SixVox project, hosting workspace, and existing job. Record
   its schedule and active state without exporting credentials or full job commands.
2. Provision a new random 32-byte hex or base64url secret in the server's secret
   settings as `DIGEST_CRON_SECRET`, and the same value in Supabase Vault as
   `sixvox_digest_cron_secret`. Never use a Supabase key, VITE-prefixed variable,
   URL query string, or a committed file for this credential.
3. Temporarily pause only the existing digest job during the coordinated change.
   Leave an already-paused job paused. Do not create an additional scheduler.
4. Deploy the route and server secret together. Old public-key-only requests must
   return 401. The code also rejects malformed/short configured secrets.
5. Run `ops/update-digest-cron-auth.sql` in the correct project's SQL editor. It
   replaces only the named job's command, preserving schedule and active state.
   It fails if the existing job or dedicated Vault secret is missing/ambiguous.
   This script does not trigger any email processing itself.
6. Restore the original active state only after verification. Observe the next
   scheduled result. Do not manually trigger digests as a harmless health check:
   an authenticated request can send customer email.

If deployment cannot be completed, keep the affected job paused until a matching
route/credential configuration is restored. Do not restore public-key authentication
as an automatic fallback. Secret rotation requires coordinating both secret stores.

## Verification and limits

- Run `npx vitest run --config vitest.config.ts src/lib/digest-auth.test.ts`.
  Provider work is mocked; these tests send no email or database requests.
- Check unauthorized requests against staging return 401 and do not invoke the worker.
- The operator SQL needs execution/validation in an authorized project or a local
  stack before production use. It was prepared, not applied, by this change.
- This patch fixes scheduler authentication. It does not add a distributed lock or
  exactly-once email delivery; digest concurrency/idempotency is a separate follow-up.

References: [Supabase scheduling](https://supabase.com/docs/guides/functions/schedule-functions),
[Supabase Cron](https://supabase.com/docs/guides/cron), and
[Supabase Vault](https://supabase.com/docs/guides/database/vault).
