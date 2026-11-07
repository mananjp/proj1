#!/bin/bash
set -e

# Default MONGODB_URI to local MongoDB if not set
if [ -z "$MONGODB_URI" ]; then
  export MONGODB_URI="mongodb://127.0.0.1:27017/taskdb"
fi

# If MONGODB_URI points to localhost / 127.0.0.1, start the embedded local MongoDB server
if [[ "$MONGODB_URI" == *"127.0.0.1"* ]] || [[ "$MONGODB_URI" == *"localhost"* ]]; then
  echo "=========================================================="
  echo "[Storage] Starting embedded local MongoDB server..."
  echo "=========================================================="
  mkdir -p /data/db /var/log/mongodb

  # Launch mongod with 0.25GB (256MB) WiredTiger cache (MongoDB minimum allowed value)
  mongod --dbpath /data/db \
         --bind_ip 127.0.0.1 \
         --port 27017 \
         --wiredTigerCacheSizeGB 0.25 \
         --logpath /var/log/mongodb/mongod.log \
         --logappend \
         --fork

  echo "[Storage] Waiting for local MongoDB to accept connections..."
  STARTED=false
  for i in $(seq 1 30); do
    if mongosh --port 27017 --eval "db.adminCommand('ping')" > /dev/null 2>&1; then
      echo "[Storage] Local MongoDB is online and responsive."
      STARTED=true
      break
    fi
    sleep 1
  done

  if [ "$STARTED" = false ]; then
    echo "[Storage ERROR] Failed to connect to local MongoDB within 30 seconds. MongoDB logs:"
    cat /var/log/mongodb/mongod.log || true
    exit 1
  fi

  # Run auto-seed check (creates demo users & tasks if database is empty)
  if [ -f server/seed.js ]; then
    echo "[Storage] Checking database seed..."
    node server/seed.js || true
  fi
else
  echo "[Storage] External database detected ($MONGODB_URI). Skipping embedded MongoDB."
fi

echo "[App] Starting Express application on port ${PORT:-5000}..."
exec "$@"

