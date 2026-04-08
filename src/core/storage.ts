import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { Logger } from '../utils/logger';
import { AppConfig } from '../config/defaults';

export interface RawEventRecord {
  id: string;
  threadId: string;
  operation: string;
  payload: any;
  timestamp: number;
}

export interface ThreadRecord {
  id: string;
  name: string;
  participants: string[];
  lastActivity: number;
  metadata: any;
}

export interface MessageRecord {
  id: string;
  threadId: string;
  senderId: string;
  senderName: string;
  timestamp: number;
  content: string;
  contentHash: string;
  metadata: any;
}

export interface AttachmentRecord {
  id: string;
  messageId: string;
  threadId: string;
  type: string;
  url: string;
  localPath: string;
  checksum: string;
  metadata: any;
}

export interface AuditRecord {
  id: string;
  threadId: string;
  type: string;
  severity: 'INFO' | 'WARN' | 'ERROR';
  message: string;
  createdAt: number;
}

export class Storage {
  public db: Database.Database | null = null;
  public jsonMode = false;
  private rawJsonPath: string;
  private metaJsonPath: string;
  protected fallbackStore: {
    rawEvents: RawEventRecord[];
    threads: ThreadRecord[];
    messages: MessageRecord[];
    attachments: AttachmentRecord[];
    audits: AuditRecord[];
    schemaVersions: any[];
  };

  constructor(public config: AppConfig, private logger: Logger) {
    this.rawJsonPath = path.join(this.config.outputDir, 'raw-events.json');
    this.metaJsonPath = path.join(this.config.outputDir, 'store.json');
    this.fallbackStore = {
      rawEvents: [],
      threads: [],
      messages: [],
      attachments: [],
      audits: [],
      schemaVersions: [],
    };
  }

  init(): void {
    fs.mkdirSync(this.config.outputDir, { recursive: true });
    fs.mkdirSync(this.config.mediaDir, { recursive: true });
    try {
      this.db = new Database(this.config.dbFile, { verbose: (message: any) => this.logger.debug(String(message)) });
      this.createSchema();
      this.logger.info(`SQLite initialized at ${this.config.dbFile}`);
    } catch (error) {
      this.jsonMode = true;
      this.logger.warn(`SQLite initialization failed, falling back to JSON storage: ${String(error)}`);
      this.saveJsonStore();
    }
  }

