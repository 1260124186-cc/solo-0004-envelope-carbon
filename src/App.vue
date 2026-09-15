<script setup lang="ts">
import { computed, ref } from 'vue'
import { useWorkspace } from './workspace/useWorkspace'
import WorkspaceHeader from './workspace/WorkspaceHeader.vue'
import FeedbackBanner from './workspace/FeedbackBanner.vue'
import AssemblyPicker from './assemblies/AssemblyPicker.vue'
import ArchivePanel from './assemblies/ArchivePanel.vue'
import DesignWorkspace from './assemblies/DesignWorkspace.vue'
import ComparisonWorkspace from './comparison/ComparisonWorkspace.vue'
import DocumentWorkspace from './documents/DocumentWorkspace.vue'
import MaterialWorkspace from './materials/MaterialWorkspace.vue'
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
  baselineId,
  alternativeId,
  visibleAssemblies,
  archivedAssemblies,
  draftArchived,
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
  archive,
  restore,
  viewArchived,
  addCustomMaterial,
  alignAlternative,
} = useWorkspace()

const archiveOpen = ref(false)
const documentCounts = computed<Record<string, number>>(() => {
  const counts: Record<string, number> = {}
  for (const document of data.value?.documents ?? []) {
    counts[document.assemblyId] = (counts[document.assemblyId] ?? 0) + 1
  }
  return counts
})
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
    <template v-else-if="data">
      <FeedbackBanner
        :error="error"
        :notice="notice"
        :external-change="externalChange"
        :busy="busy"
        @reload="load()"
      />
      <ArchivePanel
        v-if="archiveOpen && (tab === 'design' || tab === 'documents')"
        :assemblies="visibleAssemblies"
        :archived="archivedAssemblies"
        :archives="data.archives"
        :document-counts="documentCounts"
        :open-draft-id="draft?.id ?? null"
        :draft-state="draft?.state ?? null"
        :baseline-id="baselineId"
        :alternative-id="alternativeId"
        :busy="busy"
        @archive="archive($event)"
        @restore="restore($event)"
        @view="
          (id) => {
            archiveOpen = false
            viewArchived(id)
          }
        "
        @close="archiveOpen = false"
      />
      <template v-else>
        <div
          v-if="tab === 'design' || tab === 'documents'"
          class="archive-entry"
        >
          <button
            class="button small"
            :disabled="busy"
            @click="archiveOpen = true"
          >
            归档管理（{{ archivedAssemblies.length }}）：归档只是从列表隐藏，不删除构造与历史计算书
          </button>
        </div>
        <AssemblyPicker
          v-if="(tab === 'design' || tab === 'documents') && draft"
          :assemblies="visibleAssemblies"
          :selected-id="draft.id"
          :selected-archived-name="draftArchived ? draft.name : ''"
          :busy="busy"
          :can-duplicate="!dirty"
          @select="select"
          @create="create"
          @duplicate="duplicate"
          @manage-archive="archiveOpen = true"
        />
        <template v-if="tab === 'design'">
          <DesignWorkspace
            v-if="draft"
            :assembly="draft"
            :materials="data.materials"
            :result="result"
            :findings="findings"
            :busy="busy"
            :dirty="dirty"
            :archived="draftArchived"
            @update="update"
            @update-layer="updateLayer"
            @remove-layer="removeLayer"
            @move-layer="move"
            @add-layer="addMaterial"
            @save="save"
            @finalize="finalize"
            @reopen="reopen"
            @restore="restore(draft.id)"
          />
          <div
            v-else
            class="empty-state"
          >
            <h2>当前列表还没有构造</h2>
            <p>新建一个构造开始设计，或在归档管理中恢复已归档构造；归档不会删除任何内容。</p>
            <div class="empty-actions">
              <button
                class="button primary"
                :disabled="busy"
                @click="create"
              >
                ＋ 新建构造
              </button>
              <button
                class="button"
                :disabled="busy"
                @click="archiveOpen = true"
              >
                打开归档管理
              </button>
            </div>
          </div>
        </template>
        <ComparisonWorkspace
          v-else-if="tab === 'compare'"
          v-model:baseline-id="baselineId"
          v-model:alternative-id="alternativeId"
          :assemblies="visibleAssemblies"
          :materials="data.materials"
          :busy="busy"
          :dirty="dirty"
          @align="alignAlternative"
          @design="tab = 'design'"
        />
        <template v-else-if="tab === 'documents'">
          <DocumentWorkspace
            v-if="draft"
            :assembly="draft"
            :documents="selectedDocuments"
            :dirty="dirty"
            :busy="busy"
            :valid="Boolean(result)"
            :archived="draftArchived"
            @finalize="finalize"
            @reopen="reopen"
            @design="tab = 'design'"
            @restore="restore(draft.id)"
          />
          <div
            v-else
            class="empty-state"
          >
            <h2>没有可查看的构造</h2>
            <p>先在构造编辑中选择一个构造；归档构造的历史计算书可从归档管理打开查看。</p>
            <div class="empty-actions">
              <button
                class="button primary"
                @click="tab = 'design'"
              >
                返回构造编辑
              </button>
              <button
                class="button"
                :disabled="busy"
                @click="archiveOpen = true"
              >
                打开归档管理
              </button>
            </div>
          </div>
        </template>
        <MaterialWorkspace
          v-else
          :materials="data.materials"
          :busy="busy"
          :submit-material="addCustomMaterial"
        />
      </template>
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

<style scoped>
.archive-entry {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 10px;
}
.empty-actions {
  display: flex;
  gap: 8px;
  justify-content: center;
  margin-top: 12px;
}
</style>
