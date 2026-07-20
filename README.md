# Video RAG Agent

<p align="center">
  <img src="docs/video-rag-linkedin-thumbnail.png" alt="Video RAG — Local transcription · pgvector · grounded chat" width="800" />
</p>

Production-shaped monorepo that ingests video URLs or uploaded media, extracts audio, transcribes speech with **local whisper.cpp**, indexes transcript chunks with **Ollama embeddings + pgvector**, and supports grounded chat via **local Ollama** models — with **no cloud AI keys required**.

## Demo

UI walkthrough of the library, transcript, summary, grounded chat, model switching, upload, and settings:

<video src="docs/video-rag-agent-demo.webm" controls width="100%"></video>

[Download the demo video](./docs/video-rag-agent-demo.webm)

## What it does

1. Submit a YouTube / public media URL or upload a local file.
2. The API creates a video record and queues an ingestion job on Redis (BullMQ).
3. The API's ingestion module downloads (or reads) media, extracts audio, transcribes it locally, chunks + embeds the transcript, and writes a summary.
4. The web UI lets you browse the library, watch processing status, read the transcript and summary, and ask questions that are answered with citations grounded in transcript evidence.

## Features

### Ingestion & processing
- **Multiple sources** — YouTube / public URLs (via `yt-dlp` / `curl`) and direct file uploads.
- **Fully local AI** — offline transcription with whisper.cpp, embeddings + chat/summary with Ollama.
- **Async pipeline** — heavy work runs on a BullMQ consumer inside the API process; live progress (5% → 100%).
- **Smart titles** — human‑readable titles from metadata, embedded media title tags (`ffprobe`), or a cleaned‑up file name — never the raw file path.
- **Retry** — re‑queue a failed or stuck ingestion from the UI or API.
- **Hard delete** — remove a video plus all related rows (transcript, chunks, summary, chat, jobs) and its stored files in one action.

### Retrieval‑augmented chat
- Grounded Q&A per video using **pgvector cosine similarity** retrieval over transcript chunks.
- Answers include **citations** (chunk id + timestamps + snippet).
- Persistent chat sessions with the ability to **clear history** or delete a session.
- **Langfuse observability** (optional) for end‑to‑end RAG traces, token usage, and thumbs‑up/down feedback — see [OBSERVABILITY.md](./OBSERVABILITY.md).

### Web UI
- **Responsive** layout with a **collapsible sidebar** and mobile navigation drawer.
- **Dark / light / system** theme (defaults to system, persisted locally).
- **Video library** with **card and table views**, thumbnails/skeletons, status badges, and **pagination**.
- **Upload page** with URL and drag‑and‑drop file tabs and real‑time upload progress.
- **Chat workspace** with video picker, persisted last session, clear‑history control, and **thumbs feedback** on traced answers.
- **Settings** page for theme, default library view, page size, and API base URL (client‑side preferences).

## Tech stack

| Layer | Technology |
|-------|-----------|
| Language / tooling | TypeScript, pnpm workspaces, Turborepo, ESLint, Prettier |
| API | NestJS, TypeORM, BullMQ (producer + ingestion consumer), yt-dlp, FFmpeg/ffprobe, whisper.cpp |
| Data | PostgreSQL 16 + `pgvector`, Redis 7 |
| AI | Ollama (chat + embeddings), whisper.cpp (transcription) |
| Web | React 18, Vite, React Router 7, TanStack Query, Zustand, Tailwind CSS, shadcn/ui (Radix), lucide-react, sonner |
| Contracts | Zod schemas / DTOs in the API; mirrored TypeScript types in the web app |
| Infra | Docker & Docker Compose, Nginx (serves the built web app) |

## Monorepo layout

| Path | Role |
|------|------|
| `apps/api` | NestJS REST API (TypeORM + Postgres/pgvector, BullMQ producer + ingestion consumer, Ollama RAG chat). Owns DB entities/migrations and Zod contracts under `src/database` + `src/shared`. |
| `apps/web` | React + Vite + Tailwind/shadcn admin & chat UI (Zustand state, TanStack Query). Owns local API DTO types under `src/types`. |

## Architecture

```text
  Web (React/Vite)  --->  API (NestJS)  --->  Postgres + pgvector
                             |  ^            ^
                             v  |            |
                           Redis (BullMQ) ---+
                             |                 |
                             +---- local FS artifacts (/data/uploads or ./uploads)
                             |
                           Ollama (Docker :11434)
```

