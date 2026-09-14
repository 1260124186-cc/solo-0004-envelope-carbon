<script setup lang="ts">
import { computed } from 'vue'
import type { Assembly, Finding } from '../assemblies/types'
import type { Material } from '../materials/types'
import { diffAssemblies } from '../assemblies/diff'
const props = defineProps<{
  draft: Assembly
  saved: Assembly | null
  materials: Material[]
  findings: Finding[]
  busy: boolean
}>()
const emit = defineEmits<{
  saveAs: []
  discard: []
  close: []
}>()
const differences = computed(() =>
  props.saved ? diffAssemblies(props.draft, props.saved, props.materials) : [],
)
</script>

<template>
  <section
    class="conflict-panel"
    role="alertdialog"
    aria-labelledby="conflict-title"
    aria-describedby="conflict-intro"
  >
    <span class="eyebrow">跨标签页冲突</span>
    <h2 id="conflict-title">另一标签页已保存新版本</h2>
    <p
      id="conflict-intro"
      class="conflict-intro"
    >
      当前草稿尚未写入，继续保留在编辑区。请核对草稿与最新保存版本的差异，再决定放弃草稿，或将草稿另存为独立构造。此处不会覆盖另一标签页保存的内容，也不会自动合并构造层。
    </p>
    <p
      v-if="!saved"
      class="inline-warning"
    >
      该草稿尚未保存过，另一标签页修改的是其他内容。另存会把草稿作为新构造写入，与已保存内容互不影响。
    </p>
    <p
      v-else-if="!differences.length"
      class="inline-warning"
    >
      草稿与最新保存版本内容一致，仅保存记录被另一标签页更新。另存将产生一个内容相同的独立构造。
    </p>
    <div
      v-else
      class="table-scroll conflict-diff"
    >
      <table>
        <caption>
          当前草稿与最新保存版本的差异
        </caption>
        <thead>
          <tr>
            <th scope="col">项目</th>
            <th scope="col">当前草稿</th>
            <th scope="col">最新保存版本</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="difference in differences"
            :key="difference.label"
          >
            <th scope="row">{{ difference.label }}</th>
            <td>{{ difference.draft }}</td>
            <td>{{ difference.saved }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div
      v-if="findings.length"
      class="conflict-findings"
      role="alert"
    >
      <p>另存前已按最新材料目录重新校验，需先解决以下问题：</p>
      <ul>
        <li
          v-for="finding in findings"
          :key="`${finding.path}:${finding.text}`"
        >
          {{ finding.text }}
        </li>
      </ul>
    </div>
    <div class="conflict-actions">
      <button
        class="button"
        :disabled="busy"
        @click="emit('close')"
      >
        继续编辑草稿
      </button>
      <button
        class="button"
        :disabled="busy"
        @click="emit('discard')"
      >
        放弃草稿，载入保存版本
      </button>
      <button
        class="button primary"
        :disabled="busy || findings.length > 0"
        @click="emit('saveAs')"
      >
        另存为独立构造
      </button>
    </div>
  </section>
</template>

<style scoped>
.conflict-panel {
  margin-bottom: 16px;
  padding: 24px 28px;
  border: 1px solid #e5d7af;
  border-radius: 8px;
  background: #fffdf4;
}
.conflict-panel h2 {
  margin-top: 6px;
}
.conflict-intro {
  color: var(--muted);
  font-size: 12px;
  line-height: 1.9;
  margin: 12px 0 18px;
}
.conflict-diff {
  margin: 0 0 18px;
}
.conflict-diff td {
  white-space: pre-line;
}
.conflict-findings {
  margin-bottom: 18px;
  padding: 12px 16px;
  border: 1px solid #eacac0;
  border-radius: 6px;
  background: #fff0eb;
  color: #922f20;
  font-size: 12px;
  line-height: 1.8;
}
.conflict-findings p {
  margin: 0 0 6px;
}
.conflict-findings ul {
  margin: 0;
  padding-left: 18px;
}
.conflict-actions {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
}
@media (max-width: 600px) {
  .conflict-panel {
    padding: 18px;
  }
  .conflict-actions {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
