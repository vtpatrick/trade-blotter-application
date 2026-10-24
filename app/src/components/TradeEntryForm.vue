<script setup lang="ts">
import { computed, reactive, ref, useTemplateRef, watch } from 'vue'
import { TradeRejectedError, type Trade } from '@/api/trades'
import { useBlotterStore } from '@/stores/blotter'
import { formatAmount, formatPrice, formatQuantity } from '@/utils/format'
import { validateTrade, type TradeForm, type TradeFormErrors } from '@/utils/validateTrade'

const blotter = useBlotterStore()

const form = reactive<TradeForm>({ symbol: '', side: 'Buy', quantity: '', price: '' })
const symbolInput = useTemplateRef<HTMLInputElement>('symbolInput')

const validation = computed(() => validateTrade(form))
/** Errors appear after the first submit attempt, then update as the user types. */
const showErrors = ref(false)
const serverErrors = ref<TradeFormErrors>({})
const formError = ref<string | null>(null)
const submitting = ref(false)
const lastBooked = ref<Trade | null>(null)
let lastBookedTimer: ReturnType<typeof setTimeout> | undefined

const errors = computed<TradeFormErrors>(() => ({
  ...serverErrors.value,
  ...(showErrors.value && !validation.value.ok ? validation.value.errors : {}),
}))

// Server feedback is about the values that were sent; drop it once they change.
watch(form, () => {
  serverErrors.value = {}
  formError.value = null
})

const notional = computed(() => {
  const quantity = Number(form.quantity)
  const price = Number(form.price)
  return form.quantity && form.price && quantity > 0 && price > 0 ? quantity * price : null
})

const submitLabel = computed(() => {
  if (submitting.value) return 'Booking…'
  if (!validation.value.ok) return form.side || 'Submit'
  const { side, quantity, symbol, price } = validation.value.trade
  return `${side} ${formatQuantity(quantity)} ${symbol} @ ${formatPrice(price)}`
})

