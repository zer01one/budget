<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useTransactionsStore } from '@/stores/transactions.store'
import { useCategoriesStore } from '@/stores/categories.store'
import type { EChartsOption } from 'echarts'

const txStore = useTransactionsStore()
const categoriesStore = useCategoriesStore()

const selectedMonth = ref(new Date().toLocaleDateString('en-CA').slice(0, 7))

onMounted(() => txStore.loadCurrentAndPrevMonth())

function prevMonth() {
  const [y, m] = selectedMonth.value.split('-').map(Number)
  const d = new Date(y, m - 2)
  selectedMonth.value = d.toLocaleDateString('en-CA').slice(0, 7)
}
function nextMonth() {
  const [y, m] = selectedMonth.value.split('-').map(Number)
  const d = new Date(y, m)
  const now = new Date().toLocaleDateString('en-CA').slice(0, 7)
  const next = d.toLocaleDateString('en-CA').slice(0, 7)
  if (next <= now) selectedMonth.value = next
}
const isCurrentMonth = computed(() =>
  selectedMonth.value === new Date().toLocaleDateString('en-CA').slice(0, 7)
)
function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m - 1).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
}

// Transactions for selected month
const monthTxs = computed(() =>
  txStore.allCached.filter(t => t.date.startsWith(selectedMonth.value) && !t.isDeleted)
)

// ── Donut: расходы по категориям ─────────────────────────────────────────────
const donutOption = computed((): EChartsOption => {
  const map = new Map<string, number>()
  for (const tx of monthTxs.value) {
    if (tx.type !== 'expense' || !tx.categoryId) continue
    map.set(tx.categoryId, (map.get(tx.categoryId) ?? 0) + tx.amount)
  }
  const data = [...map.entries()]
    .map(([catId, value]) => ({
      value,
      name: categoriesStore.getById(catId)?.name ?? 'Прочее',
      itemStyle: { color: categoriesStore.getById(catId)?.color ?? '#6B7280' },
    }))
    .sort((a, b) => b.value - a.value)

  return {
    tooltip: {
      trigger: 'item',
      formatter: (p: unknown) => {
        const { name, value, percent } = p as { name: string; value: number; percent: number }
        return `${name}: ${value.toLocaleString('ru-RU')} (${percent}%)`
      },
    },
    legend: { show: false },
    series: [{
      type: 'pie',
      radius: ['50%', '75%'],
      center: ['50%', '50%'],
      data: data.length ? data : [{ value: 1, name: 'Нет данных', itemStyle: { color: '#2E2E38' } }],
      label: { show: false },
      emphasis: { scale: true, scaleSize: 4 },
    }],
  }
})

// ── Bar: доходы vs расходы за 6 месяцев ──────────────────────────────────────
const last6Months = computed((): string[] => {
  const result: string[] = []
  const [y, m] = selectedMonth.value.split('-').map(Number)
  for (let i = 5; i >= 0; i--) {
    const d = new Date(y, m - 1 - i)
    result.push(d.toLocaleDateString('en-CA').slice(0, 7))
  }
  return result
})

const barMonthlyOption = computed((): EChartsOption => {
  const incomes = last6Months.value.map(mo =>
    txStore.allCached.filter(t => t.date.startsWith(mo) && t.type === 'income' && !t.isDeleted)
      .reduce((s, t) => s + t.amount, 0)
  )
  const expenses = last6Months.value.map(mo =>
    txStore.allCached.filter(t => t.date.startsWith(mo) && t.type === 'expense' && !t.isDeleted)
      .reduce((s, t) => s + t.amount, 0)
  )
  const labels = last6Months.value.map(mo => {
    const [y, m] = mo.split('-').map(Number)
    return new Date(y, m - 1).toLocaleDateString('ru-RU', { month: 'short' })
  })

  return {
    tooltip: {
      trigger: 'axis',
      formatter: (params: unknown) =>
        (params as Array<{ marker: string; seriesName: string; value: number }>)
          .map(p => `${p.marker}${p.seriesName}: ${p.value.toLocaleString('ru-RU')}`)
          .join('<br/>'),
    },
    legend: { data: ['Доходы', 'Расходы'], bottom: 0, textStyle: { color: '#8888A0', fontSize: 11 } },
    grid: { top: 12, bottom: 40, left: 8, right: 8, containLabel: true },
    xAxis: { type: 'category', data: labels },
    yAxis: { type: 'value', axisLabel: { formatter: (v: number) => v >= 1000 ? `${v / 1000}k` : String(v) } },
    series: [
      {
        name: 'Доходы', type: 'bar', data: incomes, barMaxWidth: 20,
        itemStyle: { color: '#10B981', borderRadius: [4, 4, 0, 0] },
      },
      {
        name: 'Расходы', type: 'bar', data: expenses, barMaxWidth: 20,
        itemStyle: { color: '#EF4444', borderRadius: [4, 4, 0, 0] },
      },
    ],
  }
})