- **API** handles sync HTTP (create videos, list/detail/delete, status, transcript/summary/chat) and runs the BullMQ ingestion consumer as an `IngestionModule`.
- **Redis / BullMQ** is the job queue between the API producer and the in-process consumer.
- **Postgres + pgvector** stores relational data and transcript‑chunk embeddings.
- **Ollama** serves local chat and embedding models (no cloud AI keys).
- **whisper.cpp** runs on the API host (or a baked‑in binary) for offline transcription.
- **Local filesystem** stores artifacts (media, audio, transcript, summary) under `videos/<id>/`.

### Ingestion pipeline (API IngestionModule)

| Progress | Step |
|----------|------|
| 5% | Resolve source + extract metadata (title/thumbnail via `yt-dlp`, or `ffprobe`/filename for uploads) |
| 20% | Extract / convert audio with FFmpeg (mono 16 kHz WAV) |
| 40% | Transcribe with local whisper.cpp CLI |
| 60% | Chunk transcript + create Ollama embeddings → pgvector |
| 80% | Generate summary with Ollama chat |
| 100% | Mark video/job completed |

### Chat / RAG flow

`POST /videos/:id/chat` runs a local RAG agent that:

1. Routes the question (QA vs summary-style).
2. Embeds the query with Ollama and retrieves chunks via **pgvector cosine distance** (`<=>`).
3. Grades context confidence.
4. Generates an answer with Ollama + citations (chunk id + timestamps + snippet).

Providers are env-swappable (`whispercpp` / `ollama` / `mock`; local storage today).

### Delete flow

```text
Delete (list/detail) -> Confirm dialog -> DELETE /videos/:id
  -> transaction: chat messages, sessions, chunks, transcript, summary, jobs, video
  -> storage.delete videos/:id  -> invalidate library / navigate
```

## Prerequisites

