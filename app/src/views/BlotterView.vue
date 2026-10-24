<script setup lang="ts">
import { storeToRefs } from 'pinia'
import BlotterTable from '@/components/BlotterTable.vue'
import PositionsPanel from '@/components/PositionsPanel.vue'
import TradeEntryForm from '@/components/TradeEntryForm.vue'
import { useBlotterStore } from '@/stores/blotter'

const blotter = useBlotterStore()
const { loadError, loading } = storeToRefs(blotter)
</script>

<template>
  <div class="layout">
    <p v-if="loadError" class="load-error" role="alert">
      Could not load the blotter: {{ loadError }}
      <button type="button" :disabled="loading" @click="blotter.load()">Retry</button>
    </p>

    <aside class="side">
      <TradeEntryForm />
      <PositionsPanel />
    </aside>

    <BlotterTable class="main" />
  </div>
</template>

<style scoped>
.layout {
  display: grid;
  /* minmax(0, …) lets the blotter scroll inside its card instead of widening the page. */
  grid-template-columns: minmax(0, 1fr);
  gap: 1rem;
  align-items: start;
}

.side {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1rem;
}

.load-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.6rem 1rem;
  border: 1px solid var(--color-danger);
  border-radius: var(--radius);
  color: var(--color-danger);
}

.load-error button {
  padding: 0.25rem 0.75rem;
  border: 1px solid currentColor;
  border-radius: var(--radius);
  background: none;
  cursor: pointer;
}

@media (min-width: 960px) {
  .layout {
    grid-template-columns: 340px minmax(0, 1fr);
  }

  .load-error {
    grid-column: 1 / -1;
  }

  .side {
    position: sticky;
    top: 1rem;
  }
}
</style>
