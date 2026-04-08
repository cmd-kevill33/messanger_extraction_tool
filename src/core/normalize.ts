import crypto from 'crypto';
import { RawEventRecord } from './storage';

export interface CanonicalAttachment {
  id: string;
  type: string;
  url: string;
  filename?: string;
  checksum?: string;
  metadata?: any;
}

export interface CanonicalReaction {
  id: string;
  messageId: string;
  userId: string;
  reaction: string;
  timestamp: number;
}

export interface CanonicalMessage {
  id: string;
  threadId: string;
  senderId: string;
  senderName: string;
  timestamp: number;
  content: string;
  contentHash: string;
  attachments: CanonicalAttachment[];
  reactions: CanonicalReaction[];
  metadata: any;
}

export interface CanonicalThread {
  id: string;
  name: string;
  participants: string[];
  lastActivity: number;
  metadata: any;
}

export type NormalizedPayload = {
  type: 'thread' | 'message' | 'reaction' | 'raw';
  payload: CanonicalMessage | CanonicalThread | CanonicalReaction | any;
};

export function computeContentHash(payload: any): string {
  const sortedStringify = (obj: any): string => {
    if (obj === null || typeof obj !== 'object') {
      return JSON.stringify(obj);
    }
    if (Array.isArray(obj)) {
      return '[' + obj.map(sortedStringify).join(',') + ']';
    }
    const keys = Object.keys(obj).sort();
    const pairs = keys.map(key => `"${key}":${sortedStringify(obj[key])}`);
    return '{' + pairs.join(',') + '}';
  };
  return crypto.createHash('sha256').update(sortedStringify(payload)).digest('hex');
}

const findByKey = (obj: any, key: string): any => {
  if (!obj || typeof obj !== 'object') return undefined;
  if (Object.prototype.hasOwnProperty.call(obj, key)) return obj[key];
  for (const value of Object.values(obj)) {
    const result = findByKey(value, key);
    if (result !== undefined) return result;
  }
  return undefined;
};

const collectNodes = (payload: any): any[] => {
  if (!payload || typeof payload !== 'object') return [];
  if (Array.isArray(payload)) {
    return payload.flatMap(item => collectNodes(item));
  }
  const nodes: any[] = [];
  if (Object.prototype.hasOwnProperty.call(payload, 'nodes') && Array.isArray(payload.nodes)) {
    return payload.nodes;
  }
  Object.values(payload).forEach(value => {
    if (typeof value === 'object') nodes.push(...collectNodes(value));
  });
  return nodes;
};

const gatherAttachments = (message: any, threadId: string): CanonicalAttachment[] => {
  const found = findByKey(message, 'attachments') || findByKey(message, 'all_attachments') || [];
  if (!Array.isArray(found)) return [];
  return found.map((attachment: any, index: number) => ({
    id: attachment.id || `${message.id || message.message_id}-${index}`,
    type: attachment.mercury_type || attachment.type || attachment.attachment_type || 'file',
    url: attachment.url || attachment.media?.uri || attachment.image_url || attachment.media?.src || '',
    filename: attachment.filename || attachment.name || attachment.title || '',
    metadata: attachment,
  }));
};

const clampThreadId = (threadId: string, fallback: string): string => threadId || fallback || 'unknown-thread';

export function normalizeGraphQLEvent(event: RawEventRecord): NormalizedPayload[] {
  const results: NormalizedPayload[] = [];
  const operation = event.operation || 'raw';
  const payload = event.payload;
  const threadId = clampThreadId(event.threadId, findByKey(payload, 'thread_key')?.thread_fbid || findByKey(payload, 'thread_id'));

  if (operation.includes('ThreadList')) {
    const threadNodes = collectNodes(payload).filter((node: any) => node?.thread_key || node?.id || node?.name);
    threadNodes.forEach((thread: any) => {
      const normalized: CanonicalThread = {
        id: String(thread.thread_key?.thread_fbid || thread.id || thread.thread_id || threadKeyToString(thread.thread_key)),
        name: thread.name || thread.thread_title || `Thread ${thread.id || thread.thread_key?.thread_fbid}`,
        participants: Array.isArray(thread.all_participants?.nodes)
          ? thread.all_participants.nodes.map((node: any) => node?.messaging_actor?.name || node?.name || node?.id || 'Unknown')
          : [],
        lastActivity: Number(thread.last_message_timestamp || thread.updated_time || 0),
        metadata: thread,
      };
      results.push({ type: 'thread', payload: normalized });
    });
    return results;
  }

  if (operation.includes('MessageThread') || operation.includes('DeltaMessage') || operation.includes('delta')) {
    const messages = collectNodes(payload).filter((node: any) => node?.message_id || node?.id || node?.attachments || node?.body);
    messages.forEach((message: any) => {
      const id = String(message.message_id || message.id || message.thread_message_id || computeContentHash(message));
      const content = String(message.body || message.text || message.snippet || message.message || '').trim();
      const normalized: CanonicalMessage = {
        id,
        threadId,
        senderId: String(message.message_sender?.id || message.sender?.id || message.actor?.id || message.sender_id || 'unknown-sender'),
        senderName: String(message.message_sender?.name || message.sender?.name || message.actor?.name || 'Unknown'),
        timestamp: Number(message.timestamp || message.created_timestamp || message.message_timestamp || Date.now()),
        content,
        contentHash: computeContentHash({ id, threadId, timestamp: Number(message.timestamp || message.created_timestamp || message.message_timestamp || 0), content }),
        attachments: gatherAttachments(message, threadId),
        reactions: [],
        metadata: message,
      };
      results.push({ type: 'message', payload: normalized });
    });
  }

  if (operation.includes('Reaction') || operation.includes('DeltaReaction')) {
    const reactionNodes = collectNodes(payload).filter((node: any) => node?.reaction_type || node?.reaction || node?.message_id);
    reactionNodes.forEach((reaction: any) => {
      const normalized: CanonicalReaction = {
        id: String(reaction.id || computeContentHash(reaction)),
        messageId: String(reaction.message_id || reaction.message_id || reaction.subject_id || ''),
        userId: String(reaction.actor?.id || reaction.reactor?.id || reaction.user_id || 'unknown-user'),
        reaction: String(reaction.reaction_type || reaction.reaction || 'like'),
        timestamp: Number(reaction.timestamp || reaction.created_time || Date.now()),
      };
      results.push({ type: 'reaction', payload: normalized });
    });
  }

  if (results.length === 0) {
    results.push({ type: 'raw', payload });
  }

  return results;
}

function threadKeyToString(threadKey: any): string {
  if (!threadKey || typeof threadKey !== 'object') return 'unknown-thread';
  if (threadKey.thread_fbid) return String(threadKey.thread_fbid);
  if (threadKey.other_user_id) return String(threadKey.other_user_id);
  return JSON.stringify(threadKey);
}
