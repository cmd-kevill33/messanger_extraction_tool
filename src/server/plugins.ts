import fs from 'fs';
import path from 'path';
import chokidar from 'chokidar';
import { Logger } from '../utils/logger';
import { AppConfig } from '../config/defaults';

export interface PluginDefinition {
  id: string;
  name: string;
  description: string;
  category: 'panel' | 'theme' | 'transform';
  codeFile?: string;
  code?: string;
  metadata?: any;
}

export class PluginManager {
  private plugins: PluginDefinition[] = [];

  constructor(private config: AppConfig, private logger: Logger) {
    this.loadPlugins();
    this.watchPlugins();
  }

  getPlugins(): PluginDefinition[] {
    return this.plugins;
  }

  private loadPlugins(): void {
    try {
      const files = fs.readdirSync(this.config.pluginDir).filter((file) => file.endsWith('.json'));
      this.plugins = files.map((file) => {
        const source = fs.readFileSync(path.resolve(this.config.pluginDir, file), 'utf-8');
        const definition = JSON.parse(source) as PluginDefinition;
        if (definition.codeFile) {
          const codePath = path.resolve(this.config.pluginDir, definition.codeFile);
          if (fs.existsSync(codePath)) {
            definition.code = fs.readFileSync(codePath, 'utf-8');
          }
        }
        return definition;
      });
      this.logger.info(`Loaded ${this.plugins.length} plugin definitions from ${this.config.pluginDir}`);
    } catch (error) {
      this.logger.warn(`Unable to load plugins: ${String(error)}`);
      this.plugins = [];
    }
  }

  private watchPlugins(): void {
    try {
      const watcher = chokidar.watch(this.config.pluginDir, { ignoreInitial: true, persistent: true });
      watcher.on('all', () => {
        this.logger.info('Plugin folder changed, reloading plugins');
        this.loadPlugins();
      });
    } catch (error) {
      this.logger.warn(`Plugin watch setup failed: ${String(error)}`);
    }
  }
}
