interface ConfigCache {
  data: any;
  ts: number;
}

let configCache: ConfigCache | null = null;

export function getConfigCache(): ConfigCache | null {
  return configCache;
}

export function setConfigCache(cache: ConfigCache): void {
  configCache = cache;
}

export function clearConfigCache(): void {
  configCache = null;
}