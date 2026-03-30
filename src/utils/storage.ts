/**
 * 带命名空间的 LocalStorage 管理工具
 * 自动按 sessionKey 或 deviceId 隔离数据，防止会话间数据串扰
 */

import { generateSessionKey, getOrCreateDeviceId } from './deviceId';

// 存储键名常量
export const STORAGE_KEYS = {
  MESSAGES: 'messages',
  SETTINGS: 'settings',
  DEVICE_ID: 'device-id',
  SHARED_SESSION: 'shared-session',
} as const;

/**
 * 获取当前命名空间前缀
 * 默认使用 deviceId 作为命名空间
 */
function getNamespace(): string {
  // 检查是否使用共享会话模式（使用全局 key）
  const isShared = localStorage.getItem('gui-web-shared-session') === 'true';

  if (isShared) {
    return 'gui-web:shared';
  }

  // 使用 deviceId 前 8 位作为命名空间
  const deviceId = getOrCreateDeviceId();
  return `gui-web:${deviceId.substring(0, 8)}`;
}

/**
 * 获取带命名空间的完整 key
 */
export function getNamespacedKey(key: string): string {
  const ns = getNamespace();
  return `${ns}:${key}`;
}

/**
 * 带命名空间的 localStorage 包装
 */
export const namespacedStorage = {
  /**
   * 获取值
   */
  get(key: string): string | null {
    return localStorage.getItem(getNamespacedKey(key));
  },

  /**
   * 设置值
   */
  set(key: string, value: string): void {
    localStorage.setItem(getNamespacedKey(key), value);
  },

  /**
   * 删除值
   */
  remove(key: string): void {
    localStorage.removeItem(getNamespacedKey(key));
  },

  /**
   * 获取并解析 JSON
   */
  getJSON<T>(key: string): T | null {
    const value = this.get(key);
    if (!value) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  },

  /**
   * 设置 JSON 值
   */
  setJSON<T>(key: string, value: T): void {
    try {
      this.set(key, JSON.stringify(value));
    } catch {
      // 忽略存储错误
    }
  },
};

/**
 * 切换会话模式
 * @param shared true = 共享会话，false = 独立会话
 */
export function setSessionMode(shared: boolean): void {
  localStorage.setItem('gui-web-shared-session', String(shared));
}

/**
 * 获取当前会话模式
 */
export function getSessionMode(): boolean {
  return localStorage.getItem('gui-web-shared-session') === 'true';
}

/**
 * 清除当前命名空间的所有数据
 */
export function clearCurrentNamespace(): void {
  const ns = getNamespace();
  const keysToRemove: string[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(ns + ':')) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach(key => localStorage.removeItem(key));
}

/**
 * 清除所有 gui-web 相关的存储数据
 */
export function clearAllStorage(): void {
  const keysToRemove: string[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('gui-web:')) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach(key => localStorage.removeItem(key));
}
