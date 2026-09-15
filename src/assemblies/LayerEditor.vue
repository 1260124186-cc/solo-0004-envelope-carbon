<script setup lang="ts">
import { ref } from 'vue'
import type { Layer } from './types'
import type { Material } from '../materials/types'
import LayerRow from './LayerRow.vue'
import MaterialPicker from '../materials/MaterialPicker.vue'
const props = defineProps<{ layers: Layer[]; materials: Material[]; disabled: boolean }>()
const emit = defineEmits<{
  update: [id: string, patch: Partial<Layer>]
  remove: [id: string]
  move: [id: string, direction: -1 | 1]
  reorder: [from: number, to: number]
  add: [material: Material]
}>()

const dragId = ref('')
const targetIndex = ref(-1)
const announcement = ref('')

function draggedIndex(): number {
  return props.layers.findIndex((layer) => layer.id === dragId.value)
}

function onDragStart(event: DragEvent, layer: Layer) {
  dragId.value = layer.id
  targetIndex.value = -1
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', layer.id)
  }
  // 拖动整行而不只是手柄，方便看清被拖的是哪一层。
  const row = (event.currentTarget as HTMLElement | null)?.closest('.layer-row')
  if (row && event.dataTransfer) {
    const rect = row.getBoundingClientRect()
    event.dataTransfer.setDragImage(row, rect.width / 2, rect.height / 2)
  }
}

// 根据指针位于目标行的上/下半区，返回插入位置（0 至 layers.length）。
function insertionIndex(event: DragEvent, index: number): number {
  const row = event.currentTarget as HTMLElement | null
  if (!row) return index
  const rect = row.getBoundingClientRect()
  return event.clientY < rect.top + rect.height / 2 ? index : index + 1
}

function showTarget(event: DragEvent, index: number) {
  if (!dragId.value) return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  const from = draggedIndex()
  const target = insertionIndex(event, index)
  // 落在原位置的两个空隙（层前、层后）时不做任何移动，也不显示指示线。
  targetIndex.value = target === from || target === from + 1 ? -1 : target
}

function showTail(event: DragEvent) {
  if (!dragId.value) return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  const from = draggedIndex()
  const target = props.layers.length
  targetIndex.value = target === from || target === from + 1 ? -1 : target
}

function drop(event: DragEvent, index: number) {
  if (!dragId.value) return
  event.preventDefault()
  const from = draggedIndex()
  const target = insertionIndex(event, index)
  commitReorder(from, target)
}

function dropTail(event: DragEvent) {
  if (!dragId.value) return
  event.preventDefault()
  commitReorder(draggedIndex(), props.layers.length)
}

function commitReorder(from: number, target: number) {
  const moved = props.layers[from]
  if (moved && target !== from && target !== from + 1) {
    // reorder 的目标是“移除后插入”的最终下标：插在 from 之后时下标减一。
    const finalPosition = target > from ? target - 1 : target
    emit('reorder', from, finalPosition)
    const material = props.materials.find((item) => item.id === moved.materialId)
    announcement.value = `已调整顺序：${material?.name ?? '该层'}现位于第 ${finalPosition + 1} 层（室外至室内）。`
  }
  resetDrag()
}

function resetDrag() {
  dragId.value = ''
  targetIndex.value = -1
}
</script>

<template>
  <section
    class="layer-editor"
    aria-labelledby="layer-heading"
  >
    <span
      class="sr-only"
      role="status"
      aria-live="polite"
      >{{ announcement }}</span
    >
    <div class="section-heading">
      <div>
        <span class="eyebrow">构造组成</span>
        <h2 id="layer-heading">从室外，到室内</h2>
      </div>
      <span class="muted">{{ layers.length }} / 20 层</span>
    </div>
    <p class="layer-direction">
      室外侧 <span>↓ 拖拽 ⠿ 手柄可直接调整顺序，也可用 ↑ ↓ 按键移动</span>
    </p>
    <div
      v-if="!layers.length"
      class="empty-state"
    >
      构造还是空的。请从下方选择第一种材料。
    </div>
    <LayerRow
      v-for="(layer, index) in layers"
      :key="layer.id"
      :layer="layer"
      :index="index"
      :total="layers.length"
      :materials="materials"
      :disabled="disabled"
      :dragging="layer.id === dragId"
      :drop-before="targetIndex === index"
      @update="emit('update', layer.id, $event)"
      @remove="emit('remove', layer.id)"
      @move="emit('move', layer.id, $event)"
      @dragstart="onDragStart($event, layer)"
      @dragover="showTarget($event, index)"
      @drop="drop($event, index)"
      @dragend="resetDrag"
    />
    <div
      v-if="layers.length"
      class="drop-tail"
      :class="{ active: targetIndex === layers.length }"
      aria-hidden="true"
      @dragover="showTail"
      @drop="dropTail"
    />
    <p
      v-if="layers.length"
      class="layer-direction"
    >
      室内侧
    </p>
    <MaterialPicker
      :materials="materials"
      :disabled="disabled || layers.length >= 20"
      @add="emit('add', $event)"
    />
  </section>
</template>

<style scoped>
.layer-editor {
  margin-top: 30px;
}
.layer-direction {
  font-size: 11px;
  color: var(--muted);
  margin: 15px 0;
}
.layer-direction span {
  margin-left: 12px;
  color: #9a9d94;
}
.drop-tail {
  height: 12px;
  margin: 0 0 10px;
  border-radius: 3px;
}
.drop-tail.active {
  box-shadow: inset 0 3px 0 var(--green);
}
</style>
