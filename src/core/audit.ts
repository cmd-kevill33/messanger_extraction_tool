import { nanoid } from 'nanoid';
import { Storage, AuditRecord } from './storage';
import { Logger } from '../utils/logger';

export interface AuditSummary {
  threadId?: string;
  duplicates: number;
  orphanedReactions: number;
  missingAttachments: number;
  inconsistentTimestamps: number;
  warnings: string[];
}

export class Auditor {
  constructor(private storage: Storage, private logger: Logger) {}

  run(threadId?: string): AuditSummary {
    const summary: AuditSummary = {
      threadId,
      duplicates: 0,
      orphanedReactions: 0,
      missingAttachments: 0,
      inconsistentTimestamps: 0,
      warnings: [],
    };

    const messages = threadId ? this.storage.getMessages(threadId) : [];
    const attachments = threadId ? this.storage.getAttachments(threadId) : [];

    const hashCounts = messages.reduce<Record<string, number>>((counts, message) => {
      counts[message.contentHash] = (counts[message.contentHash] || 0) + 1;
      return counts;
    }, {});

    Object.entries(hashCounts).forEach(([hash, count]) => {
      if (count > 1) {
        summary.duplicates += count - 1;
        summary.warnings.push(`Detected ${count} duplicate message entries for content hash ${hash}`);
      }
    });

    messages.forEach((message) => {
      const referenceAttachments = attachments.filter((attachment) => attachment.messageId === message.id);
      if (referenceAttachments.length === 0 && message.metadata?.attachments?.length > 0) {
        summary.missingAttachments += 1;
        summary.warnings.push(`Message ${message.id} refers to attachments that are not stored locally.`);
      }
      if (message.timestamp <= 0 || Number.isNaN(message.timestamp)) {
        summary.inconsistentTimestamps += 1;
        summary.warnings.push(`Message ${message.id} has invalid timestamp ${message.timestamp}.`);
      }
    });

    const allReactions = messages.flatMap((message) => message.metadata?.reactions || []);
    allReactions.forEach((reaction: any) => {
      if (reaction.message_id && !messages.find((message) => message.id === reaction.message_id)) {
        summary.orphanedReactions += 1;
        summary.warnings.push(`Orphaned reaction references missing message ${reaction.message_id}.`);
      }
    });

    const record: AuditRecord = {
      id: nanoid(),
      threadId: threadId || 'global',
      type: 'integrity-audit',
      severity: summary.warnings.length ? 'WARN' : 'INFO',
      message: `${summary.warnings.length} issues detected during audit.`,
      createdAt: Date.now(),
    };
    this.storage.insertAudit(record);
    this.logger.info(`Audit complete for thread ${threadId || 'all'}: ${summary.warnings.length} warnings found.`);
    return summary;
  }
}
