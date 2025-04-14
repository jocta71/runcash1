// Níveis de log suportados pelo sistema
export enum LogLevel {
  ERROR = 0,   // Apenas erros críticos
  WARN = 1,    // Erros e avisos
  INFO = 2,    // Informações importantes
  DEBUG = 3,   // Informações detalhadas para debug
  VERBOSE = 4  // Informações extremamente detalhadas
}

// Configuração global do logger
class LoggerConfig {
  private static _instance: LoggerConfig;
  private _level: LogLevel = import.meta.env.MODE === 'production' 
    ? LogLevel.INFO  // Em produção, log INFO por padrão
    : LogLevel.DEBUG; // Em desenvolvimento, log DEBUG por padrão
  
  private _enabled: boolean = true;
  private _categories: Record<string, boolean> = {};
  
  public static getInstance(): LoggerConfig {
    if (!LoggerConfig._instance) {
      LoggerConfig._instance = new LoggerConfig();
    }
    return LoggerConfig._instance;
  }
  
  public get level(): LogLevel {
    return this._level;
  }
  
  public set level(level: LogLevel) {
    this._level = level;
  }
  
  public get enabled(): boolean {
    return this._enabled;
  }
  
  public set enabled(enabled: boolean) {
    this._enabled = enabled;
  }
  
  public enableCategory(category: string): void {
    this._categories[category] = true;
  }
  
  public disableCategory(category: string): void {
    this._categories[category] = false;
  }
  
  public isCategoryEnabled(category: string): boolean {
    return this._categories[category] !== false; // Habilitado por padrão
  }
}

// Classe principal de logger
export class Logger {
  private category: string;
  
  constructor(category: string) {
    this.category = category;
  }
  
  private shouldLog(level: LogLevel): boolean {
    const config = LoggerConfig.getInstance();
    return config.enabled && 
           level <= config.level && 
           config.isCategoryEnabled(this.category);
  }
  
  private formatMessage(message: string): string {
    return `[${this.category}] ${message}`;
  }
  
  error(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(this.formatMessage(message), ...args);
    }
  }
  
  warn(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatMessage(message), ...args);
    }
  }
  
  info(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.info(this.formatMessage(message), ...args);
    }
  }
  
  debug(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.debug(this.formatMessage(message), ...args);
    }
  }
  
  success(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.log('%c' + this.formatMessage(message), 'color: green; font-weight: bold', ...args);
    }
  }
  
  verbose(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.VERBOSE)) {
      console.log(this.formatMessage(message), ...args);
    }
  }
}

// Configuração global do logger
export const loggerConfig = LoggerConfig.getInstance();

// Factory para criar instâncias de logger
export function getLogger(category: string): Logger {
  return new Logger(category);
}

// Em produção, definir nível padrão como INFO
if (import.meta.env.MODE === 'production') {
  loggerConfig.level = LogLevel.INFO;
  
  // Desabilitar categorias específicas
  loggerConfig.disableCategory('Socket');
} 