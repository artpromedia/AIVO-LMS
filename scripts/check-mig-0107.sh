#!/usr/bin/env bash
# Verify migration 0107 (users.timezone) reached prod.
set -euo pipefail
ssh -o StrictHostKeyChecking=accept-new root@10.0.0.1 \
  "sudo -u postgres psql -d aivo -At -c \"SELECT 'users_timezone_cols=' || count(*) FROM information_schema.columns WHERE table_name='users' AND column_name='timezone';\""
