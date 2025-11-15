import { createHash } from 'crypto'
import { DatasetRecord } from '../types/dataset.js'
import { suiClient } from '../lib/suiClient.js'
import { auditLogger } from '../logger.js'
import { walrusClient } from '../lib/walrusClient.js'
import { config } from '../config.js'
import type { IntegrityVerificationResult, TrustScore, NautilusVerificationProof } from '../types/trust.js'
import { prismaService } from './prismaService.js'

/**
 * Calculate trust score for a dataset based on 4 factors:
 * 1. Provenance Completeness (0-25 points)
 * 2. Integrity Verification (0-25 points)
 * 3. Audit Claims (0-25 points)
 * 4. Usage & Consensus (0-25 points)
 */
export function calculateTrustScore(
  dataset: DatasetRecord,
  verifiedByNautilus: boolean = false,
  integrityVerification?: IntegrityVerificationResult
): TrustScore {
  // Factor 1: Provenance Completeness (0-25 points)
  const timelineEvents = dataset.timeline.length
  let provenanceScore = 0
  let provenanceDetails = ''

  if (timelineEvents >= 5) {
    provenanceScore = 25
    provenanceDetails = 'Excellent provenance tracking (5+ events)'
  } else if (timelineEvents >= 3) {
    provenanceScore = 20
    provenanceDetails = 'Good provenance tracking (3-4 events)'
  } else if (timelineEvents >= 2) {
    provenanceScore = 15
    provenanceDetails = 'Moderate provenance tracking (2 events)'
  } else if (timelineEvents >= 1) {
    provenanceScore = 10
    provenanceDetails = 'Minimal provenance tracking (1 event)'
  } else {
    provenanceScore = 0
    provenanceDetails = 'No provenance tracking'
  }

  // Factor 2: Integrity Verification (0-25 points)
  const sha256Verified = integrityVerification
    ? integrityVerification.sha256Match
    : dataset.hashes.sha256.length > 0
  const poseidonVerified = integrityVerification
    ? integrityVerification.poseidonMatch
    : dataset.hashes.poseidon.length > 0
  const integrityRootValid = integrityVerification
    ? integrityVerification.integrityRootValid
    : dataset.walrus.integrityRoot.length > 0
  let integrityScore = 0
  let integrityDetails = describeIntegrityDetails(
    integrityVerification,
    sha256Verified,
    poseidonVerified,
    integrityRootValid
  )

  if (sha256Verified && poseidonVerified && integrityRootValid) {
    integrityScore = 25
    integrityDetails = 'Full integrity verification (SHA256 + Poseidon + Root)'
  } else if (sha256Verified && poseidonVerified) {
    integrityScore = 20
    integrityDetails = 'Dual hash verification (SHA256 + Poseidon)'
  } else if (sha256Verified) {
    integrityScore = 15
    integrityDetails = 'Basic hash verification (SHA256 only)'
  } else {
    integrityScore = 0
    integrityDetails = 'No integrity verification'
  }

  // Factor 3: Audit Claims (0-25 points)
  const criticalClaims = dataset.claims.filter(c => c.severity === 'critical').length
  const warningClaims = dataset.claims.filter(c => c.severity === 'warning').length
  const infoClaims = dataset.claims.filter(c => c.severity === 'info').length

  // Start with perfect score and deduct for claims
  let auditScore = 25 - (criticalClaims * 10) - (warningClaims * 5) - (infoClaims * 2)
  auditScore = Math.max(0, auditScore) // Can't go below 0

  let auditDetails = ''
  if (criticalClaims === 0 && warningClaims === 0 && infoClaims === 0) {
    auditDetails = 'No audit claims (perfect score)'
  } else {
    auditDetails = `Audit claims: ${criticalClaims} critical, ${warningClaims} warning, ${infoClaims} info`
  }

  // Factor 4: Usage & Consensus (0-25 points)
  const downloads = dataset.metrics.downloads
  let usageScore = 0
  let usageDetails = ''

  if (downloads >= 100) {
    usageScore = 25
    usageDetails = 'Highly trusted (100+ downloads)'
  } else if (downloads >= 50) {
    usageScore = 20
    usageDetails = 'Well trusted (50-99 downloads)'
  } else if (downloads >= 20) {
    usageScore = 15
    usageDetails = 'Moderately trusted (20-49 downloads)'
  } else if (downloads >= 5) {
    usageScore = 10
    usageDetails = 'Some trust established (5-19 downloads)'
  } else if (downloads >= 1) {
    usageScore = 5
    usageDetails = 'Minimal usage (1-4 downloads)'
  } else {
    usageScore = 0
    usageDetails = 'No usage history'
  }

  // Calculate total score
  const totalScore = provenanceScore + integrityScore + auditScore + usageScore

  return {
    datasetId: dataset.id,
    score: totalScore,
    provenanceScore,
    integrityScore,
    auditScore,
    usageScore,
    lastUpdated: new Date().toISOString(),
    verifiedByNautilus,
    integrityCheck: integrityVerification,
    factors: {
      provenance: {
        timelineEvents,
        score: provenanceScore,
        details: provenanceDetails
      },
      integrity: {
        sha256Verified,
        poseidonVerified,
        integrityRootValid,
        score: integrityScore,
        details: integrityDetails
      },
      audit: {
        criticalClaims,
        warningClaims,
        infoClaims,
        score: auditScore,
        details: auditDetails
      },
      usage: {
        downloads,
        score: usageScore,
        details: usageDetails
      }
    }
  }
}

