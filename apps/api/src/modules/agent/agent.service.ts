import { Injectable } from '@nestjs/common';
import { createLlmGatewayFromEnv, type LlmGateway } from '../../shared';
import { getEnv } from '../../config/env';
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
};

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

  async answerQuestion(videoIds: string[], query: string, model?: string): Promise<AgentAnswer> {
    const resolvedModel = this.gateway.resolveModel(model);
    const mode = /summary|highlight|key points/i.test(query) ? 'summary' : 'qa';

    if (mode === 'summary') {
      const retrievedChunks = await this.ragService.retrieveRelevantChunks(videoIds, query);
      const selectedChunks = retrievedChunks.slice(0, 4);
      if (selectedChunks.length === 0) {
        return {
          answer: 'I could not find grounded transcript evidence for that question yet.',
          citations: [] as Citation[],
          confidence: 0.1,
          mode,
          needsClarification: false,
          modelUsed: resolvedModel
        };
      }

      const prompt = `Summarize the following transcript context in bullet points and keep it grounded.\n\n${selectedChunks
        .map((chunk) => `- [${chunk.startTime}-${chunk.endTime}] ${chunk.content}`)
        .join('\n')}`;
      const result = await this.gateway.chat([{ role: 'user', content: prompt }], {
        model: resolvedModel,
        temperature: 0.2
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
      retrievedChunks = await this.ragService.retrieveRelevantChunks(videoIds, currentQuery);
      const grade = this.ragService.gradeContext(retrievedChunks);

      if (retrievedChunks.length === 0 || grade === 'none') {
        return {
          answer: 'I could not find grounded transcript evidence for that question yet.',
          citations: [] as Citation[],
          confidence: 0.1,
          mode,
          needsClarification: false,
          modelUsed: resolvedModel
        };
      }

      if (grade === 'low' && !rewritten) {
        currentQuery = `${currentQuery} Provide the most directly matching answer using transcript evidence.`;
        rewritten = true;
        continue;
      }

      const prompt = `Answer the user question using only the transcript context. If the answer is not present, say so.\n\nQuestion: ${currentQuery}\n\nContext:\n${retrievedChunks
        .map((chunk) => `- [${chunk.startTime}-${chunk.endTime}] ${chunk.content}`)
        .join('\n')}`;
      const result = await this.gateway.chat([{ role: 'user', content: prompt }], {
        model: resolvedModel,
        temperature: 0.2
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

    return {
      answer: 'I could not find grounded transcript evidence for that question yet.',
      citations: [] as Citation[],
      confidence: 0.1,
      mode,
      needsClarification: false,
      modelUsed: resolvedModel
    };
  }
}