- Node.js 22+
- pnpm 9+
- Docker + Docker Compose (recommended for Postgres, Redis, Ollama)
- FFmpeg (+ ffprobe)
- yt-dlp (for YouTube sources)
- A built [whisper.cpp](https://github.com/ggerganov/whisper.cpp) binary + GGML model file (only when running the API on the host; the Docker image bakes one in)

## Local AI setup

### 1. Install FFmpeg

```bash
# Debian / Ubuntu
sudo apt-get update && sudo apt-get install -y ffmpeg

# macOS
brew install ffmpeg
```

### 2. Build whisper.cpp and download a model

```bash
git clone https://github.com/ggerganov/whisper.cpp.git
cd whisper.cpp
cmake -B build
cmake --build build -j --config Release

# Binary is typically: build/bin/whisper-cli  (or main / whisper depending on version)
mkdir -p /path/to/video_rag_agent/bin /path/to/video_rag_agent/models
cp build/bin/whisper-cli /path/to/video_rag_agent/bin/whisper-cli

# Download the base model (or use small)
bash ./models/download-ggml-model.sh base
cp models/ggml-base.bin /path/to/video_rag_agent/models/ggml-base.bin
```

Set in `.env`:

```bash
WHISPER_BIN_PATH=./bin/whisper-cli
WHISPER_MODEL_PATH=./models/ggml-base.bin
AUDIO_TEMP_DIR=./uploads/tmp
TRANSCRIPTION_PROVIDER=whispercpp
```

### 3. Run Ollama with Docker

```bash
# From the repo root (starts Postgres, Redis, Ollama, and pulls models from .env)
docker compose up -d postgres redis ollama ollama-init
```

`ollama-init` pulls every model in `LLM_AVAILABLE_MODELS` plus `OLLAMA_EMBED_MODEL`. For a host-only Ollama:

```bash
docker run -d -v ollama:/root/.ollama -p 11434:11434 --name ollama ollama/ollama
# Pull the same allowlist as in .env, e.g.:
docker exec -it ollama ollama pull llama3.2:1b
docker exec -it ollama ollama pull all-minilm
```

NVIDIA GPU:

```bash
docker run -d --gpus=all -v ollama:/root/.ollama -p 11434:11434 --name ollama ollama/ollama
```

### Lightweight chat models (recommended allowlist)

| Model | Approx size | Notes |
|-------|-------------|--------|
| `llama3.2:1b` | ~1.3 GB | Default; fastest |
| `qwen2.5:1.5b` | ~1.0 GB | Strong small instruct model |
| `smollm2:1.7b` | ~1.0 GB | Very light, good for chat |
| `gemma2:2b` | ~1.6 GB | Solid quality/size tradeoff |
| `phi3:mini` | ~2.3 GB | Heavier end of “light” |

Configure via `LLM_DEFAULT_MODEL` and `LLM_AVAILABLE_MODELS` in `.env`. Embeddings stay on `all-minilm` (fixed dimensions).

### 4. Configure env and run the NestJS app

```bash
cp .env.example .env
# Ensure OLLAMA_BASE_URL=http://localhost:11434
# LLM_DEFAULT_MODEL=llama3.2:1b
# LLM_AVAILABLE_MODELS=llama3.2:1b,qwen2.5:1.5b,smollm2:1.7b,gemma2:2b,phi3:mini
# OLLAMA_EMBED_MODEL=all-minilm
# EMBEDDING_DIMENSIONS=384

pnpm install
pnpm build
pnpm --filter @video-rag/api start
pnpm --filter @video-rag/web dev
```

## Quick start (full Docker stack)

The Docker image bakes in whisper.cpp (with a base model), FFmpeg, and yt-dlp, so no host AI setup is needed.

```bash
cp .env.example .env

docker compose up --build
```

`ollama-init` pulls `LLM_AVAILABLE_MODELS` and `OLLAMA_EMBED_MODEL` automatically before the API starts.

Services:

| Service | URL / port |
|---------|------------|
| Web UI | http://localhost:8080 |
| API | http://localhost:3000 |
| Ollama | http://localhost:11434 (host `${OLLAMA_HOST_PORT:-11435}` if 11434 is taken) |
| Postgres | `localhost:5433` → container `5432` |
| Redis | `localhost:6379` |

Compose loads `.env` for `api` and `ollama-init`, and overrides `DATABASE_URL` / `REDIS_URL` / `OLLAMA_BASE_URL` for the Docker network. Uploads are stored on a volume at `/data/uploads`. Ingestion runs inside the API process.

> If a local Postgres already uses port `5432`, Compose publishes the app database on **`5433`**. Local `.env` should use `DATABASE_URL=postgresql://postgres:postgres@localhost:5433/video_rag`.

## Local development (infra in Docker, apps on host)

```bash
cp .env.example .env
docker compose up -d postgres redis ollama ollama-init
pnpm install
pnpm build
pnpm --filter @video-rag/api start
pnpm --filter @video-rag/web dev   # Vite dev server on http://localhost:5173
```

### Useful workspace scripts

```bash
pnpm dev          # run all apps in parallel (turbo)
pnpm build        # build all apps
pnpm typecheck    # typecheck everything
pnpm lint         # lint everything
pnpm format       # prettier --write .
pnpm db:migrate   # run TypeORM migrations (@video-rag/api)
```

## Important environment variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Postgres connection string (pgvector image) |
| `REDIS_URL` | Redis / BullMQ connection |
| `CORS_ORIGIN` | Allowed web origin |
| `WORKER_CONCURRENCY` | Number of concurrent ingestion jobs |
| `STORAGE_PROVIDER` | `local` (default) |
| `LOCAL_STORAGE_ROOT` | Artifact root (`./uploads` locally, `/data/uploads` in Docker) |
| `AUDIO_TEMP_DIR` | Temp WAV / whisper work directory (cleaned after each job) |
| `TYPEORM_SYNC` | `true` for local schema bootstrap |
| `TRANSCRIPTION_PROVIDER` | `whispercpp` or `mock` |
| `WHISPER_BIN_PATH` | Path to whisper.cpp CLI binary |
| `WHISPER_MODEL_PATH` | Path to GGML model (e.g. `ggml-base.bin`) |
| `CHAT_PROVIDER` | `ollama` or `mock` |
| `EMBEDDING_PROVIDER` | `ollama` or `mock` |
| `LLM_PROVIDER` | Chat gateway provider (`ollama` or `mock`) |
| `LLM_DEFAULT_MODEL` | Default model for summarization + chat fallback |
| `LLM_AVAILABLE_MODELS` | Comma-separated allowlist of chat models |
| `LLM_OPENAI_BASE_URL` / `LLM_OPENAI_API_KEY` / `LLM_OPENAI_MODELS` | Optional OpenAI-compatible online models |
| `OLLAMA_BASE_URL` | Ollama HTTP API (`http://localhost:11434`) |
| `OLLAMA_CHAT_MODEL` | Legacy alias; synced to `LLM_DEFAULT_MODEL` |
| `OLLAMA_EMBED_MODEL` | Embedding model (default `all-minilm`) |
| `EMBEDDING_DIMENSIONS` | Must match embed model (default `384` for `all-minilm`) |
| `MAX_UPLOAD_SIZE_MB` | Upload size cap |
| `ALLOWED_SOURCE_HOSTS` | Comma-separated allow-list for URL ingestion |
| `MAX_VIDEO_DURATION_SECONDS` | Reject sources longer than this |
| `MAX_DOWNLOAD_SIZE_MB` | Download size cap |
| `INGESTION_RATE_LIMIT` / `CHAT_RATE_LIMIT` | Per-window request limits |
| `LANGFUSE_*` / `OBSERVABILITY_ENVIRONMENT` | Optional Langfuse tracing — see [OBSERVABILITY.md](./OBSERVABILITY.md) |

See `.env.example` for the full list.

## Main API endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/videos` | Ingest from URL |
| `POST` | `/videos/upload` | Ingest from uploaded file |
| `GET` | `/videos` | List videos (supports `page` / `pageSize`) |
| `GET` | `/videos/:id` | Video detail |
| `GET` | `/videos/:id/status` | Job / progress status |
| `POST` | `/videos/:id/retry` | Re-queue ingestion |
| `DELETE` | `/videos/:id` | Hard delete video + all related data & files |
| `GET` | `/videos/:id/transcript` | Transcript + segments |
| `GET` | `/videos/:id/summary` | Summary |
| `POST` | `/videos/:id/chat` | Grounded Q&A with citations (optional `model`; returns `traceId` when tracing runs) |
| `POST` | `/observability/feedback` | Thumbs feedback score for a Langfuse `traceId` |
| `GET` | `/llm/models` | Available chat models + server default |
| `POST` | `/sessions` | Create a chat session |
| `GET` | `/sessions/:id` | Get session |
| `GET` | `/sessions/:id/messages` | Session message history |
| `DELETE` | `/sessions/:id/messages` | Clear session history |
| `DELETE` | `/sessions/:id` | Delete session |
| `GET` | `/admin/jobs` | Job admin list |
| `GET` | `/admin/jobs/:id` | Job detail |
| `POST` | `/admin/jobs/:id/retry` | Retry a job |
| `GET` | `/health` | Health check |

## Web UI routes

- `/` and `/videos` — video library (card / table views, pagination, delete)
- `/videos/new` — URL or file upload
- `/videos/:id` — detail + status (+ retry / delete)
- `/videos/:id/transcript` — transcript viewer
- `/videos/:id/summary` — summary
- `/chat` — chat workspace (pick a video)
- `/chat/video/:id` — chat with a specific video (citations)
- `/settings` — preferences (theme, view, page size, default chat model, API base URL)

## Data model (high level)

- **Video** — source, title, thumbnail, status, progress, artifact paths
- **VideoJob** — ingest / retry attempts
- **Transcript** — raw text + timed segments
- **TranscriptChunk** — retrieval units + **pgvector** embeddings
- **Summary** — summary text + highlights
- **ChatSession / ChatMessage** — conversation + citations

## Notes / known limits

- Transcription is fully local via whisper.cpp; temp WAV files under `AUDIO_TEMP_DIR` are deleted after each run.
- Retrieval uses **pgvector cosine distance** (`<=>`) over stored chunk embeddings.
- Changing `OLLAMA_EMBED_MODEL` / `EMBEDDING_DIMENSIONS` requires re-ingesting videos (vector width must match).
- With `TYPEORM_SYNC=true`, schema is auto-synced for local/dev use; the app also runs `CREATE EXTENSION vector` and migrates the embedding column on boot. Prefer migrations for stricter production setups.
- Deletes are **hard** and irreversible (rows + stored files are removed). Already-processed uploads keep their existing title unless re-run via Retry.
# video-chat-rag-app
