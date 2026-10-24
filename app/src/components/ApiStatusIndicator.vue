<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useHealthStore, type ApiConnectionState } from '@/stores/health'

const health = useHealthStore()
const { state, latencyMs, lastCheckedAt, error, report } = storeToRefs(health)

const LABELS: Record<ApiConnectionState, string> = {
  connecting: 'Connecting',
  healthy: 'Healthy',
  degraded: 'Degraded',
  unhealthy: 'Unhealthy',
  offline: 'Offline',
}

const label = computed(() => LABELS[state.value])

// The badge is the only place health shows, so its tooltip carries the detail: each check's status.
const tooltip = computed(() => {
  const parts = [`API: ${label.value}`]
  if (error.value) parts.push(error.value)
  for (const check of report.value?.checks ?? []) {
    parts.push(
      `${check.name}: ${check.status}${check.description ? ` (${check.description})` : ''}`,
    )
  }
  if (report.value)
    parts.push(`${report.value.service} ${report.value.version}, ${report.value.environment}`)
  if (lastCheckedAt.value) parts.push(`Last checked ${lastCheckedAt.value.toLocaleTimeString()}`)
  return parts.join('\n')
})
</script>

<template>
  <span class="api-status" :class="state" :title="tooltip" role="status">
    <span class="dot" aria-hidden="true"></span>
    <span>API: {{ label }}</span>
    <span v-if="latencyMs !== null" class="latency">{{ latencyMs }} ms</span>
  </span>
</template>

<style scoped>
.api-status {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.05rem 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  font-size: 0.72rem;
  color: var(--color-text);
  white-space: nowrap;
  cursor: default;
}

.dot {
  width: 0.45rem;
  height: 0.45rem;
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
