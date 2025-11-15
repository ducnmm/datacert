import { useState } from 'react'
import type { TrustScore } from '../types'

interface TrustScoreBadgeProps {
  score: number
  verifiedByNautilus?: boolean
  compact?: boolean
  showBreakdown?: boolean
  fullDetails?: TrustScore
}

function getScoreColor(score: number): string {
  if (score >= 80) return '#10b981' // Green
  if (score >= 60) return '#fbbf24' // Yellow
  if (score >= 40) return '#f59e0b' // Orange
  return '#ef4444' // Red
}

function getScoreLabel(score: number): string {
  if (score >= 80) return 'Excellent'
  if (score >= 60) return 'Good'
  if (score >= 40) return 'Fair'
  return 'Poor'
}

export function TrustScoreBadge({
  score,
  verifiedByNautilus = false,
  compact = false,
  showBreakdown = false,
  fullDetails
}: TrustScoreBadgeProps) {
  const [showDetails, setShowDetails] = useState(false)
  const color = getScoreColor(score)
  const label = getScoreLabel(score)

  if (compact) {
    return (
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.25rem 0.75rem',
        backgroundColor: `${color}20`,
        border: `2px solid ${color}`,
        borderRadius: '1rem',
        fontSize: '0.875rem',
        fontWeight: 600,
        color: color
      }}>
        <span style={{ fontSize: '1rem' }}>🛡️</span>
        <span>{score}/100</span>
        {verifiedByNautilus && (
          <span style={{ fontSize: '0.75rem' }} title="Verified by Nautilus">✓</span>
        )}
      </div>
    )
  }

  return (
    <div style={{
      border: `2px solid ${color}`,
      borderRadius: '0.75rem',
      padding: '1rem',
      backgroundColor: 'rgba(255, 255, 255, 0.02)'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.5rem' }}>🛡️</span>
          <div>
            <div style={{ fontSize: '0.875rem', color: '#9ca3af', marginBottom: '0.25rem' }}>
              Trust Score
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
              <span style={{ fontSize: '2rem', fontWeight: 700, color }}>
                {score}
              </span>
              <span style={{ fontSize: '1rem', color: '#6b7280' }}>/100</span>
              <span style={{
                fontSize: '0.875rem',
                fontWeight: 600,
                color,
                marginLeft: '0.5rem'
              }}>
                {label}
              </span>
            </div>
          </div>
        </div>
        {verifiedByNautilus && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1rem',
            backgroundColor: '#10b98120',
            border: '1px solid #10b981',
            borderRadius: '0.5rem',
            fontSize: '0.875rem',
            fontWeight: 600,
            color: '#10b981'
          }}>
            <span>✓</span>
            <span>Nautilus Verified</span>
          </div>
        )}
      </div>

      {/* Breakdown */}
      {showBreakdown && fullDetails && (
        <>
          <div style={{
            height: '1px',
            backgroundColor: '#374151',
            margin: '1rem 0'
          }} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            {/* Provenance */}
            <div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '0.25rem'
              }}>
                <span style={{ fontSize: '0.875rem', color: '#9ca3af' }}>
                  Provenance
                </span>
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#e5e7eb' }}>
                  {fullDetails.provenanceScore}/25
                </span>
              </div>
              <div style={{
                height: '4px',
                backgroundColor: '#374151',
                borderRadius: '2px',
                overflow: 'hidden'
              }}>
                <div style={{
                  height: '100%',
                  width: `${(fullDetails.provenanceScore / 25) * 100}%`,
                  backgroundColor: getScoreColor((fullDetails.provenanceScore / 25) * 100),
                  transition: 'width 0.3s ease'
                }} />
              </div>
            </div>

            {/* Integrity */}
            <div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '0.25rem'
              }}>
                <span style={{ fontSize: '0.875rem', color: '#9ca3af' }}>
                  Integrity
                </span>
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#e5e7eb' }}>
                  {fullDetails.integrityScore}/25
                </span>
              </div>
              <div style={{
                height: '4px',
                backgroundColor: '#374151',
                borderRadius: '2px',
                overflow: 'hidden'
              }}>
                <div style={{
                  height: '100%',
                  width: `${(fullDetails.integrityScore / 25) * 100}%`,
                  backgroundColor: getScoreColor((fullDetails.integrityScore / 25) * 100),
                  transition: 'width 0.3s ease'
                }} />
              </div>
            </div>

            {/* Audit */}
            <div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '0.25rem'
              }}>
                <span style={{ fontSize: '0.875rem', color: '#9ca3af' }}>
                  Audit Quality
                </span>
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#e5e7eb' }}>
                  {fullDetails.auditScore}/25
                </span>
              </div>
              <div style={{
                height: '4px',
                backgroundColor: '#374151',
                borderRadius: '2px',
                overflow: 'hidden'
              }}>
                <div style={{
                  height: '100%',
                  width: `${(fullDetails.auditScore / 25) * 100}%`,
                  backgroundColor: getScoreColor((fullDetails.auditScore / 25) * 100),
                  transition: 'width 0.3s ease'
                }} />
              </div>
            </div>

            {/* Usage */}
            <div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '0.25rem'
              }}>
                <span style={{ fontSize: '0.875rem', color: '#9ca3af' }}>
                  Usage & Trust
                </span>
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#e5e7eb' }}>
                  {fullDetails.usageScore}/25
                </span>
              </div>
              <div style={{
                height: '4px',
                backgroundColor: '#374151',
                borderRadius: '2px',
                overflow: 'hidden'
              }}>
                <div style={{
                  height: '100%',
                  width: `${(fullDetails.usageScore / 25) * 100}%`,
                  backgroundColor: getScoreColor((fullDetails.usageScore / 25) * 100),
                  transition: 'width 0.3s ease'
                }} />
              </div>
            </div>
          </div>

          {/* Toggle Details Button */}
          <button
            onClick={() => setShowDetails(!showDetails)}
            style={{
              marginTop: '1rem',
              width: '100%',
              padding: '0.5rem',
              backgroundColor: 'transparent',
              border: '1px solid #374151',
              borderRadius: '0.5rem',
              color: '#9ca3af',
              fontSize: '0.875rem',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#6b7280'
              e.currentTarget.style.color = '#e5e7eb'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#374151'
              e.currentTarget.style.color = '#9ca3af'
            }}
          >
            {showDetails ? '▼ Hide Details' : '▶ Show Details'}
          </button>

          {/* Detailed Breakdown */}
          {showDetails && (
            <div style={{
              marginTop: '1rem',
              padding: '1rem',
              backgroundColor: 'rgba(0, 0, 0, 0.2)',
              borderRadius: '0.5rem',
              fontSize: '0.875rem'
            }}>
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontWeight: 600, color: '#e5e7eb', marginBottom: '0.5rem' }}>
                  📊 Provenance ({fullDetails.provenanceScore}/25)
                </div>
                <div style={{ color: '#9ca3af' }}>
                  {fullDetails.factors.provenance.details}
                </div>
                <div style={{ color: '#6b7280', fontSize: '0.8125rem', marginTop: '0.25rem' }}>
                  Timeline events: {fullDetails.factors.provenance.timelineEvents}
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontWeight: 600, color: '#e5e7eb', marginBottom: '0.5rem' }}>
                  🔐 Integrity ({fullDetails.integrityScore}/25)
                </div>
                <div style={{ color: '#9ca3af' }}>
                  {fullDetails.factors.integrity.details}
                </div>
                <div style={{ color: '#6b7280', fontSize: '0.8125rem', marginTop: '0.25rem' }}>
                  SHA256: {fullDetails.factors.integrity.sha256Verified ? '✓' : '✗'} |
                  Poseidon: {fullDetails.factors.integrity.poseidonVerified ? '✓' : '✗'} |
                  Root: {fullDetails.factors.integrity.integrityRootValid ? '✓' : '✗'}
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontWeight: 600, color: '#e5e7eb', marginBottom: '0.5rem' }}>
                  🔍 Audit Quality ({fullDetails.auditScore}/25)
                </div>
                <div style={{ color: '#9ca3af' }}>
                  {fullDetails.factors.audit.details}
                </div>
                {(fullDetails.factors.audit.criticalClaims > 0 ||
                  fullDetails.factors.audit.warningClaims > 0 ||
                  fullDetails.factors.audit.infoClaims > 0) && (
                  <div style={{ color: '#6b7280', fontSize: '0.8125rem', marginTop: '0.25rem' }}>
                    Critical: {fullDetails.factors.audit.criticalClaims} |
                    Warnings: {fullDetails.factors.audit.warningClaims} |
                    Info: {fullDetails.factors.audit.infoClaims}
                  </div>
                )}
              </div>

              <div>
                <div style={{ fontWeight: 600, color: '#e5e7eb', marginBottom: '0.5rem' }}>
                  📈 Usage & Trust ({fullDetails.usageScore}/25)
                </div>
                <div style={{ color: '#9ca3af' }}>
                  {fullDetails.factors.usage.details}
                </div>
                <div style={{ color: '#6b7280', fontSize: '0.8125rem', marginTop: '0.25rem' }}>
                  Downloads: {fullDetails.factors.usage.downloads}
                </div>
              </div>

              <div style={{
                marginTop: '1rem',
                paddingTop: '1rem',
                borderTop: '1px solid #374151',
                color: '#6b7280',
                fontSize: '0.8125rem'
              }}>
                Last updated: {new Date(fullDetails.lastUpdated).toLocaleString()}
              </div>
            </div>
          )}
        </>
      )}

      {fullDetails?.nautilusProof && (
        <>
          <div style={{
            height: '1px',
            backgroundColor: '#374151',
            margin: '1rem 0'
          }} />
          <div style={{
            backgroundColor: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            borderRadius: '0.5rem',
            padding: '0.75rem'
          }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#10b981', marginBottom: '0.5rem' }}>
              Nautilus Proof of Integrity
            </div>
            <div style={{ fontSize: '0.8rem', color: '#d1d5db', lineHeight: 1.5 }}>
              <div>Blob: <span style={{ color: '#e5e7eb' }}>{fullDetails.nautilusProof.blobId}</span></div>
              <div>Walrus Gateway: <span style={{ color: '#e5e7eb' }}>{fullDetails.nautilusProof.walrusGateway}</span></div>
              <div>SHA256: <code style={{ wordBreak: 'break-all' }}>{fullDetails.nautilusProof.computedSha256}</code></div>
              <div>Signature: <code style={{ wordBreak: 'break-all' }}>{fullDetails.nautilusProof.signature}</code></div>
              <div>Verified at: {new Date(fullDetails.nautilusProof.timestampMs).toLocaleString()}</div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
