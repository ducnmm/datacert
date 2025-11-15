export interface IntegrityVerificationResult {
  sha256Match: boolean
  poseidonMatch: boolean
  integrityRootValid: boolean
  walrusLatencyMs?: number
}

export interface TrustScore {
  datasetId: string
  score: number // 0-100
  provenanceScore: number // 0-25
  integrityScore: number // 0-25
  auditScore: number // 0-25
  usageScore: number // 0-25
  lastUpdated: string
  verifiedByNautilus: boolean
  integrityCheck?: IntegrityVerificationResult
  nautilusProof?: NautilusVerificationProof
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

export interface NautilusVerificationProof {
  blobId: string
  expectedSha256: string
  computedSha256: string
  verified: boolean
  blobSize: number
  walrusGateway: string
  timestampMs: number
  signature: string
}
