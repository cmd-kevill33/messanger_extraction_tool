import { describe, expect, it } from 'vitest';
import { normalizeGraphQLEvent, computeContentHash } from '../src/core/normalize';

describe('normalizeGraphQLEvent', () => {
  it('should normalize thread list payloads', () => {
    const rawEvent = {
      id: 'test-1',
      threadId: '',
      operation: 'ThreadListQuery',
      payload: {
        data: {
          viewer: {
            threads: {
              nodes: [
                { id: '123', name: 'Test Thread', all_participants: { nodes: [{ messaging_actor: { id: '1', name: 'Alice' } }] }, last_message_timestamp: 1650000000000 }]
            }
          }
        }
      },
      timestamp: Date.now(),
    };
    const normalized = normalizeGraphQLEvent(rawEvent);
    expect(normalized.length).toBeGreaterThan(0);
    expect(normalized[0].type).toBe('thread');
    expect((normalized[0].payload as any).id).toBe('123');
  });

  it('should normalize message payloads', () => {
    const rawEvent = {
      id: 'test-2',
      threadId: '123',
      operation: 'MessageThreadQuery',
      payload: {
        data: {
          message_thread: {
            messages: { nodes: [{ message_id: 'm1', body: 'Hello world', timestamp: 1650000001000, message_sender: { id: '1', name: 'Alice' } }] }
          }
        }
      },
      timestamp: Date.now(),
    };
    const normalized = normalizeGraphQLEvent(rawEvent);
    expect(normalized[0].type).toBe('message');
    expect((normalized[0].payload as any).content).toBe('Hello world');
  });
});

describe('computeContentHash', () => {
  it('should produce deterministic hashes', () => {
    const obj1 = { a: 1, b: 'test' };
    const obj2 = { b: 'test', a: 1 };
    const hash1 = computeContentHash(obj1);
    const hash2 = computeContentHash(obj2);
    expect(hash1).toBe(hash2);
    expect(typeof hash1).toBe('string');
    expect(hash1.length).toBeGreaterThan(0);
  });
});
