<script setup lang="ts">
import { ref, inject, type Ref } from 'vue'
import { fetchSkillFiles } from '@/services/agentApi'
import type { SkillFile } from '@/types'

// Props
const props = defineProps<{
  files: SkillFile[]
  depth?: number
}>()

// Inject from parent
const selectedFile = inject<Ref<SkillFile | null>>('selectedFile')
const expandedDirs = inject<Ref<Set<string>>>('expandedDirs')
const dirContents = inject<Ref<Map<string, SkillFile[]>>>('dirContents')
const loadingDirs = inject<Ref<Set<string>>>('loadingDirs')
const onSelectFile = inject<(file: SkillFile) => void>('onSelectFile')

// State
const localLoading = ref(new Set<string>())

// Methods
function isDirExpanded(dirPath: string): boolean {
  return expandedDirs?.value?.has(dirPath) || false
}

function isDirLoading(dirPath: string): boolean {
  return loadingDirs?.value?.has(dirPath) || localLoading.value.has(dirPath)
}

function getDirFiles(dirPath: string): SkillFile[] {
  return dirContents?.value?.get(dirPath) || []
}

async function toggleDirectory(dir: SkillFile) {
  if (dir.type !== 'directory') return

  const dirPath = dir.path

  if (expandedDirs?.value?.has(dirPath)) {
    expandedDirs.value.delete(dirPath)
  } else {
    // Expand - load contents if not cached
    if (dirContents?.value && !dirContents.value.has(dirPath)) {
      localLoading.value.add(dirPath)
      try {
        const result = await fetchSkillFiles(dirPath)
        dirContents.value.set(dirPath, result.files || [])
      } catch (err: any) {
        console.error(`Failed to load directory ${dirPath}:`, err)
      } finally {
        localLoading.value.delete(dirPath)
      }
    }
    expandedDirs?.value?.add(dirPath)
  }
}

function selectFile(file: SkillFile) {
  if (file.type === 'file' && onSelectFile) {
    onSelectFile(file)
  }
}

function getFileIcon(file: SkillFile): string {
  if (file.type === 'directory') return '📁'
  const name = file.name.toLowerCase()
  if (name.endsWith('.md')) return '📝'
  if (name.endsWith('.ts')) return '📘'
  if (name.endsWith('.js')) return '📙'
  if (name.endsWith('.json')) return '📋'
  if (name.endsWith('.py')) return '🐍'
  if (name.endsWith('.yaml') || name.endsWith('.yml')) return '⚙️'
  if (name.endsWith('.txt')) return '📃'
  return '📄'
}

function formatSize(size?: number): string {
  if (!size) return ''
  if (size > 1024) return `${(size / 1024).toFixed(1)}KB`
  return `${size}B`
}
</script>

<template>
  <template v-for="file in files" :key="file.path">
    <!-- Directory Item -->
    <div v-if="file.type === 'directory'" class="tree-dir">
      <div
        class="tree-item directory"
        :class="{ expanded: isDirExpanded(file.path) }"
        :style="{ paddingLeft: `${(depth || 0) * 12 + 8}px` }"
        @click="toggleDirectory(file)"
      >
        <span class="dir-arrow">{{ isDirExpanded(file.path) ? '▼' : '▶' }}</span>
        <span class="file-icon">{{ getFileIcon(file) }}</span>
        <span class="file-name">{{ file.name }}</span>
        <span v-if="isDirLoading(file.path)" class="dir-loading">...</span>
      </div>
      <!-- Nested Files (recursive) -->
      <div v-if="isDirExpanded(file.path)" class="tree-nested">
        <FileTreeItem
          v-if="getDirFiles(file.path).length > 0"
          :files="getDirFiles(file.path)"
          :depth="(depth || 0) + 1"
        />
        <div v-else class="tree-empty" :style="{ paddingLeft: `${(depth || 0) * 12 + 20}px` }">
          (空目录)
        </div>
      </div>
    </div>
    <!-- File Item -->
    <div
      v-else
      class="tree-item"
      :class="{ active: selectedFile?.path === file.path }"
      :style="{ paddingLeft: `${(depth || 0) * 12 + 8}px` }"
      @click="selectFile(file)"
    >
      <span class="file-icon">{{ getFileIcon(file) }}</span>
      <span class="file-name">{{ file.name }}</span>
      <span v-if="file.size" class="file-size">{{ formatSize(file.size) }}</span>
    </div>
  </template>
</template>

<style scoped>
.tree-dir {
  width: 100%;
}

.tree-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.5rem;
  padding-left: 8px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.tree-item:hover {
  background: rgba(0, 245, 255, 0.05);
}

.tree-item.active {
  background: rgba(0, 245, 255, 0.1);
}

.tree-item.directory {
  cursor: pointer;
}

.tree-item.directory.expanded {
  color: var(--bio-cyan);
}

.dir-arrow {
  font-size: 0.5rem;
  color: var(--text-muted);
  transition: transform var(--transition-fast);
  width: 0.625rem;
}

.tree-item.directory.expanded .dir-arrow {
  color: var(--bio-cyan);
}

.dir-loading {
  font-size: 0.625rem;
  color: var(--text-muted);
}

.tree-nested {
  border-left: 1px solid var(--border-glass);
  margin-left: 12px;
}

.tree-empty {
  font-size: 0.625rem;
  color: var(--text-muted);
  font-style: italic;
  padding: 0.25rem 0;
}

.file-icon {
  font-size: 0.875rem;
}

.file-name {
  flex: 1;
  font-size: 0.75rem;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-size {
  font-size: 0.5625rem;
  color: var(--text-muted);
}
</style>