async function onSubmit() {
  showErrors.value = true
  const result = validation.value
  if (!result.ok || submitting.value) return

  submitting.value = true
  try {
    const booked = await blotter.submitTrade(result.trade)

    lastBooked.value = booked
    clearTimeout(lastBookedTimer)
    lastBookedTimer = setTimeout(() => (lastBooked.value = null), 4_000)

    // Fresh ticket; keep the side, since consecutive trades often go the same way.
    Object.assign(form, { symbol: '', quantity: '', price: '' })
    showErrors.value = false
    symbolInput.value?.focus()
  } catch (e) {
    if (e instanceof TradeRejectedError && Object.keys(e.fieldErrors).length > 0) {
      serverErrors.value = e.fieldErrors
    } else {
      formError.value = e instanceof Error ? e.message : String(e)
    }
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <form class="card ticket" novalidate @submit.prevent="onSubmit">
    <h2 class="card-title">New trade</h2>

    <div class="fields">
      <fieldset class="side" :class="form.side.toLowerCase()">
        <legend class="label">Side</legend>
        <label class="side-option buy">
          <input v-model="form.side" type="radio" name="side" value="Buy" />
          <span>Buy</span>
        </label>
        <label class="side-option sell">
          <input v-model="form.side" type="radio" name="side" value="Sell" />
          <span>Sell</span>
        </label>
        <p v-if="errors.side" class="field-error">{{ errors.side }}</p>
      </fieldset>

      <div class="field">
        <label class="label" for="trade-symbol">Symbol</label>
        <input
          id="trade-symbol"
          ref="symbolInput"
          v-model="form.symbol"
          class="symbol-input"
          placeholder="AAPL"
          autocomplete="off"
          spellcheck="false"
          maxlength="12"
          :aria-invalid="!!errors.symbol"
          aria-describedby="trade-symbol-error"
        />
        <p v-if="errors.symbol" id="trade-symbol-error" class="field-error">{{ errors.symbol }}</p>
      </div>

      <div class="row">
        <div class="field">
          <label class="label" for="trade-quantity">Quantity</label>
          <input
            id="trade-quantity"
            v-model="form.quantity"
            class="num"
            inputmode="numeric"
            placeholder="100"
            autocomplete="off"
            :aria-invalid="!!errors.quantity"
            aria-describedby="trade-quantity-error"
          />
          <p v-if="errors.quantity" id="trade-quantity-error" class="field-error">
            {{ errors.quantity }}
          </p>
        </div>

        <div class="field">
          <label class="label" for="trade-price">Price</label>
          <input
            id="trade-price"
            v-model="form.price"
            class="num"
            inputmode="decimal"
            placeholder="150.25"
            autocomplete="off"
            :aria-invalid="!!errors.price"
            aria-describedby="trade-price-error"
          />
          <p v-if="errors.price" id="trade-price-error" class="field-error">{{ errors.price }}</p>
        </div>
      </div>

      <p class="notional">
        <span>Notional</span>
        <span class="num">{{ notional === null ? '—' : formatAmount(notional) }}</span>
      </p>

      <button type="submit" class="submit" :class="form.side.toLowerCase()" :disabled="submitting">
        {{ submitLabel }}
      </button>

      <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>
      <p class="booked" aria-live="polite">
        <template v-if="lastBooked">
          Booked {{ lastBooked.side.toLowerCase() }} {{ formatQuantity(lastBooked.quantity) }}
          {{ lastBooked.symbol }} @ {{ formatPrice(lastBooked.price) }}
        </template>
      </p>
    </div>
  </form>
</template>

<style scoped>
.fields {
  display: grid;
  gap: 0.85rem;
  padding: 1rem;
}

.row {
  display: grid;
  /* minmax(0, …): inputs have a wide intrinsic size that would otherwise overflow narrow screens. */
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.field {
  display: grid;
  gap: 0.3rem;
  align-content: start;
}

.label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

input:not([type='radio']) {
  width: 100%;
  min-width: 0;
  padding: 0.5rem 0.65rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-surface-muted);
}

input[aria-invalid='true'] {
  border-color: var(--color-danger);
}

.symbol-input {
  text-transform: uppercase;
  font-family: var(--font-mono);
  letter-spacing: 0.04em;
}

.symbol-input::placeholder {
  text-transform: none;
}

.side {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
  border: 0;
  padding: 0;
}

.side legend {
  margin-bottom: 0.3rem;
}

.side .field-error {
  grid-column: 1 / -1;
}

.side-option {
  position: relative;
}

.side-option input {
  position: absolute;
  opacity: 0;
  inset: 0;
}

.side-option span {
  display: block;
  padding: 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  text-align: center;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-text-muted);
  cursor: pointer;
}

.side-option input:focus-visible + span {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

.side-option.buy input:checked + span {
  background: var(--color-buy);
  border-color: var(--color-buy);
  color: #fff;
}

.side-option.sell input:checked + span {
  background: var(--color-sell);
  border-color: var(--color-sell);
  color: #fff;
}

.notional {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem 0.65rem;
  border-radius: var(--radius);
  background: var(--color-surface-muted);
  color: var(--color-text-muted);
}

.notional .num {
  color: var(--color-text);
}

.submit {
  padding: 0.65rem;
  border: 0;
  border-radius: var(--radius);
  background: var(--color-accent);
  color: #fff;
  font-weight: 700;
  cursor: pointer;
}

.submit.buy {
  background: var(--color-buy);
}

.submit.sell {
  background: var(--color-sell);
}

.submit:disabled {
  opacity: 0.6;
  cursor: progress;
}

.field-error,
.form-error {
  color: var(--color-danger);
  font-size: 0.8rem;
}

.booked {
  min-height: 1.3em;
  color: var(--color-text-muted);
  font-size: 0.85rem;
}
</style>
