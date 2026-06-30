# Draft render worker: Remotion (headless Chromium) + FFmpeg, off-Vercel.
FROM node:22-bookworm-slim

# ffmpeg + the shared libs Remotion's Chrome Headless Shell needs at runtime.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg ca-certificates fonts-liberation \
      libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 \
      libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 \
      libpango-1.0-0 libcairo2 libatspi2.0-0 libxshmfence1 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY . .

# Pre-download Remotion's Chrome Headless Shell so the first render isn't slow.
# Non-fatal: if the build network blocks it, ensureBrowser() fetches at runtime.
RUN node -e "import('@remotion/renderer').then(m => m.ensureBrowser()).catch(()=>{})" || true

ENV PORT=8080
EXPOSE 8080
CMD ["node", "src/server.mjs"]
