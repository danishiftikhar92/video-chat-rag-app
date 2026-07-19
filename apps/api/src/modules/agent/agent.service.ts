import { Injectable } from '@nestjs/common';
import { createLlmGatewayFromEnv, type LlmGateway } from '../../shared';
import { getEnv } from '../../config/env';
import type { ObservabilityContext } from '../observability/observability.types';
import { RagService } from '../rag/rag.service';

type RetrievedChunk = {
  id: string;
  videoId: string;
  content: string;
  startTime: number;
  endTime: number;
  score: number;
  metadata: unknown;
};

type Citation = {
  chunkId: string;
  videoId: string;
  contentSnippet: string;
  startTime: number;
  endTime: number;
};

export type AgentAnswer = {
  answer: string;
  citations: Citation[];
  confidence: number;
  mode: string;
  needsClarification: boolean;
  modelUsed: string;
  fallback?: boolean;
};

const FALLBACK_ANSWER = 'I could not find grounded transcript evidence for that question yet.';

@Injectable()
export class AgentService {
  private readonly gateway: LlmGateway = createLlmGatewayFromEnv(getEnv());

  constructor(private readonly ragService: RagService) {}

  private toCitations(chunks: RetrievedChunk[]): Citation[] {
    return chunks.map((chunk) => ({
      chunkId: chunk.id,
      videoId: chunk.videoId,
      contentSnippet: chunk.content.slice(0, 240),
      startTime: chunk.startTime,
      endTime: chunk.endTime
    }));
  }

  private toRetrievalOutput(chunks: RetrievedChunk[], grade?: string) {
    return {
      count: chunks.length,
      grade,
      documents: chunks.map((chunk) => ({
        id: chunk.id,
        videoId: chunk.videoId,
        score: chunk.score,
        startTime: chunk.startTime,
        endTime: chunk.endTime,
        snippet: chunk.content.slice(0, 240)
      }))
    };
  }

  private fallbackAnswer(mode: string, modelUsed: string, obs?: ObservabilityContext): AgentAnswer {
    obs?.event('fallback_response', { answer: FALLBACK_ANSWER, mode });
    obs?.update({ tags: ['fallback_response'] });
    return {
      answer: FALLBACK_ANSWER,
      citations: [] as Citation[],
      confidence: 0.1,
      mode,
      needsClarification: false,
      modelUsed,
      fallback: true
    };
  }

  async answerQuestion(
    videoIds: string[],
    query: string,
    model?: string,
    obs?: ObservabilityContext
  ): Promise<AgentAnswer> {
    const resolvedModel = this.gateway.resolveModel(model);
    const mode = /summary|highlight|key points/i.test(query) ? 'summary' : 'qa';
    obs?.update({ metadata: { mode, model: resolvedModel, videoIds } });

    if (mode === 'summary') {
      const retrievalSpan = obs?.startSpan('retrieval', { query, videoIds, mode });
      const retrievalStarted = Date.now();
      let retrievedChunks: RetrievedChunk[] = [];
      try {
        retrievedChunks = await this.ragService.retrieveRelevantChunks(videoIds, query);
        retrievalSpan?.end({
          output: this.toRetrievalOutput(retrievedChunks),
          metadata: { latencyMs: Date.now() - retrievalStarted }
        });
      } catch (error) {
        retrievalSpan?.end({
          level: 'ERROR',
          statusMessage: error instanceof Error ? error.message : String(error),
          metadata: { latencyMs: Date.now() - retrievalStarted }
        });
        throw error;
      }

      const selectedChunks = retrievedChunks.slice(0, 4);
      if (selectedChunks.length === 0) {
        return this.fallbackAnswer(mode, resolvedModel, obs);
      }

      const prompt = `Summarize the following transcript context in bullet points and keep it grounded.\n\n${selectedChunks
        .map((chunk) => `- [${chunk.startTime}-${chunk.endTime}] ${chunk.content}`)
        .join('\n')}`;

      const promptSpan = obs?.startSpan('prompt_assembly', { mode }, { chunkCount: selectedChunks.length });
      promptSpan?.end({ output: { prompt } });

      const result = await this.gateway.chat([{ role: 'user', content: prompt }], {
        model: resolvedModel,
        temperature: 0.2,
        observability: obs
      });
      return {
        answer: result.content,
        citations: this.toCitations(selectedChunks),
        confidence: 0.9,
        mode,
        needsClarification: false,
        modelUsed: result.modelUsed
      };
    }

    let currentQuery = query;
    let retrievedChunks: RetrievedChunk[] = [];
    let rewritten = false;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const retrievalSpan = obs?.startSpan(
        'retrieval',
        { query: currentQuery, videoIds, mode, attempt, rewritten },
        { attempt }
      );
      const retrievalStarted = Date.now();
      try {
        retrievedChunks = await this.ragService.retrieveRelevantChunks(videoIds, currentQuery);
      } catch (error) {
        retrievalSpan?.end({
          level: 'ERROR',
          statusMessage: error instanceof Error ? error.message : String(error),
          metadata: { latencyMs: Date.now() - retrievalStarted }
        });
        throw error;
      }

      const grade = this.ragService.gradeContext(retrievedChunks);
      retrievalSpan?.end({
        output: this.toRetrievalOutput(retrievedChunks, grade),
        metadata: { latencyMs: Date.now() - retrievalStarted, grade, rewritten }
      });

      if (retrievedChunks.length === 0 || grade === 'none') {
        return this.fallbackAnswer(mode, resolvedModel, obs);
      }

      if (grade === 'low' && !rewritten) {
        obs?.event('query_rewrite', {
          originalQuery: query,
          rewrittenQuery: `${currentQuery} Provide the most directly matching answer using transcript evidence.`
        });
        currentQuery = `${currentQuery} Provide the most directly matching answer using transcript evidence.`;
        rewritten = true;
        continue;
      }

      const prompt = `Answer the user question using only the transcript context. If the answer is not present, say so.\n\nQuestion: ${currentQuery}\n\nContext:\n${retrievedChunks
        .map((chunk) => `- [${chunk.startTime}-${chunk.endTime}] ${chunk.content}`)
        .join('\n')}`;

      const promptSpan = obs?.startSpan(
        'prompt_assembly',
        { mode, query: currentQuery },
        { chunkCount: retrievedChunks.length, grade, rewritten }
      );
      promptSpan?.end({ output: { prompt } });

      const result = await this.gateway.chat([{ role: 'user', content: prompt }], {
        model: resolvedModel,
        temperature: 0.2,
        observability: obs
      });

      return {
        answer: result.content,
        citations: this.toCitations(retrievedChunks),
        confidence: grade === 'high' ? 0.9 : 0.5,
        mode,
        needsClarification: grade === 'low',
        modelUsed: result.modelUsed
      };
    }

    return this.fallbackAnswer(mode, resolvedModel, obs);
  }
}
