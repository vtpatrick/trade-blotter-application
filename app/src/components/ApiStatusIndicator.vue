<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useHealthStore, type ApiConnectionState } from '@/stores/health'

const health = useHealthStore()
const { state, latencyMs, lastCheckedAt, error } = storeToRefs(health)

const LABELS: Record<ApiConnectionState, string> = {
  connecting: 'Connecting',
  healthy: 'Healthy',
  degraded: 'Degraded',
  unhealthy: 'Unhealthy',
  offline: 'Offline',
}

const label = computed(() => LABELS[state.value])

const tooltip = computed(() => {
  const parts = [`API: ${label.value}`]
  if (error.value) parts.push(error.value)
  if (lastCheckedAt.value) parts.push(`Last checked ${lastCheckedAt.value.toLocaleTimeString()}`)
  return parts.join('\n')
})
</script>

<template>
  <RouterLink to="/status" class="api-status" :class="state" :title="tooltip">
    <span class="dot" aria-hidden="true"></span>
    <span>API: {{ label }}</span>
    <span v-if="latencyMs !== null" class="latency">{{ latencyMs }} ms</span>
  </RouterLink>
</template>

<style scoped>
.api-status {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  font-size: 0.85rem;
  color: var(--color-text);
  white-space: nowrap;
}

.dot {
  width: 0.6rem;
  height: 0.6rem;
  border-radius: 50%;
  background: var(--status-color);
}

.latency {
  opacity: 0.6;
  font-variant-numeric: tabular-nums;
}

.connecting {
  --status-color: #9ca3af;
}
.healthy {
  --status-color: #22c55e;
}
.degraded {
  --status-color: #f59e0b;
}
.unhealthy,
.offline {
  --status-color: #ef4444;
}

.connecting .dot {
  animation: pulse 1s ease-in-out infinite;
}

@keyframes pulse {
  50% {
    opacity: 0.3;
  }
}
</style>
