#!/usr/bin/env bash
set -euo pipefail

# Run from the script&#39;s directory
cd "$(dirname "$0")"

# Run the Node script with the required plan
exec /usr/bin/node /home/cc/plan-changer/dist/index.js --plan "Hyperfast"
