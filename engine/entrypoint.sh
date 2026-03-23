#!/bin/bash
set -e

PUID=${PUID:-1000}
PGID=${PGID:-1000}

echo "[86Web Engine] Starting with UID=${PUID} GID=${PGID}"

# Create group/user if they don't exist
if ! getent group "$PGID" > /dev/null 2>&1; then
    groupadd -g "$PGID" app86web
fi
if ! getent passwd "$PUID" > /dev/null 2>&1; then
    useradd -u "$PUID" -g "$PGID" -M -s /bin/bash app86web
fi

# Ensure machine-id exists for PulseAudio
if [ ! -s /etc/machine-id ]; then
    cat /proc/sys/kernel/random/uuid | tr -d '-' > /etc/machine-id
fi

# Create required data directories
DATA_DIRS="/data /data/vms /data/roms /data/config /data/cache /data/cache/86box"
for dir in $DATA_DIRS; do
    mkdir -p "$dir"
    chown "$PUID:$PGID" "$dir"
done

# Fix ownership of /app
chown -R "$PUID:$PGID" /app

# Fix /tmp for Xvfb
chmod 1777 /tmp

# Sudo for IP route management (Runner)
{
  echo "#${PUID} ALL=(root) NOPASSWD: /sbin/ip"
} > /etc/sudoers.d/86web-net
chmod 0440 /etc/sudoers.d/86web-net

# Update check (Runner)
echo "[86Web Engine] Running startup update check as UID=${PUID}..."
cd /app/runner && gosu "$PUID:$PGID" python3 app/startup.py || echo "[86Web Engine] WARNING: update check failed (continuing)"

# Strip caps from 86Box
if [ -x "/data/cache/86box/86Box" ]; then
    setcap -r /data/cache/86box/86Box 2>/dev/null || true
fi

echo "[86Web Engine] Starting Supervisord (Backend = :8000, Runner = :8001)"
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
