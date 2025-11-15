import { config } from '../config.js'
import { getDataset } from './datasetService.js'
import { auditLogger } from '../logger.js'
import { calculateTrustScore, publishTrustScoreWithNautilus } from './trustOracle.js'
import type { DatasetRecord } from '../types/dataset.js'
import type { NautilusVerificationProof, TrustScore } from '../types/trust.js'
import { prismaService } from './prismaService.js'
import { memoryStore } from '../store/memoryStore.js'

interface NautilusIntentEnvelope<T> {
  intent: number
  timestamp_ms: number
  data: T
}

interface NautilusProcessDataResponse {
  response: NautilusIntentEnvelope<NautilusWalrusResult>
  signature: string
}

interface NautilusWalrusResult {
  blob_id: string
  expected_sha256: string
  computed_sha256: string
  verified: boolean
  blob_size: number
  walrus_gateway: string
}

interface NautilusVerificationRecord {
  proof: NautilusVerificationProof
  trustScore: TrustScore
}

const verificationCache = new Map<string, NautilusVerificationRecord>()
const DEFAULT_TIMEOUT_MS = 20_000

function isNautilusEnabled(): boolean {
  return Boolean(config.nautilusServerUrl)
}

function resolveWalrusGateway(): string {
  return (config.nautilusWalrusGateway ?? config.walrusGateway ?? '').replace(/\/$/, '')
}

export async function requestNautilusVerification(datasetId: string, blobId?: string): Promise<TrustScore | undefined> {
  if (!isNautilusEnabled()) {
    auditLogger.warn('nautilus_not_configured', 'NAUTILUS_SERVER_URL not set; skipping verification', {
      datasetId
    })
    return undefined
  }

  const dataset = await getDataset(datasetId)
  const targetBlob = blobId ?? dataset.walrus.blobId
  if (!targetBlob) {
    throw new Error(`Dataset ${datasetId} does not have a Walrus blob id`)
  }
  if (!dataset.hashes.sha256) {
    throw new Error(`Dataset ${datasetId} is missing SHA256 metadata`)
  }

  const proof = await callNautilusServer({
    blobId: targetBlob,
    expectedSha256: dataset.hashes.sha256
  })

  return finalizeNautilusVerification(dataset, proof)
}

export async function getLatestVerification(datasetId: string): Promise<NautilusVerificationRecord | undefined> {
  if (verificationCache.has(datasetId)) {
    return verificationCache.get(datasetId)
  }

  try {
    const dataset = await getDataset(datasetId)
    if (dataset.trust?.nautilusProof) {
      const record: NautilusVerificationRecord = {
        proof: dataset.trust.nautilusProof,
        trustScore: dataset.trust
      }
      verificationCache.set(datasetId, record)
      return record
    }
  } catch (error) {
    auditLogger.warn('nautilus_cache_lookup_failed', 'Unable to hydrate latest Nautilus proof from dataset record', {
      datasetId,
      error: error instanceof Error ? error.message : String(error)
    })
  }
  return undefined
}

async function finalizeNautilusVerification(dataset: DatasetRecord, proof: NautilusVerificationProof): Promise<TrustScore> {
  const integrityCheck = {
    sha256Match: proof.computedSha256.toLowerCase() === proof.expectedSha256.toLowerCase(),
    poseidonMatch: proof.verified,
    integrityRootValid: proof.verified,
    walrusLatencyMs: undefined
  }

  const trustScore = calculateTrustScore(dataset, proof.verified, integrityCheck)
  trustScore.nautilusProof = proof

  await publishTrustScoreWithNautilus(trustScore, proof)
  await prismaService.saveTrustScore(dataset.id, trustScore)
  memoryStore.updateTrust(dataset.id, trustScore)

  verificationCache.set(dataset.id, { proof, trustScore })

  auditLogger.info('nautilus_verification_complete', 'Dataset verified via local Nautilus enclave', {
    datasetId: dataset.id,
    blobId: proof.blobId,
    verified: proof.verified
  })

  return trustScore
}

async function callNautilusServer(input: { blobId: string; expectedSha256: string }): Promise<NautilusVerificationProof> {
  const serverUrl = config.nautilusServerUrl!.replace(/\/$/, '')
  const payload = {
    payload: {
      blob_id: input.blobId,
      expected_sha256: input.expectedSha256,
      walrus_gateway: resolveWalrusGateway()
    }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)

  try {
    const response = await fetch(`${serverUrl}/process_data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Nautilus enclave responded with ${response.status}: ${text}`)
    }

    const body = await response.json() as NautilusProcessDataResponse
    return {
      blobId: body.response.data.blob_id,
      expectedSha256: body.response.data.expected_sha256,
      computedSha256: body.response.data.computed_sha256,
      verified: body.response.data.verified,
      blobSize: body.response.data.blob_size,
      walrusGateway: body.response.data.walrus_gateway,
      timestampMs: body.response.timestamp_ms,
      signature: body.signature.toLowerCase()
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    auditLogger.error('nautilus_request_failed', 'Failed to fetch proof from Nautilus enclave', {
      blobId: input.blobId,
      error: message
    })
    throw error
  } finally {
    clearTimeout(timeout)
  }
}
