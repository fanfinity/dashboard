<template>
  <apexchart type="bar" height="280" :options="options" :series="chartSeries" />
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

// Locally registered, the same way ThroughputChart and ContactDetailPage do it.
const apexchart = VueApexCharts

// Nine entity kinds over 24 hourly buckets. Stacked rather than grouped: the
// question this chart answers is "how bad was that hour, and what was it?", and
// nine side-by-side bars per hour answers neither half of it.
const props = defineProps({
  categories: { type: Array, default: () => [] },
  series: { type: Array, default: () => [] },
  colors: { type: Array, default: () => [] }
})

const chartSeries = computed(() => props.series)

const options = computed(() => ({
  chart: baseChart({ type: 'bar', stacked: true }),
  colors: resolvePalette(props.colors),
  dataLabels: { enabled: false },
  plotOptions: {
    bar: { columnWidth: '65%', borderRadius: 2, borderRadiusApplication: 'end' }
  },
  legend: {
    position: 'top',
    horizontalAlign: 'left',
    fontSize: '12px',
    markers: { radius: 12 },
    itemMargin: { horizontal: 8, vertical: 2 }
  },
  grid: gridStyle(),
  xaxis: {
    categories: props.categories,
    tickAmount: 8,
    axisBorder: { show: false },
    axisTicks: { show: false },
    labels: { style: axisLabelStyle(), rotate: 0 }
  },
  yaxis: {
    labels: {
      style: axisLabelStyle(),
      formatter: value => Math.round(value).toLocaleString('en-GB')
    }
  },
  tooltip: { theme: 'light' }
}))
</script>