  private createSchema(): void {
    if (!this.db) return;
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS raw_events (
        id TEXT PRIMARY KEY,
        thread_id TEXT,
        operation TEXT,
        payload TEXT,
        timestamp INTEGER
      );
      CREATE TABLE IF NOT EXISTS threads (
        id TEXT PRIMARY KEY,
        name TEXT,
        participants TEXT,
        last_activity INTEGER,
        metadata TEXT
      );
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        thread_id TEXT,
        sender_id TEXT,
        sender_name TEXT,
        timestamp INTEGER,
        content TEXT,
        content_hash TEXT,
        metadata TEXT
      );
      CREATE TABLE IF NOT EXISTS attachments (
        id TEXT PRIMARY KEY,
        message_id TEXT,
        thread_id TEXT,
        type TEXT,
        url TEXT,
        local_path TEXT,
        checksum TEXT,
        metadata TEXT
      );
      CREATE TABLE IF NOT EXISTS schema_versions (
        operation_name TEXT PRIMARY KEY,
        field_snapshot TEXT,
        example_payload TEXT,
        detected_at INTEGER
      );
      CREATE TABLE IF NOT EXISTS audits (
        id TEXT PRIMARY KEY,
        thread_id TEXT,
        type TEXT,
        severity TEXT,
        message TEXT,
        created_at INTEGER
      );
    `);
  }

  saveJsonStore(): void {
    fs.writeFileSync(this.metaJsonPath, JSON.stringify(this.fallbackStore, null, 2));
  }

  insertRawEvent(event: RawEventRecord): void {
    if (this.jsonMode) {
      this.fallbackStore.rawEvents.push(event);
      this.saveJsonStore();
      fs.writeFileSync(this.rawJsonPath, JSON.stringify(this.fallbackStore.rawEvents, null, 2));
      return;
    }
    if (!this.db) return;
    const stmt = this.db.prepare(`INSERT OR IGNORE INTO raw_events (id, thread_id, operation, payload, timestamp) VALUES (@id, @threadId, @operation, @payload, @timestamp)`);
    stmt.run({
      id: event.id,
      threadId: event.threadId,
      operation: event.operation,
      payload: JSON.stringify(event.payload),
      timestamp: event.timestamp,
    });
  }

  insertThread(thread: ThreadRecord): void {
    if (this.jsonMode) {
      const existing = this.fallbackStore.threads.find(item => item.id === thread.id);
      if (!existing) this.fallbackStore.threads.push(thread);
      this.saveJsonStore();
      return;
    }
    if (!this.db) return;
    const stmt = this.db.prepare(`INSERT OR REPLACE INTO threads (id, name, participants, last_activity, metadata) VALUES (@id, @name, @participants, @lastActivity, @metadata)`);
    stmt.run({
      id: thread.id,
      name: thread.name,
      participants: JSON.stringify(thread.participants || []),
      lastActivity: thread.lastActivity,
      metadata: JSON.stringify(thread.metadata || {}),
    });
  }

  insertMessage(message: MessageRecord): void {
    if (this.jsonMode) {
      const existing = this.fallbackStore.messages.find(item => item.id === message.id);
      if (!existing) this.fallbackStore.messages.push(message);
      this.saveJsonStore();
      return;
    }
    if (!this.db) return;
    const stmt = this.db.prepare(`INSERT OR IGNORE INTO messages (id, thread_id, sender_id, sender_name, timestamp, content, content_hash, metadata) VALUES (@id, @threadId, @senderId, @senderName, @timestamp, @content, @contentHash, @metadata)`);
    stmt.run({
      id: message.id,
      threadId: message.threadId,
      senderId: message.senderId,
      senderName: message.senderName,
      timestamp: message.timestamp,
      content: message.content,
      contentHash: message.contentHash,
      metadata: JSON.stringify(message.metadata || {}),
    });
  }

  insertAttachment(record: AttachmentRecord): void {
    if (this.jsonMode) {
      const existing = this.fallbackStore.attachments.find(item => item.id === record.id);
      if (!existing) this.fallbackStore.attachments.push(record);
      this.saveJsonStore();
      return;
    }
    if (!this.db) return;
    const stmt = this.db.prepare(`INSERT OR IGNORE INTO attachments (id, message_id, thread_id, type, url, local_path, checksum, metadata) VALUES (@id, @messageId, @threadId, @type, @url, @localPath, @checksum, @metadata)`);
    stmt.run({
      id: record.id,
      messageId: record.messageId,
      threadId: record.threadId,
      type: record.type,
      url: record.url,
      localPath: record.localPath,
      checksum: record.checksum,
      metadata: JSON.stringify(record.metadata || {}),
    });
  }

  insertSchemaVersion(operationName: string, fieldSnapshot: any, examplePayload: any): void {
    if (this.jsonMode) {
      const existing = this.fallbackStore.schemaVersions.find(item => item.operationName === operationName);
      if (!existing) {
        this.fallbackStore.schemaVersions.push({ operationName, fieldSnapshot, examplePayload, detectedAt: Date.now() });
        this.saveJsonStore();
      }
      return;
    }
    if (!this.db) return;
    const stmt = this.db.prepare(`INSERT OR REPLACE INTO schema_versions (operation_name, field_snapshot, example_payload, detected_at) VALUES (@operationName, @fieldSnapshot, @examplePayload, @detectedAt)`);
    stmt.run({
      operationName,
      fieldSnapshot: JSON.stringify(fieldSnapshot),
      examplePayload: JSON.stringify(examplePayload),
      detectedAt: Date.now(),
    });
  }

  insertAudit(audit: AuditRecord): void {
    if (this.jsonMode) {
      this.fallbackStore.audits.push(audit);
      this.saveJsonStore();
      return;
    }
    if (!this.db) return;
    const stmt = this.db.prepare(`INSERT OR IGNORE INTO audits (id, thread_id, type, severity, message, created_at) VALUES (@id, @threadId, @type, @severity, @message, @createdAt)`);
    stmt.run({
      id: audit.id,
      threadId: audit.threadId,
      type: audit.type,
      severity: audit.severity,
      message: audit.message,
      createdAt: audit.createdAt,
    });
  }

  getThreads(): ThreadRecord[] {
    if (this.jsonMode) {
      return this.fallbackStore.threads;
    }
    if (!this.db) return [];
    const rows = this.db.prepare(`SELECT * FROM threads ORDER BY last_activity DESC`).all() as any[];
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      participants: JSON.parse(row.participants || '[]'),
      lastActivity: row.last_activity,
      metadata: JSON.parse(row.metadata || '{}'),
    }));
  }

  getMessages(threadId: string): MessageRecord[] {
    if (this.jsonMode) {
      return this.fallbackStore.messages.filter(message => message.threadId === threadId).sort((a, b) => a.timestamp - b.timestamp);
    }
    if (!this.db) return [];
    const rows = this.db.prepare(`SELECT * FROM messages WHERE thread_id = ? ORDER BY timestamp ASC`).all(threadId) as any[];
    return rows.map(row => ({
      id: row.id,
      threadId: row.thread_id,
      senderId: row.sender_id,
      senderName: row.sender_name,
      timestamp: row.timestamp,
      content: row.content,
      contentHash: row.content_hash,
      metadata: JSON.parse(row.metadata || '{}'),
    }));
  }

  getAttachments(threadId: string): AttachmentRecord[] {
    if (this.jsonMode) {
      return this.fallbackStore.attachments.filter(item => item.threadId === threadId);
    }
    if (!this.db) return [];
    const rows = this.db.prepare(`SELECT * FROM attachments WHERE thread_id = ?`).all(threadId) as any[];
    return rows.map(row => ({
      id: row.id,
      messageId: row.message_id,
      threadId: row.thread_id,
      type: row.type,
      url: row.url,
      localPath: row.local_path,
      checksum: row.checksum,
      metadata: JSON.parse(row.metadata || '{}'),
    }));
  }

  getAuditRecords(threadId?: string): AuditRecord[] {
    if (this.jsonMode) {
      return threadId ? this.fallbackStore.audits.filter(item => item.threadId === threadId) : this.fallbackStore.audits;
    }
    if (!this.db) return [];
    const rows = threadId
      ? this.db.prepare(`SELECT * FROM audits WHERE thread_id = ? ORDER BY created_at DESC`).all(threadId) as any[]
      : this.db.prepare(`SELECT * FROM audits ORDER BY created_at DESC`).all() as any[];
    return rows.map(row => ({
      id: row.id,
      threadId: row.thread_id,
      type: row.type,
      severity: row.severity,
      message: row.message,
      createdAt: row.created_at,
    }));
  }
}