// ── Line: накопленный расход по дням текущего месяца ─────────────────────────
const lineOption = computed((): EChartsOption => {
  const [y, m] = selectedMonth.value.split('-').map(Number)
  const daysInMonth = new Date(y, m, 0).getDate()
  const today = new Date().toLocaleDateString('en-CA')
  const maxDay = selectedMonth.value < today.slice(0, 7)
    ? daysInMonth
    : parseInt(today.slice(8, 10))

  const days: string[] = []
  const cumExpense: number[] = []
  const cumIncome: number[] = []
  let totalExp = 0
  let totalInc = 0

  for (let d = 1; d <= maxDay; d++) {
    const dateStr = `${selectedMonth.value}-${String(d).padStart(2, '0')}`
    days.push(String(d))
    const dayTxs = txStore.allCached.filter(t => t.date === dateStr && !t.isDeleted)
    totalExp += dayTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    totalInc += dayTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    cumExpense.push(Math.round(totalExp))
    cumIncome.push(Math.round(totalInc))
  }

  return {
    tooltip: {
      trigger: 'axis',
      formatter: (params: unknown) => {
        const items = params as Array<{ marker: string; seriesName: string; value: number; axisValue: string }>
        return `День ${items[0].axisValue}<br/>` +
          items.map(p => `${p.marker}${p.seriesName}: ${p.value.toLocaleString('ru-RU')}`).join('<br/>')
      },
    },
    legend: { data: ['Расходы', 'Доходы'], bottom: 0, textStyle: { color: '#8888A0', fontSize: 11 } },
    grid: { top: 12, bottom: 40, left: 8, right: 8, containLabel: true },
    xAxis: { type: 'category', data: days, boundaryGap: false },
    yAxis: { type: 'value', axisLabel: { formatter: (v: number) => v >= 1000 ? `${v / 1000}k` : String(v) } },
    series: [
      {
        name: 'Расходы', type: 'line', data: cumExpense, smooth: true,
        lineStyle: { color: '#EF4444', width: 2 },
        itemStyle: { color: '#EF4444' },
        areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: '#EF444430' }, { offset: 1, color: '#EF444405' }] } },
      },
      {
        name: 'Доходы', type: 'line', data: cumIncome, smooth: true,
        lineStyle: { color: '#10B981', width: 2 },
        itemStyle: { color: '#10B981' },
        areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: '#10B98130' }, { offset: 1, color: '#10B98105' }] } },
      },
    ],
  }
})

