<script setup lang="ts">
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import ApiStatusIndicator from '@/components/ApiStatusIndicator.vue'
import { useHealthStore } from '@/stores/health'

const health = useHealthStore()
const { report, error, latencyMs, lastCheckedAt } = storeToRefs(health)

const checking = ref(false)

async function checkNow() {
  checking.value = true
  try {
    await health.check()
  } finally {
    checking.value = false
  }
}

function formatUptime(totalSeconds: number): string {
  const s = Math.floor(totalSeconds)
  const days = Math.floor(s / 86_400)
  const hours = Math.floor((s % 86_400) / 3_600)
  const minutes = Math.floor((s % 3_600) / 60)
  const seconds = s % 60
  return [days && `${days}d`, (days || hours) && `${hours}h`, `${minutes}m`, `${seconds}s`]
    .filter(Boolean)
    .join(' ')
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString()
}
</script>

<template>
  <main class="status">
    <div class="heading">
      <h1>System Status</h1>
      <ApiStatusIndicator />
      <button type="button" :disabled="checking" @click="checkNow">
        {{ checking ? 'Checking…' : 'Check now' }}
      </button>
    </div>

    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="lastCheckedAt" class="muted">
      Last checked {{ lastCheckedAt.toLocaleTimeString() }}
      <template v-if="latencyMs !== null"> · round trip {{ latencyMs }} ms</template>
      <template v-if="error && report"> · showing last known report</template>
    </p>

    <template v-if="report">
      <dl class="details">
        <dt>Service</dt>
        <dd>{{ report.service }}</dd>
        <dt>Version</dt>
        <dd>{{ report.version }}</dd>
        <dt>Environment</dt>
        <dd>{{ report.environment }}</dd>
        <dt>Started</dt>
        <dd>{{ formatTimestamp(report.startedAtUtc) }}</dd>
        <dt>Uptime</dt>
        <dd>{{ formatUptime(report.uptimeSeconds) }}</dd>
        <dt>Server time</dt>
        <dd>{{ formatTimestamp(report.serverTimeUtc) }}</dd>
      </dl>

      <h2>Checks</h2>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Status</th>
            <th>Description</th>
            <th class="num">Duration</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="check in report.checks" :key="check.name">
            <td>{{ check.name }}</td>
            <td :class="check.status.toLowerCase()">{{ check.status }}</td>
            <td>{{ check.description ?? '—' }}</td>
            <td class="num">{{ check.durationMs.toFixed(2) }} ms</td>
          </tr>
        </tbody>
      </table>
    </template>
  </main>
</template>

<style scoped>
.status {
  padding: 1rem 0;
}

.heading {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

h1 {
  font-size: 1.75rem;
}

h2 {
  font-size: 1.25rem;
  margin: 1.5rem 0 0.5rem;
}

button {
  padding: 0.3rem 0.9rem;
  cursor: pointer;
}

.muted {
  opacity: 0.7;
  font-size: 0.9rem;
}

.error {
  color: #ef4444;
}

.details {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 0.25rem 1.5rem;
  margin-top: 1rem;
}

dt {
  opacity: 0.7;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

th,
td {
  text-align: left;
  padding: 0.4rem 0.6rem;
  border-bottom: 1px solid var(--color-border);
}

.num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.healthy {
  color: #22c55e;
}
.degraded {
  color: #f59e0b;
}
.unhealthy {
  color: #ef4444;
}
</style>
