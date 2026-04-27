# syntax=docker/dockerfile:1

FROM node:20-bookworm-slim AS builder
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV PLAYWRIGHT_PROFILES_DIR=/var/lib/budget-tracker/playwright-profiles

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
       openssl \
       ca-certificates \
       xvfb \
       dbus-x11 \
       fonts-liberation \
       libgbm1 \
       x11-utils \
  && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/middleware.ts ./middleware.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json

RUN npx playwright install chromium --with-deps \
  && mkdir -p "$PLAYWRIGHT_PROFILES_DIR"

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN printf '#!/bin/sh\nset -e\n\n# Reap Xvfb when the container exits so a restart does not collide on :99.\ntrap "kill 0" EXIT\n\nXvfb :99 -screen 0 1920x1080x24 -ac +extension RANDR -nolisten tcp &\n\nDISPLAY=:99\nexport DISPLAY\n\ni=0\nwhile ! xdpyinfo -display :99 >/dev/null 2>&1; do\n  i=$((i+1))\n  if [ "$i" -ge 20 ]; then\n    echo "[entrypoint] Xvfb did not start within 10s — aborting" >&2\n    exit 1\n  fi\n  sleep 0.5\ndone\necho "[entrypoint] Xvfb ready on :99"\n\nnpx prisma migrate deploy\nexec npm run start\n' > /app/docker-entrypoint-xvfb.sh \
  && chmod +x /app/docker-entrypoint-xvfb.sh

CMD ["/app/docker-entrypoint-xvfb.sh"]
