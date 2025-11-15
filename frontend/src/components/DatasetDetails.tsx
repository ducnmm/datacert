import { useState, useEffect, useCallback, useMemo } from 'react'
import type { DatasetRecord, TrustScore } from '../types'
import { TrustScoreBadge } from './TrustScoreBadge'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000'

interface DatasetDetailsProps {
  dataset: DatasetRecord
  onSubmitClaim: (payload: {
    statement: string
    severity: 'info' | 'warning' | 'critical'
    evidenceUri?: string
  }) => Promise<void>
  onRequestAccess: (payload: {
    purpose: string
    stakeAmount?: number
    tokenHoldings?: string[]
  }) => Promise<string>
  currentAccount?: { address: string } | null
}

export function DatasetDetails({ dataset, onSubmitClaim, onRequestAccess, currentAccount }: DatasetDetailsProps) {
  const [claimStatement, setClaimStatement] = useState('')
  const [claimSeverity, setClaimSeverity] = useState<'info' | 'warning' | 'critical'>('warning')
  const [evidenceUri, setEvidenceUri] = useState('')
  const [claimStatus, setClaimStatus] = useState('')

  const [purpose, setPurpose] = useState('Model training for haulout detector')
  const [stakeAmount, setStakeAmount] = useState(dataset.accessPolicy.minStake ?? 50)
  const [tokenHoldings, setTokenHoldings] = useState('WAL-GOLD')
  const [accessStatus, setAccessStatus] = useState('')

  const [trustScore, setTrustScore] = useState<TrustScore | null>(dataset.trust ?? null)
  const [loadingTrustScore, setLoadingTrustScore] = useState(!dataset.trust)
  const [trustHistory, setTrustHistory] = useState<TrustScore[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [reverifyStatus, setReverifyStatus] = useState('')
  const [reverifyLoading, setReverifyLoading] = useState(false)
  const [nautilusStatus, setNautilusStatus] = useState('')
  const [nautilusLoading, setNautilusLoading] = useState(false)

  // Fetch trust score for this dataset
  useEffect(() => {
    let cancelled = false
    setTrustScore(dataset.trust ?? null)
    setLoadingTrustScore(true)

    const fetchTrustScore = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/datasets/${dataset.id}/trust-score`)
        if (!response.ok) {
          throw new Error('Failed to fetch trust score')
        }
        const data: TrustScore = await response.json()
        if (!cancelled) {
          setTrustScore(data)
        }
      } catch (error) {
        console.error('Failed to fetch trust score:', error)
      } finally {
        if (!cancelled) {
          setLoadingTrustScore(false)
        }
      }
    }

    fetchTrustScore()
    return () => {
      cancelled = true
    }
  }, [dataset.id, dataset.trust])

  const fetchTrustHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/datasets/${dataset.id}/trust-score/history`)
      if (!response.ok) {
        throw new Error('Failed to load trust history')
      }
      const payload = await response.json() as { data?: TrustScore[] }
      setTrustHistory(payload.data ?? [])
    } catch (error) {
      console.error('Failed to load trust history:', error)
      setTrustHistory([])
    } finally {
      setHistoryLoading(false)
    }
  }, [dataset.id])

  useEffect(() => {
    fetchTrustHistory()
  }, [fetchTrustHistory])

  const trustHistorySorted = useMemo(() => {
    return [...trustHistory].sort(
      (a, b) => new Date(a.lastUpdated).getTime() - new Date(b.lastUpdated).getTime()
    )
  }, [trustHistory])

  const historyChartPoints = useMemo(() => {
    if (trustHistorySorted.length === 0) {
      return ''
    }
    const height = 80
    const width = 280
    const denominator = Math.max(trustHistorySorted.length - 1, 1)
    return trustHistorySorted
      .map((entry, index) => {
        const x = (index / denominator) * width
        const y = height - ((entry.score / 100) * height)
        return `${x},${y}`
      })
      .join(' ')
  }, [trustHistorySorted])

  const handleClaim = async (event: React.FormEvent) => {
    event.preventDefault()
    try {
      await onSubmitClaim({
        statement: claimStatement,
        severity: claimSeverity,
        evidenceUri: evidenceUri || undefined
      })
      setClaimStatement('')
      setEvidenceUri('')
      setClaimStatus('Claim submitted to on-chain registry ✅')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to submit claim'
      setClaimStatus(message)
    }
  }

  const handleAccess = async (event: React.FormEvent) => {
    event.preventDefault()

    // Validate stake amount for stake_gated policy
    if (dataset.accessPolicy.type === 'stake_gated') {
      const minStake = dataset.accessPolicy.minStake ?? 0
      if (stakeAmount < minStake) {
        setAccessStatus(`❌ Insufficient stake: minimum ${minStake} WAL required (enforced on-chain)`)
        return
      }
    }

    try {
      const downloadUrl = await onRequestAccess({
        purpose,
        stakeAmount,
        tokenHoldings: tokenHoldings ? tokenHoldings.split(',').map(token => token.trim()) : undefined
      })
      setAccessStatus(`Access granted! Download URL: ${downloadUrl}`)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to grant access'
      setAccessStatus(message)
    }
  }

  const handleReverify = async () => {
    setReverifyLoading(true)
    setReverifyStatus('Re-running Walrus verification...')
    try {
      const response = await fetch(`${API_BASE_URL}/api/datasets/${dataset.id}/trust-score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ performWalrusVerification: true })
      })
      if (!response.ok) {
        throw new Error('Backend rejected re-verification request')
      }
      const updated: TrustScore = await response.json()
      setTrustScore(updated)
      setReverifyStatus('Trust score refreshed on-chain ✅')
      await fetchTrustHistory()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      setReverifyStatus(`❌ Re-verification failed: ${message}`)
    } finally {
      setReverifyLoading(false)
    }
  }

  const handleNautilusVerification = async () => {
    setNautilusLoading(true)
    setNautilusStatus('Contacting Nautilus enclave...')
    try {
      const response = await fetch(`${API_BASE_URL}/api/nautilus/verify/${dataset.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      if (!response.ok) {
        throw new Error('Nautilus verification failed')
      }
      const payload = await response.json() as { trustScore?: TrustScore }
      if (payload.trustScore) {
        setTrustScore(payload.trustScore)
        await fetchTrustHistory()
        setNautilusStatus('Enclave attestation published on-chain ✅')
      } else {
        setNautilusStatus('Enclave responded without a trust score')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      setNautilusStatus(`❌ Nautilus verification failed: ${message}`)
    } finally {
      setNautilusLoading(false)
    }
  }

  return (
    <section className="panel details">
      <header className="panel-header">
        <div>
          <p className="eyebrow">Dataset detail</p>
          <h2>{dataset.title}</h2>
        </div>
        <div className="badge-row">
          <span className="badge ghost">{dataset.id}</span>
          <span className="badge ghost">{dataset.certificateId}</span>
        </div>
      </header>

      <p className="muted">{dataset.description}</p>

      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '1.5rem',
        marginTop: '1.5rem',
        marginBottom: '1.5rem'
      }}>
        <div style={{ flex: '2 1 420px' }}>
          {loadingTrustScore ? (
            <div style={{ padding: '1rem', textAlign: 'center', color: '#9ca3af' }}>
              Loading trust score...
            </div>
          ) : trustScore ? (
            <TrustScoreBadge
              score={trustScore.score}
              verifiedByNautilus={trustScore.verifiedByNautilus}
              showBreakdown={true}
              fullDetails={trustScore}
            />
          ) : (
            <div style={{ padding: '1rem', textAlign: 'center', color: '#fca5a5', border: '1px solid #f87171', borderRadius: '0.75rem' }}>
              Trust score unavailable. Try re-running verification.
            </div>
          )}
        </div>
        <div style={{
          flex: '1 1 260px',
          border: '1px solid #374151',
          borderRadius: '0.75rem',
          padding: '1.25rem',
          background: 'rgba(17, 24, 39, 0.6)',
          minWidth: '240px'
        }}>
          <h4 style={{ marginBottom: '0.5rem' }}>Re-verify trust</h4>
          <p style={{ color: '#9ca3af', fontSize: '0.9rem', marginBottom: '1rem' }}>
            Trigger a fresh Walrus integrity check and publish a new trust score snapshot.
          </p>
          <button
            type="button"
            onClick={handleReverify}
            disabled={reverifyLoading}
            style={{
              width: '100%',
              padding: '0.75rem',
              borderRadius: '0.5rem',
              border: 'none',
              backgroundColor: reverifyLoading ? '#4b5563' : '#4338ca',
              color: '#fff',
              fontWeight: 600,
              cursor: reverifyLoading ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s ease'
            }}
          >
            {reverifyLoading ? 'Re-verifying...' : 'Re-verify via Walrus'}
          </button>
          <p className="status" style={{ marginTop: '0.75rem', minHeight: '1.25rem' }}>
            {reverifyStatus || (trustScore ? `Last verified ${new Date(trustScore.lastUpdated).toLocaleString()}` : '')}
          </p>
        </div>
        <div style={{
          flex: '1 1 260px',
          border: '1px solid rgba(16, 185, 129, 0.4)',
          borderRadius: '0.75rem',
          padding: '1.25rem',
          background: 'rgba(6, 95, 70, 0.2)',
          minWidth: '240px'
        }}>
          <h4 style={{ marginBottom: '0.5rem', color: '#d1fae5' }}>Nautilus attestation</h4>
          <p style={{ color: '#a7f3d0', fontSize: '0.9rem', marginBottom: '1rem' }}>
            Trigger a Nitro Enclave verification and publish the signed proof on-chain.
          </p>
          <button
            type='button'
            onClick={handleNautilusVerification}
            disabled={nautilusLoading}
            style={{
              width: '100%',
              padding: '0.75rem',
              borderRadius: '0.5rem',
              border: 'none',
              backgroundColor: nautilusLoading ? '#064e3b' : '#059669',
              color: '#fff',
              fontWeight: 600,
              cursor: nautilusLoading ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s ease'
            }}
          >
            {nautilusLoading ? 'Verifying...' : 'Verify via Nautilus'}
          </button>
          <p className="status" style={{ marginTop: '0.75rem', minHeight: '1.5rem', color: '#d1fae5' }}>
            {nautilusStatus ||
              (trustScore?.nautilusProof
                ? `Last enclave proof ${new Date(trustScore.nautilusProof.timestampMs).toLocaleString()}`
                : 'No enclave proof yet')}
          </p>
        </div>
      </div>

      <section style={{
        border: '1px solid #1f2937',
        borderRadius: '0.75rem',
        padding: '1.25rem',
        marginBottom: '2rem',
        background: 'rgba(15, 23, 42, 0.6)'
      }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <p className="eyebrow">Provenance analytics</p>
            <h3 style={{ margin: 0 }}>Trust score history</h3>
          </div>
          <span className="badge ghost">{trustHistory.length} snapshots</span>
        </header>
        {historyLoading ? (
          <div className="loading-state">Loading trust history...</div>
        ) : trustHistorySorted.length === 0 ? (
          <div className="empty-state">
            <p>No trust snapshots yet. Trigger a verification to generate history.</p>
          </div>
        ) : (
          <>
            <svg
              viewBox="0 0 280 80"
              preserveAspectRatio="none"
              style={{ width: '100%', height: '120px', background: 'rgba(31, 41, 55, 0.7)', borderRadius: '0.5rem' }}
            >
              <polyline
                fill="none"
                stroke="#34d399"
                strokeWidth="3"
                points={historyChartPoints}
              />
              <line x1="0" x2="280" y1="80" y2="80" stroke="#4b5563" strokeDasharray="4 6" />
            </svg>
            <div style={{
              marginTop: '1rem',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '0.75rem'
            }}>
              {trustHistorySorted.slice(-4).reverse().map((entry, index) => (
                <div key={`${entry.datasetId}-${entry.lastUpdated}-${index}`} style={{
                  border: '1px solid #283046',
                  borderRadius: '0.5rem',
                  padding: '0.75rem',
                  background: 'rgba(17, 24, 39, 0.9)'
                }}>
                  <strong style={{ fontSize: '1.25rem' }}>{entry.score}</strong>
                  <span style={{ marginLeft: '0.25rem', color: '#9ca3af' }}>/100</span>
                  <p style={{ color: '#9ca3af', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                    {new Date(entry.lastUpdated).toLocaleString()}
                  </p>
                  <p style={{ color: entry.verifiedByNautilus ? '#34d399' : '#fbbf24', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                    {entry.verifiedByNautilus ? 'Nautilus verified' : 'Manual verification'}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <div className="chips">
        {dataset.tags.map(tag => (
          <span className="chip" key={tag}>{tag}</span>
        ))}
      </div>

      <div className="metrics-grid">
        <div>
          <small>Walrus Blob ID</small>
          <strong style={{ wordBreak: 'break-all', fontSize: '0.9rem' }}>{dataset.walrus.blobId}</strong>
          <p className="muted" style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>Decentralized storage identifier</p>
        </div>
        <div>
          <small>Integrity Root</small>
          <strong style={{ wordBreak: 'break-all', fontSize: '0.9rem' }}>{dataset.walrus.integrityRoot}</strong>
          <p className="muted" style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>Cryptographic proof of data integrity</p>
        </div>
        <div>
          <small>Poseidon Hash</small>
          <strong style={{ wordBreak: 'break-all', fontSize: '0.9rem' }}>{dataset.hashes.poseidon}</strong>
          <p className="muted" style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>Zero-knowledge circuit compatible hash</p>
        </div>
      </div>

      <section className="on-chain-objects" style={{ marginTop: '2rem' }}>
        <h3>On-Chain Objects</h3>
        <p className="muted" style={{ marginBottom: '1rem' }}>View verifiable records on Sui blockchain</p>
        <div className="metrics-grid">
          <div>
            <small>Dataset Certificate (NFT)</small>
            {dataset.certificateId ? (
              <a
                href={`https://suiscan.xyz/testnet/object/${dataset.certificateId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="link-external"
                style={{ fontSize: '0.9rem', wordBreak: 'break-all' }}
              >
                {dataset.certificateId.slice(0, 20)}...{dataset.certificateId.slice(-6)} →
              </a>
            ) : (
              <span className="muted">Not minted yet</span>
            )}
            <p className="muted" style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>Dataset ownership & metadata</p>
          </div>
          <div>
            <small>Access Registry</small>
            <a
              href="https://suiscan.xyz/testnet/object/0x84ce31ca3501843aa42fdb65d47288c193ea33b068fb88cb6bd11c113bd2d750"
              target="_blank"
              rel="noopener noreferrer"
              className="link-external"
              style={{ fontSize: '0.9rem' }}
            >
              0x84ce31...bd2d750 →
            </a>
            <p className="muted" style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>All dataset access records</p>
          </div>
          <div>
            <small>Claim Registry</small>
            <a
              href="https://suiscan.xyz/testnet/object/0xce15a994eab487c5808318d57e92ac58bd856530c398f47751d14ffdc0e57e75"
              target="_blank"
              rel="noopener noreferrer"
              className="link-external"
              style={{ fontSize: '0.9rem' }}
            >
              0xce15a9...dc0e57e75 →
            </a>
            <p className="muted" style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>All audit claims filed</p>
          </div>
        </div>
      </section>

      <section className="timeline">
        <h3>Chain-of-custody timeline (10 most recent)</h3>
        <div className="timeline-table">
          <table>
            <thead>
              <tr>
                <th>Event</th>
                <th>Timestamp</th>
                <th>Transaction</th>
              </tr>
            </thead>
            <tbody>
              {dataset.timeline.slice(0, 10).map(event => (
                <tr key={event.id}>
                  <td><strong>{event.description}</strong></td>
                  <td className="muted">{new Date(event.timestamp).toLocaleString()}</td>
                  <td>
                    {event.metadata?.digest ? (
                      <a
                        href={`https://suiscan.xyz/testnet/tx/${event.metadata.digest}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="link-external"
                      >
                        View on Suiscan →
                      </a>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="forms-container">
        <form className="form-section claim-card" onSubmit={handleClaim}>
          <h3>Raise a claim</h3>
          <textarea
            value={claimStatement}
            onChange={event => setClaimStatement(event.target.value)}
            placeholder="Describe authenticity, bias, or consent issues"
            rows={3}
            required
          />
          <label>
            <span>Severity</span>
            <select
              value={claimSeverity}
              onChange={event =>
                setClaimSeverity(event.target.value as 'info' | 'warning' | 'critical')
              }
            >
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </select>
          </label>
          <label>
            <span>Evidence URI</span>
            <input
              value={evidenceUri}
              onChange={event => setEvidenceUri(event.target.value)}
              placeholder="https://…"
            />
          </label>
          <button type="submit" className="secondary">Submit claim</button>
          <p className="status">{claimStatus}</p>
        </form>

        <form className="form-section access-card" onSubmit={handleAccess}>
          <h3>Request gated access</h3>

          {!currentAccount && (
            <div className="wallet-warning">
              ⚠️ Please connect Sui wallet to request access
            </div>
          )}

          {currentAccount && (
            <div className="wallet-info">
              ✅ Requester: {currentAccount.address.slice(0, 10)}...{currentAccount.address.slice(-6)}
            </div>
          )}

          <label>
            <span>Purpose</span>
            <input
              value={purpose}
              onChange={event => setPurpose(event.target.value)}
              required
              disabled={!currentAccount}
            />
          </label>
          {dataset.accessPolicy.type === 'stake_gated' && (
            <label>
              <span>Stake amount (WAL) - Minimum: {dataset.accessPolicy.minStake ?? 0} WAL</span>
              <input
                type="number"
                value={stakeAmount}
                onChange={event => setStakeAmount(Number(event.target.value))}
                min={dataset.accessPolicy.minStake ?? 0}
                disabled={!currentAccount}
              />
              {stakeAmount < (dataset.accessPolicy.minStake ?? 0) && (
                <small style={{ color: '#ff6b6b', fontSize: '0.85rem', marginTop: '0.25rem', display: 'block' }}>
                  ⚠️ Stake amount must be at least {dataset.accessPolicy.minStake ?? 0} WAL (enforced on-chain)
                </small>
              )}
            </label>
          )}
          {dataset.accessPolicy.type === 'token_gated' && (
            <label>
              <span>Tokens</span>
              <input
                value={tokenHoldings}
                onChange={event => setTokenHoldings(event.target.value)}
                placeholder="WAL-GOLD, DATA-VIP"
                disabled={!currentAccount}
              />
            </label>
          )}
          <button
            type="submit"
            className="primary ghost"
            disabled={
              !currentAccount ||
              (dataset.accessPolicy.type === 'stake_gated' && stakeAmount < (dataset.accessPolicy.minStake ?? 0))
            }
          >
            {!currentAccount
              ? 'Connect Wallet to Request'
              : (dataset.accessPolicy.type === 'stake_gated' && stakeAmount < (dataset.accessPolicy.minStake ?? 0))
                ? `Minimum ${dataset.accessPolicy.minStake} WAL Required`
                : 'Request access'}
          </button>
          <p className="status">{accessStatus}</p>
        </form>
      </div>

      <section className="claims-list">
        <h3>Audit claims</h3>
        {dataset.claims.length === 0 ? (
          <p className="muted">No claims yet</p>
        ) : (
          <ul>
            {dataset.claims.map(claim => (
              <li key={claim.id}>
                <span className={`badge ${claim.severity}`}>{claim.severity}</span>
                <div>
                  <strong>{claim.statement}</strong>
                  <p className="muted">
                    {claim.role} · {new Date(claim.createdAt).toLocaleString()}
                  </p>
                  {claim.evidenceUri && <a href={claim.evidenceUri}>{claim.evidenceUri}</a>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  )
}
