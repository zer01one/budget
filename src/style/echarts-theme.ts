import { registerTheme } from 'echarts/core'

const BUDGET_DARK = {
  backgroundColor: 'transparent',
  textStyle: { color: '#8888A0', fontFamily: 'inherit' },
  title: { textStyle: { color: '#F0F0F5' }, subtextStyle: { color: '#8888A0' } },
  line: {
    itemStyle: { borderWidth: 2 },
    lineStyle: { width: 2 },
    symbolSize: 4,
    symbol: 'circle',
    smooth: true,
  },
  radar: { itemStyle: { borderWidth: 2 } },
  bar: { itemStyle: { barBorderWidth: 0, barBorderRadius: [4, 4, 0, 0] } },
  pie: { itemStyle: { borderWidth: 2, borderColor: '#1A1A22' } },
  categoryAxis: {
    axisLine: { show: true, lineStyle: { color: '#2E2E38' } },
    axisTick: { show: false },
    axisLabel: { color: '#8888A0', fontSize: 11 },
    splitLine: { show: false },
  },
  valueAxis: {
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: '#8888A0', fontSize: 11 },
    splitLine: { lineStyle: { color: '#2E2E38', type: 'dashed' } },
  },
  tooltip: {
    backgroundColor: '#2A2A36',
    borderColor: '#3E3E50',
    borderWidth: 1,
    textStyle: { color: '#F0F0F5', fontSize: 12 },
    extraCssText: 'box-shadow: 0 4px 16px rgba(0,0,0,0.4); border-radius: 8px;',
  },
  legend: { textStyle: { color: '#8888A0' } },
  color: [
    '#7C3AED', '#10B981', '#F59E0B', '#EF4444',
    '#3B82F6', '#EC4899', '#06B6D4', '#A855F7',
    '#14B8A6', '#F97316', '#6366F1', '#84CC16',
  ],
}

export function registerEChartsTheme() {
  registerTheme('budget-dark', BUDGET_DARK)
}
