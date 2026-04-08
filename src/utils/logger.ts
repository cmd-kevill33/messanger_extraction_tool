import chalk from 'chalk';

export type LogSeverity = 'error' | 'warn' | 'info' | 'debug';

export class Logger {
  constructor(public level = 1) {}

  private format(level: LogSeverity, message: string): string {
    const time = new Date().toISOString();
    const label = level.toUpperCase().padEnd(5);
    switch (level) {
      case 'error':
        return `${chalk.red(`[${time}] ${label}`)} ${message}`;
      case 'warn':
        return `${chalk.yellow(`[${time}] ${label}`)} ${message}`;
      case 'debug':
        return `${chalk.gray(`[${time}] ${label}`)} ${message}`;
      default:
        return `${chalk.cyan(`[${time}] ${label}`)} ${message}`;
    }
  }

  error(message: string): void {
    console.error(this.format('error', message));
  }

  warn(message: string): void {
    if (this.level >= 1) console.warn(this.format('warn', message));
  }

  info(message: string): void {
    if (this.level >= 1) console.log(this.format('info', message));
  }

  debug(message: string): void {
    if (this.level >= 2) console.log(this.format('debug', message));
  }
}
