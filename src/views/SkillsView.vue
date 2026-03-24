<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch, provide } from 'vue'
import {
  fetchSkills,
  readSkillFile,
  writeSkillFile,
  createSkill,
  deleteSkill,
  createSkillFile,
  deleteSkillFile,
  reloadSkills
} from '@/services/agentApi'
import type { SkillInfo, SkillFile, SkillAgentInfo } from '@/types'
import FileTreeItem from '@/components/FileTreeItem.vue'

// State
const loading = ref(false)
const skills = ref<SkillInfo[]>([])
const agents = ref<Record<string, SkillAgentInfo>>({})
const error = ref('')
const filter = ref<'all' | 'builtin' | 'extension' | 'custom'>('custom')
const searchQuery = ref('')

// Selected skill
const selectedSkill = ref<SkillInfo | null>(null)
const selectedFile = ref<SkillFile | null>(null)
const fileContent = ref('')
const originalContent = ref('')
const fileLoading = ref(false)
const fileError = ref('')
const isEditing = ref(false)
const hasChanges = computed(() => fileContent.value !== originalContent.value)

// Expanded directories (track which dirs are expanded)
const expandedDirs = ref<Set<string>>(new Set())
const dirContents = ref<Map<string, SkillFile[]>>(new Map())
const loadingDirs = ref<Set<string>>(new Set())

// Provide for FileTreeItem component
provide('selectedFile', selectedFile)
provide('expandedDirs', expandedDirs)
provide('dirContents', dirContents)
provide('loadingDirs', loadingDirs)
provide('onSelectFile', selectFile)

// Create skill modal
const showCreateSkill = ref(false)
const newSkillId = ref('')
const newSkillName = ref('')
const newSkillDesc = ref('')
const newSkillEmoji = ref('🔧')
const creating = ref(false)

// Create file modal
const showCreateFile = ref(false)
const newFileName = ref('')
const creatingFile = ref(false)

// Delete confirmation
const showDeleteConfirm = ref(false)
const deleteTarget = ref<'skill' | 'file'>('skill')
const deletePath = ref('')

// Refresh timer
let refreshTimer: ReturnType<typeof setInterval> | null = null

// Computed
const filteredSkills = computed(() => {
  let result = skills.value

  // Filter by source
  if (filter.value === 'builtin') {
    result = result.filter(s => s.source === 'builtin')
  } else if (filter.value === 'extension') {
    result = result.filter(s => s.source.startsWith('extension:'))
  } else if (filter.value === 'custom') {
    result = result.filter(s => s.source === 'custom')
  }

  // Filter by search
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(s =>
      s.name.toLowerCase().includes(query) ||
      s.description.toLowerCase().includes(query) ||
      s.id.toLowerCase().includes(query)
    )
  }

  return result
})

const builtinCount = computed(() => skills.value.filter(s => s.source === 'builtin').length)
const extensionCount = computed(() => skills.value.filter(s => s.source.startsWith('extension:')).length)
const customCount = computed(() => skills.value.filter(s => s.source === 'custom').length)

const canEdit = computed(() => {
  return selectedSkill.value?.source === 'custom'
})

const canDelete = computed(() => {
  return selectedSkill.value?.source === 'custom'
})

// Methods
async function loadSkills() {
  loading.value = true
  error.value = ''

  try {
    const result = await fetchSkills()
    skills.value = result.skills || []
    agents.value = result.agents || {}
  } catch (err: any) {
    error.value = `加载失败: ${err.message}`
  } finally {
    loading.value = false
  }
}

async function selectSkill(skill: SkillInfo) {
  selectedSkill.value = skill
  selectedFile.value = null
  fileContent.value = ''
  originalContent.value = ''
  isEditing.value = false
  fileError.value = ''

  // Auto-select SKILL.md
  const skillMd = skill.files?.find(f => f.name === 'SKILL.md')
  if (skillMd) {
    await selectFile(skillMd)
  }
}

async function selectFile(file: SkillFile) {
  if (file.type === 'directory') return

  selectedFile.value = file
  fileLoading.value = true
  fileError.value = ''
  isEditing.value = false

  try {
    const result = await readSkillFile(file.path)
    fileContent.value = result.content
    originalContent.value = result.content
  } catch (err: any) {
    fileError.value = `读取失败: ${err.message}`
  } finally {
    fileLoading.value = false
  }
}

