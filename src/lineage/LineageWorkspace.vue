<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Assembly } from '../assemblies/types'
import { stateLabels } from '../assemblies/types'
import type { Material } from '../materials/types'
import { buildForest, collectDescendants, findNode, findRoot } from './lineage'
import LineageTree from './LineageTree.vue'

const props = defineProps<{
  assemblies: Assembly[]
  materials: Material[]
  selectedId: string
  dirty: boolean
}>()
const emit = defineEmits<{ open: [id: string]; design: [] }>()

const focusId = ref(props.selectedId)
const forest = computed(() => buildForest(props.assemblies, props.materials))
const focusNode = computed(() => findNode(forest.value, focusId.value))
const familyRoot = computed(() => findRoot(forest.value, focusId.value))
const impact = computed(() => (focusNode.value ? collectDescendants(focusNode.value) : []))
</script>

<template>
  <section class="panel lineage-workspace">
    <span class="eyebrow">构造谱系</span>
    <h1>看清每个替代方案，从哪里来。</h1>
    <p class="section-intro">
      复制构造时记录派生来源并随设计一并保存。此处只读展示来源链、各节点相对来源的关键差异，以及来源变化的下游影响；谱系不自动合并或改写任何构造。
    </p>
    <div
      v-if="!assemblies.length"
      class="empty-state"
    >
      <h2>还没有构造</h2>
      <p>返回构造编辑，新建并保存构造后，复制替代方案即可形成谱系。</p>
      <button
        class="button primary"
        @click="emit('design')"
      >
        返回构造编辑
      </button>
    </div>
    <template v-else>
      <p
        v-if="dirty"
        class="inline-warning"
      >
        编辑区仍有未保存修改，以下谱系来自最近保存版本。
      </p>
      <label class="lineage-picker">
        查看构造
        <select
          v-model="focusId"
          aria-label="查看构造"
        >
          <option
            v-for="item in assemblies"
            :key="item.id"
            :value="item.id"
          >
            {{ item.name }} · {{ stateLabels[item.state] }}
          </option>
        </select>
      </label>
      <div
        v-if="familyRoot && focusNode"
        class="lineage-layout"
      >
        <div class="lineage-family">
          <h2>派生关系</h2>
          <p class="muted">「{{ focusNode.assembly.name }}」所在的构造族，差异均相对其直接来源。</p>
          <ul class="lineage-forest">
            <LineageTree
              :node="familyRoot"
              :focus-id="focusId"
              @open="emit('open', $event)"
            />
          </ul>
        </div>
        <aside class="lineage-impact">
          <h2>下游影响</h2>
          <template v-if="impact.length">
            <p>
              若调整「{{ focusNode.assembly.name }}」，以下 {{ impact.length }}
              个下游替代方案可能需要复核：
            </p>
            <ol class="impact-list">
              <li
                v-for="item in impact"
                :key="item.assembly.id"
                data-check="impact-item"
              >
                <strong>{{ item.assembly.name }}</strong>
                <span class="muted">
                  · {{ stateLabels[item.assembly.state] }} · 修订 {{ item.assembly.revision
                  }}<template v-if="item.assembly.origin">
                    · 复制自「{{ item.assembly.origin.name }}」</template
                  ></span
                >
                <ul
                  v-if="item.differences.length"
                  class="impact-diff"
                >
                  <li
                    v-for="difference in item.differences"
                    :key="difference"
                  >
                    {{ difference }}
                  </li>
                </ul>
                <p
                  v-else
                  class="muted impact-none"
                >
                  与其来源内容一致。
                </p>
              </li>
            </ol>
          </template>
          <p v-else>「{{ focusNode.assembly.name }}」没有下游替代方案，调整它不会影响其他构造。</p>
          <p class="muted impact-disclaimer">
            谱系仅作只读追踪：来源变化不会自动合并或改写任何构造，请复核后手动调整。
          </p>
        </aside>
      </div>
    </template>
  </section>
</template>

<style scoped>
.lineage-workspace {
  max-width: 1100px;
  margin: 0 auto;
}
.lineage-picker {
  max-width: 420px;
  margin-bottom: 28px;
}
.lineage-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 28px;
  align-items: start;
}
.lineage-family h2,
.lineage-impact h2 {
  margin-top: 0;
}
.lineage-family > p {
  font-size: 12px;
  margin: 8px 0 18px;
}
.lineage-forest {
  margin: 0;
  padding: 0;
}
.lineage-impact {
  border: 1px solid var(--line);
  border-radius: 6px;
  background: #f6f7f0;
  padding: 20px;
  font-size: 12px;
  line-height: 1.9;
}
.impact-list {
  margin: 0;
  padding-left: 20px;
  display: grid;
  gap: 14px;
}
.impact-diff {
  margin: 6px 0 0;
  padding-left: 18px;
  color: var(--muted);
}
.impact-none {
  margin: 4px 0 0;
}
.impact-disclaimer {
  border-top: 1px solid var(--line);
  margin-top: 18px;
  padding-top: 12px;
  font-size: 11px;
}
@media (max-width: 900px) {
  .lineage-layout {
    grid-template-columns: 1fr;
  }
}
</style>
