import { Storage } from './storage';

export interface ReplayEvent {
  id: string;
  type: 'message' | 'attachment' | 'reaction';
  timestamp: number;
  payload: any;
}

export class ReplayEngine {
  constructor(private storage: Storage) {}

  buildTimeline(threadId: string): ReplayEvent[] {
    const messages = this.storage.getMessages(threadId);
    const attachments = this.storage.getAttachments(threadId);
    const events: ReplayEvent[] = messages.map((message) => ({
      id: message.id,
      type: 'message',
      timestamp: message.timestamp,
      payload: message,
    }));

    attachments.forEach((attachment) => {
      events.push({
        id: `${attachment.id}-attachment`,
        type: 'attachment',
        timestamp: Date.now(),
        payload: attachment,
      });
    });

    return events.sort((a, b) => a.timestamp - b.timestamp);
  }
}
