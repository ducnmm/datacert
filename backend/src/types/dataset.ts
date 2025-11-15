import type { TrustScore } from './trust.js'

export type DatasetStatus = 'draft' | 'pending' | 'certified' | 'disputed'

export interface WalrusUploadResult {
  blobId: string
  integrityRoot: string
  proof: string
  expiresAt: string
  sizeBytes: number
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

export interface AccessPolicy {
  type: 'public' | 'token_gated' | 'stake_gated'
  sealPolicyId?: string
  minStake?: number
  allowedTokens?: string[]
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
  metadata?: Record<string, any>
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
  walrus: WalrusUploadResult
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
  accessPolicy: AccessPolicy
  claims: DatasetClaim[]
  timeline: TimelineEvent[]
  trust?: TrustScore
}
