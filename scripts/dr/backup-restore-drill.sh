#!/usr/bin/env bash
# Sprint 16 — quarterly backup + restore drill.
#
# Performs a point-in-time recovery (PITR) into a clean Postgres
# cluster, runs the fixed validation query set under
# scripts/dr/drill-queries.sql, asserts RTO < 1h and RPO < 5 min,
# and writes a structured drill report to scripts/dr/results/.
#
# Usage:
#   scripts/dr/backup-restore-drill.sh \
#     --target {staging-shadow|smoke-test} \
#     [--dry-run] \
#     [--restore-bin pg_basebackup|pgbackrest]
#
# Environment:
#   DR_PG_SOURCE_HOST       PITR source cluster host (omit in --dry-run)
#   DR_PG_SOURCE_PORT       default 5432
#   DR_PG_SOURCE_DB         default postgres
#   DR_PG_TARGET_HOST       restore target host (omit in --dry-run)
#   DR_PG_TARGET_PORT       default 5432
#   DR_PG_TARGET_DB         default aivo_drill
#   DR_PG_TARGET_USER       default postgres
#   PGPASSWORD              standard libpq password env
#
# Exit codes:
#   0  drill PASS (within RTO + RPO)
#   1  drill FAIL (RTO exceeded, RPO exceeded, validation failed, etc.)
#   2  invalid arguments / environment
#
# This script is rehearsed in CI via --dry-run mode where it
# generates a synthetic report without touching any cluster.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
QUERY_FILE="${SCRIPT_DIR}/drill-queries.sql"
RESULTS_DIR="${SCRIPT_DIR}/results"
mkdir -p "${RESULTS_DIR}"

TARGET=""
DRY_RUN=0
RESTORE_BIN="pgbackrest"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target) TARGET="$2"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    --restore-bin) RESTORE_BIN="$2"; shift 2 ;;
    -h|--help)
      grep -E '^# ' "$0" | sed 's/^# //'
      exit 0
      ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

if [[ -z "${TARGET}" ]]; then
  echo "ERROR: --target is required (staging-shadow|smoke-test)" >&2
  exit 2
fi

case "${TARGET}" in
  staging-shadow|smoke-test) ;;
  *) echo "ERROR: --target must be staging-shadow or smoke-test" >&2; exit 2 ;;
esac

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
REPORT="${RESULTS_DIR}/${TIMESTAMP}.json"

RTO_LIMIT_SECONDS=$((60 * 60))      # 1 hour
RPO_LIMIT_SECONDS=$((5 * 60))       # 5 minutes

# Track everything we want to surface in the report.
declare -A METRICS
METRICS[target]="${TARGET}"
METRICS[dry_run]="${DRY_RUN}"
METRICS[restore_bin]="${RESTORE_BIN}"
METRICS[timestamp]="${TIMESTAMP}"
METRICS[rto_limit_seconds]="${RTO_LIMIT_SECONDS}"
METRICS[rpo_limit_seconds]="${RPO_LIMIT_SECONDS}"

# 1. Restore.
START_RESTORE_EPOCH=$(date -u +%s)
if [[ ${DRY_RUN} -eq 1 ]]; then
  echo "[dry-run] would restore via ${RESTORE_BIN} from ${DR_PG_SOURCE_HOST:-<unset>} to ${DR_PG_TARGET_HOST:-<unset>}"
  # Simulate a 5-minute restore.
  SIMULATED_RESTORE_SECONDS=$((5 * 60))
  END_RESTORE_EPOCH=$(( START_RESTORE_EPOCH + SIMULATED_RESTORE_SECONDS ))
else
  : "${DR_PG_SOURCE_HOST:?DR_PG_SOURCE_HOST must be set unless --dry-run}"
  : "${DR_PG_TARGET_HOST:?DR_PG_TARGET_HOST must be set unless --dry-run}"
  case "${RESTORE_BIN}" in
    pgbackrest)
      pgbackrest --stanza=aivo --type=time \
        --target="$(date -u -d '5 minutes ago' '+%Y-%m-%d %H:%M:%S')" \
        --target-action=promote \
        restore
      ;;
    pg_basebackup)
      pg_basebackup \
        -h "${DR_PG_SOURCE_HOST}" -p "${DR_PG_SOURCE_PORT:-5432}" \
        -D "/var/lib/postgresql/drill-${TIMESTAMP}" \
        -X stream -P
      ;;
    *)
      echo "ERROR: unknown --restore-bin ${RESTORE_BIN}" >&2
      exit 2
      ;;
  esac
  END_RESTORE_EPOCH=$(date -u +%s)
fi
RTO_SECONDS=$(( END_RESTORE_EPOCH - START_RESTORE_EPOCH ))
METRICS[rto_seconds]="${RTO_SECONDS}"

# 2. Run validation query set.
declare -a QUERY_RESULTS=()
if [[ ${DRY_RUN} -eq 1 ]]; then
  # Synthetic results — every check passes.
  QUERY_RESULTS+=(
    'users_count=12'
    'tenants_count=3'
    'learners_count=42'
    'audit_events_count=1024'
    'audit_events_with_prev_hash=1023'
    'orphan_learners=0'
    'orphan_sessions=0'
    'audit_lag_seconds=120'
    'iep_documents_count=8'
    'consents_count=42'
  )
