export function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}

export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export function now(): string {
  return new Date().toISOString()
}
