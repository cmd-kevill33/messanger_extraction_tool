import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { chromium, Browser, Page, WebSocket as PWWebSocket } from 'playwright';
import puppeteer, { Browser as PuppeteerBrowser, Page as PuppeteerPage } from 'puppeteer';
import { nanoid } from 'nanoid';
import { AppConfig } from '../config/defaults';
import { Logger } from '../utils/logger';
import { Storage, RawEventRecord, MessageRecord, AttachmentRecord, ThreadRecord } from './storage';
import { normalizeGraphQLEvent, CanonicalAttachment, CanonicalMessage } from './normalize';
import { SchemaManager } from './schema';
import { MediaDownloader } from './media';

export class CaptureManager {
  private browser: Browser | PuppeteerBrowser | null = null;
  private page: Page | PuppeteerPage | null = null;
  private usePuppeteer = false;
  private schemaManager: SchemaManager;
  private mediaDownloader: MediaDownloader;
  private threadCache: ThreadRecord[] = [];

  constructor(private config: AppConfig, private storage: Storage, private logger: Logger) {
    this.schemaManager = new SchemaManager(storage, logger);
    this.mediaDownloader = new MediaDownloader(config, logger);
  }

  async start(): Promise<void> {
    this.storage.init();
    this.logger.info('Starting capture session...');
    await this.launchBrowser();
    if (!this.page) throw new Error('Browser page was not initialized');

    await this.setupPage(this.page);
    if (this.config.selectThread) {
      await this.openMessagesRoot();
      await this.promptThreadSelection();
    }
    if (!this.config.threadId) {
      throw new Error('No thread ID available. Use --thread-id or --select-thread.');
    }
    await this.openThread(this.config.threadId);

    if (this.config.fullHistory) {
      await this.scrollHistoryToStart();
    }

    if (this.config.live) {
      this.logger.info('Live capture enabled. Listening for new events until stopped.');
      await this.waitForLiveCapture();
    } else {
      this.logger.info('Captured current window, waiting for final network commit.');
      await this.page.waitForTimeout(8000);
    }

    await this.teardown();
    this.logger.info('Capture session completed.');
  }

