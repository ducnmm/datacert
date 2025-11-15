export type DatasetStatus = 'draft' | 'pending' | 'certified' | 'disputed'

export interface IntegrityCheck {
  sha256Match: boolean
  poseidonMatch: boolean
  integrityRootValid: boolean
  walrusLatencyMs?: number
}

export interface NautilusProof {
  blobId: string
  expectedSha256: string
  computedSha256: string
  verified: boolean
  blobSize: number
  walrusGateway: string
  timestampMs: number
  signature: string
}

export interface TrustScore {
  datasetId: string
  score: number
  provenanceScore: number
  integrityScore: number
  auditScore: number
  usageScore: number
  lastUpdated: string
  verifiedByNautilus: boolean
  integrityCheck?: IntegrityCheck
  nautilusProof?: NautilusProof
  factors: {
    provenance: {
      timelineEvents: number
      score: number
      details: string
    }
    integrity: {
      sha256Verified: boolean
      poseidonVerified: boolean
      integrityRootValid: boolean
      score: number
      details: string
    }
    audit: {
      criticalClaims: number
      warningClaims: number
      infoClaims: number
      score: number
      details: string
    }
    usage: {
      downloads: number
      score: number
      details: string
    }
  }
}

export interface DatasetClaim {
  id: string
  role: 'auditor' | 'buyer' | 'creator'
  statement: string
  evidenceUri?: string
  severity: 'info' | 'warning' | 'critical'
  createdAt: string
  resolved?: boolean
}

export interface TimelineEvent {
  id: string
  type:
  | 'upload'
  | 'certificate_minted'
  | 'seal_policy_created'
  | 'claim_added'
  | 'status_change'
  | 'access_request'
  description: string
  timestamp: string
  metadata?: Record<string, unknown>
}

export interface DatasetRecord {
  id: string
  ownerAddress: string
  title: string
  description: string
  categories: string[]
  tags: string[]
  license: string
  sensitivity: 'public' | 'restricted' | 'confidential'
  walrus: {
    blobId: string
    integrityRoot: string
    proof: string
    expiresAt: string
    sizeBytes: number
  }
  hashes: {
    sha256: string
    poseidon: string
  }
  status: DatasetStatus
  certificateId?: string
  sealPolicyId?: string
  createdAt: string
  updatedAt: string
  metrics: {
    downloads: number
    revenueWal: number
    disputes: number
  }
  accessPolicy: {
    type: 'public' | 'token_gated' | 'stake_gated'
    minStake?: number
    allowedTokens?: string[]
  }
  claims: DatasetClaim[]
  timeline: TimelineEvent[]
  trust?: TrustScore
}

export interface UploadSession {
  sessionId: string
  walrus: {
    blobId: string
    integrityRoot: string
    proof: string
    expiresAt: string
    sizeBytes: number
    sha256: string
    poseidon: string
  }
}
