/**
 * 增量 SHA-256（純 JS 實作，無外部依賴）。
 *
 * 瀏覽器 Web Crypto 的 `crypto.subtle.digest` 只能一次吃完整個 ArrayBuffer，
 * 上傳 100 MB 檔案時會讓 JS heap 出現約 2 倍檔案的暫態峰值。
 * 這裡改為分塊讀取檔案並逐塊餵入增量實作，峰值記憶體降為單一區塊大小。
 */

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
])

function rotr(value: number, bits: number): number {
  return (value >>> bits) | (value << (32 - bits))
}

class Sha256 {
  private readonly state = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ])

  private readonly block = new Uint8Array(64)
  private readonly words = new Uint32Array(64)
  private blockLength = 0
  private totalLength = 0

  update(data: Uint8Array): void {
    this.totalLength += data.length
    let offset = 0

    if (this.blockLength > 0) {
      const take = Math.min(64 - this.blockLength, data.length)
      this.block.set(data.subarray(0, take), this.blockLength)
      this.blockLength += take
      offset = take
      if (this.blockLength === 64) {
        this.compress(this.block, 0)
        this.blockLength = 0
      }
    }

    while (offset + 64 <= data.length) {
      this.compress(data, offset)
      offset += 64
    }

    if (offset < data.length) {
      this.block.set(data.subarray(offset), 0)
      this.blockLength = data.length - offset
    }
  }

  digestHex(): string {
    const bits = this.totalLength * 8
    const high = Math.floor(bits / 0x100000000)
    const low = bits % 0x100000000
    const padLength = this.blockLength < 56 ? 56 - this.blockLength : 120 - this.blockLength
    const padding = new Uint8Array(padLength + 8)
    padding[0] = 0x80
    padding[padLength] = (high >>> 24) & 0xff
    padding[padLength + 1] = (high >>> 16) & 0xff
    padding[padLength + 2] = (high >>> 8) & 0xff
    padding[padLength + 3] = high & 0xff
    padding[padLength + 4] = (low >>> 24) & 0xff
    padding[padLength + 5] = (low >>> 16) & 0xff
    padding[padLength + 6] = (low >>> 8) & 0xff
    padding[padLength + 7] = low & 0xff
    // update() 會累加 totalLength，但長度欄位已先算好，故不影響結果。
    this.update(padding)

    let hex = ''
    for (const word of this.state) hex += word.toString(16).padStart(8, '0')
    return hex
  }

  private compress(view: Uint8Array, offset: number): void {
    const w = this.words
    for (let i = 0; i < 16; i += 1) {
      const base = offset + i * 4
      w[i] =
        ((view[base] << 24) | (view[base + 1] << 16) | (view[base + 2] << 8) | view[base + 3]) >>> 0
    }
    for (let i = 16; i < 64; i += 1) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3)
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10)
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0
    }

    const h = this.state
    let a = h[0]
    let b = h[1]
    let c = h[2]
    let d = h[3]
    let e = h[4]
    let f = h[5]
    let g = h[6]
    let hh = h[7]

    for (let i = 0; i < 64; i += 1) {
      const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)
      const ch = (e & f) ^ (~e & g)
      const temp1 = (hh + s1 + ch + K[i] + w[i]) >>> 0
      const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const temp2 = (s0 + maj) >>> 0
      hh = g
      g = f
      f = e
      e = (d + temp1) >>> 0
      d = c
      c = b
      b = a
      a = (temp1 + temp2) >>> 0
    }

    h[0] = (h[0] + a) >>> 0
    h[1] = (h[1] + b) >>> 0
    h[2] = (h[2] + c) >>> 0
    h[3] = (h[3] + d) >>> 0
    h[4] = (h[4] + e) >>> 0
    h[5] = (h[5] + f) >>> 0
    h[6] = (h[6] + g) >>> 0
    h[7] = (h[7] + hh) >>> 0
  }
}

/** 分塊讀取 Blob 並計算 SHA-256 hex；記憶體峰值為單一區塊（預設 4 MiB）。 */
export async function sha256HexBlob(blob: Blob, chunkSize = 4 * 1024 * 1024): Promise<string> {
  const hasher = new Sha256()
  for (let offset = 0; offset < blob.size; offset += chunkSize) {
    const end = Math.min(offset + chunkSize, blob.size)
    hasher.update(new Uint8Array(await blob.slice(offset, end).arrayBuffer()))
  }
  return hasher.digestHex()
}
