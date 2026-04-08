import { Logger } from '../utils/logger';
import { Storage } from './storage';

export class SchemaManager {
  constructor(private storage: Storage, private logger: Logger) {}

  track(operation: string, payload: any): void {
    const fieldSnapshot = this.buildFieldSnapshot(payload);
    this.storage.insertSchemaVersion(operation, fieldSnapshot, payload);
    const previous = this.getPreviousSnapshot(operation);
    if (previous) {
      this.compareSchemas(operation, previous, fieldSnapshot);
    }
  }

  private buildFieldSnapshot(payload: any): Record<string, any> {
    const schema: Record<string, any> = {};
    const flatten = (obj: any, prefix = ''): void => {
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
        Object.entries(obj).forEach(([key, value]) => {
          const path = prefix ? `${prefix}.${key}` : key;
          if (value && typeof value === 'object' && !Array.isArray(value)) {
            flatten(value, path);
          } else {
            schema[path] = typeof value;
          }
        });
      }
    };
    flatten(payload);
    return schema;
  }

  private getPreviousSnapshot(operation: string): Record<string, any> | null {
    if ((this.storage as any).jsonMode) {
      const fallbackStore = (this.storage as any).fallbackStore;
      const saved = fallbackStore.schemaVersions.find((item: any) => item.operationName === operation);
      return saved ? saved.fieldSnapshot : null;
    }
    const row = this.storage.db?.prepare(`SELECT field_snapshot FROM schema_versions WHERE operation_name = ?`).get(operation) as any;
    return row ? JSON.parse(row.field_snapshot) : null;
  }

  private compareSchemas(operation: string, previous: Record<string, any>, current: Record<string, any>): void {
    const currentKeys = new Set(Object.keys(current));
    const previousKeys = new Set(Object.keys(previous));
    const missing = [...previousKeys].filter(key => !currentKeys.has(key));
    const added = [...currentKeys].filter(key => !previousKeys.has(key));
    if (missing.length || added.length) {
      const messageParts: string[] = [];
      if (added.length) messageParts.push(`new fields ${added.join(', ')}`);
      if (missing.length) messageParts.push(`missing fields ${missing.join(', ')}`);
      this.logger.warn(`Schema drift detected for ${operation}: ${messageParts.join(', ')}`);
    }
  }
}
