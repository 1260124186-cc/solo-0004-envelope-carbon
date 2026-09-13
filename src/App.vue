<script setup lang="ts">
import { useWorkspace } from './workspace/useWorkspace'
import WorkspaceHeader from './workspace/WorkspaceHeader.vue'
import FeedbackBanner from './workspace/FeedbackBanner.vue'
import AssemblyPicker from './assemblies/AssemblyPicker.vue'
import DesignWorkspace from './assemblies/DesignWorkspace.vue'
import ComparisonWorkspace from './comparison/ComparisonWorkspace.vue'
import DocumentWorkspace from './documents/DocumentWorkspace.vue'
import MaterialWorkspace from './materials/MaterialWorkspace.vue'
import EvidenceWorkspace from './evidence/EvidenceWorkspace.vue'
import EvidenceWarnings from './evidence/EvidenceWarnings.vue'
const {
  data,
  draft,
  tab,
  notice,
  error,
  fatal,
  busy,
  externalChange,
  dirty,
  findings,
  result,
  selectedDocuments,
  draftWarnings,
  warningsFor,
  evidencePreset,
  evidencePresetNonce,
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
  saveEvidence,
  setEvidenceStatus,
  openEvidence,
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
      <EvidenceWarnings
        v-if="tab === 'design'"
        :warnings="draftWarnings"
        label="本构造引用了不再适用的物性依据"
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
      <template v-else-if="tab === 'compare'">
        <EvidenceWarnings
          :warnings="warningsFor(baselineId)"
          label="基准构造引用了不再适用的物性依据"
        />
        <EvidenceWarnings
          :warnings="warningsFor(alternativeId)"
          label="替代构造引用了不再适用的物性依据"
        />
        <ComparisonWorkspace
          v-model:baseline-id="baselineId"
          v-model:alternative-id="alternativeId"
          :assemblies="data.assemblies"
          :materials="data.materials"
          :busy="busy"
          :dirty="dirty"
          @align="alignAlternative"
          @design="tab = 'design'"
        />
      </template>
      <template v-else-if="tab === 'documents'">
        <EvidenceWarnings
          :warnings="draftWarnings"
          label="本构造引用了不再适用的物性依据"
        />
        <DocumentWorkspace
          :assembly="draft"
          :documents="selectedDocuments"
          :dirty="dirty"
          :busy="busy"
          :valid="Boolean(result)"
          @finalize="finalize"
          @reopen="reopen"
          @design="tab = 'design'"
        />
      </template>
      <MaterialWorkspace
        v-else-if="tab === 'materials'"
        :materials="data.materials"
        :evidence="data.evidence"
        :busy="busy"
        :submit-material="addCustomMaterial"
        @register-evidence="openEvidence($event)"
      />
      <EvidenceWorkspace
        v-else
        :key="evidencePresetNonce"
        :evidence="data.evidence"
        :materials="data.materials"
        :assemblies="data.assemblies"
        :busy="busy"
        :preset-material-id="evidencePreset"
        :save-evidence="saveEvidence"
        :set-status="setEvidenceStatus"
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
