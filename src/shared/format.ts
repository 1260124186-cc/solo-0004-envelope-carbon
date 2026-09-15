const formatter = new Intl.NumberFormat('zh-CN', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

export function number(value: number): string {
  if (!Number.isFinite(value)) return '—'
  if (value !== 0 && Math.abs(value) < 1) {
    return new Intl.NumberFormat('zh-CN', { maximumSignificantDigits: 3 }).format(value)
  }
  return formatter.format(value)
}

export function signed(value: number): string {
  return `${value > 0 ? '+' : ''}${number(value)}`
}

// 完整精度：不做任何四舍五入，直接呈现实际保存、实际参与计算的存储值。
// 使用 String(Number) 的最短往返表示，保证 parseFloat(full(x)) === x。
export function full(value: number): string {
  if (!Number.isFinite(value)) return '—'
  return String(value)
}

export function date(value: string): string {
  const parsed = new Date(value)
  if (!Number.isFinite(parsed.getTime())) return '时间未知'
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed)
}
