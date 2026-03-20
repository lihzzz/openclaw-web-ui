<script setup lang="ts">
import type { ToolCall } from '@/stores/chat'
import { ref } from 'vue'

const props = defineProps<{
  toolCalls: ToolCall[]
}>()

const showModal = ref(false)
const expandedTools = ref<Set<string>>(new Set())

// 默认展开所有工具
function initExpandedTools() {
  expandedTools.value = new Set(props.toolCalls.map(t => t.id))
}

// 切换单个工具的展开状态
function toggleTool(toolId: string) {
  if (expandedTools.value.has(toolId)) {
    expandedTools.value.delete(toolId)
  } else {
    expandedTools.value.add(toolId)
  }
}

// 检查工具是否展开
function isToolExpanded(toolId: string): boolean {
  return expandedTools.value.has(toolId)
}

// 获取状态统计
function getStatusSummary(): { running: number; success: number; error: number } {
  return {
    running: props.toolCalls.filter(t => t.status === 'running').length,
    success: props.toolCalls.filter(t => t.status === 'success').length,
    error: props.toolCalls.filter(t => t.status === 'error').length
  }
}

// 格式化 JSON
function formatJson(obj: unknown): string {
  try {
    return JSON.stringify(obj, null, 2)
  } catch {
    return String(obj)
  }
}

// 打开弹窗时初始化展开状态
function openModal() {
  initExpandedTools()
  showModal.value = true
}

// 全部展开
function expandAll() {
  expandedTools.value = new Set(props.toolCalls.map(t => t.id))
}

// 全部折叠
function collapseAll() {
  expandedTools.value = new Set()
}
</script>

<template>
  <div class="tool-calls-summary" @click="openModal">
    <div class="summary-icon">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
      </svg>
    </div>
    <span class="summary-text">使用了 {{ toolCalls.length }} 个工具</span>
    <div class="status-dots">
      <span v-if="getStatusSummary().running > 0" class="status-dot running"></span>
      <span v-if="getStatusSummary().success > 0" class="status-dot success"></span>
      <span v-if="getStatusSummary().error > 0" class="status-dot error"></span>
    </div>
    <svg class="expand-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  </div>

  <!-- 工具详情弹窗 -->
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="showModal" class="modal-overlay" @click="showModal = false">
        <div class="tool-modal" @click.stop>
          <div class="modal-header">
            <h3 class="modal-title">工具调用详情 ({{ toolCalls.length }})</h3>
            <div class="header-actions">
              <button class="action-btn" @click="expandAll">
                全部展开
              </button>
              <button class="action-btn" @click="collapseAll">
                全部折叠
              </button>
              <button class="close-btn" @click="showModal = false">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          <div class="modal-body">
            <div
              v-for="tool in toolCalls"
              :key="tool.id"
              class="tool-item"
              :class="`status-${tool.status}`"
            >
              <div class="tool-header" @click="toggleTool(tool.id)">
                <span class="tool-arrow">{{ isToolExpanded(tool.id) ? '▼' : '▶' }}</span>
                <div class="tool-status-icon">
                  <svg v-if="tool.status === 'running'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  <svg v-else-if="tool.status === 'success'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <svg v-else-if="tool.status === 'error'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                  <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <span class="tool-name">{{ tool.name }}</span>
                <span class="tool-status-text">{{ tool.status }}</span>
              </div>

              <div v-if="isToolExpanded(tool.id)" class="tool-details">
                <div class="detail-section">
                  <div class="detail-label">输入参数</div>
                  <pre class="detail-code">{{ formatJson(tool.input) }}</pre>
                </div>

                <div v-if="tool.output" class="detail-section">
                  <div class="detail-label">输出结果</div>
                  <pre class="detail-code">{{ tool.output }}</pre>
                </div>

                <div v-if="tool.error" class="detail-section error-section">
                  <div class="detail-label">错误信息</div>
                  <pre class="detail-code error-text">{{ tool.error }}</pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.tool-calls-summary {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.625rem;
  background: rgba(0, 245, 255, 0.08);
  border: 1px solid rgba(0, 245, 255, 0.2);
  border-radius: var(--radius);
  cursor: pointer;
  transition: all var(--transition-fast);
  margin-top: 0.5rem;
}

.tool-calls-summary:hover {
  background: rgba(0, 245, 255, 0.15);
  border-color: var(--bio-cyan);
  box-shadow: var(--glow-cyan);
}

.summary-icon {
  display: flex;
  align-items: center;
  color: var(--bio-cyan);
}

.summary-text {
  font-size: 0.75rem;
  font-family: var(--font-mono);
  color: var(--bio-cyan);
}

