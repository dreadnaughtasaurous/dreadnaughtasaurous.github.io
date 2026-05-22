<template>
  <div class="pay-table-tabs">
    <!-- Tab buttons -->
    <div class="pay-tab-bar" role="tablist">
      <button
        v-for="(col, idx) in dateColumns"
        :key="col"
        role="tab"
        :aria-selected="activeIdx === idx"
        :class="[
          'pay-tab-btn',
          { active: activeIdx === idx },
          { 'pay-tab-btn--current': idx === currentDateIdx }
        ]"
        @click="activeIdx = idx"
      >
        {{ col }}
        <!-- [NEW] Small "current" badge on the auto-detected active-rate tab -->
        <span v-if="idx === currentDateIdx" class="pay-tab-current-badge" aria-label="Current rate">●</span>
      </button>
    </div>

    <!-- Table -->
    <div class="pay-table-wrap">
      <table class="pay-table">
        <thead>
          <tr>
            <th v-for="col in visibleHeaders" :key="col.label" :class="col.class">{{ col.label }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, ridx) in rows"
            :key="ridx"
            :class="{ 'pt-group': row.isGroup }"
          >
            <template v-if="row.isGroup">
              <td :colspan="visibleHeaders.length">{{ row.label }}</td>
            </template>
            <template v-else>
              <td
                v-for="(cell, cidx) in getVisibleCells(row)"
                :key="cidx"
                :class="cell.class"
              >{{ cell.value }}</td>
            </template>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  caption: String,
  // staticCols: columns always shown e.g. [{label:'Classification',class:'pt-class'},{label:'Pay Code',class:'pt-code'}]
  staticCols: { type: Array, default: () => [] },
  // dateCols: the year column labels e.g. ['1 Aug 2024','1 Aug 2025','1 Aug 2026','1 Aug 2027']
  // Must be in chronological order, formatted as 'D MMM YYYY' (e.g. '1 Aug 2024')
  dateCols: { type: Array, default: () => [] },
  // rows: array of row objects. Group rows: {isGroup:true,label:'Class 1'}
  // Data rows: {cells:['Year 1','PH1','1,283.66','1,322.17','1,361.83','1,402.69']}
  // cells order must match: [...staticCols, ...dateCols]
  rows: { type: Array, default: () => [] },
})

// [NEW] ── Effective-date detection ──────────────────────────────────────────
//
// Parse each date column label ('1 Aug 2024') into a JS Date.
// JS's Date constructor handles 'D MMM YYYY' reliably without needing a library.
// We find the highest index whose date is on or before today — that is the
// currently-active rate. If every date is in the future, we fall back to 0.
//
const today = new Date()
today.setHours(0, 0, 0, 0) // normalise to midnight so date-only comparisons are exact

const currentDateIdx = computed(() => {
  let best = 0
  for (let i = 0; i < props.dateCols.length; i++) {
    const d = new Date(props.dateCols[i])
    if (isNaN(d.getTime())) continue   // skip unparseable labels gracefully
    if (d <= today) best = i
  }
  return best
})

// [NEW] ── Auto-select the active tab on first render ────────────────────────
//
// activeIdx starts at currentDateIdx, not 0.
// After that it is entirely user-controlled — clicking any tab updates it freely.
//
const activeIdx = ref(currentDateIdx.value)

const dateColumns = computed(() => props.dateCols)

const visibleHeaders = computed(() => {
  const statics = props.staticCols.map(c => ({ label: c.label, class: c.class }))
  const dateHeader = { label: 'Rate', class: 'pt-rate' }
  return [...statics, dateHeader]
})

function getVisibleCells(row) {
  const staticCount = props.staticCols.length
  const staticCells = row.cells.slice(0, staticCount).map((v, i) => ({
    value: v,
    class: props.staticCols[i]?.class || ''
  }))
  const rateValue = row.cells[staticCount + activeIdx.value]
  const formattedRate = rateValue != null ? `$${rateValue}` : ''
  return [...staticCells, { value: formattedRate, class: 'pt-rate' }]
}
</script>