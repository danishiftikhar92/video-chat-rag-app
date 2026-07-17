import { execFile } from 'node:child_process';
import { accessSync, constants } from 'node:fs';
import { mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { getEnv } from '../config/env';
import { MediaService } from '../services/media.service';

const execFileAsync = promisify(execFile);

type TranscriptSegment = {
  text: string;
  startTime: number;
  endTime: number;
  confidence?: number;
};

type WhisperJsonOutput = {
  transcription?: Array<{
    text?: string;
    offsets?: { from?: number; to?: number };
    timestamps?: { from?: string; to?: string };
  }>;
  text?: string;
  result?: {
    language?: string;
  };
  language?: string;
};

export interface TranscriptionProvider {
  transcribe(audioPath: string): Promise<{ rawText: string; language: string; segments: TranscriptSegment[] }>;
}

class MockTranscriptionProvider implements TranscriptionProvider {
  async transcribe(): Promise<{ rawText: string; language: string; segments: TranscriptSegment[] }> {
    const text =
      'Mock transcript. Replace with local whisper.cpp by setting TRANSCRIPTION_PROVIDER=whispercpp and configuring WHISPER_BIN_PATH / WHISPER_MODEL_PATH.';
    return {
      rawText: text,
      language: 'en',
      segments: [{ text, startTime: 0, endTime: 10, confidence: 0.8 }]
    };
  }
}

class WhisperCppTranscriptionProvider implements TranscriptionProvider {
  private readonly media = new MediaService(getEnv().LOCAL_STORAGE_ROOT);

  private assertConfigured() {
    const env = getEnv();
    try {
      accessSync(env.WHISPER_BIN_PATH, constants.X_OK);
    } catch {
      try {
        accessSync(env.WHISPER_BIN_PATH, constants.F_OK);
      } catch {
        throw new Error(
          `whisper.cpp binary not found at "${env.WHISPER_BIN_PATH}". Build whisper.cpp and set WHISPER_BIN_PATH.`
        );
      }
    }

    try {
      accessSync(env.WHISPER_MODEL_PATH, constants.F_OK);
    } catch {
      throw new Error(
        `Whisper model not found at "${env.WHISPER_MODEL_PATH}". Download ggml-base.bin (or similar) and set WHISPER_MODEL_PATH.`
      );
    }
  }

  private parseTimestamp(value?: string): number | null {
    if (!value) return null;
    const match = value.trim().match(/^(?:(\d+):)?(\d{2}):(\d{2})(?:\.(\d+))?$/);
    if (!match) return null;
    const hours = Number(match[1] ?? 0);
    const minutes = Number(match[2]);
    const seconds = Number(match[3]);
    const fraction = match[4] ? Number(`0.${match[4]}`) : 0;
    return hours * 3600 + minutes * 60 + seconds + fraction;
  }

  private mapSegments(payload: WhisperJsonOutput): TranscriptSegment[] {
    const rows = payload.transcription ?? [];
    const segments: TranscriptSegment[] = [];

    for (const row of rows) {
      const text = (row.text ?? '').trim();
      if (!text) continue;

      const startFromMs = row.offsets?.from;
      const endFromMs = row.offsets?.to;
      const startTime =
        typeof startFromMs === 'number'
          ? startFromMs / 1000
          : this.parseTimestamp(row.timestamps?.from) ?? 0;
      const endTime =
        typeof endFromMs === 'number'
          ? endFromMs / 1000
          : this.parseTimestamp(row.timestamps?.to) ?? startTime;

      segments.push({
        text,
        startTime,
        endTime: Math.max(endTime, startTime),
        confidence: 0.9
      });
    }

    return segments;
  }

  private async readWhisperOutput(outputBase: string): Promise<WhisperJsonOutput> {
    const candidates = [`${outputBase}.json`, `${outputBase}.wav.json`, `${outputBase}`];
    for (const candidate of candidates) {
      try {
        const raw = await readFile(candidate, 'utf8');
        return JSON.parse(raw) as WhisperJsonOutput;
      } catch {
        // try next candidate
      }
    }
    throw new Error(`whisper.cpp did not produce a JSON transcript near "${outputBase}"`);
  }

  async transcribe(audioPath: string): Promise<{ rawText: string; language: string; segments: TranscriptSegment[] }> {
    this.assertConfigured();
    const env = getEnv();
    const tempDir = path.join(env.AUDIO_TEMP_DIR, `whisper-${randomUUID()}`);
    const cleanupTargets = [tempDir];

    try {
      await mkdir(tempDir, { recursive: true });
      const wavPath = await this.media.convertToWav(audioPath, tempDir, 'input');
      const outputBase = path.join(tempDir, 'transcript');

      // whisper.cpp CLI: write JSON next to -of output base
      await execFileAsync(
        env.WHISPER_BIN_PATH,
        [
          '-m',
          env.WHISPER_MODEL_PATH,
          '-f',
          wavPath,
          '-of',
          outputBase,
          '-oj',
          '-l',
          'auto'
        ],
        {
          maxBuffer: 32 * 1024 * 1024
        }
      );

      const payload = await this.readWhisperOutput(outputBase);
      const segments = this.mapSegments(payload);
      const rawText =
        (payload.text ?? '').trim() ||
        segments
          .map((segment) => segment.text)
          .join(' ')
          .trim();
      const language = payload.result?.language ?? payload.language ?? 'unknown';

      if (!rawText) {
        throw new Error('whisper.cpp returned an empty transcript');
      }

      return {
        rawText,
        language,
        segments:
          segments.length > 0
            ? segments
            : [{ text: rawText, startTime: 0, endTime: 0, confidence: 0.8 }]
      };
    } finally {
      await Promise.all(
        cleanupTargets.map(async (target) => {
          try {
            await rm(target, { recursive: true, force: true });
          } catch {
            // best-effort cleanup
          }
        })
      );
    }
  }
}

export const createTranscriptionProvider = (): TranscriptionProvider => {
  const env = getEnv();
  switch (env.TRANSCRIPTION_PROVIDER) {
    case 'mock':
      return new MockTranscriptionProvider();
    case 'whispercpp':
      return new WhisperCppTranscriptionProvider();
    default:
      throw new Error(`Unsupported transcription provider: ${env.TRANSCRIPTION_PROVIDER}`);
  }
};
