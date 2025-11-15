import { nanoid } from 'nanoid'
import { DatasetRecord, DatasetClaim, AccessPolicy } from '../types/dataset.js'
import { walrusClient } from '../lib/walrusClient.js'
import { suiClient } from '../lib/suiClient.js'
import { memoryStore } from '../store/memoryStore.js'
import { prismaService } from './prismaService.js'
import { auditLogger } from '../logger.js'
import { calculateAndPublishTrustScore } from './trustOracle.js'
import { requestNautilusVerification } from './nautilusOracle.js'

interface UploadInput {
  fileName: string
  mimeType: string
  contentBase64: string
}

interface RegisterInput {
  sessionId: string
  ownerAddress: string
  title: string
  description: string
  categories: string[]
  tags: string[]
  license: string
  sensitivity: DatasetRecord['sensitivity']
  accessPolicy: AccessPolicy
}

interface ClaimInput {
  datasetId: string
  role: DatasetClaim['role']
  statement: string
  severity: DatasetClaim['severity']
  evidenceUri?: string
}

interface AccessRequestInput {
  datasetId: string
  requester: string
  purpose: string
  stakeAmount?: number
  tokenHoldings?: string[]
}

interface UploadSession {
  sessionId: string
  walrusResult: Awaited<ReturnType<typeof walrusClient.upload>>
  createdAt: string
}

const uploadSessions = new Map<string, UploadSession>()

export async function createUploadSession(input: UploadInput) {
  const walrusResult = await walrusClient.upload(input)
  const sessionId = `session-${nanoid(10)}`
  uploadSessions.set(sessionId, {
    sessionId,
    walrusResult,
    createdAt: new Date().toISOString()
  })
  auditLogger.info('walrus_upload', 'Dataset uploaded to Walrus', { sessionId })
  return { sessionId, walrus: walrusResult }
}

export async function registerDataset(input: RegisterInput): Promise<DatasetRecord> {
  const session = uploadSessions.get(input.sessionId)
  if (!session) {
    throw new Error('Upload session not found or expired')
  }

  const datasetId = `dataset-${nanoid(12)}`
  const now = new Date().toISOString()
  const accessPolicy = input.accessPolicy

  const certificate = await suiClient.mintCertificate({
    datasetId,
    ownerAddress: input.ownerAddress,
    walrusBlobId: session.walrusResult.blobId,
    sha256: session.walrusResult.sha256,
    poseidon: session.walrusResult.poseidon,
    license: input.license,
    categories: input.categories,
    minStake: accessPolicy.minStake ?? 0
  })

  const record: DatasetRecord = {
    id: datasetId,
    ownerAddress: input.ownerAddress,
    title: input.title,
    description: input.description,
    categories: input.categories,
    tags: input.tags,
    license: input.license,
    sensitivity: input.sensitivity,
    walrus: {
      blobId: session.walrusResult.blobId,
      integrityRoot: session.walrusResult.integrityRoot,
      proof: session.walrusResult.proof,
      expiresAt: session.walrusResult.expiresAt,
      sizeBytes: session.walrusResult.sizeBytes
    },
    hashes: {
      sha256: session.walrusResult.sha256,
      poseidon: session.walrusResult.poseidon
    },
    status: 'certified',
    certificateId: certificate.certificateId,
    sealPolicyId: undefined,
    createdAt: now,
    updatedAt: now,
    metrics: {
      downloads: 0,
      revenueWal: 0,
      disputes: 0
    },
    accessPolicy,
    claims: [],
    timeline: [
      {
        id: `${datasetId}-upload`,
        type: 'upload',
        description: 'Dataset uploaded to Walrus',
        timestamp: now,
        metadata: { blobId: session.walrusResult.blobId }
      },
      {
        id: `${datasetId}-certificate`,
        type: 'certificate_minted',
        description: 'Certificate minted on Sui',
        timestamp: now,
        metadata: {
          certificateId: certificate.certificateId,
          digest: certificate.digest
        }
      }
    ]
  }

  uploadSessions.delete(input.sessionId)

  // Persist metadata before trust calculations so downstream history lookups succeed
  await prismaService.upsertDataset(record)

  const trustScore = await calculateAndPublishTrustScore(record, false, {
    performWalrusVerification: true
  })
  record.trust = trustScore

  memoryStore.upsertDataset(record)

  try {
    await requestNautilusVerification(datasetId, record.walrus.blobId)
  } catch (error) {
    auditLogger.warn('nautilus_request_failed', 'Failed to request Nautilus verification after registration', {
      datasetId,
      error: error instanceof Error ? error.message : String(error)
    })
  }

  auditLogger.info('dataset_registered', 'Dataset certified', {
    datasetId,
    certificateId: certificate.certificateId,
    trustScore: trustScore.score
  })
  return record
}

