/**
 * 设备签名工具
 * 用于生成设备密钥对和签名认证
 */

const KEY_PAIR_KEY = 'gui-web-key-pair'

/**
 * 生成 RSA 密钥对
 */
export async function generateKeyPair(): Promise<CryptoKeyPair> {
  return await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256'
    },
    true,
    ['sign', 'verify']
  )
}

/**
 * 导出公钥为 Base64
 */
export async function exportPublicKey(key: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey('spki', key)
  return btoa(String.fromCharCode(...new Uint8Array(exported)))
}

/**
 * 从 localStorage 获取或创建密钥对
 */
export async function getOrCreateKeyPair(): Promise<{ 
  publicKey: CryptoKey
  privateKey: CryptoKey 
}> {
  // 尝试从 localStorage 恢复
  const saved = localStorage.getItem(KEY_PAIR_KEY)
  
  if (saved) {
    try {
      const { privateKeyJwk, publicKeyJwk } = JSON.parse(saved)
      const privateKey = await crypto.subtle.importKey(
        'jwk',
        privateKeyJwk,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        true,
        ['sign']
      )
      const publicKey = await crypto.subtle.importKey(
        'jwk',
        publicKeyJwk,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        true,
        ['verify']
      )
      return { publicKey, privateKey }
    } catch {
      // 恢复失败，重新生成
    }
  }
  
  // 生成新密钥对
  const keyPair = await generateKeyPair()
  
  // 导出并保存
  const privateKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey!)
  const publicKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey!)
  localStorage.setItem(KEY_PAIR_KEY, JSON.stringify({ privateKeyJwk, publicKeyJwk }))
  
  return {
    publicKey: keyPair.publicKey!,
    privateKey: keyPair.privateKey!
  }
}

/**
 * 签名数据
 */
export async function signData(privateKey: CryptoKey, data: string): Promise<string> {
  const encoder = new TextEncoder()
  const dataBuffer = encoder.encode(data)
  
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    privateKey,
    dataBuffer
  )
  
  return btoa(String.fromCharCode(...new Uint8Array(signature)))
}

/**
 * 生成设备签名载荷 (v3 格式)
 */
export function generateSignaturePayload(params: {
  deviceId: string
  nonce: string
  client: { id: string; version: string; platform: string; mode: string }
  role: string
  scopes: string[]
  token?: string
}): string {
  const { deviceId, nonce, client, role, scopes, token } = params
  
  // v3 payload 包含 platform 和 deviceFamily
  const payload = {
    device: deviceId,
    client: client.id,
    version: client.version,
    platform: client.platform,
    deviceFamily: 'web',
    role,
    scopes: scopes.join(','),
    nonce,
    ...(token && { token })
  }
  
  // 按字母顺序排序并拼接
  const sortedKeys = Object.keys(payload).sort()
  const parts = sortedKeys.map(k => `${k}=${(payload as Record<string, string>)[k]}`)
  
  return parts.join('&')
}

/**
 * 从公钥生成设备指纹
 */
export async function getDeviceFingerprint(publicKey: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey('spki', publicKey)
  const hash = await crypto.subtle.digest('SHA-256', exported)
  const hashArray = new Uint8Array(hash)
  
  return Array.from(hashArray)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}