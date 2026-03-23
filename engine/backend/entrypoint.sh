#!/bin/bash
set -e

PUID=${PUID:-1000}
PGID=${PGID:-1000}

echo "[Sphere86 Backend] Starting with UID=${PUID} GID=${PGID}"

# Create group/user if they don't exist
if ! getent group "$PGID" > /dev/null 2>&1; then
    groupadd -g "$PGID" appSphere86
fi
if ! getent passwd "$PUID" > /dev/null 2>&1; then
    useradd -u "$PUID" -g "$PGID" -M -s /bin/bash appSphere86
fi

# Create required data directories
DATA_DIRS="/data /data/vms /data/roms /data/config /data/cache"
for dir in $DATA_DIRS; do
    mkdir -p "$dir"
    chown "$PUID:$PGID" "$dir"
done

# Fix ownership of /app
chown -R "$PUID:$PGID" /app

echo "[Sphere86 Backend] Dropping to UID=${PUID}"
exec gosu "$PUID:$PGID" "$@"
