#!/usr/bin/env sh
set -e

# Optional: set timezone if TZ is provided (e.g., TZ=America/Los_Angeles)
if [ -n "${TZ:-}" ] && [ -f "/usr/share/zoneinfo/$TZ" ]; then
  ln -sf "/usr/share/zoneinfo/$TZ" /etc/localtime
  echo "$TZ" > /etc/timezone
fi

# Ensure cron log exists
touch /var/log/cron.log

# Run cron in the foreground with log level 2
exec crond -f -l 2