export async function listDatasets() {
  return await prismaService.listDatasets()
}

export async function getDataset(datasetId: string) {
  const record = await prismaService.getDataset(datasetId)
  if (!record) {
    throw new Error('Dataset not found')
  }
  return record
}

export async function getTrustScoreHistory(datasetId: string, limit = 20) {
  return prismaService.getTrustHistory(datasetId, limit)
}

export async function addClaim(input: ClaimInput) {
  // Ensure dataset exists and is loaded in memory
  const dataset = await getDataset(input.datasetId)
  if (!dataset) {
    throw new Error(`Dataset ${input.datasetId} not found`)
  }

  const claim: DatasetClaim = {
    id: `claim-${nanoid(8)}`,
    role: input.role,
    statement: input.statement,
    severity: input.severity,
    evidenceUri: input.evidenceUri,
    createdAt: new Date().toISOString()
  }

  // Add to database
  await prismaService.addClaim(input.datasetId, claim)

  // Update memory store
  const record = memoryStore.getDataset(input.datasetId)
  if (record) {
    record.claims.push(claim)
    record.metrics.disputes = record.claims.filter((c: DatasetClaim) => !c.resolved).length
  }

  // File claim on-chain
  const severityMap = { info: 0, warning: 1, critical: 2 }
  const txHash = await suiClient.fileClaim({
    datasetId: input.datasetId,
    severity: severityMap[claim.severity],
    statement: claim.statement,
    evidenceUri: claim.evidenceUri || ''
  })

  auditLogger.warn('dataset_claim', 'Claim filed against dataset', {
    datasetId: input.datasetId,
    claimId: claim.id,
    severity: claim.severity,
    txHash
  })

  return await getDataset(input.datasetId)
}

export async function recordAccess(input: AccessRequestInput) {
  const dataset = await getDataset(input.datasetId)
  if (dataset.accessPolicy.type === 'stake_gated' && (input.stakeAmount ?? 0) < (dataset.accessPolicy.minStake ?? 0)) {
    throw new Error('Insufficient WAL stake for access')
  }
  if (dataset.accessPolicy.type === 'token_gated') {
    const allowed = dataset.accessPolicy.allowedTokens ?? []
    const holdings = input.tokenHoldings ?? []
    const intersection = holdings.filter(token => allowed.includes(token))
    if (intersection.length === 0) {
      throw new Error('Token-gated access denied')
    }
  }

  const tx = await suiClient.recordAccess({
    datasetId: input.datasetId,
    requester: input.requester,
    purpose: input.purpose,
    certificateId: dataset.certificateId,
    stakeAmount: input.stakeAmount
  })

  // Add timeline event with transaction digest
  memoryStore.appendTimeline(input.datasetId, {
    id: `${input.datasetId}-access-${Date.now()}`,
    type: 'access_request',
    description: input.purpose,
    timestamp: new Date().toISOString(),
    metadata: {
      requester: input.requester,
      stakeAmount: input.stakeAmount,
      digest: tx.tx
    }
  })

  auditLogger.info('dataset_access', 'Access granted', {
    datasetId: input.datasetId,
    requester: input.requester,
    tx: tx.tx
  })
  return {
    datasetId: dataset.id,
    downloadUrl: await walrusClient.read(dataset.walrus.blobId),
    certificateId: dataset.certificateId,
    tx: tx.tx
  }
}
