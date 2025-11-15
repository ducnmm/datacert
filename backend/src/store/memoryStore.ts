import { DatasetRecord, DatasetClaim, TimelineEvent } from '../types/dataset.js'

export class MemoryStore {
  private datasets = new Map<string, DatasetRecord>()

  upsertDataset(record: DatasetRecord): DatasetRecord {
    this.datasets.set(record.id, record)
    return record
  }

  listDatasets(): DatasetRecord[] {
    return Array.from(this.datasets.values())
  }

  getDataset(id: string): DatasetRecord | undefined {
    return this.datasets.get(id)
  }

  addClaim(datasetId: string, claim: DatasetClaim): DatasetRecord {
    const current = this.datasets.get(datasetId)
    if (!current) {
      throw new Error(`Dataset ${datasetId} not found`)
    }
    current.claims.push(claim)
    current.metrics.disputes = current.claims.filter((c: DatasetClaim) => !c.resolved).length
    current.timeline.push(this.makeTimelineEvent('claim_added', datasetId, {
      claimId: claim.id,
      severity: claim.severity
    }))
    current.updatedAt = new Date().toISOString()
    this.datasets.set(datasetId, current)
    return current
  }

  updateTrust(datasetId: string, trustScore: DatasetRecord['trust']): DatasetRecord | undefined {
    const current = this.datasets.get(datasetId)
    if (!current) {
      return undefined
    }
    current.trust = trustScore ?? undefined
    current.updatedAt = new Date().toISOString()
    this.datasets.set(datasetId, current)
    return current
  }

  appendTimeline(datasetId: string, event: TimelineEvent): void {
    const current = this.datasets.get(datasetId)
    if (!current) return
    current.timeline.push(event)
    current.updatedAt = new Date().toISOString()
    this.datasets.set(datasetId, current)
  }

  updateStatus(datasetId: string, status: DatasetRecord['status']): DatasetRecord {
    const current = this.datasets.get(datasetId)
    if (!current) {
      throw new Error(`Dataset ${datasetId} not found`)
    }
    current.status = status
    current.timeline.push(this.makeTimelineEvent('status_change', datasetId, { status }))
    current.updatedAt = new Date().toISOString()
    this.datasets.set(datasetId, current)
    return current
  }

  private makeTimelineEvent(
    type: TimelineEvent['type'],
    datasetId: string,
    metadata?: Record<string, any>
  ): TimelineEvent {
    return {
      id: `${datasetId}-${type}-${Date.now()}`,
      type,
      description: `Event ${type}`,
      timestamp: new Date().toISOString(),
      metadata
    }
  }
}

export const memoryStore = new MemoryStore()
