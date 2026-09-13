<script setup lang="ts">
import { calculationMethod } from './engine'
</script>

<template>
  <details class="method-note">
    <summary>计算口径与边界</summary>
    <div class="method-body">
      <p>{{ calculationMethod }}</p>
      <p>初始质量 = 厚度（米）× 密度。初始隐含碳 = 质量 × 碳因子 ×（1 + 损耗率）。</p>
      <p>替换次数为计算年限除以寿命后向上取整再减一。恰好处于计算期终点的替换不计入。</p>
      <p>
        总热阻 = 各层热阻之和 + 内外表面热阻。未选择热工计算口径时采用默认内表面 0.11、外表面
        0.04；选择口径后按口径设置计算。传热系数为总热阻的倒数。
      </p>
      <p>不计运行能耗、运输、施工能耗、终结阶段及生物源碳储存；不含热桥、含湿或空腔修正。</p>
      <p>内置参数为教学示例，实际工程请选用已核实的物性。目标达成仅用于方案阶段辅助判断。</p>
    </div>
  </details>
</template>

<style scoped>
.method-note {
  padding: 18px 24px;
  border-top: 1px solid var(--line);
  background: #f5f5ef;
}
.method-note summary {
  font-size: 11px;
  color: var(--muted);
  cursor: pointer;
}
.method-body {
  font-size: 11px;
  line-height: 1.8;
  color: var(--muted);
}
.method-body p {
  margin: 10px 0;
}
</style>
