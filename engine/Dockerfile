FROM ubuntu:22.04

LABEL maintainer="86Web"
LABEL description="86Web Engine (FastAPI Backend + 86Box Runner Manager)"

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    curl \
    wget \
    tigervnc-standalone-server \
    x11-utils \
    libgl1-mesa-dri \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libxrandr2 \
    libxi6 \
    libxtst6 \
    libxrender1 \
    libxfixes3 \
    libxcursor1 \
    libxcomposite1 \
    libxdamage1 \
    libxkbcommon0 \
    libxkbcommon-x11-0 \
    libdbus-1-3 \
    libasound2 \
    libpulse0 \
    libopenal1 \
    libevdev2 \
    libfreetype6 \
    libwayland-client0 \
    libwayland-cursor0 \
    libwayland-egl1 \
    libxcb-icccm4 \
    libxcb-image0 \
    libxcb-keysyms1 \
    libxcb-render-util0 \
    libxcb-xinerama0 \
    libxcb-randr0 \
    libxcb-shape0 \
    libxcb-xkb1 \
    pulseaudio \
    pulseaudio-utils \
    jq \
    gosu \
    matchbox-window-manager \
    ffmpeg \
    xdotool \
    iproute2 \
    sudo \
    libpcap0.8 \
    libcap2-bin \
    supervisor \
    build-essential \
    python3-dev \
    python3-pip \
    python3-venv \
    && rm -rf /var/lib/apt/lists/*

# Build cap_wrap: raises CAP_NET_RAW as an ambient capability
COPY runner/cap_wrap.c /tmp/cap_wrap.c
RUN apt-get update && apt-get install -y --no-install-recommends libcap-dev \
    && gcc -O2 -o /usr/local/bin/cap_wrap /tmp/cap_wrap.c -lcap \
    && setcap 'cap_net_raw,cap_net_admin,cap_setpcap+ep' /usr/local/bin/cap_wrap \
    && rm /tmp/cap_wrap.c \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python packages
COPY backend/requirements.txt /app/requirements-backend.txt
COPY runner/requirements.txt /app/requirements-runner.txt
RUN pip3 install --no-cache-dir -r /app/requirements-backend.txt -r /app/requirements-runner.txt

# Copy backend app & dependencies
COPY backend/app/ ./backend/app/
COPY VERSION /app/VERSION
COPY scripts/query_86box.py ./scripts/query_86box.py
RUN printf '#!/bin/sh\nexec python3 /app/scripts/query_86box.py "$@"\n' > /usr/local/bin/86box-query \
    && chmod +x /usr/local/bin/86box-query

# Copy runner app
COPY runner/app/ ./runner/app/

# Setup supervisord
COPY engine/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Entrypoint
COPY engine/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8000 8001

ENTRYPOINT ["/entrypoint.sh"]
