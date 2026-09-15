<script setup lang="ts">
import type { FreezePreview } from './preview'
import { DOCUMENT_CAPACITY_NEAR_LIMIT_SLOTS } from './preview'
import { date, number } from '../shared/format'
import { kindLabels } from '../materials/types'
import { stateLabels, surfaceLabels } from '../assemblies/types'

const props = defineProps<{ preview: FreezePreview; busy: boolean; error: string }>()
const emit = defineEmits<{ cancel: []; confirm: [] }>()

const capacityNear = props.preview.remaining <= DOCUMENT_CAPACITY_NEAR_LIMIT_SLOTS
</script>

<template>
  <Teleport to="body">
    <div
      class="preview-backdrop"
      @click.self="!busy && emit('cancel')"
    >
      <section
        class="freeze-preview"
        role="dialog"
        aria-modal="true"
        aria-labelledby="freeze-preview-title"
      >
        <header class="preview-header">
          <div>
            <span class="eyebrow">定稿前校验</span>
            <h2 id="freeze-preview-title">冻结预览</h2>
            <p>
              以下内容来自当前已保存的构造（修订
              {{ preview.revision }}），未保存草稿不会进入计算书。
            </p>
          </div>
          <button
            class="preview-close"
            type="button"
            :disabled="busy"
            aria-label="关闭冻结预览"
            @click="emit('cancel')"
          >
            ×
          </button>
        </header>

        <div class="preview-body">
          <div
            v-if="preview.issues.length"
            class="preview-blockers"
            role="alert"
          >
            <h3>定稿已阻止，请先处理以下位置</h3>
            <ul>
              <li
                v-for="(issue, index) in preview.issues"
                :key="`${issue.location}-${index}`"
              >
                <strong>{{ issue.location }}</strong>
                <span>{{ issue.text }}</span>
              </li>
            </ul>
          </div>

          <div
            v-if="error"
            class="preview-blockers commit-error"
            role="alert"
          >
            <h3>定稿写入未完成</h3>
            <p>{{ error }}</p>
          </div>

          <section class="preview-section">
            <h3>将冻结的构造状态</h3>
            <dl class="preview-summary">
              <div>
                <dt>构造名称</dt>
                <dd data-check="preview-name">{{ preview.assembly.name }}</dd>
              </div>
              <div>
                <dt>当前状态</dt>
                <dd data-check="preview-state">{{ stateLabels[preview.assembly.state] }}</dd>
              </div>
              <div>
                <dt>修订号</dt>
                <dd data-check="preview-revision">{{ preview.revision }}</dd>
              </div>
              <div>
                <dt>建筑部位</dt>
                <dd>{{ surfaceLabels[preview.assembly.surface] }}</dd>
              </div>
              <div>
                <dt>构造面积</dt>
                <dd>{{ number(preview.assembly.area) }} 平方米</dd>
              </div>
              <div>
                <dt>计算年限</dt>
                <dd>{{ preview.assembly.years }} 年</dd>
              </div>
              <div>
                <dt>碳强度目标</dt>
                <dd>≤ {{ number(preview.assembly.carbonLimit) }} 千克当量/平方米</dd>
              </div>
              <div>
                <dt>传热系数上限</dt>
                <dd>≤ {{ number(preview.assembly.thermalLimit) }} 瓦/平方米·开尔文</dd>
              </div>
            </dl>
            <div class="table-scroll compact">
              <table>
                <caption>
                  构造层（室外至室内，共
                  {{
                    preview.assembly.layers.length
                  }}
                  层）
                </caption>
                <thead>
                  <tr>
                    <th scope="col">序号</th>
                    <th scope="col">材料</th>
                    <th scope="col">厚度（毫米）</th>
                    <th scope="col">损耗率</th>
                    <th scope="col">替换寿命（年）</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(layer, index) in preview.assembly.layers"
                    :key="layer.id"
                  >
                    <th scope="row">{{ index + 1 }}</th>
                    <td>
                      {{ preview.materialNames[layer.materialId] || '材料缺失（见下方校验问题）' }}
                    </td>
                    <td>{{ number(layer.thickness) }}</td>
                    <td>{{ number(layer.loss) }}%</td>
                    <td>{{ layer.lifespan }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p class="preview-note">
              <strong>设计说明：</strong>{{ preview.assembly.note || '无补充说明。' }}
            </p>
            <p class="preview-meta">最后保存时间：{{ date(preview.assembly.updatedAt) }}</p>
          </section>

          <section class="preview-section">
            <h3>材料物性快照</h3>
            <p class="section-note">
              计算书将复制
              {{ preview.materials.length }}
              种本构造引用材料的当前物性，后续材料目录变化不影响本计算书。
            </p>
            <div class="table-scroll compact">
              <table>
                <thead>
                  <tr>
                    <th scope="col">材料</th>
                    <th scope="col">类别</th>
                    <th scope="col">密度（千克/立方米）</th>
                    <th scope="col">导热系数</th>
                    <th scope="col">碳因子</th>
                    <th scope="col">参考寿命（年）</th>
                    <th scope="col">参数来源</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="material in preview.materials"
                    :key="material.id"
                  >
                    <th scope="row">{{ material.name }}</th>
                    <td>{{ kindLabels[material.kind] }}</td>
                    <td>{{ number(material.density) }}</td>
                    <td>{{ number(material.conductivity) }}</td>
                    <td>{{ number(material.factor) }}</td>
                    <td>{{ material.lifespan }}</td>
                    <td>{{ material.source }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section class="preview-section">
            <h3>将写入计算书的计算结果</h3>
            <div
              v-if="preview.result"
              class="result-grid"
            >
              <div>
                <span>初始隐含碳</span>
                <strong data-check="preview-initial">{{ number(preview.result.initial) }}</strong>
                <small>千克当量/平方米</small>
              </div>
              <div>
                <span>替换隐含碳</span>
                <strong data-check="preview-replacement">{{
                  number(preview.result.replacement)
                }}</strong>
                <small>千克当量/平方米</small>
              </div>
              <div>
                <span>生命周期强度</span>
                <strong data-check="preview-intensity">{{
                  number(preview.result.intensity)
                }}</strong>
                <small>千克当量/平方米</small>
              </div>
              <div>
                <span>整个构造隐含碳</span>
                <strong data-check="preview-whole">{{ number(preview.result.whole) }}</strong>
                <small>千克二氧化碳当量</small>
              </div>
              <div>
                <span>传热系数</span>
                <strong data-check="preview-transmittance">{{
                  number(preview.result.transmittance)
                }}</strong>
                <small>瓦/平方米·开尔文</small>
              </div>
              <div>
                <span>目标校核</span>
                <strong :class="preview.result.carbonPass ? 'pass' : 'fail'">
                  {{ preview.result.carbonPass ? '碳目标通过' : '超过碳目标' }}
                </strong>
                <small :class="preview.result.thermalPass ? 'pass' : 'fail'">
                  {{ preview.result.thermalPass ? '热工目标通过' : '超过热工目标' }}
                </small>
              </div>
            </div>
            <div
              v-if="preview.result"
              class="table-scroll compact"
            >
              <table>
                <caption>
                  逐层计算结果（室外至室内）
                </caption>
                <thead>
                  <tr>
                    <th scope="col">材料</th>
                    <th scope="col">厚度（毫米）</th>
                    <th scope="col">质量（千克/平方米）</th>
                    <th scope="col">替换次数</th>
                    <th scope="col">初始碳（千克当量/平方米）</th>
                    <th scope="col">替换碳（千克当量/平方米）</th>
                    <th scope="col">合计（千克当量/平方米）</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="layer in preview.result.layers"
                    :key="layer.layerId"
                  >
                    <th scope="row">{{ layer.materialName }}</th>
                    <td>{{ number(layer.thickness) }}</td>
                    <td>{{ number(layer.mass) }}</td>
                    <td>{{ layer.cycles }}</td>
                    <td>{{ number(layer.initial) }}</td>
                    <td>{{ number(layer.replacement) }}</td>
                    <td>{{ number(layer.total) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p
              v-else
              class="result-unavailable"
            >
              参数校验未通过，暂不生成计算结果。
            </p>
          </section>

          <section
            class="preview-section capacity-section"
            :class="{ warning: capacityNear }"
          >
            <h3>容量与修订</h3>
            <p>
              当前已有 {{ preview.documentCount.toLocaleString('zh-CN') }} /
              {{ preview.capacity.toLocaleString('zh-CN') }} 份计算书，定稿后修订号保持为
              <strong data-check="preview-freeze-revision">{{ preview.revision }}</strong
              >，状态冻结为「已定稿」。
            </p>
          </section>
        </div>

        <footer class="preview-footer">
          <button
            type="button"
            class="button"
            :disabled="busy"
            @click="emit('cancel')"
          >
            取消
          </button>
          <button
            type="button"
            class="button primary"
            data-check="confirm-finalize"
            :disabled="busy || !preview.canFinalize"
            @click="emit('confirm')"
          >
            {{ busy ? '正在定稿…' : '确认并生成计算书' }}
          </button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.preview-backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
  background: rgba(31, 45, 37, 0.58);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.freeze-preview {
  width: min(1080px, 100%);
  max-height: calc(100vh - 48px);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: 8px;
  box-shadow: 0 24px 70px rgba(20, 35, 28, 0.28);
}
.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 18px;
  padding: 24px 28px;
  border-bottom: 1px solid var(--line);
}
.preview-header h2 {
  margin: 4px 0 8px;
}
.preview-header p {
  margin: 0;
  color: var(--muted);
  font-size: 12px;
}
.preview-close {
  border: 0;
  background: transparent;
  color: var(--muted);
  font-size: 26px;
  line-height: 1;
  padding: 0 4px;
}
.preview-body {
  overflow-y: auto;
  padding: 24px 28px;
}
.preview-section {
  margin-bottom: 24px;
}
.preview-section h3 {
  margin: 0 0 14px;
  font-size: 14px;
}
.preview-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin: 0 0 18px;
}
.preview-summary div {
  border: 1px solid var(--line);
  background: #f8f9f2;
  border-radius: 5px;
  padding: 11px 12px;
}
.preview-summary dt {
  color: var(--muted);
  font-size: 10px;
  margin-bottom: 5px;
}
.preview-summary dd {
  margin: 0;
  font-size: 12px;
  font-weight: 500;
}
.table-scroll.compact {
  margin: 12px 0;
}
.compact :is(th, td) {
  padding: 9px 10px;
  font-size: 11px;
}
.preview-note,
.preview-meta,
.section-note {
  color: var(--muted);
  font-size: 11px;
  line-height: 1.8;
  margin: 8px 0;
}
.preview-blockers {
  border: 1px solid #d49c76;
  background: #fdf2e5;
  color: #6f411f;
  border-radius: 6px;
  padding: 16px 18px;
  margin-bottom: 24px;
}
.preview-blockers h3 {
  margin: 0 0 10px;
  font-size: 13px;
}
.preview-blockers ul {
  margin: 0;
  padding-left: 18px;
  font-size: 12px;
  line-height: 1.8;
}
.preview-blockers strong {
  margin-right: 8px;
}
.commit-error p {
  margin: 0;
  white-space: pre-line;
  line-height: 1.8;
  font-size: 12px;
}
.result-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
.result-grid div {
  border: 1px solid var(--line);
  border-radius: 5px;
  padding: 14px;
}
.result-grid span,
.result-grid small {
  display: block;
  color: var(--muted);
  font-size: 10px;
}
.result-grid strong {
  display: block;
  font-size: 21px;
  font-weight: 500;
  margin: 7px 0;
}
.pass {
  color: var(--green);
}
.fail {
  color: #a04b32;
}
.result-unavailable {
  border: 1px dashed #d1b39f;
  background: #fcf5ee;
  color: #7d5137;
  border-radius: 5px;
  padding: 14px;
  font-size: 12px;
}
.capacity-section {
  color: var(--muted);
  font-size: 12px;
  line-height: 1.8;
}
.capacity-section.warning {
  border: 1px solid #d8bd76;
  background: #fbf6e7;
  padding: 12px 14px;
  border-radius: 5px;
}
.preview-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 18px 28px;
  border-top: 1px solid var(--line);
}
@media (max-width: 800px) {
  .preview-summary,
  .result-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 560px) {
  .preview-backdrop {
    padding: 0;
  }
  .freeze-preview {
    max-height: 100vh;
    border-radius: 0;
  }
  .preview-summary,
  .result-grid {
    grid-template-columns: 1fr;
  }
}
</style>
