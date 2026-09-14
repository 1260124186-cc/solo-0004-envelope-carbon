// 精确十进制小数：value = m × 10^e。
// 双精度输入是有限二进制小数，均可精确改写为有限十进制；
// 碳计算只含乘法、加法与除以 10 的幂，全程保持精确，仅在输出时一次性舍入。
export interface Dec {
  m: bigint
  e: number
}

export const zeroDec: Dec = { m: 0n, e: 0 }
export const oneDec: Dec = { m: 1n, e: 0 }

function scaleBinary(m: bigint, exp2: number): Dec {
  // m × 2^exp2 的精确十进制：2^-k = 5^k × 10^-k
  if (m === 0n) return { m: 0n, e: 0 }
  if (exp2 >= 0) return { m: m << BigInt(exp2), e: 0 }
  return { m: m * 5n ** BigInt(-exp2), e: exp2 }
}

export function fromDouble(value: number): Dec {
  if (!Number.isFinite(value)) throw new Error('数值无效，无法精确计算。')
  if (value === 0) return { m: 0n, e: 0 }
  const buffer = new DataView(new ArrayBuffer(8))
  buffer.setFloat64(0, value)
  const hi = BigInt(buffer.getUint32(0))
  const lo = BigInt(buffer.getUint32(4))
  const sign = (hi & 0x80000000n) !== 0n ? -1n : 1n
  const exponent = Number((hi >> 20n) & 0x7ffn)
  const fraction = (hi & 0xfffffn) * 0x100000000n + lo
  if (exponent === 0) return scaleBinary(sign * fraction, -1074)
  return scaleBinary(sign * ((1n << 52n) | fraction), exponent - 1075)
}

export function add(a: Dec, b: Dec): Dec {
  if (a.m === 0n) return b
  if (b.m === 0n) return a
  if (a.e < b.e) return { m: a.m + b.m * 10n ** BigInt(b.e - a.e), e: a.e }
  if (b.e < a.e) return { m: a.m * 10n ** BigInt(a.e - b.e) + b.m, e: b.e }
  return { m: a.m + b.m, e: a.e }
}

export function mul(a: Dec, b: Dec): Dec {
  return { m: a.m * b.m, e: a.e + b.e }
}

export function divByPowerOfTen(value: Dec, power: number): Dec {
  return { m: value.m, e: value.e - power }
}

export function sumDec(values: Dec[]): Dec {
  let total = zeroDec
  for (const value of values) total = add(total, value)
  return total
}

function normalized(value: Dec): Dec {
  let { m, e } = value
  if (m === 0n) return { m: 0n, e: 0 }
  while (m % 10n === 0n) {
    m /= 10n
    e += 1
  }
  return { m, e }
}

export function equal(a: Dec, b: Dec): boolean {
  const x = normalized(a)
  const y = normalized(b)
  return x.m === y.m && x.e === y.e
}

export function toDouble(value: Dec): number {
  // Number 解析十进制字符串按最近偶数舍入，得到正确舍入的双精度值。
  return Number(`${value.m}e${value.e}`)
}
