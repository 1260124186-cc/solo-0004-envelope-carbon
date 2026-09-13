<script setup lang="ts">
import { useWorkspace } from './workspace/useWorkspace'
import WorkspaceHeader from './workspace/WorkspaceHeader.vue'
import FeedbackBanner from './workspace/FeedbackBanner.vue'
import AssemblyPicker from './assemblies/AssemblyPicker.vue'
import DesignWorkspace from './assemblies/DesignWorkspace.vue'
import ComparisonWorkspace from './comparison/ComparisonWorkspace.vue'
import DocumentWorkspace from './documents/DocumentWorkspace.vue'
import MaterialWorkspace from './materials/MaterialWorkspace.vue'
import SchemePicker from './schemes/SchemePicker.vue'
import SchemeWorkspace from './schemes/SchemeWorkspace.vue'
const {
  data,
  draft,
  schemeDraft,
  tab,
  notice,
  error,
  fatal,
  busy,
  externalChange,
  dirty,
  schemeDirty,
  findings,
  result,
  schemeEvaluation,
  selectedDocuments,
  baselineId,
  alternativeId,
  load,
  select,
  create,
  duplicate,
  update,
  addMaterial,
  updateLayer,
  removeLayer,
  move,
  save,
  finalize,
  reopen,
  addCustomMaterial,
  alignAlternative,
  selectScheme,
  createSchemeDraft,
  updateScheme,
  addSchemeEntry,
  updateSchemeEntry,
  removeSchemeEntry,
  keepSchemeEntry,
  updateSchemeEntryReference,
  saveScheme,
} = useWorkspace()
</script>

<template>
  <WorkspaceHeader
    :active="tab"
    @navigate="tab = $event"
  />
  <main class="workspace-main">
    <div
      v-if="fatal"
      class="fatal-panel"
      role="alert"
    >
      <h1>设计暂时无法载入</h1>
      <p>{{ fatal }}</p>
      <button
        class="button primary"
        @click="load()"
      >
        重试读取
      </button>
    </div>
    <template v-else-if="data && draft">
      <FeedbackBanner
        :error="error"
        :notice="notice"
        :external-change="externalChange"
        :busy="busy"
        @reload="load()"
      />
      <AssemblyPicker
        v-if="tab === 'design' || tab === 'documents'"
        :assemblies="data.assemblies"
        :selected-id="draft.id"
        :busy="busy"
        :can-duplicate="!dirty"
        @select="select"
        @create="create"
        @duplicate="duplicate"
      />
      <SchemePicker
        v-else-if="tab === 'schemes' && schemeDraft"
        :schemes="data.schemes"
        :selected-id="schemeDraft.id"
        :busy="busy"
        @select="selectScheme"
        @create="createSchemeDraft"
      />
      <DesignWorkspace
        v-if="tab === 'design'"
        :assembly="draft"
        :materials="data.materials"
        :result="result"
        :findings="findings"
        :busy="busy"
        :dirty="dirty"
        @update="update"
        @update-layer="updateLayer"
        @remove-layer="removeLayer"
        @move-layer="move"
        @add-layer="addMaterial"
        @save="save"
        @finalize="finalize"
        @reopen="reopen"
      />
      <ComparisonWorkspace
        v-else-if="tab === 'compare'"
        v-model:baseline-id="baselineId"
        v-model:alternative-id="alternativeId"
        :assemblies="data.assemblies"
        :materials="data.materials"
        :busy="busy"
        :dirty="dirty"
        @align="alignAlternative"
        @design="tab = 'design'"
      />
      <div
        v-else-if="tab === 'schemes' && !schemeDraft"
        class="empty-state"
      >
        <h2>还没有围护组合</h2>
        <p>把同一建筑的外墙、屋面和楼板构造组织成一份完整方案，组合保存时会冻结引用版本。</p>
        <button
          class="button primary"
          :disabled="busy"
          @click="createSchemeDraft"
        >
          ＋ 新建围护组合
        </button>
      </div>
      <SchemeWorkspace
        v-else-if="tab === 'schemes' && schemeDraft"
        :scheme="schemeDraft"
        :assemblies="data.assemblies"
        :evaluation="schemeEvaluation"
        :busy="busy"
        :dirty="schemeDirty"
        @update="updateScheme"
        @add-entry="addSchemeEntry"
        @update-entry="updateSchemeEntry"
        @remove-entry="removeSchemeEntry"
        @keep="keepSchemeEntry"
        @update-reference="updateSchemeEntryReference"
        @save="saveScheme"
        @design="tab = 'design'"
      />
      <DocumentWorkspace
        v-else-if="tab === 'documents'"
        :assembly="draft"
        :documents="selectedDocuments"
        :dirty="dirty"
        :busy="busy"
        :valid="Boolean(result)"
        @finalize="finalize"
        @reopen="reopen"
        @design="tab = 'design'"
      />
      <MaterialWorkspace
        v-else
        :materials="data.materials"
        :busy="busy"
        :submit-material="addCustomMaterial"
      />
    </template>
    <div
      v-else
      class="empty-state"
    >
      正在准备构造工作区…
    </div>
  </main>
  <footer class="site-footer">
    <span>围护碳研 · 从构造出发</span><span>设计保存在当前浏览器 · 示例物性仅供教学</span>
  </footer>
</template>
