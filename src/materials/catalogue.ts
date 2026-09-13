import type { Material } from './types'

const referenceCreatedAt = '2026-01-01T00:00:00.000Z'

function reference(
  id: string,
  name: string,
  kind: Material['kind'],
  description: string,
  physical: {
    density: number
    conductivity: number
    factor: number
    lifespan: number
    source: string
  },
): Material {
  return {
    id,
    name,
    kind,
    description,
    custom: false,
    revisions: [{ revision: 1, note: '初始版本', createdAt: referenceCreatedAt, ...physical }],
  }
}

export const referenceMaterials: Material[] = [
  reference(
    'env-concrete',
    '普通混凝土',
    'structure',
    '用于演示质量法计算；工程中应按实际强度等级校核。',
    {
      density: 2400,
      conductivity: 1.74,
      factor: 0.13,
      lifespan: 60,
      source: '教学示例参数 · 混凝土',
    },
  ),
  reference('env-aerated', '蒸压加气混凝土', 'structure', '简化干态导热系数，不含灰缝影响。', {
    density: 600,
    conductivity: 0.18,
    factor: 0.32,
    lifespan: 60,
    source: '教学示例参数 · 轻质砌体',
  }),
  reference('env-brick', '烧结多孔砖', 'structure', '密度为构造等效密度，需与实际孔洞率一致。', {
    density: 1400,
    conductivity: 0.58,
    factor: 0.24,
    lifespan: 60,
    source: '教学示例参数 · 多孔砖',
  }),
  reference('env-mineral', '岩棉板', 'insulation', '仅计材料层，未包含锚固件与粘结层。', {
    density: 120,
    conductivity: 0.04,
    factor: 1.2,
    lifespan: 30,
    source: '教学示例参数 · 岩棉',
  }),
  reference('env-woodfiber', '木纤维保温板', 'insulation', '本模型不抵扣生物源碳储存。', {
    density: 160,
    conductivity: 0.046,
    factor: 0.55,
    lifespan: 30,
    source: '教学示例参数 · 木纤维',
  }),
  reference(
    'env-foamglass',
    '泡沫玻璃板',
    'insulation',
    '闭孔材料演示参数，实际数值依制造方法而变。',
    {
      density: 150,
      conductivity: 0.058,
      factor: 1.05,
      lifespan: 50,
      source: '教学示例参数 · 泡沫玻璃',
    },
  ),
  reference('env-lime', '石灰砂浆', 'finish', '按每次整体替换计算，不含后期碳化修正。', {
    density: 1700,
    conductivity: 0.81,
    factor: 0.12,
    lifespan: 20,
    source: '教学示例参数 · 砂浆',
  }),
  reference('env-gypsum', '石膏板', 'finish', '不计龙骨及接缝材料，需另建构造层。', {
    density: 800,
    conductivity: 0.22,
    factor: 0.26,
    lifespan: 25,
    source: '教学示例参数 · 石膏',
  }),
]