function startEditing() {
  isEditing.value = true
}

function cancelEditing() {
  fileContent.value = originalContent.value
  isEditing.value = false
}

async function saveFile() {
  if (!selectedFile.value) return

  fileLoading.value = true
  fileError.value = ''

  try {
    const result = await writeSkillFile(selectedFile.value.path, fileContent.value)
    if (result.success) {
      originalContent.value = fileContent.value
      isEditing.value = false
      await loadSkills()
    } else {
      fileError.value = result.error || '保存失败'
    }
  } catch (err: any) {
    fileError.value = `保存失败: ${err.message}`
  } finally {
    fileLoading.value = false
  }
}

async function handleReload() {
  fileLoading.value = true
  try {
    await reloadSkills()
    await loadSkills()
  } catch (err: any) {
    fileError.value = `重载失败: ${err.message}`
  } finally {
    fileLoading.value = false
  }
}

// Create skill
function openCreateSkill() {
  newSkillId.value = ''
  newSkillName.value = ''
  newSkillDesc.value = ''
  newSkillEmoji.value = '🔧'
  showCreateSkill.value = true
}

async function handleCreateSkill() {
  if (!newSkillId.value.trim()) return

  creating.value = true
  try {
    const result = await createSkill(
      newSkillId.value.trim(),
      newSkillName.value.trim() || newSkillId.value.trim(),
      newSkillDesc.value.trim(),
      newSkillEmoji.value
    )

    if (result.success) {
      showCreateSkill.value = false
      await loadSkills()
      // Select the new skill
      const newSkill = skills.value.find(s => s.id === newSkillId.value.trim() && s.source === 'custom')
      if (newSkill) {
        await selectSkill(newSkill)
      }
    } else {
      error.value = result.error || '创建失败'
    }
  } catch (err: any) {
    error.value = `创建失败: ${err.message}`
  } finally {
    creating.value = false
  }
}

// Create file
function openCreateFile() {
  newFileName.value = ''
  showCreateFile.value = true
}

async function handleCreateFile() {
  if (!newFileName.value.trim() || !selectedSkill.value) return

  creatingFile.value = true
  try {
    // Get skill directory from skill location
    const skillDir = selectedSkill.value.location.replace('/SKILL.md', '')
    const result = await createSkillFile(skillDir, newFileName.value.trim())

    if (result.success) {
      showCreateFile.value = false
      await loadSkills()
      // Refresh skill files
      const updatedSkill = skills.value.find(s => s.id === selectedSkill.value?.id && s.source === selectedSkill.value?.source)
      if (updatedSkill) {
        selectedSkill.value = updatedSkill
        // Select the new file
        const newFile = updatedSkill.files?.find(f => f.name === newFileName.value.trim())
        if (newFile) {
          await selectFile(newFile)
        }
      }
    } else {
      error.value = result.error || '创建失败'
    }
  } catch (err: any) {
    error.value = `创建失败: ${err.message}`
  } finally {
    creatingFile.value = false
  }
}

// Delete
function confirmDeleteSkill() {
  deleteTarget.value = 'skill'
  deletePath.value = selectedSkill.value?.id || ''
  showDeleteConfirm.value = true
}

function confirmDeleteFile() {
  deleteTarget.value = 'file'
  deletePath.value = selectedFile.value?.path || ''
  showDeleteConfirm.value = true
}

async function handleDelete() {
  if (deleteTarget.value === 'skill' && selectedSkill.value) {
    try {
      const result = await deleteSkill(selectedSkill.value.source, selectedSkill.value.id)
      if (result.success) {
        selectedSkill.value = null
        selectedFile.value = null
        showDeleteConfirm.value = false
        await loadSkills()
      } else {
        error.value = result.error || '删除失败'
      }
    } catch (err: any) {
      error.value = `删除失败: ${err.message}`
    }
  } else if (deleteTarget.value === 'file' && selectedFile.value) {
    try {
      const result = await deleteSkillFile(selectedFile.value.path)
      if (result.success) {
        selectedFile.value = null
        showDeleteConfirm.value = false
        await loadSkills()
        // Refresh skill files
        if (selectedSkill.value) {
          const updatedSkill = skills.value.find(s => s.id === selectedSkill.value?.id && s.source === selectedSkill.value?.source)
          if (updatedSkill) {
            selectedSkill.value = updatedSkill
          }
        }
      } else {
        error.value = result.error || '删除失败'
      }
    } catch (err: any) {
      error.value = `删除失败: ${err.message}`
    }
  }
}

