import fs from 'fs';
import path from 'path';
import { Command } from 'commander';
import open from 'open';
import { DEFAULT_CONFIG, AppConfig } from './config/defaults';
import { Logger } from './utils/logger';
import { Storage } from './core/storage';
import { CaptureManager } from './core/capture';
import { Auditor } from './core/audit';
import { createApiServer } from './server/api';

const program = new Command();
program.name('orpheus-echo').description('Messenger extraction, audit, replay, and local UI server.');

function buildConfig(options: any): AppConfig {
  const config: AppConfig = {
    ...DEFAULT_CONFIG,
    outputDir: options.outputDir || DEFAULT_CONFIG.outputDir,
    dbFile: options.dbFile || path.join(options.outputDir || DEFAULT_CONFIG.outputDir, 'orpheus-echo.sqlite'),
    mediaDir: options.mediaDir || path.join(options.outputDir || DEFAULT_CONFIG.outputDir, 'media'),
    jsonConfigFile: path.join(options.outputDir || DEFAULT_CONFIG.outputDir, 'config.json'),
    pluginDir: options.pluginDir || DEFAULT_CONFIG.pluginDir,
    serverPort: options.port || DEFAULT_CONFIG.serverPort,
    uiPort: options.uiPort || DEFAULT_CONFIG.uiPort,
    headless: options.headless ?? DEFAULT_CONFIG.headless,
    live: options.live ?? DEFAULT_CONFIG.live,
    fullHistory: options.fullHistory ?? DEFAULT_CONFIG.fullHistory,
    threadId: options.threadId,
    selectThread: options.selectThread ?? DEFAULT_CONFIG.selectThread,
    verbose: Number(options.verbose || 1),
    dryRun: options.dryRun ?? DEFAULT_CONFIG.dryRun,
  };
  return config;
}

program.command('capture')
  .description('Capture a Messenger thread from Facebook using network interception.')
  .option('--thread-id <id>', 'Facebook Messenger thread ID')
  .option('--select-thread', 'Select from discovered threads')
  .option('--full-history', 'Scroll until the oldest message is reached')
  .option('--live', 'Keep listening for live updates')
  .option('--headless', 'Run the browser in headless mode')
  .option('--no-headless', 'Run the browser with UI visible')
  .option('--output-dir <path>', 'Directory for captured data')
  .option('--verbose <level>', 'Verbosity level 1-3', (value: string) => Number(value), 1)
  .option('--dry-run', 'Process events without persisting them')
  .action(async (options) => {
    const config = buildConfig(options);
    const logger = new Logger(config.verbose);
    const storage = new Storage(config, logger);
    const manager = new CaptureManager(config, storage, logger);
    try {
      if (config.dryRun) {
        logger.info('Dry run enabled; events will not be persisted.');
      }
      await manager.start();
    } catch (error) {
      logger.error(`Capture failed: ${String(error)}`);
      process.exit(1);
    }
  });

program.command('audit')
  .description('Run integrity auditing against stored thread data.')
  .option('--thread-id <id>', 'Audit a specific thread')
  .option('--output-dir <path>', 'Directory for captured data')
  .option('--verbose <level>', 'Verbosity level 1-3', (value: string) => Number(value), 1)
  .action((options) => {
    const config = buildConfig(options);
    const logger = new Logger(config.verbose);
    const storage = new Storage(config, logger);
    storage.init();
    const auditor = new Auditor(storage, logger);
    const summary = auditor.run(options.threadId);
    logger.info(`Audit summary: ${JSON.stringify(summary, null, 2)}`);
  });

program.command('serve')
  .description('Launch the local API server and optionally serve the web UI.')
  .option('--port <port>', 'Local API server port')
  .option('--output-dir <path>', 'Directory for captured data')
  .option('--verbose <level>', 'Verbosity level 1-3', (value: string) => Number(value), 1)
  .action(async (options) => {
    const config = buildConfig(options);
    const logger = new Logger(config.verbose);
    const storage = new Storage(config, logger);
    storage.init();
    const app = createApiServer(config, storage, logger);
    app.listen(config.serverPort, () => {
      logger.info(`API server listening on http://127.0.0.1:${config.serverPort}`);
    });
  });

program.command('export')
  .description('Export stored data to JSON or copy the SQLite database.')
  .option('--format <format>', 'export format (json|sqlite)', 'json')
  .option('--thread-id <id>', 'Thread ID to export')
  .option('--output-dir <path>', 'Directory for captured data')
  .option('--export-dir <path>', 'Directory for exports', './exports')
  .option('--verbose <level>', 'Verbosity level 1-3', (value: string) => Number(value), 1)
  .action((options) => {
    const config = buildConfig(options);
    const logger = new Logger(config.verbose);
    const storage = new Storage(config, logger);
    storage.init();
    const exportDir = path.resolve(options.exportDir || './exports');
    fs.mkdirSync(exportDir, { recursive: true });
    if (options.format === 'sqlite') {
      const destination = path.join(exportDir, path.basename(config.dbFile));
      fs.copyFileSync(config.dbFile, destination);
      logger.info(`SQLite database exported to ${destination}`);
      return;
    }
    const threadId = options.threadId;
    if (!threadId) {
      logger.error('Thread ID is required for JSON export');
      process.exit(1);
    }
    const payload = {
      thread: storage.getThreads().find((thread) => thread.id === threadId),
      messages: storage.getMessages(threadId),
      attachments: storage.getAttachments(threadId),
      audits: storage.getAuditRecords(threadId),
    };
    const fileName = `thread-${threadId}-${Date.now()}.json`;
    const destination = path.join(exportDir, fileName);
    fs.writeFileSync(destination, JSON.stringify(payload, null, 2), 'utf-8');
    logger.info(`JSON export written to ${destination}`);
  });

program.command('ui')
  .description('Open the local Web UI against the running API server.')
  .option('--api-url <url>', 'API URL for the UI', 'http://127.0.0.1:4000')
  .action(async (options) => {
    const url = options.apiUrl || 'http://127.0.0.1:4000';
    const target = `${url}`;
    try {
      await open(target);
      console.log(`Opened UI at ${target}`);
    } catch (error) {
      console.error(`Unable to open browser: ${String(error)}`);
    }
  });

program.on('--help', () => {
  console.log('');
  console.log('Examples:');
  console.log('  orpheus-echo capture --thread-id 123456789 --full-history --live');
  console.log('  orpheus-echo audit --thread-id 123456789');
  console.log('  orpheus-echo serve --port 4000');
  console.log('  orpheus-echo export --format json --thread-id 123456789');
});

program.parseAsync(process.argv).catch((error) => {
  console.error(`CLI error: ${String(error)}`);
  process.exit(1);
});
