/**
 * 统一日志系统
 * 支持按级别开关，生产环境自动禁用 debug 日志
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerConfig {
  level: LogLevel;
  enabled: boolean;
  prefix?: string;
}

// 日志级别权重
const LEVEL_WEIGHTS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// 检测生产环境
const isProduction = () => {
  return import.meta.env?.PROD ||
    import.meta.env?.NODE_ENV === 'production' ||
    import.meta.env?.MODE === 'production' ||
    false;
};

// 从环境变量获取日志级别
const getEnvLevel = (): LogLevel => {
  const envLevel = import.meta.env?.VITE_LOG_LEVEL;
  if (envLevel && ['debug', 'info', 'warn', 'error'].includes(envLevel)) {
    return envLevel as LogLevel;
  }
  return isProduction() ? 'info' : 'debug';
};

// 全局配置
const globalConfig: LoggerConfig = {
  level: getEnvLevel(),
  enabled: true,
  prefix: '[OpenClaw]',
};

/**
 * 设置全局日志配置
 */
export function configureLogger(config: Partial<LoggerConfig>): void {
  Object.assign(globalConfig, config);
}

/**
 * 获取当前日志级别
 */
export function getLogLevel(): LogLevel {
  return globalConfig.level;
}

/**
 * 创建带前缀的日志消息
 */
function formatMessage(level: LogLevel, message: string): string {
  const prefix = globalConfig.prefix ? `${globalConfig.prefix} ` : '';
  const levelTag = level.toUpperCase().padStart(5);
  return `${prefix}[${levelTag}] ${message}`;
}

/**
 * 是否应该记录此级别的日志
 */
function shouldLog(level: LogLevel): boolean {
  if (!globalConfig.enabled) return false;
  return LEVEL_WEIGHTS[level] >= LEVEL_WEIGHTS[globalConfig.level];
}

/**
 * 安全的 JSON 序列化
 */
function safeStringify(obj: unknown): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

/**
 * 日志记录器类
 */
class Logger {
  private prefix: string;

  constructor(prefix: string = '') {
    this.prefix = prefix;
  }

  /**
   * 创建子日志记录器（带额外前缀）
   */
  child(subPrefix: string): Logger {
    return new Logger(this.prefix ? `${this.prefix}:${subPrefix}` : subPrefix);
  }

  /**
   * 打印 Debug 日志
   */
  debug(message: string, ...args: unknown[]): void {
    if (!shouldLog('debug')) return;
    const formatted = this.prefix
      ? `${globalConfig.prefix || ''}[${this.prefix}] ${message}`
      : message;
    console.debug(formatMessage('debug', formatted), ...args.map(arg =>
      typeof arg === 'object' ? safeStringify(arg) : arg
    ));
  }

  /**
   * 打印 Info 日志
   */
  info(message: string, ...args: unknown[]): void {
    if (!shouldLog('info')) return;
    const formatted = this.prefix
      ? `${globalConfig.prefix || ''}[${this.prefix}] ${message}`
      : message;
    console.info(formatMessage('info', formatted), ...args.map(arg =>
      typeof arg === 'object' ? safeStringify(arg) : arg
    ));
  }

  /**
   * 打印 Warn 日志
   */
  warn(message: string, ...args: unknown[]): void {
    if (!shouldLog('warn')) return;
    const formatted = this.prefix
      ? `${globalConfig.prefix || ''}[${this.prefix}] ${message}`
      : message;
    console.warn(formatMessage('warn', formatted), ...args.map(arg =>
      typeof arg === 'object' ? safeStringify(arg) : arg
    ));
  }

  /**
   * 打印 Error 日志
   */
  error(message: string, ...args: unknown[]): void {
    if (!shouldLog('error')) return;
    const formatted = this.prefix
      ? `${globalConfig.prefix || ''}[${this.prefix}] ${message}`
      : message;
    console.error(formatMessage('error', formatted), ...args.map(arg =>
      typeof arg === 'object' ? safeStringify(arg) : arg
    ));
  }

  /**
   * 条件日志：仅在开发环境打印
   */
  dev(message: string, ...args: unknown[]): void {
    if (isProduction()) return;
    this.debug(message, ...args);
  }

  /**
   * 分组日志
   */
  group(label: string): void {
    if (shouldLog('debug')) {
      console.group(label);
    }
  }

  groupEnd(): void {
    if (shouldLog('debug')) {
      console.groupEnd();
    }
  }
}

// 默认日志实例
export const logger = new Logger();

/**
 * 创建命名空间日志记录器
 */
export function createLogger(namespace: string): Logger {
  return new Logger(namespace);
}

/**
   * 创建 Store 专用日志记录器
   */
export function createStoreLogger(storeName: string): Logger {
  return new Logger(`store:${storeName}`);
}

/**
 * 创建组件专用日志记录器
 */
export function createComponentLogger(componentName: string): Logger {
  return new Logger(`component:${componentName}`);
}

export default logger;
