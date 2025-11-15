import type { DatasetRecord } from '../types'
import { TrustScoreBadge } from './TrustScoreBadge'

interface DatasetGridProps {
  datasets: DatasetRecord[]
  activeId?: string
  onSelect: (dataset: DatasetRecord) => void
}

// Quick trust score calculation for grid view
function calculateQuickTrustScore(dataset: DatasetRecord): number {
  let score = 0

  // Provenance (0-25): based on timeline events
  const timelineEvents = dataset.timeline.length
  if (timelineEvents >= 5) score += 25
  else if (timelineEvents >= 3) score += 20
  else if (timelineEvents >= 2) score += 15
  else if (timelineEvents >= 1) score += 10

  // Integrity (0-25): we have hashes, so give some points
  if (dataset.hashes.sha256) score += 15
  if (dataset.hashes.poseidon) score += 5
  if (dataset.walrus.integrityRoot) score += 5

  // Audit (0-25): based on claims
  const criticalClaims = dataset.claims.filter(c => c.severity === 'critical').length
  const warningClaims = dataset.claims.filter(c => c.severity === 'warning').length
  const infoClaims = dataset.claims.filter(c => c.severity === 'info').length
  let auditScore = 25 - (criticalClaims * 10) - (warningClaims * 5) - (infoClaims * 2)
  score += Math.max(0, auditScore)

  // Usage (0-25): based on downloads
  const downloads = dataset.metrics.downloads
  if (downloads >= 100) score += 25
  else if (downloads >= 50) score += 20
  else if (downloads >= 20) score += 15
  else if (downloads >= 5) score += 10
  else if (downloads >= 1) score += 5

  return score
}

const statusColor: Record<DatasetRecord['status'], string> = {
  draft: 'badge gray',
  pending: 'badge amber',
  certified: 'badge green',
  disputed: 'badge red'
}

function resolveTrustScore(dataset: DatasetRecord) {
  if (dataset.trust) {
    return {
      score: dataset.trust.score,
      verifiedByNautilus: dataset.trust.verifiedByNautilus
    }
  }
  return {
    score: calculateQuickTrustScore(dataset),
    verifiedByNautilus: false
  }
}

export function DatasetGrid({ datasets, activeId, onSelect }: DatasetGridProps) {
  if (!datasets.length) {
    return (
      <div className="empty-state">
        <p>No datasets yet. Upload the first one!</p>
      </div>
    )
  }

  return (
    <div className="dataset-grid">
      {datasets.map(dataset => {
        const { score: trustScore, verifiedByNautilus } = resolveTrustScore(dataset)
        return (
          <article
            key={dataset.id}
            className={`dataset-card ${dataset.id === activeId ? 'active' : ''}`}
            onClick={() => onSelect(dataset)}
          >
            <div className="dataset-card__head">
              <h3>{dataset.title}</h3>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <TrustScoreBadge score={trustScore} compact={true} verifiedByNautilus={verifiedByNautilus} />
                <span className={statusColor[dataset.status]}>{dataset.status}</span>
              </div>
            </div>
            <p className="muted">{dataset.description}</p>
            <ul className="meta">
              <li>{dataset.license}</li>
              <li>{dataset.categories.join(', ')}</li>
              <li>{dataset.accessPolicy.type.replace('_', ' ')}</li>
            </ul>
          <div className="metrics">
            <div>
              <strong>{dataset.metrics.downloads}</strong>
              <span>Access</span>
            </div>
            <div>
              <strong>{dataset.metrics.revenueWal} WAL</strong>
              <span>Revenue</span>
            </div>
            <div>
              <strong>{dataset.metrics.disputes}</strong>
              <span>Disputes</span>
            </div>
          </div>
        </article>
        )
      })}
    </div>
  )
}