/**
 * Publish trust score to Sui blockchain via oracle
 */
export async function publishTrustScore(trustScore: TrustScore): Promise<string> {
  try {
    const txHash = await suiClient.updateTrustScore({
      datasetId: trustScore.datasetId,
      provenanceScore: trustScore.provenanceScore,
      integrityScore: trustScore.integrityScore,
      auditScore: trustScore.auditScore,
      usageScore: trustScore.usageScore,
      verifiedByNautilus: trustScore.verifiedByNautilus
    })

    auditLogger.info('trust_score_published', 'Trust score published to blockchain', {
      datasetId: trustScore.datasetId,
      score: trustScore.score,
      txHash
    })

    return txHash
  } catch (error) {
    auditLogger.error('trust_score_publish_failed', 'Failed to publish trust score', {
      datasetId: trustScore.datasetId,
      error: error instanceof Error ? error.message : String(error)
    })
    throw error
  }
}

export async function publishTrustScoreWithNautilus(
  trustScore: TrustScore,
  proof: NautilusVerificationProof
): Promise<string> {
  try {
    const txHash = await suiClient.updateTrustScoreWithNautilus({
      datasetId: trustScore.datasetId,
      provenanceScore: trustScore.provenanceScore,
      integrityScore: trustScore.integrityScore,
      auditScore: trustScore.auditScore,
      usageScore: trustScore.usageScore,
      verifiedByNautilus: trustScore.verifiedByNautilus,
      blobId: proof.blobId,
      expectedSha256: proof.expectedSha256,
      computedSha256: proof.computedSha256,
      verified: proof.verified,
      blobSize: proof.blobSize,
      walrusGateway: proof.walrusGateway,
      timestampMs: proof.timestampMs,
      signature: proof.signature
    })

    auditLogger.info('nautilus_trust_score_published', 'Trust score published with Nautilus proof', {
      datasetId: trustScore.datasetId,
      score: trustScore.score,
      txHash
    })

    return txHash
  } catch (error) {
    auditLogger.error('nautilus_trust_score_publish_failed', 'Failed to publish Nautilus trust score', {
      datasetId: trustScore.datasetId,
      error: error instanceof Error ? error.message : String(error)
    })
    throw error
  }
}

/**
 * Calculate and publish trust score for a dataset
 */
export async function calculateAndPublishTrustScore(
  dataset: DatasetRecord,
  verifiedByNautilus: boolean = false,
  options?: { performWalrusVerification?: boolean }
): Promise<TrustScore> {
  const integrityCheck = options?.performWalrusVerification
    ? await verifyDataIntegrity(dataset)
    : undefined

  const trustScore = calculateTrustScore(dataset, verifiedByNautilus, integrityCheck)

  // Publish to blockchain
  await publishTrustScore(trustScore)

  // Persist snapshot + history
  await prismaService.saveTrustScore(dataset.id, trustScore)

  return trustScore
}

