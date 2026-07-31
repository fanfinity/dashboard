<template>
  <apexchart
    type="bar"
    :height="height"
    :options="options"
    :series="chartSeries"
  />
</template>

<script setup>
import { computed } from 'vue'
import VueApexCharts from 'vue3-apexcharts'
import {
  axisLabelStyle,
  baseChart,
  gridStyle,
  resolvePalette
} from '@/components/monitoring/chart-palette'

const apexchart = VueApexCharts

// Horizontal, because these categories are product names and a vertical axis
// would either truncate them or rotate them 45°. One bar per row, distributed
// colours so the bar matches nothing else on the page by accident.
const COLOR_TOKENS = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
  'var(--color-chart-6)',
  'var(--color-chart-7)',
  'var(--color-chart-8)',
  'var(--color-chart-9)'
]

const props = defineProps({
  categories: { type: Array, default: () => [] },
  data: { type: Array, default: () => [] },
  label: { type: String, default: 'Volume' }
})

const chartSeries = computed(() => [{ name: props.label, data: props.data }])

// 44px a bar keeps a three-row and a seven-row breakdown equally readable
// instead of stretching three bars over the same 280px.
const height = computed(() => Math.max(160, props.categories.length * 44 + 40))

const compact = new Intl.NumberFormat('en-GB', {
  notation: 'compact',
  maximumFractionDigits: 1
})

const options = computed(() => ({
  chart: baseChart({ type: 'bar' }),
  colors: resolvePalette(COLOR_TOKENS),
  plotOptions: {
    bar: {
      horizontal: true,
      distributed: true,
      barHeight: '58%',
      borderRadius: 3,
      borderRadiusApplication: 'end'
    }
  },
  // Off: the exact figures are in the table directly below, and an in-bar label
  // is unreadable on the short bars of a long-tail breakdown.
  dataLabels: { enabled: false },
  legend: { show: false },
  grid: gridStyle(),
  xaxis: {
    categories: props.categories,
    axisBorder: { show: false },
    axisTicks: { show: false },
    labels: {
      style: axisLabelStyle(),
      formatter: value => compact.format(value)
    }
  },
  yaxis: { labels: { style: axisLabelStyle() } },
  tooltip: {
    theme: 'light',
    y: { formatter: value => Number(value).toLocaleString('en-GB') }
  }
}))
</script>
