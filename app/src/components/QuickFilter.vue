<script setup lang="ts" generic="T extends string">
/** A row of mutually exclusive filter chips ("All / Buy / Sell"). */
defineProps<{
  label: string
  options: readonly { value: T; label: string }[]
}>()

const model = defineModel<T>({ required: true })
</script>

<template>
  <div class="quick-filter" role="group" :aria-label="label">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      :aria-pressed="model === option.value"
      @click="model = option.value"
    >
      {{ option.label }}
    </button>
  </div>
</template>

<style scoped>
.quick-filter {
  display: inline-flex;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  overflow: hidden;
  background: var(--color-surface);
}

button {
  padding: 0.3rem 0.7rem;
  border: 0;
  background: none;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-text-muted);
  white-space: nowrap;
}

button + button {
  border-left: 1px solid var(--color-border);
}

button:hover {
  color: var(--color-text);
}

button[aria-pressed='true'] {
  background: var(--color-accent);
  color: #fff;
}
</style>
