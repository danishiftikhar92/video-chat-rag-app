# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS base
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY apps ./apps
RUN pnpm install --frozen-lockfile || pnpm install

FROM deps AS build
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN pnpm build

# Build a self-contained whisper.cpp CLI + bundle a base model.
FROM debian:bookworm-slim AS whisper
ARG WHISPER_MODEL=base
RUN apt-get update \
  && apt-get install -y --no-install-recommends git cmake build-essential ca-certificates curl wget \
  && rm -rf /var/lib/apt/lists/*
RUN git clone --depth 1 https://github.com/ggerganov/whisper.cpp /opt/whisper-src \
  && cmake -S /opt/whisper-src -B /opt/whisper-src/build -DCMAKE_BUILD_TYPE=Release -DBUILD_SHARED_LIBS=OFF \
  && cmake --build /opt/whisper-src/build -j --config Release --target whisper-cli \
  && bash /opt/whisper-src/models/download-ggml-model.sh ${WHISPER_MODEL} \
  && mkdir -p /opt/whisper/models \
  && cp /opt/whisper-src/build/bin/whisper-cli /opt/whisper/whisper-cli \
  && cp /opt/whisper-src/models/ggml-${WHISPER_MODEL}.bin /opt/whisper/models/ggml-${WHISPER_MODEL}.bin \
  && /opt/whisper/whisper-cli --help >/dev/null

FROM base AS runtime
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg curl ca-certificates python3 libgomp1 \
  && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
  && chmod a+rx /usr/local/bin/yt-dlp \
  && yt-dlp --version \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app /app
COPY --from=whisper /opt/whisper /opt/whisper
RUN mkdir -p /data/uploads
ENV NODE_ENV=production
ENV LOCAL_STORAGE_ROOT=/data/uploads
ENV WHISPER_BIN_PATH=/opt/whisper/whisper-cli
ENV WHISPER_MODEL_PATH=/opt/whisper/models/ggml-base.bin
COPY scripts/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["api"]

FROM nginx:1.27-alpine AS web
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
