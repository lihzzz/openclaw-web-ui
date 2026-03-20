<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  data: number[]
  width?: number
  height?: number
  color?: string
}>(), {
  width: 120,
  height: 24
})

// 格式化数值
function formatValue(v: number): string {
  if (v >= 1000000) return (v / 1000000).toFixed(1) + 'M'
  if (v >= 1000) return (v / 1000).toFixed(1) + 'k'
  if (v >= 1000) return (v / 1000).toFixed(1) + 's'
  if (v < 1000) return v + 'ms'
  return String(v)
}

// 计算趋势
const trend = computed(() => {
  const validValues = props.data.filter(v => v > 0)
  if (validValues.length < 2) return 'flat'

  const last = validValues[validValues.length - 1]
  const prev = validValues[validValues.length - 2]

  if (last > prev) return 'up'
  if (last < prev) return 'down'
  return 'flat'
})

// 计算颜色
const strokeColor = computed(() => {
  if (props.color) return props.color

  if (trend.value === 'up') return '#f87171'
  if (trend.value === 'down') return '#4ade80'
  return '#f59e0b'
})

// 检查是否有数据
const hasData = computed(() => props.data.some(v => v > 0))

// 计算 SVG 点
const points = computed(() => {
  if (!hasData.value) return { line: '', area: '' }

  const data = props.data
  const max = Math.max(...data)
  const min = Math.min(...data.filter(v => v > 0), max)
  const range = max - min || 1
  const pad = 2

  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (props.width - pad * 2)
    const y = v === 0 ? props.height - pad : (props.height - pad) - ((v - min) / range) * (props.height - pad * 2 - 2)
    return { x, y, v }
  })

  const line = pts.map(p => `${p.x},${p.y}`).join(' ')
  const area = `${pts[0].x},${props.height} ${line} ${pts[pts.length - 1].x},${props.height}`

  return { line, area, pts }
})

const gradientId = `spark-${Math.random().toString(36).slice(2, 8)}`
</script>

<template>
  <span v-if="hasData" class="sparkline">
    <svg :width="width" :height="height" class="inline-block align-middle">
      <defs>
        <linearGradient :id="gradientId" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" :stop-color="strokeColor" stop-opacity="0.3" />
          <stop offset="100%" :stop-color="strokeColor" stop-opacity="0.02" />
        </linearGradient>
      </defs>

      <!-- 填充区域 -->
      <polygon :points="points.area" :fill="`url(#${gradientId})`" />

      <!-- 线条 -->
      <polyline
        :points="points.line"
        fill="none"
        :stroke="strokeColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />

      <!-- 数据点 -->
      <template v-if="points.pts">
        <circle
          v-for="(p, i) in points.pts.filter(p => p.v > 0)"
          :key="i"
          :cx="p.x"
          :cy="p.y"
          r="2"
          :fill="strokeColor"
          opacity="0.9"
        >
          <title>{{ formatValue(p.v) }}</title>
        </circle>
      </template>
    </svg>
  </span>
</template>

<style scoped>
.sparkline {
  display: inline-flex;
  align-items: center;
}

svg {
  image-rendering: crisp-edges;
}
</style>