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

const percentFormatter = new Intl.NumberFormat('zh-CN', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

export function percent(value: number): string {
  if (!Number.isFinite(value)) return '—'
  return `${percentFormatter.format(value * 100)}%`
}

export function signedPercent(value: number): string {
  if (!Number.isFinite(value)) return '—'
  return `${value > 0 ? '+' : ''}${percent(value)}`
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
