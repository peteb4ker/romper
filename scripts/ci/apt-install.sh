#!/usr/bin/env bash
# Install apt packages on a CI runner without letting a stalled mirror eat the
# job's time limit (#926). Runs `apt-get update`, then `apt-get install -y`
# with the given arguments, each attempt under its own time limit, retrying a
# few times with a short backoff.
#
# Usage: scripts/ci/apt-install.sh [apt-get install options] <package>...
#
# Environment (all optional; the workflows use the defaults):
#   APT_ATTEMPTS         attempts per command (default 3)
#   APT_ATTEMPT_TIMEOUT  seconds before an attempt is killed (default 90)
#   APT_BACKOFF          seconds to wait between attempts (default 5)
#   APT_GET              the apt-get command, for testing (default "sudo apt-get")
set -euo pipefail

attempts=${APT_ATTEMPTS:-3}
attempt_timeout=${APT_ATTEMPT_TIMEOUT:-90}
backoff=${APT_BACKOFF:-5}
read -r -a apt_get <<<"${APT_GET:-sudo apt-get}"

# Acquire::Retries retries a failed download; Acquire::*::Timeout gives up on a
# connection that stops sending data (apt.conf(5)).
apt_opts=(-o Acquire::Retries=3 -o Acquire::http::Timeout=30 -o Acquire::https::Timeout=30)

# retry <command...>: run it up to $attempts times, each under `timeout`.
retry() {
  local attempt status=0
  for ((attempt = 1; attempt <= attempts; attempt++)); do
    status=0
    timeout --kill-after=10 "$attempt_timeout" "$@" || status=$?
    if [ "$status" -eq 0 ]; then
      return 0
    fi
    echo "::warning::attempt $attempt of $attempts failed (exit $status): $*"
    if [ "$attempt" -lt "$attempts" ]; then
      sleep "$backoff"
    fi
  done
  return "$status"
}

retry "${apt_get[@]}" "${apt_opts[@]}" update
retry "${apt_get[@]}" "${apt_opts[@]}" install -y "$@"
