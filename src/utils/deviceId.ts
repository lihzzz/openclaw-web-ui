/**
 * 设备 ID 生成与恢复工具
 * 用于在 localStorage 中持久化设备标识
 */

const DEVICE_ID_KEY = 'gui-web-device-id'

/**
 * 生成随机设备 ID
 * 格式: hex string (32 chars)
 */
function generateDeviceId(): string {
  const array = new Uint8Array(16)
  crypto.getRandomValues(array)
  return Array.from(array)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * 获取或创建设备 ID
 * 优先从 localStorage 恢复，不存在则生成新的
 */
export function getOrCreateDeviceId(): string {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY)
  
  if (!deviceId) {
    deviceId = generateDeviceId()
    localStorage.setItem(DEVICE_ID_KEY, deviceId)
  }
  
  return deviceId
}

/**
 * 清除设备 ID（用于重置）
 */
export function clearDeviceId(): void {
  localStorage.removeItem(DEVICE_ID_KEY)
}

/**
 * 获取设备 ID 的短格式（前 8 位）
 */
export function getShortDeviceId(): string {
  const deviceId = getOrCreateDeviceId()
  return deviceId.substring(0, 8)
}

/**
 * 生成 Session Key
 * @param shared 是否使用共享 session
 */
export function generateSessionKey(shared: boolean = false): string {
  if (shared) {
    return 'agent:main:main'
  }
  const deviceId = getOrCreateDeviceId()
  return `agent:main:${deviceId}`
}

/**
 * 生成显示名称
 * @param shared 是否使用共享 session
 */
export function generateDisplayName(shared: boolean = false): string {
  if (shared) {
    return 'Main Agent-Shared'
  }
  const shortId = getShortDeviceId()
  return `Main Agent-Private-${shortId}`
}