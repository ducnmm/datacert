import { writeFileSync, unlinkSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { spawnSync } from 'child_process'
import { config } from '../config.js'
import { WalrusUploadResult } from '../types/dataset.js'
import { computeSha256FromBase64, computePoseidonPlaceholder } from '../utils/hash.js'

interface UploadPayload {
  fileName: string
  mimeType: string
  contentBase64: string
}

export class WalrusClient {
  async upload(payload: UploadPayload): Promise<WalrusUploadResult & {
    sha256: string
    poseidon: string
  }> {
    const sizeBytes = Buffer.from(payload.contentBase64, 'base64').byteLength
    const sha256 = computeSha256FromBase64(payload.contentBase64)
    const poseidon = computePoseidonPlaceholder(payload.contentBase64)

    // Write to temp file
    const tempPath = join(tmpdir(), `walrus-upload-${Date.now()}-${payload.fileName}`)
    const buffer = Buffer.from(payload.contentBase64, 'base64')
    writeFileSync(tempPath, buffer)

    if (config.walrusForceMock) {
      console.info('ℹ️  WALRUS_FORCE_MOCK=true → using mock blob ids')
      return this.makeMockResult(sizeBytes, sha256, poseidon)
    }

    let stdout = ''
    let stderr = ''

    try {
      const result = spawnSync(
        config.walrusCliPath,
        ['store', '--json', '--epochs', '1', tempPath],
        {
          encoding: 'utf-8',
          timeout: 60000
        }
      )
      stdout = result.stdout ?? ''
      stderr = result.stderr ?? ''

      if (result.status === 0 && stdout.trim().length > 0) {
        const parsed = JSON.parse(stdout)
        let blobId: string
        let suiBlobId: string

        // Walrus CLI returns an array of results
        const firstResult = Array.isArray(parsed) ? parsed[0] : parsed
        const blobStoreResult = firstResult.blobStoreResult || firstResult

        if (blobStoreResult.newlyCreated) {
          blobId = blobStoreResult.newlyCreated.blobObject.blobId
          suiBlobId = blobStoreResult.newlyCreated.blobObject.id
        } else if (blobStoreResult.alreadyCertified) {
          blobId = blobStoreResult.alreadyCertified.blobId
          suiBlobId = blobStoreResult.alreadyCertified.event?.objectId ?? blobStoreResult.alreadyCertified.blobId
        } else {
          throw new Error('Unexpected Walrus CLI output format')
        }

        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        return {
          blobId,
          integrityRoot: suiBlobId,
          proof: sha256,
          expiresAt,
          sizeBytes,
          sha256,
          poseidon
        }
      }

      // Log detailed error info
      console.error('❌ Walrus CLI failed:', {
        status: result.status,
        stderr: stderr.substring(0, 500),
        stdout: stdout.substring(0, 500)
      })
      this.handleWalrusError(stderr || stdout)
      return this.makeMockResult(sizeBytes, sha256, poseidon)
    } catch (error) {
      this.handleWalrusError(
        error instanceof Error ? error.message : 'Unknown Walrus upload error'
      )
      return this.makeMockResult(sizeBytes, sha256, poseidon)
    } finally {
      // Cleanup temp file
      try {
        unlinkSync(tempPath)
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }

  async read(blobId: string): Promise<string> {
    return `${config.walrusGateway}/v1/blobs/${blobId}`
  }

  private handleWalrusError(message: string) {
    if (message.includes('could not find WAL coins with sufficient balance')) {
      console.warn('⚠️  Walrus CLI: insufficient WAL balance, falling back to mock blob')
      return
    }
    console.warn('⚠️  Walrus CLI fallback triggered:', message)
  }

  private makeMockResult(sizeBytes: number, sha256: string, poseidon: string) {
    return {
      blobId: `walrus-mock-${Date.now()}`,
      integrityRoot: sha256.substring(0, 32),
      proof: sha256,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      sizeBytes,
      sha256,
      poseidon
    }
  }
}

export const walrusClient = new WalrusClient()
