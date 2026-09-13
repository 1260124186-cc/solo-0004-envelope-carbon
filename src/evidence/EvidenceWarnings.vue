<script setup lang="ts">
import type { ObsoleteWarning } from './warnings'
defineProps<{
  warnings: ObsoleteWarning[]
  label?: string
}>()
</script>

<template>
  <div
    v-if="warnings.length"
    class="obsolete-banner"
    role="alert"
    data-check="obsolete-warning"
  >
    <p class="banner-title">⚠ {{ label || '物性依据提示' }}（{{ warnings.length }}）</p>
    <ul>
      <li
        v-for="warning in warnings"
        :key="warning.evidenceId"
      >
        {{ warning.message }}
        <a
          v-if="warning.url"
          :href="warning.url"
          target="_blank"
          rel="noopener noreferrer"
          >打开来源网址</a
        >
      </li>
    </ul>
    <p class="banner-foot">依据状态不参与计算：当前结果与已生成计算书均保持原值。</p>
  </div>
</template>

<style scoped>
.obsolete-banner {
  border: 1px solid #dcb99f;
  background: #fcf3de;
  color: #7a4a20;
  border-radius: 6px;
  padding: 14px 18px;
  margin: 0 0 20px;
  font-size: 12px;
  line-height: 1.8;
}
.banner-title {
  font-weight: 600;
  margin: 0 0 6px;
}
.obsolete-banner ul {
  margin: 0;
  padding-left: 18px;
}
.obsolete-banner a {
  color: #7a4a20;
  margin-left: 6px;
  white-space: nowrap;
}
.banner-foot {
  margin: 8px 0 0;
  font-size: 10px;
  opacity: 0.85;
}
</style>
