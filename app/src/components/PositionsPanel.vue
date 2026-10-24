<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useBlotterStore } from '@/stores/blotter'
import { formatPrice, formatQuantity } from '@/utils/format'

const { positions, loading } = storeToRefs(useBlotterStore())
</script>

<template>
  <section class="card">
    <h2 class="card-title">
      <span>Positions</span>
      <span class="hint">avg cost method</span>
    </h2>

    <table v-if="positions.length > 0">
      <thead>
        <tr>
          <th>Symbol</th>
          <th class="num">Net qty</th>
          <th class="num">Avg cost</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="position in positions" :key="position.symbol">
          <td class="symbol">{{ position.symbol }}</td>
          <td class="num" :class="position.netQuantity > 0 ? 'long' : 'short'">
            {{ formatQuantity(position.netQuantity) }}
            <span class="direction">{{ position.netQuantity > 0 ? 'Long' : 'Short' }}</span>
          </td>
          <td class="num">{{ formatPrice(position.averageCost) }}</td>
        </tr>
      </tbody>
    </table>

    <p v-else class="empty">{{ loading ? 'Loading positions…' : 'No open positions.' }}</p>
  </section>
</template>

<style scoped>
.hint {
  font-weight: 500;
  letter-spacing: normal;
  text-transform: none;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th {
  padding: 0.55rem 1rem;
  border-bottom: 1px solid var(--color-border);
  text-align: left;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

th.num {
  text-align: right;
}

td {
  padding: 0.45rem 1rem;
  border-bottom: 1px solid var(--color-border);
  white-space: nowrap;
}

tbody tr:last-child td {
  border-bottom: 0;
}

.symbol {
  font-family: var(--font-mono);
  font-weight: 700;
}

.long {
  color: var(--color-buy);
}

.short {
  color: var(--color-sell);
}

.direction {
  margin-left: 0.35rem;
  font-family: var(--font-sans);
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
</style>
