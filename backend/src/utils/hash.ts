import { createHash } from 'crypto'

export function computeSha256FromBase64(base64Content: string): string {
  const buffer = Buffer.from(base64Content, 'base64')
  return createHash('sha256').update(buffer).digest('hex')
}

export function computePoseidonPlaceholder(base64Content: string): string {
  // Placeholder for Poseidon hash until ZK library is wired in.
  const buffer = Buffer.from(base64Content, 'base64')
  return createHash('sha512').update(buffer).digest('hex').slice(0, 64)
}
