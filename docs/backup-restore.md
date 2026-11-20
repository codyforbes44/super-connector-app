# Backup and restore drill

Last run: 2026-11-20. Result: passed.

## What was checked
Key tables were copied, restored into scratch tables with the same structure, and compared by row count plus a fingerprint of every row ID:

| Table | Live rows | Restored rows | IDs match |
|---|---|---|---|
| calls | 567 | 567 | yes |
| messages | 215 | 215 | yes |
| conversations | 58 | 58 | yes |
| contacts | 0 | 0 | (empty) |
| phone_numbers | 6 | 6 | yes |
| workspaces | 2 | 2 | yes |
| workspace_members | 4 | 4 | yes |
| subscriptions | 7 | 7 | yes |

## Steps
1. Fingerprint each table: `count(*)` plus `md5(string_agg(id::text, ',' order by id))`.
2. Copy each table: `create temp table bk_<t> as select * from public.<t>`.
3. Restore into a scratch table with the same structure: `create temp table rs_<t> (like public.<t> including all); insert into rs_<t> select * from bk_<t>`.
4. Fingerprint the restored tables the same way and compare them.
5. For a real recovery, restore from the platform's daily backup (or a `private_backups` snapshot made before data repairs). Then run steps 1 and 4 to confirm the counts.

The session tables disappear when the check ends, so the drill never touches live data.