else
  TARGET_HOST="${DR_PG_TARGET_HOST}"
  TARGET_PORT="${DR_PG_TARGET_PORT:-5432}"
  TARGET_DB="${DR_PG_TARGET_DB:-aivo_drill}"
  TARGET_USER="${DR_PG_TARGET_USER:-postgres}"
  while IFS= read -r line; do
    [[ -z "${line}" ]] && continue
    QUERY_RESULTS+=("${line}")
  done < <(
    psql -h "${TARGET_HOST}" -p "${TARGET_PORT}" -U "${TARGET_USER}" -d "${TARGET_DB}" \
         -At -F'=' -f "${QUERY_FILE}" \
      | awk 'NF { print }'
  )
fi

# 3. Evaluate RPO (audit_lag_seconds) and integrity checks.
get_metric() {
  local key="$1"
  local default="${2:-0}"
  for row in "${QUERY_RESULTS[@]}"; do
    if [[ "${row}" == "${key}="* ]]; then
      echo "${row#${key}=}"
      return
    fi
    # psql -A returns just the value; we tagged via column alias above.
  done
  echo "${default}"
}

# Driver enforces: audit_lag_seconds <= RPO; orphans == 0;
# audit_events_with_prev_hash == audit_events_count - 1.
AUDIT_LAG="$(get_metric audit_lag_seconds 99999)"
ORPHAN_LEARNERS="$(get_metric orphan_learners 0)"
ORPHAN_SESSIONS="$(get_metric orphan_sessions 0)"
AUDIT_COUNT="$(get_metric audit_events_count 0)"
AUDIT_WITH_PREV="$(get_metric audit_events_with_prev_hash 0)"

METRICS[audit_lag_seconds]="${AUDIT_LAG}"
METRICS[orphan_learners]="${ORPHAN_LEARNERS}"
METRICS[orphan_sessions]="${ORPHAN_SESSIONS}"
METRICS[audit_events_count]="${AUDIT_COUNT}"
METRICS[audit_events_with_prev_hash]="${AUDIT_WITH_PREV}"

FAILURES=()

if [[ "${RTO_SECONDS}" -gt "${RTO_LIMIT_SECONDS}" ]]; then
  FAILURES+=("RTO exceeded: ${RTO_SECONDS}s > ${RTO_LIMIT_SECONDS}s")
fi
if [[ "${AUDIT_LAG}" -gt "${RPO_LIMIT_SECONDS}" ]]; then
  FAILURES+=("RPO exceeded: audit_lag=${AUDIT_LAG}s > ${RPO_LIMIT_SECONDS}s")
fi
if [[ "${ORPHAN_LEARNERS}" -ne 0 ]]; then
  FAILURES+=("Orphan learners (FK integrity): ${ORPHAN_LEARNERS}")
fi
if [[ "${ORPHAN_SESSIONS}" -ne 0 ]]; then
  FAILURES+=("Orphan sessions (FK integrity): ${ORPHAN_SESSIONS}")
fi
EXPECTED_PREV=$(( AUDIT_COUNT > 0 ? AUDIT_COUNT - 1 : 0 ))
if [[ "${AUDIT_WITH_PREV}" -ne "${EXPECTED_PREV}" ]]; then
  FAILURES+=("Audit chain broken: ${AUDIT_WITH_PREV} prev_hash rows vs expected ${EXPECTED_PREV}")
fi

if [[ ${#FAILURES[@]} -eq 0 ]]; then
  STATUS="PASS"
else
  STATUS="FAIL"
fi
METRICS[status]="${STATUS}"

# 4. Emit JSON report.
{
  echo "{"
  echo "  \"timestamp\": \"${METRICS[timestamp]}\","
  echo "  \"target\": \"${METRICS[target]}\","
  echo "  \"dry_run\": ${METRICS[dry_run]},"
  echo "  \"restore_bin\": \"${METRICS[restore_bin]}\","
  echo "  \"rto_seconds\": ${METRICS[rto_seconds]},"
  echo "  \"rto_limit_seconds\": ${METRICS[rto_limit_seconds]},"
  echo "  \"rpo_observed_seconds\": ${METRICS[audit_lag_seconds]},"
  echo "  \"rpo_limit_seconds\": ${METRICS[rpo_limit_seconds]},"
  echo "  \"audit_events_count\": ${METRICS[audit_events_count]},"
  echo "  \"audit_events_with_prev_hash\": ${METRICS[audit_events_with_prev_hash]},"
  echo "  \"orphan_learners\": ${METRICS[orphan_learners]},"
  echo "  \"orphan_sessions\": ${METRICS[orphan_sessions]},"
  echo "  \"status\": \"${METRICS[status]}\","
  echo "  \"failures\": ["
  for i in "${!FAILURES[@]}"; do
    sep=","; [[ $i -eq $(( ${#FAILURES[@]} - 1 )) ]] && sep=""
    echo "    \"${FAILURES[$i]}\"${sep}"
  done
  echo "  ]"
  echo "}"
} > "${REPORT}"

echo "Drill report written: ${REPORT}"
echo "Status: ${STATUS}  RTO=${RTO_SECONDS}s  RPO=${AUDIT_LAG}s"

if [[ "${STATUS}" != "PASS" ]]; then
  for f in "${FAILURES[@]}"; do echo "  - ${f}"; done
  exit 1
fi
exit 0
