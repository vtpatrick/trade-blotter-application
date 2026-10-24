<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useBlotterStore, type LiveFeedState } from '@/stores/blotter'

const { liveState } = storeToRefs(useBlotterStore())

const LABELS: Record<LiveFeedState, string> = {
  connecting: 'Connecting',
  live: 'Live',
  reconnecting: 'Reconnecting',
  offline: 'Feed offline',
}

const TOOLTIPS: Record<LiveFeedState, string> = {
  connecting: 'Opening the live trade feed…',
  live: 'New trades from any user appear instantly.',
  reconnecting: 'Live feed interrupted; reconnecting. The blotter reloads when it is back.',
  offline: 'Cannot reach the live feed; retrying every few seconds.',
}

const label = computed(() => LABELS[liveState.value])
const tooltip = computed(() => TOOLTIPS[liveState.value])
</script>

<template>
  <span class="feed" :class="liveState" :title="tooltip" role="status">
    <span class="dot" aria-hidden="true"></span>
    {{ label }}
  </span>
</template>

<style scoped>
.feed {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.05rem 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  font-size: 0.72rem;
  white-space: nowrap;
}

.dot {
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 50%;
  background: var(--status-color);
}

.feed.connecting,
.feed.reconnecting {
  --status-color: #f59e0b;
}
.feed.live {
  --status-color: #22c55e;
}
.feed.offline {
  --status-color: #ef4444;
}

.feed.live .dot {
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  50% {
    opacity: 0.35;
  }
}
</style>
