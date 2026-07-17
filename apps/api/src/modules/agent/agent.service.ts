import { Injectable } from '@nestjs/common';
import { createOllamaClientFromEnv } from '@video-rag/shared';
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

@Injectable()
export class AgentService {
  private readonly ollama = createOllamaClientFromEnv(getEnv());

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

  async answerQuestion(videoIds: string[], query: string) {
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
          needsClarification: false
        };
      }

      const prompt = `Summarize the following transcript context in bullet points and keep it grounded.\n\n${selectedChunks
        .map((chunk) => `- [${chunk.startTime}-${chunk.endTime}] ${chunk.content}`)
        .join('\n')}`;
      const answer = await this.ollama.chat(prompt, { temperature: 0.2 });
      return {
        answer,
        citations: this.toCitations(selectedChunks),
        confidence: 0.9,
        mode,
        needsClarification: false
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
          needsClarification: false
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
      const answer = await this.ollama.chat(prompt, { temperature: 0.2 });

      return {
        answer,
        citations: this.toCitations(retrievedChunks),
        confidence: grade === 'high' ? 0.9 : 0.5,
        mode,
        needsClarification: grade === 'low'
      };
    }

    return {
      answer: 'I could not find grounded transcript evidence for that question yet.',
      citations: [] as Citation[],
      confidence: 0.1,
      mode,
      needsClarification: false
    };
  }
}