// Source badge
function getSourceLabel(source: string): string {
  if (source === 'builtin') return '内置'
  if (source.startsWith('extension:')) return `扩展:${source.split(':')[1]}`
  return '自定义'
}

function getSourceClass(source: string): string {
  if (source === 'builtin') return 'builtin'
  if (source.startsWith('extension:')) return 'extension'
  return 'custom'
}

// Get skill directory from location (SKILL.md path)
function getSkillDir(location: string): string {
  // Remove /SKILL.md suffix to get the directory
  return location.replace(/\/SKILL\.md$/, '')
}

// Lifecycle
onMounted(async () => {
  await loadSkills()
  refreshTimer = setInterval(() => {
    loadSkills()
  }, 30000)
})

onUnmounted(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
  }
})

// Warn before leaving with unsaved changes
watch(isEditing, (editing) => {
  if (editing) {
    window.addEventListener('beforeunload', (e) => {
      if (hasChanges.value) {
        e.preventDefault()
        e.returnValue = ''
      }
    })
  }
})
</script>

<template>
  <div class="skills-view">
    <!-- Header -->
    <div class="view-header">
      <div class="header-title">
        <h1>🧩 Skills</h1>
        <p class="subtitle">
          共 {{ skills.length }} 个技能 · 内置 {{ builtinCount }} / 扩展 {{ extensionCount }} / 自定义 {{ customCount }}
        </p>
      </div>
      <button class="btn btn-primary" @click="openCreateSkill">
        ➕ 新建技能
      </button>
    </div>

    <!-- Toolbar -->
    <div class="toolbar">
      <div class="filter-tabs">
        <button
          v-for="f in ['all', 'builtin', 'extension', 'custom'] as const"
          :key="f"
          class="filter-tab"
          :class="{ active: filter === f }"
          @click="filter = f"
        >
          {{ f === 'all' ? '全部' : f === 'builtin' ? '内置' : f === 'extension' ? '扩展' : '自定义' }}
        </button>
      </div>
      <input
        v-model="searchQuery"
        type="text"
        class="search-input"
        placeholder="搜索技能..."
      />
      <button class="btn btn-secondary" @click="handleReload">
        🔄 刷新
      </button>
    </div>

    <!-- Error -->
    <div v-if="error" class="message error">{{ error }}</div>

    <!-- Loading -->
    <div v-if="loading && !skills.length" class="loading-state">
      <p>加载中...</p>
    </div>

    <!-- Main Content -->
    <div v-else class="skills-container">
      <!-- Skills List -->
      <div class="skills-list">
        <div v-if="filteredSkills.length === 0" class="empty-state">
          <p>暂无技能</p>
        </div>
        <div
          v-for="skill in filteredSkills"
          :key="`${skill.source}-${skill.id}`"
          class="skill-card"
          :class="{ active: selectedSkill?.id === skill.id && selectedSkill?.source === skill.source }"
          @click="selectSkill(skill)"
        >
          <div class="skill-header">
            <span class="skill-emoji">{{ skill.emoji }}</span>
            <span class="skill-name">{{ skill.name }}</span>
            <span class="skill-badge" :class="getSourceClass(skill.source)">
              {{ getSourceLabel(skill.source) }}
            </span>
          </div>
          <p class="skill-desc">{{ skill.description || '暂无描述' }}</p>
          <div class="skill-location" :title="getSkillDir(skill.location)">
            📂 {{ getSkillDir(skill.location) }}
          </div>
          <div v-if="skill.usedBy.length > 0" class="skill-usage">
            <span class="usage-label">使用:</span>
            <span
              v-for="agentId in skill.usedBy.slice(0, 3)"
              :key="agentId"
              class="usage-agent"
            >
              {{ agents[agentId]?.emoji || '🤖' }} {{ agents[agentId]?.name || agentId }}
            </span>
            <span v-if="skill.usedBy.length > 3" class="usage-more">
              +{{ skill.usedBy.length - 3 }}
            </span>
          </div>
          <div v-if="skill.files" class="skill-files-count">
            📁 {{ skill.files.filter(f => f.type === 'file').length }} 文件
          </div>
        </div>
      </div>

      <!-- Skill Detail -->
      <div v-if="selectedSkill" class="skill-detail">
        <!-- Skill Header -->
        <div class="detail-header">
          <div class="detail-info">
            <h2>{{ selectedSkill.emoji }} {{ selectedSkill.name }}</h2>
            <p class="detail-id">
              <code>{{ selectedSkill.id }}</code>
              <span class="skill-badge" :class="getSourceClass(selectedSkill.source)">
                {{ getSourceLabel(selectedSkill.source) }}
              </span>
            </p>
            <p class="detail-location" :title="getSkillDir(selectedSkill.location)">
              📂 {{ getSkillDir(selectedSkill.location) }}
            </p>
          </div>
          <div class="detail-actions">
            <button
              v-if="canEdit"
              class="btn btn-secondary"
              @click="openCreateFile"
            >
              📄 新建文件
            </button>
            <button
              v-if="canDelete"
              class="btn btn-danger"
              @click="confirmDeleteSkill"
            >
              🗑️ 删除技能
            </button>
          </div>
        </div>

        <!-- File Tree & Editor -->
        <div class="detail-content">
          <!-- File Tree -->
          <div class="file-tree">
            <div class="tree-header">
              <h3>文件列表</h3>
            </div>
            <div class="tree-content">
              <FileTreeItem :files="selectedSkill.files || []" :depth="0" />
            </div>
          </div>

          <!-- Editor -->
          <div class="editor-panel">
            <div v-if="!selectedFile" class="editor-placeholder">
              <p>选择文件查看内容</p>
            </div>

            <div v-else-if="fileLoading" class="editor-loading">
              <p>加载中...</p>
            </div>

            <div v-else-if="fileError" class="editor-error">
              <p>{{ fileError }}</p>
            </div>

            <template v-else>
              <div class="editor-header">
                <div class="editor-file-info">
                  <span class="editor-filename">{{ selectedFile.name }}</span>
                  <span v-if="hasChanges && isEditing" class="editor-modified">已修改</span>
                </div>
                <div class="editor-actions">
                  <template v-if="!isEditing">
                    <button
                      class="btn btn-secondary"
                      @click="startEditing"
                    >
                      ✏️ 编辑
                    </button>
                    <button
                      v-if="canDelete && selectedFile.name !== 'SKILL.md'"
                      class="btn btn-danger-sm"
                      @click="confirmDeleteFile"
                    >
                      🗑️
                    </button>
                  </template>
                  <template v-else>
                    <button class="btn btn-secondary" @click="cancelEditing">
                      取消
                    </button>
                    <button class="btn btn-primary" @click="saveFile">
                      💾 保存
                    </button>
                  </template>
                </div>
              </div>
              <textarea
                v-if="isEditing"
                v-model="fileContent"
                class="code-editor"
                spellcheck="false"
              ></textarea>
              <pre v-else class="code-preview">{{ fileContent }}</pre>
            </template>
          </div>
        </div>
      </div>

      <!-- No Selection -->
      <div v-else class="no-selection">
        <p>选择一个技能查看详情</p>
      </div>
    </div>

    <!-- Create Skill Modal -->
    <div v-if="showCreateSkill" class="modal-overlay" @click.self="showCreateSkill = false">
      <div class="modal">
        <div class="modal-header">
          <h3>新建技能</h3>
          <button class="modal-close" @click="showCreateSkill = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>技能 ID</label>
            <input v-model="newSkillId" type="text" placeholder="my-skill" />
          </div>
          <div class="form-group">
            <label>名称</label>
            <input v-model="newSkillName" type="text" placeholder="我的技能" />
          </div>
          <div class="form-group">
            <label>描述</label>
            <textarea v-model="newSkillDesc" placeholder="技能描述..."></textarea>
          </div>
          <div class="form-group">
            <label>Emoji</label>
            <input v-model="newSkillEmoji" type="text" placeholder="🔧" />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showCreateSkill = false">取消</button>
          <button class="btn btn-primary" :disabled="creating || !newSkillId.trim()" @click="handleCreateSkill">
            {{ creating ? '创建中...' : '创建' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Create File Modal -->
    <div v-if="showCreateFile" class="modal-overlay" @click.self="showCreateFile = false">
      <div class="modal">
        <div class="modal-header">
          <h3>新建文件</h3>
          <button class="modal-close" @click="showCreateFile = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>文件名</label>
            <input v-model="newFileName" type="text" placeholder="example.md" />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showCreateFile = false">取消</button>
          <button class="btn btn-primary" :disabled="creatingFile || !newFileName.trim()" @click="handleCreateFile">
            {{ creatingFile ? '创建中...' : '创建' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Delete Confirm Modal -->
    <div v-if="showDeleteConfirm" class="modal-overlay" @click.self="showDeleteConfirm = false">
      <div class="modal modal-sm">
        <div class="modal-header">
          <h3>确认删除</h3>
          <button class="modal-close" @click="showDeleteConfirm = false">×</button>
        </div>
        <div class="modal-body">
          <p>
            {{ deleteTarget === 'skill' ? '确定要删除此技能吗？此操作不可撤销。' : '确定要删除此文件吗？此操作不可撤销。' }}
          </p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showDeleteConfirm = false">取消</button>
          <button class="btn btn-danger" @click="handleDelete">删除</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.skills-view {
  padding: 1.5rem;
  height: 100%;
  overflow-y: auto;
}

/* Header */
.view-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.header-title h1 {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.subtitle {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-top: 0.25rem;
}

/* Toolbar */
.toolbar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.filter-tabs {
  display: flex;
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.filter-tab {
  padding: 0.5rem 1rem;
  font-size: 0.75rem;
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.filter-tab:hover {
  color: var(--text-primary);
}

.filter-tab.active {
  color: var(--abyss-black);
  background: var(--bio-cyan);
}

.search-input {
  flex: 1;
  max-width: 200px;
  padding: 0.5rem 0.75rem;
  font-size: 0.75rem;
  color: var(--text-primary);
  background: rgba(10, 17, 40, 0.6);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-sm);
}

.search-input:focus {
  outline: none;
  border-color: var(--bio-cyan);
}

/* Buttons */
.btn {
  padding: 0.5rem 1rem;
  font-size: 0.75rem;
  font-weight: 500;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  color: var(--abyss-black);
  background: var(--bio-cyan);
  border: 1px solid var(--bio-cyan);
}

.btn-primary:hover:not(:disabled) {
  background: #00d4e0;
}

.btn-secondary {
  color: var(--text-primary);
  background: rgba(10, 17, 40, 0.6);
  border: 1px solid var(--border-glass);
}

.btn-secondary:hover:not(:disabled) {
  border-color: var(--bio-cyan);
}

.btn-danger {
  color: #fca5a5;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.btn-danger:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.2);
}

.btn-danger-sm {
  padding: 0.375rem 0.5rem;
  font-size: 0.625rem;
  color: #fca5a5;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: var(--radius-sm);
  cursor: pointer;
}

/* Messages */
.message {
  padding: 0.75rem 1rem;
  border-radius: var(--radius-sm);
  margin-bottom: 1rem;
  font-size: 0.875rem;
}

.message.error {
  color: #fca5a5;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
}

/* Loading */
.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4rem;
  color: var(--text-muted);
}

/* Skills Container */
.skills-container {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 1rem;
  height: calc(100% - 120px);
}

/* Skills List */
.skills-list {
  background: rgba(10, 17, 40, 0.6);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius);
  overflow-y: auto;
  padding: 0.5rem;
}

.empty-state {
  padding: 2rem;
  text-align: center;
  color: var(--text-muted);
  font-size: 0.875rem;
}

.skill-card {
  padding: 0.75rem;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
  margin-bottom: 0.5rem;
}

.skill-card:hover {
  background: rgba(0, 245, 255, 0.05);
}

.skill-card.active {
  background: rgba(0, 245, 255, 0.1);
  border: 1px solid var(--bio-cyan);
}

.skill-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.375rem;
}

.skill-emoji {
  font-size: 1rem;
}

.skill-name {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-primary);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.skill-badge {
  font-size: 0.5625rem;
  padding: 0.125rem 0.375rem;
  border-radius: var(--radius-sm);
  font-weight: 500;
}

.skill-badge.builtin {
  color: #60a5fa;
  background: rgba(96, 165, 250, 0.1);
}

.skill-badge.extension {
  color: #c084fc;
  background: rgba(192, 132, 252, 0.1);
}

.skill-badge.custom {
  color: #4ade80;
  background: rgba(74, 222, 128, 0.1);
}

.skill-desc {
  font-size: 0.6875rem;
  color: var(--text-muted);
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.skill-location {
  margin-top: 0.25rem;
  font-size: 0.5625rem;
  color: var(--text-muted);
  opacity: 0.7;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--font-mono);
}

.skill-usage {
  margin-top: 0.375rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  align-items: center;
}

.usage-label {
  font-size: 0.5625rem;
  color: var(--text-muted);
}

.usage-agent {
  font-size: 0.5625rem;
  padding: 0.0625rem 0.25rem;
  background: var(--ocean-dark);
  border-radius: var(--radius-sm);
}

.usage-more {
  font-size: 0.5625rem;
  color: var(--text-muted);
}

.skill-files-count {
  margin-top: 0.25rem;
  font-size: 0.5625rem;
  color: var(--text-muted);
}

/* Skill Detail */
.skill-detail {
  background: rgba(10, 17, 40, 0.6);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.detail-header {
  padding: 1rem;
  border-bottom: 1px solid var(--border-glass);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.detail-info h2 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 0.25rem 0;
}

.detail-id {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
}

.detail-id code {
  font-size: 0.6875rem;
  padding: 0.125rem 0.375rem;
  background: rgba(0, 0, 0, 0.3);
  border-radius: var(--radius-sm);
}

.detail-location {
  margin: 0.375rem 0 0 0;
  font-size: 0.625rem;
  color: var(--text-muted);
  font-family: var(--font-mono);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 400px;
}

.detail-actions {
  display: flex;
  gap: 0.5rem;
}

.detail-content {
  flex: 1;
  display: grid;
  grid-template-columns: 200px 1fr;
  overflow: hidden;
}

/* File Tree */
.file-tree {
  border-right: 1px solid var(--border-glass);
  display: flex;
  flex-direction: column;
}

.tree-header {
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--border-glass);
}

.tree-header h3 {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.tree-content {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem;
}

/* Editor Panel */
.editor-panel {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.editor-placeholder,
.editor-loading,
.editor-error {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  font-size: 0.875rem;
}

.editor-error {
  color: #fca5a5;
}

.editor-header {
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--border-glass);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.editor-file-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.editor-filename {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-primary);
}

.editor-modified {
  font-size: 0.625rem;
  color: #fcd34d;
  background: rgba(234, 179, 8, 0.1);
  padding: 0.125rem 0.375rem;
  border-radius: var(--radius-sm);
}

.editor-actions {
  display: flex;
  gap: 0.5rem;
}

.code-editor {
  flex: 1;
  padding: 1rem;
  font-size: 0.75rem;
  font-family: var(--font-mono);
  color: var(--text-primary);
  background: var(--ocean-dark);
  border: none;
  resize: none;
}

.code-editor:focus {
  outline: none;
}

.code-preview {
  flex: 1;
  margin: 0;
  padding: 1rem;
  font-size: 0.75rem;
  font-family: var(--font-mono);
  color: var(--text-primary);
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
}

/* No Selection */
.no-selection {
  background: rgba(10, 17, 40, 0.6);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
}

.modal {
  background: #1a1a2e;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: var(--radius);
  width: 90%;
  max-width: 400px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}

.modal-sm {
  max-width: 320px;
}

.modal-header {
  padding: 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(255, 255, 255, 0.03);
}

.modal-header h3 {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.modal-close {
  width: 1.5rem;
  height: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  color: var(--text-secondary);
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: color var(--transition-fast);
}

.modal-close:hover {
  color: var(--text-primary);
}

.modal-body {
  padding: 1rem;
  background: rgba(0, 0, 0, 0.2);
}

.modal-body p {
  color: var(--text-secondary);
  font-size: 0.875rem;
  line-height: 1.5;
}

.modal-footer {
  padding: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  background: rgba(0, 0, 0, 0.15);
}

.form-group {
  margin-bottom: 0.75rem;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-group label {
  display: block;
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-bottom: 0.25rem;
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 0.5rem 0.75rem;
  font-size: 0.75rem;
  color: var(--text-primary);
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-sm);
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: var(--bio-cyan);
}

.form-group textarea {
  min-height: 60px;
  resize: vertical;
}

/* Responsive */
@media (max-width: 768px) {
  .skills-view {
    padding: 1rem;
  }

  .skills-container {
    grid-template-columns: 1fr;
    height: auto;
  }

  .skills-list {
    max-height: 300px;
  }

  .detail-content {
    grid-template-columns: 1fr;
  }

  .file-tree {
    border-right: none;
    border-bottom: 1px solid var(--border-glass);
    max-height: 150px;
  }
}
</style>