# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS base
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* turbo.json tsconfig.base.json ./
COPY apps ./apps
RUN pnpm install --frozen-lockfile || pnpm install

FROM deps AS build
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN pnpm build

# Build a self-contained whisper.cpp CLI + bundle a base model.
FROM debian:bookworm-slim AS whisper
ARG WHISPER_MODEL=base
# Pin a release so ARM Docker builds are reproducible (master can break).
ARG WHISPER_CPP_REF=v1.9.1
RUN apt-get update \
  && apt-get install -y --no-install-recommends git cmake build-essential ca-certificates curl wget \
  && rm -rf /var/lib/apt/lists/*
# On aarch64, GGML_NATIVE detects +fp16fml but omits +fp16, which breaks vfmaq_f16 / vaddq_f16.
# Force an arch that includes +fp16. On other arches, just disable native tuning for portable images.
RUN git clone --depth 1 --branch "${WHISPER_CPP_REF}" https://github.com/ggerganov/whisper.cpp /opt/whisper-src \
  && ARCH="$(uname -m)" \
  && if [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then \
       CMAKE_EXTRA="-DGGML_NATIVE=OFF -DGGML_CPU_ARM_ARCH=armv8.2-a+fp16"; \
     else \
       CMAKE_EXTRA="-DGGML_NATIVE=OFF"; \
     fi \
  && cmake -S /opt/whisper-src -B /opt/whisper-src/build -DCMAKE_BUILD_TYPE=Release -DBUILD_SHARED_LIBS=OFF ${CMAKE_EXTRA} \
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
