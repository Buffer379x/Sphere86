# Sphere86 — Quickstart

Get Sphere86 running quickly using Docker Compose.

## Prerequisites

- **Docker Engine** + **Docker Compose v2**
- Recommended: **Linux host**
  - Group networking (bridge/TAP) requires Linux kernel features and container capabilities.
  - On macOS/Windows you can run via a Linux VM layer (e.g. OrbStack/Docker Desktop). Most UI features work; bridge/TAP features may require additional host/VM configuration.

## Quick start

### 1) Clone

```bash
git clone <repo> /srv/Sphere86
cd /srv/Sphere86
```

### 2) Create `.env`

```bash
cp .env.example .env
```

Minimum recommended variables to change:

| Variable | Why |
|---|---|
| `APP_SECRET_KEY` | Keeps logins valid across restarts (set a long random value). |
| `ADMIN_PASSWORD` | First-boot admin password (change this). |
| `PUID` / `PGID` | UID/GID used for file ownership under `DATA_PATH`. |

### 3) Initialise the data directory

```bash
sudo bash scripts/init-data.sh
```

### 4) Build + start

```bash
docker compose up -d
docker compose logs -f
```

### 5) Open the UI

Open `http://localhost` (or `http://<host>:<WEB_PORT>` if you changed it).

Default first-boot credentials:

- **Username**: `admin` (or `ADMIN_USERNAME`)
- **Password**: `ADMIN_PASSWORD`

## Optional: HTTPS

1. Put `fullchain.pem` + `privkey.pem` in a host directory
2. Set `SSL_CERTS_DIR` to that directory
3. Set `SERVER_NAME`
4. Uncomment the HTTPS port mapping in `docker-compose.yml`
5. Restart:

```bash
docker compose up -d
```

## Optional: macvlan (LAN IP)

If you want Sphere86 reachable on a dedicated LAN IP without host port mappings:

```bash
docker network create -d macvlan \
  --subnet=192.168.1.0/24 \
  --gateway=192.168.1.1 \
  -o parent=eth0 \
  netpub

docker compose -f docker-compose.yml -f docker-compose.macvlan.yml up -d
```

Edit `docker-compose.macvlan.yml` to set the static IP.

## Stopping / restarting

```bash
docker compose down
docker compose up -d
```

## Updating

```bash
git pull
docker compose build
docker compose up -d
```

For architecture and the full variable reference, see [`README.md`](README.md).

If you plan to run Sphere86 long-term, also read:

- **Troubleshooting**: [`README.md`](README.md#troubleshooting)
- **Production checklist**: [`README.md`](README.md#production-checklist)
