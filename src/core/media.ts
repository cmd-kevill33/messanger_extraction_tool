import fs from 'fs';
import path from 'path';
import axios, { AxiosResponse } from 'axios';
import { Logger } from '../utils/logger';
import { AppConfig } from '../config/defaults';

export interface MediaResult {
  localPath: string;
  checksum: string;
  sourceUrl: string;
}

export interface AttachmentMetadata {
  id: string;
  type: string;
  url: string;
  filename?: string;
  metadata?: any;
}

export class MediaDownloader {
  private active = 0;
  private queue: Array<() => Promise<void>> = [];

  constructor(private config: AppConfig, private logger: Logger) {}

  async downloadAttachment(attachment: AttachmentMetadata): Promise<MediaResult | null> {
    if (!attachment.url) {
      this.logger.warn(`Attachment ${attachment.id} has no URL, skipping download.`);
      return null;
    }

    const fileName = attachment.filename || `${attachment.id}.${this.guessExtension(attachment.type, attachment.url)}`;
    const localPath = path.join(this.config.mediaDir, fileName.replace(/[\s\/:*?"<>|]+/g, '_'));
    const job = async (): Promise<MediaResult | null> => {
      try {
        return await this.tryDownload(attachment.url, localPath, attachment);
      } catch (error) {
        this.logger.warn(`Failed to download ${attachment.url}: ${String(error)}`);
        const fallbackUrl = attachment.metadata?.fallback_url || attachment.metadata?.uri;
        if (fallbackUrl && fallbackUrl !== attachment.url) {
          this.logger.info(`Attempting fallback URL for attachment ${attachment.id}`);
          return await this.tryDownload(fallbackUrl, localPath, attachment);
        }
        return null;
      }
    };

    return await this.enqueue(job);
  }

  private async enqueue(task: () => Promise<MediaResult | null>): Promise<MediaResult | null> {
    return new Promise((resolve) => {
      this.queue.push(async () => {
        this.active += 1;
        const result = await task();
        this.active -= 1;
        resolve(result);
      });
      if (this.active === 0) {
        this.processQueue();
      }
    });
  }

  private async processQueue(): Promise<void> {
    while (this.queue.length > 0) {
      const next = this.queue.shift();
      if (next) await next();
    }
  }

  private async tryDownload(url: string, localPath: string, attachment: AttachmentMetadata): Promise<MediaResult> {
    let attempt = 0;
    const maxAttempts = 3;
    while (attempt < maxAttempts) {
      try {
        attempt += 1;
        const response: AxiosResponse<ArrayBuffer> = await axios.get(url, {
          responseType: 'arraybuffer',
          timeout: 20000,
          headers: {
            'User-Agent': 'orpheus-echo/1.0',
            Accept: '*/*',
          },
        });
        const buffer = Buffer.from(response.data);
        fs.writeFileSync(localPath, buffer);
        const checksum = this.hashBuffer(buffer);
        this.logger.info(`Downloaded media ${attachment.id} to ${localPath}`);
        return { localPath, checksum, sourceUrl: url };
      } catch (error) {
        const delay = Math.pow(2, attempt) * 500;
        this.logger.warn(`Download attempt ${attempt} failed for ${url}, retrying after ${delay}ms`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    throw new Error(`Failed to download attachment ${attachment.id} after ${maxAttempts} attempts`);
  }

  private hashBuffer(data: Buffer): string {
    return require('crypto').createHash('sha256').update(data).digest('hex');
  }

  private guessExtension(type: string, url: string): string {
    const normalized = type.toLowerCase();
    if (normalized.includes('image')) return 'jpg';
    if (normalized.includes('video')) return 'mp4';
    if (normalized.includes('audio')) return 'mp3';
    if (url.includes('.png')) return 'png';
    if (url.includes('.webp')) return 'webp';
    if (url.includes('.mp4')) return 'mp4';
    return 'bin';
  }
}