  private async launchBrowser(): Promise<void> {
    try {
      this.browser = await chromium.launch({ headless: this.config.headless, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
      this.usePuppeteer = false;
      this.logger.info('Playwright browser launched successfully.');
    } catch (primaryError) {
      this.logger.warn(`Playwright launch failed, falling back to Puppeteer: ${String(primaryError)}`);
      this.browser = await puppeteer.launch({ headless: this.config.headless, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
      this.usePuppeteer = true;
      this.logger.info('Puppeteer browser launched successfully.');
    }
  }

  private async newPage(): Promise<Page | PuppeteerPage> {
    if (!this.browser) throw new Error('Browser is not initialized');
    return this.usePuppeteer ? await (this.browser as PuppeteerBrowser).newPage() : await (this.browser as Browser).newPage();
  }

  private async setupPage(page: Page | PuppeteerPage): Promise<void> {
    this.page = page;
    if (!this.usePuppeteer && (page as Page).route) {
      await (page as Page).route('**/api/graphql/*', (route) => route.continue());
      (page as Page).on('response', async (response) => this.handleResponse(response));
      (page as Page).on('websocket', (ws: PWWebSocket) => this.attachWebSocketListener(ws));
    } else {
      (page as PuppeteerPage).on('response', async (response) => this.handlePuppeteerResponse(response));
    }
  }

  private async handleResponse(response: any): Promise<void> {
    try {
      const url = response.url();
      if (!url.includes('/api/graphql')) return;
      const request = response.request();
      const requestData = this.parseRequestData(request.postData());
      const operationName = requestData?.operationName || requestData?.doc_id || requestData?.query || 'graphql';
      const json = await response.json().catch(() => null);
      if (!json) return;
      const rawEvent: RawEventRecord = {
        id: nanoid(),
        threadId: this.config.threadId || String(requestData?.variables?.thread_id || requestData?.variables?.threadID || ''),
        operation: String(operationName),
        payload: json,
        timestamp: Date.now(),
      };
      this.processEvent(rawEvent);
    } catch (error) {
      this.logger.debug(`Failed to process Playwright response: ${String(error)}`);
    }
  }

  private async handlePuppeteerResponse(response: any): Promise<void> {
    try {
      const url = response.url();
      if (!url.includes('/api/graphql')) return;
      const request = response.request();
      const requestData = this.parseRequestData(request.postData());
      const operationName = requestData?.operationName || requestData?.doc_id || requestData?.query || 'graphql';
      const json = await response.json().catch(() => null);
      if (!json) return;
      const rawEvent: RawEventRecord = {
        id: nanoid(),
        threadId: this.config.threadId || String(requestData?.variables?.thread_id || requestData?.variables?.threadID || ''),
        operation: String(operationName),
        payload: json,
        timestamp: Date.now(),
      };
      this.processEvent(rawEvent);
    } catch (error) {
      this.logger.debug(`Failed to process Puppeteer response: ${String(error)}`);
    }
  }

  private attachWebSocketListener(ws: PWWebSocket): void {
    ws.on('framereceived', async (frame) => {
      try {
        const payload = JSON.parse(frame.payload.toString());
        const operation = payload?.type || payload?.op || 'websocket';
        const rawEvent: RawEventRecord = {
          id: nanoid(),
          threadId: this.config.threadId || String(payload?.thread_id || payload?.threadId || ''),
          operation: String(operation),
          payload,
          timestamp: Date.now(),
        };
        this.processEvent(rawEvent);
      } catch (error) {
        this.logger.debug(`WebSocket frame parse error: ${String(error)}`);
      }
    });
  }

  private parseRequestData(postData: string | null): any {
    if (!postData) return null;
    try {
      return JSON.parse(postData);
    } catch {
      return null;
    }
  }

  private processEvent(rawEvent: RawEventRecord): void {
    this.storage.insertRawEvent(rawEvent);
    try {
      this.schemaManager.track(rawEvent.operation, rawEvent.payload);
    } catch (error) {
      this.logger.debug(`Schema tracking skipped: ${String(error)}`);
    }
    const normalized = normalizeGraphQLEvent(rawEvent);
    normalized.forEach(async (item) => {
      if (item.type === 'thread') {
        const thread = item.payload as ThreadRecord;
        this.storage.insertThread(thread);
        this.threadCache = this.storage.getThreads();
      }
      if (item.type === 'message') {
        const message = item.payload as CanonicalMessage;
        const record: MessageRecord = {
          id: message.id,
          threadId: message.threadId,
          senderId: message.senderId,
          senderName: message.senderName,
          timestamp: message.timestamp,
          content: message.content,
          contentHash: message.contentHash,
          metadata: message.metadata,
        };
        this.storage.insertMessage(record);
        for (const attachment of message.attachments) {
          const downloaded = await this.mediaDownloader.downloadAttachment(attachment);
          const attachmentRecord: AttachmentRecord = {
            id: attachment.id,
            messageId: message.id,
            threadId: message.threadId,
            type: attachment.type,
            url: attachment.url,
            localPath: downloaded?.localPath || '',
            checksum: downloaded?.checksum || '',
            metadata: attachment.metadata || {},
          };
          this.storage.insertAttachment(attachmentRecord);
        }
      }
    });
  }

  private async openMessagesRoot(): Promise<void> {
    if (!this.page) return;
    const url = 'https://www.facebook.com/messages';
    this.logger.info(`Opening messenger root at ${url}`);
    if (this.usePuppeteer) {
      await (this.page as PuppeteerPage).goto(url, { waitUntil: 'networkidle2' });
    } else {
      await (this.page as Page).goto(url, { waitUntil: 'networkidle' });
    }
    await this.page.waitForTimeout(7000);
  }

  private async promptThreadSelection(): Promise<void> {
    this.threadCache = this.storage.getThreads();
    if (this.threadCache.length === 0) {
      this.logger.warn('Thread list has not been discovered yet. Please sign in to Messenger and allow thread list to load.');
      await this.page?.waitForTimeout(8000);
      this.threadCache = this.storage.getThreads();
    }
    if (this.threadCache.length === 0) {
      throw new Error('No threads found. Ensure Facebook Messenger is reachable and that you are logged in.');
    }
    this.logger.info(`Found ${this.threadCache.length} threads in captured network traffic.`);
    this.threadCache.slice(0, 12).forEach((thread, index) => {
      console.log(`${index + 1}. ${thread.name} (${thread.id})`);
    });
    const selected = await this.askForChoice(this.threadCache.length);
    this.config.threadId = this.threadCache[selected - 1].id;
    this.logger.info(`Selected thread ${this.config.threadId}`);
  }

  private askForChoice(max: number): Promise<number> {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
      rl.question(`Choose a thread by number (1-${max}): `, (answer) => {
        rl.close();
        const index = Number(answer);
        if (Number.isNaN(index) || index < 1 || index > max) {
          resolve(1);
        } else {
          resolve(index);
        }
      });
    });
  }

  private async openThread(threadId: string): Promise<void> {
    if (!this.page) return;
    const url = `https://www.facebook.com/messages/t/${threadId}`;
    this.logger.info(`Opening thread URL ${url}`);
    if (this.usePuppeteer) {
      await (this.page as PuppeteerPage).goto(url, { waitUntil: 'networkidle2' });
    } else {
      await (this.page as Page).goto(url, { waitUntil: 'networkidle' });
    }
    await this.page.waitForTimeout(6000);
  }

  private async scrollHistoryToStart(): Promise<void> {
    if (!this.page) return;
    this.logger.info('Beginning full-history capture by scrolling to the earliest message.');
    let round = 0;
    let lastHeight = -1;
    while (round < 25) {
      if (this.usePuppeteer) {
        await (this.page as PuppeteerPage).evaluate(() => window.scrollBy(0, -2000));
      } else {
        await (this.page as Page).evaluate(() => window.scrollBy(0, -2000));
      }
      await this.page.waitForTimeout(1200);
      const currentHeight = await (this.page as any).evaluate(() => document.documentElement.scrollHeight);
      if (currentHeight === lastHeight) break;
      lastHeight = currentHeight;
      round += 1;
      this.logger.debug(`Scroll pass ${round} complete`);
    }
    this.logger.info('Full history scroll completed.');
  }

  private async waitForLiveCapture(): Promise<void> {
    if (!this.page) return;
    if (this.usePuppeteer) {
      await (this.page as PuppeteerPage).waitForTimeout(300000);
    } else {
      await (this.page as Page).waitForTimeout(300000);
    }
  }

  private async teardown(): Promise<void> {
    try {
      await this.page?.close();
      if (this.browser) {
        if (this.usePuppeteer) {
          await (this.browser as PuppeteerBrowser).close();
        } else {
          await (this.browser as Browser).close();
        }
      }
    } catch (error) {
      this.logger.warn(`Error closing browser: ${String(error)}`);
    }
  }
}
