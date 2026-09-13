<script setup lang="ts">
import type { WorkspaceTab } from './useWorkspace'
const props = defineProps<{ active: WorkspaceTab }>()
const emit = defineEmits<{ navigate: [tab: WorkspaceTab] }>()
const destinations: { id: WorkspaceTab; label: string; number: string }[] = [
  { id: 'design', label: '构造编辑', number: '01' },
  { id: 'compare', label: '方案比较', number: '02' },
  { id: 'documents', label: '计算书', number: '03' },
  { id: 'materials', label: '材料参数', number: '04' },
  { id: 'templates', label: '构造模板', number: '05' },
]
</script>

<template>
  <header class="masthead">
    <a
      class="brand"
      href="#"
      @click.prevent="emit('navigate', 'design')"
    >
      <span
        class="brand-symbol"
        aria-hidden="true"
        >▤</span
      >
      <span>围护碳研<small>建筑围护构造 · 设计工作台</small></span>
    </a>
    <nav
      class="navigation"
      aria-label="工作区导航"
    >
      <button
        v-for="item in destinations"
        :key="item.id"
        :class="['nav-item', { active: props.active === item.id }]"
        :aria-current="props.active === item.id ? 'page' : undefined"
        @click="emit('navigate', item.id)"
      >
        <span class="nav-number">{{ item.number }}</span>
        {{ item.label }}
      </button>
    </nav>
    <span class="edition">方案阶段 / 材料质量法</span>
  </header>
</template>

<style scoped>
.masthead {
  min-height: 88px;
  display: flex;
  align-items: center;
  gap: 40px;
  padding: 14px 40px;
  background: var(--paper);
  border-bottom: 1px solid var(--line);
}
.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  text-decoration: none;
  color: var(--ink);
  font-size: 22px;
  font-weight: 750;
  white-space: nowrap;
}
.brand-symbol {
  color: var(--green);
  font-size: 44px;
  line-height: 1;
}
.brand small {
  display: block;
  font-size: 10px;
  color: var(--muted);
  font-weight: 400;
  margin-top: 3px;
  letter-spacing: 1px;
}
.navigation {
  display: flex;
  gap: 8px;
  flex: 1;
}
.nav-item {
  border: 0;
  background: transparent;
  padding: 13px 16px;
  color: var(--muted);
}
.nav-item.active {
  background: var(--green-pale);
  color: var(--green);
}
.nav-number {
  font-size: 10px;
  margin-right: 7px;
  opacity: 0.65;
}
.edition {
  font-size: 11px;
  color: var(--muted);
}
@media (max-width: 1100px) {
  .masthead {
    gap: 18px;
    padding: 14px 20px;
    flex-wrap: wrap;
  }
  .edition {
    display: none;
  }
}
@media (max-width: 640px) {
  .navigation {
    flex-basis: 100%;
    overflow-x: auto;
  }
  .nav-item {
    white-space: nowrap;
    padding: 10px;
  }
}
</style>
