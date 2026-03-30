import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getOrCreateDeviceId, generateSessionKey, generateDisplayName } from '@/utils/deviceId'
import { setSessionMode as setStorageSessionMode, getSessionMode } from '@/utils/storage'

/**
 * 设备状态管理 Store
 * 管理设备 ID、Session Key 等设备相关信息
 */
export const useDeviceStore = defineStore('device', () => {
  // 状态
  const deviceId = ref<string>('')
  const useSharedSession = ref<boolean>(true)
  
  // 计算属性
  const shortDeviceId = computed(() => deviceId.value.substring(0, 8))
  
  const sessionKey = computed(() => {
    return generateSessionKey(useSharedSession.value)
  })
  
  const displayName = computed(() => {
    return generateDisplayName(useSharedSession.value)
  })
  
  // 方法
  function initDevice(): void {
    deviceId.value = getOrCreateDeviceId()
    // 从存储中读取会话模式
    useSharedSession.value = getSessionMode()
  }
  
  function toggleSessionMode(): void {
    useSharedSession.value = !useSharedSession.value
    setStorageSessionMode(useSharedSession.value)
  }

  function setSessionMode(shared: boolean): void {
    useSharedSession.value = shared
    setStorageSessionMode(shared)
  }
  
  // 初始化
  initDevice()
  
  return {
    // 状态
    deviceId,
    useSharedSession,
    
    // 计算属性
    shortDeviceId,
    sessionKey,
    displayName,
    
    // 方法
    initDevice,
    toggleSessionMode,
    setSessionMode
  }
})