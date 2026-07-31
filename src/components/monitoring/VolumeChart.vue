<template>
  <apexchart
    type="area"
    height="280"
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

// `reporting.json` ships no `*Config` block for these two series — it is a
// plain `{ bucket, ingested, routed }` shape — so the pair of tokens is named
// here. Still tokens, resolved the same way as every other chart on these
// screens; no hex is written anywhere in this folder.
const COLOR_TOKENS = ['var(--color-chart-1)', 'var(--color-chart-2)']

const props = defineProps({
  categories: { type: Array, default: () => [] },
  ingested: { type: Array, default: () => [] },
  routed: { type: Array, default: () => [] }
})

const chartSeries = computed(() => [
  { name: 'Ingested', data: props.ingested },
  { name: 'Routed', data: props.routed }
])

const compact = new Intl.NumberFormat('en-GB', {
  notation: 'compact',
  maximumFractionDigits: 1
})

const options = computed(() => ({
  chart: baseChart(),
  colors: resolvePalette(COLOR_TOKENS),
  dataLabels: { enabled: false },
  stroke: { curve: 'smooth', width: 2 },
  fill: { type: 'gradient', gradient: { opacityFrom: 0.3, opacityTo: 0.02 } },
  legend: {
    position: 'top',
    horizontalAlign: 'left',
    fontSize: '12px',
    markers: { radius: 12 }
  },
  grid: gridStyle(),
  xaxis: {
    categories: props.categories,
    tickAmount: 6,
    axisBorder: { show: false },
    axisTicks: { show: false },
    labels: { style: axisLabelStyle(), rotate: 0 }
  },
  yaxis: {
    labels: {
      style: axisLabelStyle(),
      formatter: value => compact.format(value)
    }
  },
  tooltip: {
    theme: 'light',
    y: { formatter: value => Number(value).toLocaleString('en-GB') }
  }
}))
</script>
