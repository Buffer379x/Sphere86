# Sphere86

**Sphere86** is a web UI for managing [86Box](https://86box.net) VMs (retro PC emulation) — create and configure machines, boot them, and use them from your browser via noVNC (plus audio streaming).

## TL;DR

See [`Quickstart.md`](Quickstart.md) for the fast path.

## What you get

- **VM lifecycle**: create, edit, start, stop, reset, pause, delete
- **Full 86Box config from the browser**: machines/CPU/RAM/video/sound/controllers/drives/networking and per-device options
- **Sharing**: share VMs and complete VM groups with other users
- **Locks**: lock mechanism to prevent conflicting edits/actions on shared resources
- **noVNC console**: WebSocket VNC proxy with tabbed consoles
- **Audio**: low-latency audio streaming from each running VM to the browser
- **Groups**: color-coded VM groups + optional isolated LAN via Linux bridge/TAP
- **Dashboard**: live CPU/RAM/disk usage; VM counts and per-user stats
- **Auth**: local users + optional LDAP, roles (admin/user), quotas
- **Media management**: upload/manage disk images + optional read-only shared library mount (**WIP**; hot-swap images for live VMs is planned)
- **Import**: import existing VMs and convert legacy `86box.cfg` into the new v5 format
- **Docker first**: build + run with `docker compose`

## Architecture (2 services)

Sphere86 runs as **two Docker services**:

- **`web`**: nginx reverse-proxy + static frontend (React/Vite build)
- **`engine`**: backend API **and** runner supervised in one container

Traffic flow:

```
Browser
  │  HTTP / WebSocket
  ▼
┌──────────────────────────────────────────────┐
│ web (nginx)                                  │  :80 (WEB_PORT)
│ - serves SPA                                 │
│ - /api/*        → engine:8000 (backend)      │
│ - /vnc/*        → engine:8001 (runner)       │
│ - /vms/*/audio  → engine:8001 (runner)       │
└──────────────────────────────────────────────┘
```

### `engine` internals

- **Backend (FastAPI, :8000)**: REST API, auth/JWT, SQLite persistence, VM/group/media/user management, system stats; delegates VM actions to runner.
- **Runner (FastAPI, :8001)**: starts/stops 86Box processes, manages VNC and audio streaming, group networking (bridge/TAP), VM runtime assets.

### Key HTTP paths (as seen by the browser)

- **Backend API**: `GET/POST /api/...`
- **VNC WebSocket**: `ws(s)://<host>/vnc/<vm_uuid>/websockify`
- **Audio stream**: `GET /vms/<vm_id>/audio`

## Ports

- **Host → `web`**:
  - `WEB_PORT` (default `80`) → HTTP
  - `HTTPS_PORT` (default `443`) → optional HTTPS (see below)
- **Internal (not exposed)**:
  - `engine:8000` backend API
  - `engine:8001` runner
  - `engine:6900-6949` per-VM VNC WebSocket targets (proxied by runner)

## Data / volumes

All persistent state lives under `DATA_PATH` on the host (mounted into `engine` at `/data`):

```
DATA_PATH/
├── config/
│   └── Sphere86.db
├── vms/
├── roms/
├── cache/
└── user_images/
```

An optional shared library `LIBRARY_PATH` is mounted read-only at `/library`.

## Environment variables

All variables live in `.env` and are passed through `docker-compose.yml`.

### Core

| Variable | Default | Purpose |
|---|---:|---|
| `APP_SECRET_KEY` | *(set this)* | JWT signing secret. If you want logins to survive restarts, set a stable long random value. |
| `PUID` / `PGID` | `1000` | UID/GID to run container processes as. |
| `TZ` | `Europe/Berlin` | Timezone. |
| `DATA_PATH` | `./data` | Persistent data directory on the host. |
| `LIBRARY_PATH` | `./library` | Optional read-only shared image library on the host. |

### Networking / TLS

| Variable | Default | Purpose |
|---|---:|---|
| `WEB_PORT` | `80` | Host port for HTTP. |
| `HTTPS_PORT` | `443` | Host port for HTTPS (only used if enabled in compose + certs exist). |
| `SERVER_NAME` | `_` | nginx `server_name`. |
| `SSL_CERTS_DIR` | *(empty)* | If set, must contain `fullchain.pem` and `privkey.pem`. Enables HTTPS + redirect. |

### Auth bootstrap

| Variable | Default | Purpose |
|---|---:|---|
| `USER_MANAGEMENT` | `true` | `false` disables auth entirely (open UI). |
| `ADMIN_USERNAME` | `admin` | First-boot admin user. |
| `ADMIN_PASSWORD` | `changeme` | First-boot admin password (change this). |
| `ADMIN_EMAIL` | `admin@example.com` | First-boot admin email. |
| `JWT_ALGORITHM` | `HS256` | JWT algorithm. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `1440` | Session lifetime. |

### LDAP (optional)

LDAP is active only when `USER_MANAGEMENT=true` and `LDAP_ENABLED=true`.

| Variable | Default |
|---|---:|
| `LDAP_ENABLED` | `false` |
| `LDAP_SERVER` | *(empty)* |
| `LDAP_PORT` | `389` |
| `LDAP_BASE_DN` | *(empty)* |
| `LDAP_BIND_DN` | *(empty)* |
| `LDAP_BIND_PASSWORD` | *(empty)* |
| `LDAP_USER_FILTER` | `(objectClass=person)` |
| `LDAP_GROUP_DN` | *(empty)* |
| `LDAP_USERNAME_ATTR` | `uid` |
| `LDAP_EMAIL_ATTR` | `mail` |
| `LDAP_TLS` | `false` |

### Runner / VM runtime

| Variable | Default | Purpose |
|---|---:|---|
| `RUNNER_URL` | `http://localhost:8001` | Backend→runner URL. Default stack runs runner inside `engine`, so `localhost` is correct. |
| `BOX86_VERSION` | *(empty)* | Pin 86Box release tag. |
| `BOX86_ARCH` | `x86_64` | 86Box binary arch. |
| `BASE_VNC_PORT` | `5900` | First internal VNC port. |
| `BASE_WS_PORT` | `6900` | First internal WebSocket port. |
| `ACTIVE_VM_LIMIT` | `5` | Max simultaneously running VMs. |
| `VM_AUTO_SHUTDOWN_MINUTES` | `0` | Stop long-running VMs automatically (0 disables). |
| `AUDIO_BUFFER_SECS` | `0.15` | Client-side live buffer target (latency vs. stability). |

## Build-time variables (frontend)

The `web` image uses a build arg for the frontend audio buffering:

- **`VITE_AUDIO_BUFFER_SECS`** is set by `docker-compose.yml` build args from `AUDIO_BUFFER_SECS`.

If you rebuild images and want a different default:

```bash
AUDIO_BUFFER_SECS=0.25 docker compose build --no-cache
```

## API overview (backend)

The browser talks to the backend under `/api/`. Common endpoints:

- **Health**: `GET /api/health`
- **Auth**: `POST /api/auth/login`, `GET /api/auth/me`, `GET /api/auth/config`
- **VMs**: `GET /api/vms`, `POST /api/vms`, `POST /api/vms/<id>/start`, `POST /api/vms/<id>/stop`, …
- **System**: `GET /api/system/stats`, `GET /api/system/settings` (admin), `PUT /api/system/settings` (admin)

(See the FastAPI OpenAPI at `/api/docs` when the backend is reachable.)

## Updating

```bash
git pull
docker compose build
docker compose up -d
```

86Box binaries/ROMs are updated automatically on container start (or manually in the Settings UI).

## Troubleshooting

- **`web` shows “Server unreachable”**:
  - Check the backend health endpoint from the host: `curl http://localhost/api/health`
  - Then check container health: `docker compose ps`
  - Look at logs: `docker compose logs -f engine` and `docker compose logs -f web`
- **VM group networking doesn’t work**:
  - Requires Linux bridge/TAP support and container capabilities (`NET_ADMIN`, `NET_RAW`) plus `/dev/net/tun` availability.
  - If you run on macOS/Windows via a Linux VM layer, verify the VM exposes `/dev/net/tun` and allows bridge/TAP.
- **No audio / big audio delay**:
  - Increase `AUDIO_BUFFER_SECS` (e.g. `0.25`) and rebuild the `web` image.
  - Confirm nginx audio proxy is not buffering (it is configured with `proxy_buffering off`).

## Production checklist

- **Secrets**: set a long random `APP_SECRET_KEY` and change `ADMIN_PASSWORD` on first boot.
- **TLS**: enable HTTPS (set `SSL_CERTS_DIR`, `SERVER_NAME`, and the HTTPS port mapping).
- **Backups**: back up `DATA_PATH/config/Sphere86.db` and the `DATA_PATH/vms/` tree.
- **Resource limits**: tune `ACTIVE_VM_LIMIT` based on host CPU; consider reducing `MAX_CONCURRENT_VMS` if needed.
- **Updates**: `git pull` → `docker compose build` → `docker compose up -d`.

## Credits

- [86Box](https://86box.net)
- [noVNC](https://novnc.com)
- [PulseAudio](https://www.freedesktop.org/wiki/Software/PulseAudio/) + [ffmpeg](https://ffmpeg.org)
- [TigerVNC / Xvnc](https://tigervnc.org)

## Shoutout / Inspiration

Sphere86 was inspired by David Maxwell’s **86Web** project and its ideas around deep 86Box integration and browser-based management: [maxwelld90/86web](https://github.com/maxwelld90/86web).

The rename to **Sphere86** was done to avoid confusion between the two projects and their feature sets.
