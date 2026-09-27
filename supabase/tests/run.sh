#!/usr/bin/env bash
# Runs the database rule checks in a fresh throwaway database on a local Postgres (default: socket /tmp/pgt, port 5439).
set -euo pipefail
cd "$(dirname "$0")/.."
BASE="psql -h ${PGHOST:-/tmp/pgt} -p ${PGPORT:-5439} -U ${PGUSER:-postgres} -q -v ON_ERROR_STOP=1"
$BASE -d postgres -c "drop database if exists viewtra_test" -c "create database viewtra_test" >/dev/null
for f in tests/auth_stub.sql migrations/*.sql tests/grants.sql tests/rules_test.sql tests/referrals_test.sql tests/rates_weeks_test.sql; do
  $BASE -d viewtra_test -f "$f" 2>&1 | sed 's/^psql:[^:]*:[0-9]*: //' | grep -v '^CONTEXT\|^$' || true
done
