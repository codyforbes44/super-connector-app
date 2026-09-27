-- Carrier webhooks can fail before a number can be attributed to a workspace.
-- Keep those system-level diagnostics visible only to the platform super admin;
-- workspace members continue to see only their own attributed rows.
ALTER TABLE public.webhook_errors ALTER COLUMN workspace_id DROP NOT NULL;