<template>
  <apexchart type="area" height="260" :options="options" :series="series" />
</template>

<script setup>
import { computed } from 'vue'
import VueApexCharts from 'vue3-apexcharts'

// Locally register the ApexCharts component, exactly as ContactDetailPage does.
const apexchart = VueApexCharts

// `dashboard.json` colours its series with `var(--color-chart-N)` tokens that
// are not defined in src/css/tailwind.css, so binding them would give ApexCharts
// an empty colour. We use the brand/teal pair ContactDetailPage already ships.
const COLORS = ['#3800c1', '#0d9488']

const props = defineProps({
  labels: { type: Array, default: () => [] },
  received: { type: Array, default: () => [] },
  delivered: { type: Array, default: () => [] }
})

const series = computed(() => [
  { name: 'Received', data: props.received },
  { name: 'Delivered', data: props.delivered }
])

const options = computed(() => ({
  chart: {
    toolbar: { show: false },
    zoom: { enabled: false },
    fontFamily: 'inherit',
    animations: { enabled: false }
  },
  colors: COLORS,
  dataLabels: { enabled: false },
  stroke: { curve: 'smooth', width: 2 },
  fill: {
    type: 'gradient',
    gradient: { opacityFrom: 0.3, opacityTo: 0.02 }
  },
  legend: {
    position: 'top',
    horizontalAlign: 'left',
    markers: { radius: 12 }
  },
  grid: { borderColor: '#e7e9ed', strokeDashArray: 4 },
  xaxis: {
    categories: props.labels,
    tickAmount: 6,
    axisBorder: { show: false },
    axisTicks: { show: false },
    labels: { style: { colors: '#6a7282' }, rotate: 0 }
  },
  yaxis: { labels: { style: { colors: '#6a7282' } } },
  tooltip: { theme: 'light' }
}))
</script>
