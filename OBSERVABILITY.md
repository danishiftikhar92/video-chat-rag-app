# Observability (Langfuse)

This app uses **[Langfuse](https://langfuse.com)** for LLM/RAG tracing: latency, retrieval quality, prompts, model generations, token usage, errors, and user feedback scores. App logs stay on NestJS `Logger`; Langfuse is not a replacement for request logging.

Tracing is **opt-in**. When Langfuse keys are missing or disabled, the API no-ops and chat works normally.

## Why Langfuse

The RAG stack is custom NestJS (not LangChain). Langfuse works with manual spans/generations, is self-hostable (good for local Ollama), and provides dashboards for latency, tokens, cost, and quality scores.

## Environment variables

Add these to `.env` (see `.env.example`):

| Variable | Description |
|----------|-------------|
| `LANGFUSE_PUBLIC_KEY` | Langfuse project public key |
| `LANGFUSE_SECRET_KEY` | Langfuse project secret key |
| `LANGFUSE_BASE_URL` | Optional. Empty = Langfuse Cloud. Self-hosted example: `http://localhost:3001` |
| `LANGFUSE_ENABLED` | `true` / `false` / empty. Empty **auto-enables** when both keys are set; `false` forces off |
| `OBSERVABILITY_ENVIRONMENT` | Tag on every trace (`development`, `staging`, `prod`, …). Defaults from `NODE_ENV` (`production` → `prod`) |

## Local setup

### Langfuse Cloud

1. Create a project at [cloud.langfuse.com](https://cloud.langfuse.com).
2. Copy public/secret keys into `.env`.
3. Restart the API (`pnpm --filter @video-rag/api dev`).
4. Ask a question in chat; open the Langfuse **Traces** view.

### Self-hosted

1. Run Langfuse (official Docker Compose from [Langfuse self-hosting docs](https://langfuse.com/docs/deployment/self-host)).
2. Set `LANGFUSE_BASE_URL` to your instance (e.g. `http://localhost:3001`).
3. Create a project, copy keys into `.env`, restart the API.

## What each RAG request records

Every `POST /videos/:id/chat` creates a top-level trace `rag_request` tagged with environment, session, and optional user/anonymous id.

| Observation | Contents |
|-------------|----------|
| `retrieval` | Query, video filters, chunk IDs, scores, short snippets, grade (`high` / `low` / `none`), latency |
| `prompt_assembly` | Final prompt sent to the LLM |
| `llm_call` (generation) | Model, provider, messages, answer, latency, token usage when the provider returns it |
| Events | `guardrail_blocked` / `guardrail_input` / `guardrail_output`, `query_rewrite`, `fallback_response` |

Fallback answers (“I could not find grounded transcript evidence…”) are tagged `fallback_response` for easy filtering.

Chat responses include `traceId` so the UI (or API clients) can attach feedback.

## Feedback (thumbs)

- **UI:** On assistant replies from the current page session that still carry a `traceId`, use thumbs up/down under the message. One vote per message; votes are not restored after reload (message history does not store `traceId`).
- **API:**

```http
POST /observability/feedback
Content-Type: application/json

{
  "traceId": "<id from ChatResponse>",
  "score": 1,
  "sessionId": "<optional>",
  "comment": "<optional>"
}
```

`score`: `1` = thumbs up, `0` = thumbs down. Scores appear on the Langfuse trace as `user_feedback`.

## Viewing traces and dashboards

1. Open your Langfuse project → **Tracing** / **Traces**.
2. Filter by environment tag, `fallback_response`, `guardrail_blocked`, or session id.
3. Open a trace to inspect retrieval documents, the assembled prompt, and the generation (tokens/latency).
4. Use Langfuse dashboards for latency, token usage, cost (when usage is present), and error rates over time.
5. Sort or filter by low `user_feedback` scores to find bad answers.

## Improving RAG quality

Look for patterns such as:

- **Empty or low-grade retrieval** — embedding mismatch, wrong video ids, or thin transcripts.
- **Frequent query rewrites** — first-pass retrieval is weak; tune chunking or retrieval limit.
- **Fallback answers** — no grounded evidence; check ingestion completeness.
- **Guardrail blocks** — noisy rails or legitimate refusals; review reasons on the event.
- **Thumbs-down clusters** — compare prompt + retrieved snippets vs. the answer for hallucinations or missed citations.

## Streaming

The chat API is request/response only (`stream: false`). When streaming is added, create a Langfuse generation at start, update output as chunks arrive, and end the generation when the stream completes.

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/observability/feedback` | Attach a user feedback score to a trace |
