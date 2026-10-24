<script setup lang="ts">
import { onBeforeUnmount, onMounted, useTemplateRef } from 'vue'
import type { GridApi, IRowNode } from 'ag-grid-community'
import PositionDetail from '@/components/PositionDetail.vue'
import type { PositionGridRow } from './positionRows'

export interface DetailRowContext {
  /** Remember a detail row's measured height, so getRowHeight keeps it across data refreshes. */
  rememberDetailHeight(symbol: string, height: number): void
}

/** Full-width grid row under an expanded position: its description and price history. */
const props = defineProps<{
  params: {
    data: PositionGridRow
    node: IRowNode<PositionGridRow>
    api: GridApi<PositionGridRow>
    context: DetailRowContext
  }
}>()

// The panel's height depends on what Bloomberg returns, so size the row to its content
// instead of a fixed guess (which left a gap under the panel).
const content = useTemplateRef<HTMLDivElement>('content')
let observer: ResizeObserver | undefined

onMounted(() => {
  if (!content.value || typeof ResizeObserver === 'undefined') return
  observer = new ResizeObserver(() => {
    if (!content.value) return
    const height = Math.ceil(content.value.getBoundingClientRect().height) + 1 // + bottom rule
    props.params.context.rememberDetailHeight(props.params.data.symbol, height)
    if (props.params.node.rowHeight !== height) {
      props.params.node.setRowHeight(height)
      props.params.api.onRowHeightChanged()
    }
  })
  observer.observe(content.value)
})

onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <div class="detail-row">
    <div ref="content">
      <PositionDetail
        :symbol="params.data.symbol"
        :average-cost="params.data.averageCost"
        :last="params.data.last"
      />
    </div>
  </div>
</template>

<style scoped>
.detail-row {
  height: 100%;
  overflow: hidden;
  border-bottom: 1px solid var(--color-border);
  box-shadow: inset 2px 0 0 var(--color-accent);
}
</style>
