import { Injectable } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { accessSync, constants, readdirSync, rmSync, statSync } from 'node:fs';
import { mkdir, readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { SourceType } from '../../database';

const execFileAsync = promisify(execFile);

export interface VideoMetadata {
  title: string | null;
  thumbnailUrl: string | null;
}

@Injectable()
export class MediaService {
  constructor(private readonly root: string) {}

  /**
   * Best-effort title/thumbnail extraction. For YouTube we use yt-dlp's JSON dump;
   * for direct/upload sources we derive a human-friendly title from the URL/filename.
   */
  async extractMetadata(sourceUrl: string, sourceType: SourceType): Promise<VideoMetadata> {
    if (sourceType === SourceType.youtube) {
      try {
        const { stdout } = await execFileAsync('yt-dlp', [
          '--dump-single-json',
          '--skip-download',
          '--no-warnings',
          sourceUrl
        ]);
        const info = JSON.parse(stdout.toString()) as {
          title?: string;
          thumbnail?: string;
          thumbnails?: Array<{ url?: string }>;
        };
        const thumbnail =
          info.thumbnail ?? info.thumbnails?.[info.thumbnails.length - 1]?.url ?? null;
        return { title: info.title ?? null, thumbnailUrl: thumbnail };
      } catch {
        return { title: null, thumbnailUrl: null };
      }
    }

    return { title: deriveTitleFromUrl(sourceUrl), thumbnailUrl: null };
  }

  async ensureVideoDownloaded(
    videoId: string,
    sourceUrl: string,
    sourceType: SourceType,
    sourcePath?: string | null
  ) {
    const workDir = path.join(this.root, 'videos', videoId);
    await mkdir(workDir, { recursive: true });

    if (sourceType === SourceType.upload && sourcePath) {
      return { workDir, mediaPath: sourcePath };
    }

    const outputPath = path.join(workDir, sourceType === SourceType.youtube ? 'source.m4a' : 'source.bin');

    if (sourceType === SourceType.youtube) {
      await execFileAsync('yt-dlp', ['-f', 'bestaudio', '-o', outputPath, sourceUrl]);
      return { workDir, mediaPath: outputPath };
    }

    await execFileAsync('curl', ['-L', sourceUrl, '-o', outputPath]);
    return { workDir, mediaPath: outputPath };
  }

  /**
   * Extract mono 16 kHz PCM WAV for local whisper.cpp.
   */
  async extractAudio(workDir: string, mediaPath: string) {
    const audioPath = path.join(workDir, 'audio.wav');
    await execFileAsync('ffmpeg', [
      '-y',
      '-i',
      mediaPath,
      '-vn',
      '-ac',
      '1',
      '-ar',
      '16000',
      '-c:a',
      'pcm_s16le',
      audioPath
    ]);
    return audioPath;
  }

  /**
   * Convert any audio/video file to 16 kHz mono WAV under a temp directory.
   */
  async convertToWav(inputPath: string, outputDir: string, basename = 'audio'): Promise<string> {
    await mkdir(outputDir, { recursive: true });
    const wavPath = path.join(outputDir, `${basename}.wav`);
    await execFileAsync('ffmpeg', [
      '-y',
      '-i',
      inputPath,
      '-vn',
      '-ac',
      '1',
      '-ar',
      '16000',
      '-c:a',
      'pcm_s16le',
      wavPath
    ]);
    return wavPath;
  }

  /**
   * Read the embedded title tag from a media file's container metadata, if present.
   */
  async extractMediaTitle(mediaPath: string): Promise<string | null> {
    try {
      const { stdout } = await execFileAsync('ffprobe', [
        '-v',
        'error',
        '-show_entries',
        'format_tags=title',
        '-of',
        'default=nw=1:nk=1',
        mediaPath
      ]);
      const title = stdout.toString().trim();
      return title.length > 0 ? title : null;
    } catch {
      return null;
    }
  }

  async getAudioDurationSeconds(audioPath: string): Promise<number> {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'csv=p=0',
      audioPath
    ]);
    const duration = Number.parseFloat(stdout.toString().trim());
    if (!Number.isFinite(duration) || duration <= 0) {
      throw new Error(`Unable to read audio duration for ${audioPath}`);
    }
    return duration;
  }

  async cleanupPaths(paths: string[]): Promise<void> {
    for (const target of paths) {
      try {
        const stats = statSync(target);
        if (stats.isDirectory()) {
          rmSync(target, { recursive: true, force: true });
        } else {
          await unlink(target);
        }
      } catch {
        // Ignore missing temp files during cleanup.
      }
    }
  }

  listFiles(dir: string, prefix: string, suffix: string): string[] {
    try {
      return readdirSync(dir)
        .filter((name) => name.startsWith(prefix) && name.endsWith(suffix))
        .sort()
        .map((name) => path.join(dir, name));
    } catch {
      return [];
    }
  }
}

export const deriveTitleFromUrl = (sourceUrl: string): string | null => {
  try {
    if (sourceUrl.startsWith('upload://')) {
      const name = decodeURIComponent(sourceUrl.replace('upload://', ''));
      return cleanTitle(name) || null;
    }
    const url = new URL(sourceUrl);
    const last = url.pathname.split('/').filter(Boolean).pop();
    if (last) return cleanTitle(decodeURIComponent(last)) || url.hostname;
    return url.hostname;
  } catch {
    return null;
  }
};

const stripExtension = (value: string): string => value.replace(/\.[^./\\]+$/, '');

const cleanTitle = (value: string): string =>
  stripExtension(value)
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const assertPathExists = (targetPath: string, label: string) => {
  try {
    accessSync(targetPath, constants.F_OK);
  } catch {
    throw new Error(`${label} not found at "${targetPath}". Check WHISPER_BIN_PATH / WHISPER_MODEL_PATH.`);
  }
};

export const readJsonFile = async <T>(filePath: string): Promise<T> => {
  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw) as T;
};
