import { PrismaClient, Prisma } from '@prisma/client'
import { DatasetRecord, DatasetClaim } from '../types/dataset.js'
import type { TrustScore } from '../types/trust.js'

const prisma = new PrismaClient()

export class PrismaService {
  async upsertDataset(record: DatasetRecord) {
    // Convert DatasetRecord to Prisma format
    const trustSnapshot = record.trust
    const data = {
      datasetId: record.id,
      name: record.title,
      description: record.description,
      owner: record.ownerAddress,
      walrusBlobId: record.walrus.blobId,
      integrityRoot: record.walrus.integrityRoot ?? null,
      proofHash: record.walrus.proof ?? null,
      sha256Hash: record.hashes?.sha256 ?? null,
      poseidonHash: record.hashes?.poseidon ?? null,
      certificateId: record.certificateId,
      fileSize: record.walrus.sizeBytes,
      fileType: 'application/octet-stream',
      downloads: record.metrics.downloads,
      totalRevenue: record.metrics.revenueWal,
      status: record.status,
      accessType: record.accessPolicy.type,
      minStakeAmount: record.accessPolicy.minStake ?? 0,
      trustScore: trustSnapshot?.score ?? null,
      trustFactors: trustSnapshot
        ? (trustSnapshot as unknown as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      lastVerifiedAt: trustSnapshot?.lastUpdated ? new Date(trustSnapshot.lastUpdated) : null
    }

    const existing = await prisma.dataset.findUnique({
      where: { datasetId: record.id }
    })

    if (existing) {
      return await prisma.dataset.update({
        where: { datasetId: record.id },
        data
      })
    } else {
      return await prisma.dataset.create({ data })
    }
  }

  async listDatasets() {
    const datasets = await prisma.dataset.findMany({
      include: {
        claims: true,
        accessRecords: {
          take: 10,
          orderBy: { timestamp: 'desc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Convert to DatasetRecord format
    return datasets.map(d => this.toDatasetRecord(d))
  }

  async getDataset(datasetId: string) {
    const dataset = await prisma.dataset.findUnique({
      where: { datasetId },
      include: {
        claims: true,
        accessRecords: {
          orderBy: { timestamp: 'desc' }
        }
      }
    })

    if (!dataset) {
      return null
    }

    return this.toDatasetRecord(dataset)
  }

  async addClaim(datasetId: string, claim: DatasetClaim) {
    const dataset = await prisma.dataset.findUnique({
      where: { datasetId }
    })

    if (!dataset) {
      throw new Error('Dataset not found')
    }

    await prisma.claim.create({
      data: {
        datasetId: dataset.id,
        claimant: 'unknown', // You'll need to pass this from claim input
        issue: claim.statement,
        evidence: claim.evidenceUri ?? '',
        severity: this.mapSeverity(claim.severity),
        timestamp: new Date(claim.createdAt)
      }
    })

    return await this.getDataset(datasetId)
  }

  async recordAccessMetrics(datasetId: string, revenue: number) {
    const dataset = await prisma.dataset.findUnique({
      where: { datasetId }
    })

    if (!dataset) {
      return
    }

    await prisma.dataset.update({
      where: { id: dataset.id },
      data: {
        downloads: { increment: 1 },
        totalRevenue: { increment: revenue }
      }
    })
  }

  private toDatasetRecord(d: any): DatasetRecord {
    return {
      id: d.datasetId,
      ownerAddress: d.owner,
      title: d.name,
      description: d.description,
      categories: ['Data'],
      tags: [],
      license: 'MIT',
      sensitivity: 'public',
      walrus: {
        blobId: d.walrusBlobId ?? '',
        integrityRoot: d.integrityRoot ?? '',
        proof: d.proofHash ?? '',
        expiresAt: '',
        sizeBytes: d.fileSize
      },
      hashes: {
        sha256: d.sha256Hash ?? '',
        poseidon: d.poseidonHash ?? ''
      },
      status: d.status as any,
      certificateId: d.certificateId ?? undefined,
      sealPolicyId: undefined,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
      metrics: {
        downloads: d.downloads,
        revenueWal: d.totalRevenue,
        disputes: 0
      },
      accessPolicy: {
        type: d.accessType as any,
        minStake: d.minStakeAmount
      },
      claims: (d.claims || []).map((c: any) => ({
        id: c.id,
        role: 'auditor' as const,
        statement: c.issue,
        severity: this.mapSeverityReverse(c.severity),
        evidenceUri: c.evidence,
        createdAt: c.timestamp.toISOString()
      })),
      timeline: (d.accessRecords || []).map((a: any) => ({
        id: a.id,
        type: 'access_request' as const,
        description: a.purpose,
        timestamp: a.timestamp.toISOString(),
        metadata: {
          requester: a.requester,
          stakeAmount: a.stakeAmount,
          tx: a.txHash
        }
      })),
      trust: this.parseTrustSnapshot(d)
    }
  }

  private mapSeverity(severity: DatasetClaim['severity']): string {
    const map = {
      info: 'low',
      warning: 'medium',
      critical: 'critical'
    }
    return map[severity] || 'medium'
  }

  private mapSeverityReverse(severity: string): DatasetClaim['severity'] {
    const map: Record<string, DatasetClaim['severity']> = {
      low: 'info',
      medium: 'warning',
      high: 'critical',
      critical: 'critical'
    }
    return map[severity] || 'info'
  }

  private parseTrustSnapshot(d: any): TrustScore | undefined {
    if (!d.trustFactors) {
      return undefined
    }
    const snapshot = d.trustFactors as unknown as TrustScore
    return {
      ...snapshot,
      datasetId: snapshot.datasetId ?? d.datasetId,
      lastUpdated: snapshot.lastUpdated ?? d.lastVerifiedAt?.toISOString() ?? new Date().toISOString()
    }
  }

  async saveTrustScore(datasetId: string, trustScore: TrustScore) {
    const dataset = await prisma.dataset.findUnique({
      where: { datasetId }
    })

    if (!dataset) {
      return
    }

    await prisma.$transaction([
      prisma.dataset.update({
        where: { id: dataset.id },
        data: {
          trustScore: trustScore.score,
          trustFactors: trustScore as unknown as Prisma.InputJsonValue,
          lastVerifiedAt: new Date(trustScore.lastUpdated)
        }
      }),
      prisma.trustScoreHistory.create({
        data: {
          datasetId: dataset.id,
          score: trustScore.score,
          provenanceScore: trustScore.provenanceScore,
          integrityScore: trustScore.integrityScore,
          auditScore: trustScore.auditScore,
          usageScore: trustScore.usageScore,
          verifiedByNautilus: trustScore.verifiedByNautilus,
          factors: trustScore as unknown as Prisma.InputJsonValue
        }
      })
    ])
  }

  async getTrustHistory(datasetId: string, limit = 20): Promise<TrustScore[]> {
    const dataset = await prisma.dataset.findUnique({
      where: { datasetId }
    })

    if (!dataset) {
      throw new Error('Dataset not found')
    }

    const history = await prisma.trustScoreHistory.findMany({
      where: { datasetId: dataset.id },
      orderBy: { createdAt: 'desc' },
      take: limit
    })

    if (!history.length) {
      return []
    }

    return history.map(entry => {
      const snapshot = entry.factors as unknown as TrustScore | undefined
      if (snapshot) {
        return {
          ...snapshot,
          datasetId,
          score: entry.score,
          provenanceScore: entry.provenanceScore,
          integrityScore: entry.integrityScore,
          auditScore: entry.auditScore,
          usageScore: entry.usageScore,
          verifiedByNautilus: entry.verifiedByNautilus,
          lastUpdated: snapshot.lastUpdated ?? entry.createdAt.toISOString()
        }
      }
      return {
        datasetId,
        score: entry.score,
        provenanceScore: entry.provenanceScore,
        integrityScore: entry.integrityScore,
        auditScore: entry.auditScore,
        usageScore: entry.usageScore,
        lastUpdated: entry.createdAt.toISOString(),
        verifiedByNautilus: entry.verifiedByNautilus,
        factors: {
          provenance: { timelineEvents: 0, score: entry.provenanceScore, details: 'Legacy data' },
          integrity: { sha256Verified: false, poseidonVerified: false, integrityRootValid: false, score: entry.integrityScore, details: 'Legacy data' },
          audit: { criticalClaims: 0, warningClaims: 0, infoClaims: 0, score: entry.auditScore, details: 'Legacy data' },
          usage: { downloads: 0, score: entry.usageScore, details: 'Legacy data' }
        }
      }
    })
  }
}

export const prismaService = new PrismaService()
