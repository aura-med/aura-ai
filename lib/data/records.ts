export type DbRecord = Record<string, unknown>

export function asRecord(value: unknown): DbRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as DbRecord : {}
}

export function asRecordArray(value: unknown): DbRecord[] {
  return Array.isArray(value) ? value.map(asRecord) : []
}

export function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

export function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function asBoolean(value: unknown): boolean {
  return typeof value === 'boolean' ? value : false
}

export function firstRecord(value: unknown): DbRecord {
  return asRecordArray(value)[0] ?? {}
}

export function sortByDateDesc<T extends DbRecord>(rows: T[], key: string): T[] {
  return [...rows].sort((a, b) => {
    const left = Date.parse(asString(a[key]) ?? '')
    const right = Date.parse(asString(b[key]) ?? '')
    return (Number.isNaN(right) ? 0 : right) - (Number.isNaN(left) ? 0 : left)
  })
}

export function latestByDate(value: unknown, key: string): DbRecord {
  return sortByDateDesc(asRecordArray(value), key)[0] ?? {}
}

export function dateOnly(value: Date = new Date()): string {
  return value.toISOString().slice(0, 10)
}
