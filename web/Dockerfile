# ── Stage 1: Build React app ───────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN apk add --no-cache wget tar

WORKDIR /app
COPY package.json ./
RUN npm install --legacy-peer-deps

COPY . .

ARG VITE_AUDIO_BUFFER_SECS=0.15
ENV VITE_AUDIO_BUFFER_SECS=$VITE_AUDIO_BUFFER_SECS

RUN npm run build

# Download noVNC and embed core/ files so rfb.js is served at /novnc/core/rfb.js
RUN wget -q -O /tmp/novnc.tar.gz \
      https://github.com/novnc/noVNC/archive/refs/tags/v1.5.0.tar.gz \
    && tar -xzf /tmp/novnc.tar.gz -C /tmp \
    && mkdir -p dist/novnc \
    && cp -r /tmp/noVNC-1.5.0/core dist/novnc/core \
    && cp -r /tmp/noVNC-1.5.0/vendor dist/novnc/vendor \
    && rm -rf /tmp/novnc.tar.gz /tmp/noVNC-1.5.0

# ── Stage 2: Nginx with built assets ──────────────────────────────────────
FROM nginx:1.25-alpine

LABEL org.opencontainers.image.source="https://github.com/Buffer379x/Sphere86"
LABEL org.opencontainers.image.title="Sphere86 Web"
LABEL org.opencontainers.image.icon="https://raw.githubusercontent.com/Buffer379x/Sphere86/main/docs/logo/logo.png"

RUN apk add --no-cache tzdata

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# TLS mount point (optional); empty dir → HTTP-only until certs are mounted
RUN mkdir -p /etc/nginx/certs

COPY --from=builder /app/dist /usr/share/nginx/html

# Reverse-proxy + SPA routing (same paths as docker-compose used to bind-mount)
COPY nginx/nginx.conf /etc/nginx/nginx.conf
COPY nginx/templates /etc/nginx/Sphere86-templates

# Renders http/https server block from templates at container start
COPY nginx-entrypoint.sh /docker-entrypoint.d/05-ssl-config.sh
RUN chmod +x /docker-entrypoint.d/05-ssl-config.sh

# Create tmp dirs for nginx (non-root)
RUN mkdir -p /tmp/nginx /var/cache/nginx/client_temp \
    /var/cache/nginx/proxy_temp /var/cache/nginx/fastcgi_temp \
    /var/cache/nginx/uwsgi_temp /var/cache/nginx/scgi_temp && \
    chown -R nginx:nginx /tmp/nginx /var/cache/nginx && \
    chown -R nginx:nginx /usr/share/nginx/html

EXPOSE 80 443
CMD ["nginx", "-g", "daemon off;"]