// ── Horizontal bar: топ-5 категорий расходов ─────────────────────────────────
const topCatsOption = computed((): EChartsOption => {
  const map = new Map<string, number>()
  for (const tx of monthTxs.value) {
    if (tx.type !== 'expense' || !tx.categoryId) continue
    map.set(tx.categoryId, (map.get(tx.categoryId) ?? 0) + tx.amount)
  }
  const sorted = [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  const names = sorted.map(([id]) => categoriesStore.getById(id)?.name ?? '?')
  const values = sorted.map(([, v]) => Math.round(v))
  const colors = sorted.map(([id]) => categoriesStore.getById(id)?.color ?? '#6B7280')

  return {
    tooltip: {
      trigger: 'axis',
      formatter: (params: unknown) => {
        const p = (params as Array<{ name: string; value: number }>)[0]
        return `${p.name}: ${p.value.toLocaleString('ru-RU')}`
      },
    },
    grid: { top: 4, bottom: 4, left: 8, right: 16, containLabel: true },
    xAxis: { type: 'value', axisLabel: { formatter: (v: number) => v >= 1000 ? `${v / 1000}k` : String(v) } },
    yAxis: { type: 'category', data: names, inverse: true, axisLabel: { fontSize: 11 } },
    series: [{
      type: 'bar',
      data: values.map((v, i) => ({ value: v, itemStyle: { color: colors[i], borderRadius: [0, 4, 4, 0] } })),
      barMaxWidth: 20,
      label: { show: true, position: 'right', color: '#8888A0', fontSize: 10, formatter: (p: unknown) => (p as { value: number }).value.toLocaleString('ru-RU') },
    }],
  }
})

// Сводка месяца
const summary = computed(() => {
  const income = monthTxs.value.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const expense = monthTxs.value.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  return { income, expense, net: income - expense }
})
</script>

<template>
  <div class="charts-view">
    <!-- Header with month nav -->
    <div class="charts-view__header">
      <h2 class="charts-view__title">Графики</h2>
      <div class="month-nav">
        <button class="month-nav__btn" @click="prevMonth">‹</button>
        <span class="month-nav__label">{{ formatMonthLabel(selectedMonth) }}</span>
        <button class="month-nav__btn" :disabled="isCurrentMonth" @click="nextMonth">›</button>
      </div>
    </div>

    <!-- Summary pills -->
    <div class="summary-row">
      <div class="summary-pill summary-pill--income">
        <span class="summary-pill__label">Доходы</span>
        <span class="summary-pill__value">+{{ summary.income.toLocaleString('ru-RU') }}</span>
      </div>
      <div class="summary-pill summary-pill--expense">
        <span class="summary-pill__label">Расходы</span>
        <span class="summary-pill__value">-{{ summary.expense.toLocaleString('ru-RU') }}</span>
      </div>
      <div class="summary-pill" :class="summary.net >= 0 ? 'summary-pill--income' : 'summary-pill--expense'">
        <span class="summary-pill__label">Итог</span>
        <span class="summary-pill__value">{{ summary.net >= 0 ? '+' : '' }}{{ summary.net.toLocaleString('ru-RU') }}</span>
      </div>
    </div>

    <div class="charts-grid">
      <!-- Donut: расходы по категориям -->
      <div class="chart-card chart-card--half">
        <div class="chart-card__title">Расходы по категориям</div>
        <VChart
          class="chart"
          :option="donutOption"
          theme="budget-dark"
          autoresize
        />
      </div>

      <!-- Top-5 categories -->
      <div class="chart-card chart-card--half">
        <div class="chart-card__title">Топ-5 категорий</div>
        <VChart
          class="chart"
          :option="topCatsOption"
          theme="budget-dark"
          autoresize
        />
      </div>

      <!-- Monthly income vs expense -->
      <div class="chart-card chart-card--full">
        <div class="chart-card__title">Доходы и расходы за 6 месяцев</div>
        <VChart
          class="chart chart--tall"
          :option="barMonthlyOption"
          theme="budget-dark"
          autoresize
        />
      </div>

      <!-- Cumulative line -->
      <div class="chart-card chart-card--full">
        <div class="chart-card__title">Динамика за месяц</div>
        <VChart
          class="chart chart--tall"
          :option="lineOption"
          theme="budget-dark"
          autoresize
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.charts-view { display: flex; flex-direction: column; height: 100%; overflow-y: auto; }

.charts-view__header {
  display: flex; align-items: center; justify-content: space-between;
  padding: var(--space-5) var(--space-5) var(--space-3);
  flex-shrink: 0;
}
.charts-view__title { font-size: var(--font-xl); font-weight: 700; }

.month-nav { display: flex; align-items: center; gap: var(--space-2); }
.month-nav__btn {
  width: 28px; height: 28px; border-radius: var(--radius-sm);
  background: var(--bg-elevated); border: none; color: var(--text-primary);
  cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center;
  transition: background var(--transition);
}
.month-nav__btn:hover:not(:disabled) { background: var(--border); }
.month-nav__btn:disabled { opacity: 0.3; cursor: default; }
.month-nav__label { font-size: var(--font-sm); font-weight: 600; min-width: 120px; text-align: center; }

.summary-row {
  display: flex; gap: var(--space-2);
  padding: 0 var(--space-5) var(--space-3); flex-shrink: 0;
}
.summary-pill {
  flex: 1; display: flex; flex-direction: column; align-items: center;
  padding: var(--space-3); background: var(--bg-card);
  border: 1px solid var(--border); border-radius: var(--radius-md);
}
.summary-pill--income { border-color: #10B98140; }
.summary-pill--expense { border-color: #EF444440; }
.summary-pill__label { font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
.summary-pill__value { font-size: var(--font-sm); font-weight: 700; font-variant-numeric: tabular-nums; margin-top: 2px; }
.summary-pill--income .summary-pill__value { color: #10B981; }
.summary-pill--expense .summary-pill__value { color: #EF4444; }

.charts-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
  padding: 0 var(--space-5) var(--space-8);
}

.chart-card {
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: var(--radius-xl); padding: var(--space-4);
  display: flex; flex-direction: column; gap: var(--space-3);
}
.chart-card--half { grid-column: span 1; }
.chart-card--full { grid-column: span 2; }

.chart-card__title { font-size: var(--font-sm); font-weight: 600; color: var(--text-secondary); }

.chart { width: 100%; height: 200px; }
.chart--tall { height: 220px; }

@media (max-width: 600px) {
  .charts-grid { grid-template-columns: 1fr; }
  .chart-card--half { grid-column: span 1; }
  .chart-card--full { grid-column: span 1; }
}
</style>
