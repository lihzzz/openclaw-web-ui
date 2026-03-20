<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

// 导航项配置
interface NavItem {
  name: string
  path: string
  icon: string
  label: string
}

const navItems: NavItem[] = [
  { name: 'agents', path: '/', icon: 'agents', label: 'Agents' },
  { name: 'models', path: '/models', icon: 'models', label: 'Models' },
  { name: 'config', path: '/config', icon: 'config', label: 'Config' },
  { name: 'skills', path: '/skills', icon: 'skills', label: 'Skills' },
  { name: 'sessions', path: '/sessions', icon: 'sessions', label: 'Sessions' },
  { name: 'stats', path: '/stats', icon: 'stats', label: 'Stats' },
  { name: 'chat', path: '/chat', icon: 'chat', label: 'Chat' },
  { name: 'settings', path: '/settings', icon: 'settings', label: 'Settings' }
]

// 判断当前激活项
function isActive(item: NavItem): boolean {
  if (item.path === '/') {
    return route.path === '/'
  }
  return route.path.startsWith(item.path)
}

// 导航到页面
function navigateTo(item: NavItem): void {
  router.push(item.path)
}

// 像素化图标 SVG 路径
const pixelIcons: Record<string, string> = {
  agents: `M8 2h8v2H8V2zM6 4h12v2H6V4zM4 6h16v4H4V6zM6 10h12v2H6v-2zM2 12h20v2H2v-2zM3 14h4v6H3v-6zM8 14h8v4H8v-4zM17 14h4v6h-4v-6zM7 11h2v1H7v-1zM11 11h2v1h-2v-1z`,
  models: `M6 2h12v2H6V2zM4 4h16v2H4V4zM2 6h20v12H2V6zM4 8h16v8H4V8zM6 10h4v2H6v-2zM6 13h8v2H6v-2zM12 10h6v2h-6v-2z`,
  config: `M12 2l2 2h4v2h2v4l2 2-2 2v4h-2v2h-4l-2 2-2-2H6v-2H4v-4l-2-2 2-2V6h2V4h4l2-2zM10 8v8h4V8h-4z`,
  skills: `M4 2h16v2H4V2zM2 4h20v2H2V4zM4 6h16v14H4V6zM6 8h12v10H6V8zM8 10h4v2H8v-2zM8 13h8v2H8v-2zM14 10h2v2h-2v-2zM8 16h6v2H8v-2z`,
  sessions: `M4 2h10v2H4V2zM2 4h14v2H2V4zM2 6h16v12H2V6zM4 8h12v8H4V8zM6 10h4v2H6v-2zM6 13h8v2H6v-2zM18 8h4v2h-4V8zM18 12h4v2h-4v-2zM18 16h4v2h-4v-2z`,
  stats: `M2 2h4v20H2V2zM8 8h4v14H8V8zM14 4h4v18h-4V4zM20 12h4v10h-4V12z`,
  chat: `M4 4h16v12H8l-4 4V4zM6 6h12v8H6V6zM8 8h8v2H8V8zM8 11h6v2H8v-2z`,
  settings: `M7 1h2v2H7V1zM11 1h2v2h-2V1zM7 3h8v2H7V3zM5 5h12v2H5V5zM3 7h16v8H3V7zM5 15h12v2H5v-2zM7 17h8v2H7v-2zM9 19h4v2H9v-2z`
}
</script>

<template>
  <aside class="sidebar">
    <!-- Logo -->
    <div class="sidebar-header">
      <span class="logo-emoji">🦞</span>
      <span class="logo-title">OpenClaw</span>
    </div>

    <!-- 导航 -->
    <nav class="sidebar-nav">
      <button
        v-for="item in navItems"
        :key="item.name"
        class="nav-item"
        :class="{ active: isActive(item) }"
        @click="navigateTo(item)"
      >
        <svg class="nav-icon" viewBox="0 0 24 24" fill="currentColor">
          <path :d="pixelIcons[item.icon]" />
        </svg>
        <span class="nav-label">{{ item.label }}</span>
      </button>
    </nav>
  </aside>
</template>

<style scoped>
.sidebar {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  width: 180px;
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, var(--ocean-dark) 0%, var(--abyss-black) 100%);
  border-right: 1px solid var(--border-glass);
  z-index: 30;
}

/* Logo */
.sidebar-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
  border-bottom: 1px solid var(--border-glass);
  background: linear-gradient(135deg, var(--gold-dim) 0%, transparent 100%);
}

.logo-emoji {
  font-size: 1.5rem;
  line-height: 1;
  filter: drop-shadow(0 0 8px var(--gold-glow));
}

.logo-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--gold-primary);
  text-shadow: 0 0 20px var(--gold-glow);
  letter-spacing: 0.02em;
}

/* 导航 */
.sidebar-nav {
  flex: 1;
  padding: 1rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  overflow-y: auto;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem 0.75rem;
  width: 100%;
  text-align: left;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--transition-normal);
  position: relative;
  overflow: hidden;
}

/* 悬停时的光晕扩散效果 */
.nav-item::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at center, var(--gold-dim) 0%, transparent 70%);
  opacity: 0;
  transition: opacity var(--transition-normal);
}

.nav-item:hover {
  color: var(--text-primary);
  transform: scale(1.02) translateX(2px);
}

.nav-item:hover::before {
  opacity: 1;
}

.nav-item:hover .nav-icon {
  color: var(--gold-primary);
  filter: drop-shadow(0 0 6px var(--gold-glow));
  transform: scale(1.15);
}

.nav-item.active {
  color: var(--gold-primary);
  background: linear-gradient(90deg, var(--gold-dim) 0%, transparent 100%);
  box-shadow: inset 3px 0 0 var(--gold-primary);
}

.nav-item.active::after {
  content: '';
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 60%;
  background: var(--gold-primary);
  border-radius: 3px 0 0 3px;
  box-shadow: var(--glow-gold);
}

.nav-icon {
  width: 16px;
  height: 16px;
  image-rendering: pixelated;
  shape-rendering: crispEdges;
  transition: all var(--transition-normal);
  position: relative;
  z-index: 1;
}

.nav-label {
  font-size: 0.875rem;
  font-weight: 500;
  position: relative;
  z-index: 1;
}
</style>