.status-dots {
  display: flex;
  gap: 4px;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.status-dot.running {
  background: var(--bio-cyan);
  animation: pulse 1.5s infinite;
}

.status-dot.success {
  background: var(--success);
}

.status-dot.error {
  background: var(--error);
}

.expand-icon {
  color: var(--text-muted);
  margin-left: 0.25rem;
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(3, 7, 17, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.tool-modal {
  background: rgba(10, 17, 40, 0.95);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-lg);
  box-shadow: var(--glow-cyan), 0 8px 32px rgba(0, 0, 0, 0.4);
  width: 90%;
  max-width: 800px;
  height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  animation: fadeIn var(--transition-normal);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--border-glass);
  background: rgba(3, 7, 17, 0.4);
  flex-shrink: 0;
}

.modal-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--bio-cyan);
  margin: 0;
  text-shadow: 0 0 20px rgba(0, 245, 255, 0.3);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.action-btn {
  font-size: 0.6875rem;
  padding: 0.25rem 0.5rem;
  color: var(--text-muted);
  background: transparent;
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.action-btn:hover {
  color: var(--bio-cyan);
  border-color: var(--bio-cyan);
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  color: var(--text-muted);
  background: transparent;
  border-radius: var(--radius);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.close-btn:hover {
  color: var(--bio-cyan);
  background: var(--bio-cyan-dim);
}

.modal-body {
  padding: 1rem;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.tool-item {
  background: rgba(3, 7, 17, 0.6);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.tool-item.status-running {
  border-color: rgba(0, 245, 255, 0.3);
  box-shadow: var(--glow-cyan);
}

.tool-item.status-success {
  border-color: rgba(0, 255, 136, 0.3);
}

.tool-item.status-error {
  border-color: rgba(255, 51, 102, 0.3);
}

.tool-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 0.875rem;
  background: rgba(0, 245, 255, 0.03);
  border-bottom: 1px solid var(--border-glass);
  cursor: pointer;
  user-select: none;
}

.tool-header:hover {
  background: rgba(0, 245, 255, 0.06);
}

.tool-arrow {
  font-size: 0.625rem;
  color: var(--text-muted);
  width: 12px;
  transition: transform var(--transition-fast);
}

.tool-status-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
}

.status-running .tool-status-icon {
  color: var(--bio-cyan);
}

.status-success .tool-status-icon {
  color: var(--success);
}

.status-error .tool-status-icon {
  color: var(--error);
}

.status-pending .tool-status-icon {
  color: var(--warning);
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.tool-name {
  flex: 1;
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-primary);
}

.tool-status-text {
  font-size: 0.6875rem;
  font-family: var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.125rem 0.5rem;
  border-radius: var(--radius-sm);
}

.status-running .tool-status-text {
  color: var(--bio-cyan);
  background: var(--bio-cyan-dim);
}

.status-success .tool-status-text {
  color: var(--success);
  background: var(--success-dim);
}

.status-error .tool-status-text {
  color: var(--error);
  background: var(--error-dim);
}

.status-pending .tool-status-text {
  color: var(--warning);
  background: var(--warning-dim);
}

.tool-details {
  padding: 0.75rem;
  max-height: 300px;
  overflow-y: auto;
  overflow-x: hidden;
}

.detail-section {
  margin-bottom: 0.75rem;
}

.detail-section:last-child {
  margin-bottom: 0;
}

.detail-label {
  font-size: 0.6875rem;
  font-weight: 500;
  font-family: var(--font-mono);
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.375rem;
}

.detail-code {
  margin: 0;
  padding: 0.625rem;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  line-height: 1.5;
  color: var(--text-primary);
  background: rgba(3, 7, 17, 0.8);
  border-radius: var(--radius-sm);
  overflow-y: auto;
  overflow-x: hidden;
  white-space: pre-wrap;
  word-break: break-word;
  border: 1px solid var(--border-glass);
  min-height: auto;
  max-height: 300px;
}

.error-section .detail-code {
  border-color: rgba(255, 51, 102, 0.3);
  background: rgba(255, 51, 102, 0.05);
}

.error-text {
  color: var(--error);
}

/* Transition */
.modal-enter-active,
.modal-leave-active {
  transition: opacity var(--transition-slow);
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .tool-modal,
.modal-leave-active .tool-modal {
  transition: transform var(--transition-slow), opacity var(--transition-slow);
}

.modal-enter-from .tool-modal,
.modal-leave-to .tool-modal {
  transform: scale(0.95) translateY(10px);
  opacity: 0;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
</style>