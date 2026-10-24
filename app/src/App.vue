<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { RouterLink, RouterView } from 'vue-router'
import ApiStatusIndicator from './components/ApiStatusIndicator.vue'
import LiveFeedIndicator from './components/LiveFeedIndicator.vue'
import ThemeToggle from './components/ThemeToggle.vue'
import { useBlotterStore } from './stores/blotter'
import { useHealthStore } from './stores/health'

const health = useHealthStore()
const blotter = useBlotterStore()

onMounted(() => {
  health.startPolling()
  blotter.start()
})

onUnmounted(() => {
  health.stopPolling()
  void blotter.stop()
})
</script>

<template>
  <header class="app-header">
    <RouterLink to="/" class="brand">Trade Blotter</RouterLink>

    <nav>
      <RouterLink to="/">Blotter</RouterLink>
      <RouterLink to="/positions">Positions</RouterLink>
      <RouterLink to="/status">Status</RouterLink>
    </nav>

    <div class="indicators">
      <LiveFeedIndicator />
      <ApiStatusIndicator />
      <ThemeToggle />
    </div>
  </header>

  <main class="app-main">
    <RouterView />
  </main>
</template>

<style scoped>
.app-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem 1.5rem;
  padding: 0.75rem 1.25rem;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
}

.brand {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--color-text);
}

nav {
  display: flex;
  gap: 0.25rem;
}

nav a {
  padding: 0.3rem 0.65rem;
  border-radius: var(--radius);
  color: var(--color-text-muted);
}

nav a.router-link-exact-active {
  background: var(--color-surface-muted);
  color: var(--color-text);
}

.indicators {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-left: auto;
}

.app-main {
  max-width: 1440px;
  margin: 0 auto;
  padding: 1rem 1.25rem;
}
</style>
