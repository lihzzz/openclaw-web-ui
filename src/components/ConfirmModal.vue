<script setup lang="ts">
const props = defineProps<{
  visible: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
}>()

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()

function handleConfirm(): void {
  emit('confirm')
}

function handleCancel(): void {
  emit('cancel')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="visible" class="modal-overlay" @click="handleCancel">
        <div class="confirm-modal" @click.stop>
          <div class="modal-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h3 class="modal-title">{{ title }}</h3>
          <p class="modal-message">{{ message }}</p>
          <div class="modal-actions">
            <button class="btn btn-cancel" @click="handleCancel">
              {{ cancelText || '取消' }}
            </button>
            <button class="btn btn-confirm" @click="handleConfirm">
              {{ confirmText || '确定' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(3, 7, 17, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.confirm-modal {
  background: rgba(10, 17, 40, 0.95);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-lg);
  box-shadow: var(--glow-cyan), 0 8px 32px rgba(0, 0, 0, 0.4);
  padding: 1.5rem;
  width: 90%;
  max-width: 320px;
  text-align: center;
  animation: fadeIn var(--transition-normal);
}

.modal-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  margin: 0 auto 1rem;
  color: var(--warning);
  background: var(--warning-dim);
  border-radius: 50%;
  box-shadow: 0 0 20px rgba(255, 183, 0, 0.3);
}

.modal-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 0.5rem;
}

.modal-message {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin: 0 0 1.25rem;
  line-height: 1.5;
}

.modal-actions {
  display: flex;
  gap: 0.75rem;
}

.btn {
  flex: 1;
  padding: 0.625rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  border-radius: var(--radius);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn:active {
  transform: scale(0.98);
}

.btn-cancel {
  color: var(--text-secondary);
  background: rgba(3, 7, 17, 0.6);
  border: 1px solid var(--border-glass);
}

.btn-cancel:hover {
  color: var(--text-primary);
  background: rgba(3, 7, 17, 0.8);
  border-color: var(--text-muted);
}

.btn-confirm {
  color: var(--abyss-black);
  background: linear-gradient(135deg, var(--bio-cyan) 0%, #00b8c5 100%);
  border: none;
  box-shadow: var(--glow-cyan);
}

.btn-confirm:hover {
  box-shadow: 0 0 40px rgba(0, 245, 255, 0.5);
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

.modal-enter-active .confirm-modal,
.modal-leave-active .confirm-modal {
  transition: transform var(--transition-slow), opacity var(--transition-slow);
}

.modal-enter-from .confirm-modal,
.modal-leave-to .confirm-modal {
  transform: scale(0.95) translateY(10px);
  opacity: 0;
}
</style>