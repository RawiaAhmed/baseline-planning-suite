#!/bin/sh
# Runs when the shell container starts: remote URLs come from the environment,
# never from the bundle. Change them and restart; no rebuild needed.
set -eu
cat > /usr/share/nginx/html/config.json <<JSON
{
  "remotes": {
    "people": "${PEOPLE_REMOTE_URL}",
    "delivery": "${DELIVERY_REMOTE_URL}"
  }
}
JSON
echo "config.json written: people=${PEOPLE_REMOTE_URL} delivery=${DELIVERY_REMOTE_URL}"