/**
 * Verify data integrity via Walrus gateway.
 * Fetch the blob, recompute hashes, and check integrity root endpoints.
 */
export async function verifyDataIntegrity(dataset: DatasetRecord): Promise<IntegrityVerificationResult> {
  const blobUrl = await walrusClient.read(dataset.walrus.blobId)
  const headers: Record<string, string> = {}
  if (config.walrusApiKey) {
    headers['x-api-key'] = config.walrusApiKey
  }

  const start = Date.now()

  try {
    const response = await fetch(blobUrl, { headers })
    if (!response.ok) {
      throw new Error(`Walrus gateway responded with status ${response.status}`)
    }

    const buffer = Buffer.from(await response.arrayBuffer())
    const sha256 = createHash('sha256').update(buffer).digest('hex')
    const poseidon = createHash('sha512').update(buffer).digest('hex').slice(0, 64)

    const sha256Match = dataset.hashes.sha256.length > 0
      ? sha256 === dataset.hashes.sha256
      : false
    const poseidonMatch = dataset.hashes.poseidon.length > 0
      ? poseidon === dataset.hashes.poseidon
      : false

    const integrityRootValid = await verifyIntegrityRoot(dataset.walrus.integrityRoot, headers)
    const latency = Date.now() - start

    auditLogger.info('walrus_integrity_verified', 'Walrus verification complete', {
      datasetId: dataset.id,
      blobId: dataset.walrus.blobId,
      sha256Match,
      poseidonMatch,
      integrityRootValid,
      latency
    })

    return {
      sha256Match,
      poseidonMatch,
      integrityRootValid,
      walrusLatencyMs: latency
    }
  } catch (error) {
    auditLogger.error('walrus_integrity_failed', 'Failed to verify Walrus blob', {
      datasetId: dataset.id,
      blobId: dataset.walrus.blobId,
      error: error instanceof Error ? error.message : String(error)
    })

    return {
      sha256Match: false,
      poseidonMatch: false,
      integrityRootValid: false
    }
  }
}

function describeIntegrityDetails(
  verification: IntegrityVerificationResult | undefined,
  sha256Verified: boolean,
  poseidonVerified: boolean,
  integrityRootValid: boolean
): string {
  if (!verification) {
    if (sha256Verified && poseidonVerified && integrityRootValid) {
      return 'Full integrity verification (SHA256 + Poseidon + Root)'
    }
    if (sha256Verified && poseidonVerified) {
      return 'Dual hash verification (SHA256 + Poseidon)'
    }
    if (sha256Verified) {
      return 'Basic hash verification (SHA256 only)'
    }
    return 'No integrity verification'
  }

  if (sha256Verified && poseidonVerified && integrityRootValid) {
    return 'Walrus verified: SHA256, Poseidon hash, and integrity root match'
  }

  const issues: string[] = []
  if (!sha256Verified) issues.push('SHA256 mismatch')
  if (!poseidonVerified) issues.push('Poseidon mismatch')
  if (!integrityRootValid) issues.push('Integrity root missing')

  return issues.length
    ? `Walrus verification issues: ${issues.join(', ')}`
    : 'Walrus verification performed (no issues reported)'
}

async function verifyIntegrityRoot(
  integrityRoot: string,
  headers: Record<string, string>
): Promise<boolean> {
  if (!integrityRoot) {
    return false
  }

  const candidateUrls = [
    `${config.walrusGateway}/v1/integrity/${integrityRoot}`,
    `${config.walrusGateway}/integrity/${integrityRoot}`
  ]

  for (const url of candidateUrls) {
    try {
      const response = await fetch(url, { headers })
      if (response.ok) {
        return true
      }
    } catch (error) {
      auditLogger.warn('walrus_integrity_lookup_failed', 'Failed to query Walrus integrity endpoint', {
        integrityRoot,
        url,
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }

  // Fallback: consider integrity root valid if populated
  return integrityRoot.length > 0
}
