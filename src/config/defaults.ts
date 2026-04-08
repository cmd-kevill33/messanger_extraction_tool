export interface AppConfig {
  outputDir: string;
  dbFile: string;
  mediaDir: string;
  jsonConfigFile: string;
  pluginDir: string;
  serverPort: number;
  headless: boolean;
  live: boolean;
  fullHistory: boolean;
  threadId?: string;
  selectThread: boolean;
  verbose: number;
  dryRun: boolean;
  uiPort: number;
}

export const DEFAULT_CONFIG: AppConfig = {
  outputDir: './data',
  dbFile: './data/orpheus-echo.sqlite',
  mediaDir: './data/media',
  jsonConfigFile: './data/config.json',
  pluginDir: './plugins',
  serverPort: 4000,
  uiPort: 4173,
  headless: false,
  live: false,
  fullHistory: false,
  selectThread: false,
  verbose: 1,
  dryRun: false,
};
