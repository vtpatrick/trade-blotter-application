<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import type { ColDef, Column } from 'ag-grid-community'
import {
  compileFilter,
  FILTER_HELP,
  FILTER_PLACEHOLDER,
  type FilterKind,
} from '@/utils/columnFilter'

/**
 * The expression filter's input, used both as the floating filter under a header and as the
 * filter's own display. Both kinds of params carry the current model and onModelChange; the
 * floating filter gets filterParams directly, the display gets them through colDef.
 */
type Params = {
  model: string | null
  onModelChange: (model: string | null) => void
  filterParams?: { kind?: FilterKind }
  colDef?: ColDef
  column?: Column
}

const props = defineProps<{ params: Params }>()

// The grid hands over new params (including the current model) through refresh(), not by
// re-rendering with new props, so keep the latest here.
const current = shallowRef<Params>(props.params)
function refresh(params: Params) {
  current.value = params
  return true
}
defineExpose({ refresh })

const colDef = computed(() => current.value.colDef ?? current.value.column?.getColDef())
const kind = computed<FilterKind>(
  () => current.value.filterParams?.kind ?? colDef.value?.filterParams?.kind ?? 'text',
)
const label = computed(() => `Filter ${colDef.value?.headerName ?? ''}`.trim())

const text = ref(current.value.model ?? '')
const compiled = computed(() => compileFilter(text.value, kind.value))
const error = computed(() => (compiled.value && !compiled.value.ok ? compiled.value.error : null))

// Only valid expressions reach the grid; a half-typed ">" leaves the column unfiltered.
watch(compiled, (filter) => {
  const model = filter?.ok ? text.value.trim() : null
  if (model !== current.value.model) current.value.onModelChange(model)
})

// The grid changed the model (e.g. "Clear filters"): show it, unless the user is mid-way
// through an invalid expression that the grid never saw.
watch(
  () => current.value.model,
  (model) => {
    if (model === null && error.value) return
    if ((model ?? '') !== text.value.trim()) text.value = model ?? ''
  },
)
</script>

<template>
  <input
    v-model="text"
    class="expression-filter"
    :class="[kind, { invalid: error, active: text.trim() !== '' && !error }]"
    :placeholder="FILTER_PLACEHOLDER[kind]"
    :title="error ?? FILTER_HELP[kind]"
    :aria-label="label"
    :aria-invalid="!!error"
    spellcheck="false"
    autocomplete="off"
    @keydown.esc="text = ''"
  />
</template>
