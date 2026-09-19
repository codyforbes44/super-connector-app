-- Operator-run configuration update, not a schema migration.
-- Run only in the SixVox project after provisioning the dedicated Vault secret
-- and deploying the matching DIGEST_CRON_SECRET server environment variable.
-- Does not invoke the endpoint or change the job schedule/active state.
BEGIN;
DO $update_digest_auth$
DECLARE
  digest_job_id bigint;
  secret_count integer;
  valid_secret boolean;
BEGIN
  SELECT jobid INTO STRICT digest_job_id
  FROM cron.job WHERE jobname = 'sixvox-daily-digest';

  SELECT count(*), bool_and(decrypted_secret ~ '^[A-Za-z0-9_-]{43,128}$')
    INTO secret_count, valid_secret
  FROM vault.decrypted_secrets WHERE name = 'sixvox_digest_cron_secret';
  IF secret_count <> 1 OR valid_secret IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Provision exactly one valid sixvox_digest_cron_secret in Vault first';
  END IF;

  PERFORM cron.alter_job(
    job_id := digest_job_id,
    command := $command$
      SELECT net.http_post(
        url := 'https://sixvox.3bi.io/api/public/digest/run',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (
            SELECT decrypted_secret FROM vault.decrypted_secrets
            WHERE name = 'sixvox_digest_cron_secret'
          )
        ),
        body := '{"source":"cron"}'::jsonb
      ) AS request_id;
    $command$
  );
END;
$update_digest_auth$;
COMMIT;
