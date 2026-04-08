import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { Storage } from '../core/storage';
import { PluginManager } from './plugins';
import { Logger } from '../utils/logger';
import { ReplayEngine } from '../core/replay';
import { AppConfig } from '../config/defaults';

export function createApiServer(config: AppConfig, storage: Storage, logger: Logger): express.Application {
  const app = express();
  const pluginManager = new PluginManager(config, logger);
  const replayEngine = new ReplayEngine(storage);

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  app.get('/api/config', (_req, res) => {
    res.json({ outputDir: config.outputDir, mediaDir: config.mediaDir, pluginDir: config.pluginDir, serverPort: config.serverPort });
  });

  app.get('/api/threads', (_req, res) => {
    res.json(storage.getThreads());
  });

  app.get('/api/messages', (req, res) => {
    const threadId = String(req.query.threadId || '');
    if (!threadId) return res.status(400).json({ error: 'threadId is required' });
    res.json(storage.getMessages(threadId));
  });

  app.get('/api/attachments', (req, res) => {
    const threadId = String(req.query.threadId || '');
    if (!threadId) return res.status(400).json({ error: 'threadId is required' });
    res.json(storage.getAttachments(threadId));
  });

  app.get('/api/plugins', (_req, res) => {
    res.json(pluginManager.getPlugins());
  });

  app.get('/api/replay', (req, res) => {
    const threadId = String(req.query.threadId || '');
    if (!threadId) return res.status(400).json({ error: 'threadId is required' });
    res.json(replayEngine.buildTimeline(threadId));
  });

  app.get('/api/source/list', (_req, res) => {
    const root = path.resolve(process.cwd(), 'src/ui/src');
    const files = findSourceFiles(root);
    res.json(files);
  });

  app.get('/api/source', (req, res) => {
    const file = String(req.query.path || '');
    const normalized = normalizeSourcePath(file);
    if (!normalized) return res.status(400).json({ error: 'Invalid path' });
    if (!fs.existsSync(normalized)) return res.status(404).json({ error: 'File not found' });
    res.json({ path: file, code: fs.readFileSync(normalized, 'utf-8') });
  });

  app.post('/api/source', (req, res) => {
    const file = String(req.body.path || '');
    const code = String(req.body.code || '');
    const normalized = normalizeSourcePath(file);
    if (!normalized) return res.status(400).json({ error: 'Invalid path' });
    try {
      fs.writeFileSync(normalized, code, 'utf-8');
      res.json({ success: true, path: file });
    } catch (error) {
      res.status(500).json({ error: `Unable to save file: ${String(error)}` });
    }
  });

  app.get('/api/audit', (_req, res) => {
    res.json(storage.getAuditRecords());
  });

  app.get('/api/attachment-file', (req, res) => {
    const filePath = String(req.query.path || '');
    const absolute = path.resolve(process.cwd(), filePath);
    if (!absolute.startsWith(path.resolve(process.cwd(), config.outputDir))) {
      return res.status(403).json({ error: 'Forbidden path' });
    }
    if (!fs.existsSync(absolute)) {
      return res.status(404).json({ error: 'File not found' });
    }
    res.sendFile(absolute);
  });

  const webRoot = path.resolve(process.cwd(), 'src/ui/dist');
  if (fs.existsSync(webRoot)) {
    app.use(express.static(webRoot));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(webRoot, 'index.html'));
    });
  }

  return app;
}

function findSourceFiles(directory: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const resolved = path.resolve(directory, entry.name);
    if (entry.isDirectory()) {
      results.push(...findSourceFiles(resolved));
    } else if (entry.isFile() && (resolved.endsWith('.ts') || resolved.endsWith('.tsx'))) {
      results.push(path.relative(path.resolve(process.cwd(), 'src/ui/src'), resolved));
    }
  }
  return results;
}

function normalizeSourcePath(requested: string): string | null {
  const root = path.resolve(process.cwd(), 'src/ui/src');
  const target = path.resolve(root, requested);
  if (!target.startsWith(root)) return null;
  return target;
}
