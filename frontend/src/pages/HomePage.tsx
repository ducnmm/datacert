import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { fetchDatasets } from '../lib/api'
import type { DatasetRecord } from '../types'
import { UploadWizard } from '../components/UploadWizard'
import { TrustScoreBadge } from '../components/TrustScoreBadge'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

export function HomePage() {
  useDocumentTitle('Home')
  const [datasets, setDatasets] = useState<DatasetRecord[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    fetchDatasets()
      .then(setDatasets)
      .finally(() => setLoading(false))
  }, [])

  const stats = {
    total: datasets.length,
    certified: datasets.filter(d => d.status === 'certified').length,
    totalDownloads: datasets.reduce((sum, d) => sum + d.metrics.downloads, 0),
    totalRevenue: datasets.reduce((sum, d) => sum + d.metrics.revenueWal, 0),
  }

  const trustScores = datasets
    .map(dataset => dataset.trust?.score)
    .filter((score): score is number => typeof score === 'number')

  const averageTrustScore = trustScores.length
    ? Math.round(trustScores.reduce((sum, value) => sum + value, 0) / trustScores.length)
    : null

  const nautilusVerified = datasets.filter(dataset => dataset.trust?.verifiedByNautilus).length
  const highTrustDatasets = datasets.filter(dataset => (dataset.trust?.score ?? 0) >= 80).length

  const latestVerification = datasets
    .map(dataset => dataset.trust?.lastUpdated)
    .filter((timestamp): timestamp is string => Boolean(timestamp))
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]

  const highestRatedDatasets = [...datasets]
    .filter(dataset => Boolean(dataset.trust))
    .sort((a, b) => (b.trust?.score ?? 0) - (a.trust?.score ?? 0))
    .slice(0, 3)

  const recentDatasets = datasets.slice(0, 5)

  const handleDatasetCreated = (dataset: DatasetRecord) => {
    setDatasets(prev => [dataset, ...prev])
    navigate(`/datasets/${dataset.id}`)
  }

  return (
    <div className="home-page">
      <header className="hero">
        <div>
          <p className="eyebrow">Walrus Haulout · Decentralized Data Provenance</p>
          <h1>Data Certification Platform</h1>
          <p>
            Provably authentic training datasets powered by Walrus storage, Seal access control, and Sui blockchain
          </p>
        </div>
      </header>

      {loading ? (
        <div className="loading-state">Loading statistics...</div>
      ) : (
        <>
          <section className="home-upload-section">
            <header className="section-header">
              <div>
                <p className="eyebrow">Certify Your Data</p>
                <h2>Upload & Certify Dataset</h2>
                <p>Create an immutable certificate for your training data on the blockchain</p>
              </div>
            </header>
            <UploadWizard onDatasetCreated={handleDatasetCreated} />
          </section>

          <section className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">{stats.total}</div>
              <div className="stat-label">Total Datasets</div>
              <div className="stat-sublabel">On-chain certified</div>
            </div>

            <div className="stat-card">
              <div className="stat-value">{stats.totalDownloads}</div>
              <div className="stat-label">Total Downloads</div>
              <div className="stat-sublabel">Tracked on blockchain</div>
            </div>

            <div className="stat-card">
              <div className="stat-value">{stats.totalRevenue} WAL</div>
              <div className="stat-label">Total Revenue</div>
              <div className="stat-sublabel">From stake-gated access</div>
            </div>

            <div className="stat-card">
              <div className="stat-value">{stats.certified}</div>
              <div className="stat-label">Certified</div>
              <div className="stat-sublabel">Active on network</div>
            </div>
          </section>

          <section className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">{averageTrustScore ?? '—'}</div>
              <div className="stat-label">Avg Trust Score</div>
              <div className="stat-sublabel">Across verified datasets</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{nautilusVerified}</div>
              <div className="stat-label">Nautilus Verified</div>
              <div className="stat-sublabel">End-to-end integrity checks</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{highTrustDatasets}</div>
              <div className="stat-label">Scores ≥ 80</div>
              <div className="stat-sublabel">High-confidence datasets</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">
                {latestVerification ? new Date(latestVerification).toLocaleDateString() : '—'}
              </div>
              <div className="stat-label">Last Verification</div>
              <div className="stat-sublabel">Most recent Walrus check</div>
            </div>
          </section>

          <section className="panel">
            <header className="panel-header">
              <div>
                <p className="eyebrow">Database Overview</p>
                <h2>Recent Datasets</h2>
              </div>
              <Link to="/datasets" className="btn ghost">
                View all →
              </Link>
            </header>

            {recentDatasets.length === 0 ? (
              <div className="empty-state">
                <p>No datasets yet. Be the first to certify data!</p>
              </div>
            ) : (
              <div className="dataset-table">
                <table>
                  <thead>
                    <tr>
                      <th>Dataset</th>
                      <th>Status</th>
                      <th>Downloads</th>
                      <th>Revenue</th>
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentDatasets.map(dataset => (
                      <tr key={dataset.id}>
                        <td>
                          <Link to={`/datasets/${dataset.id}`} className="dataset-link">
                            <strong>{dataset.title}</strong>
                            <br />
                            <span className="muted">{dataset.id}</span>
                          </Link>
                        </td>
                        <td>
                          <span className={`badge ${dataset.status}`}>{dataset.status}</span>
                        </td>
                        <td>{dataset.metrics.downloads}</td>
                        <td>{dataset.metrics.revenueWal} WAL</td>
                        <td className="muted">{new Date(dataset.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="panel">
            <header className="panel-header">
              <div>
                <p className="eyebrow">Trust Leaderboard</p>
                <h2>Highest Rated Datasets</h2>
              </div>
            </header>
            {highestRatedDatasets.length === 0 ? (
              <div className="empty-state">
                <p>No trust data yet. Register a dataset to see rankings.</p>
              </div>
            ) : (
              <div
                className="highest-rated-list"
                style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}
              >
                {highestRatedDatasets.map(dataset => (
                  <article key={dataset.id} className="dataset-card" style={{ cursor: 'default' }}>
                    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <div>
                        <h3 style={{ margin: 0 }}>{dataset.title}</h3>
                        <p className="muted" style={{ fontSize: '0.85rem' }}>{dataset.ownerAddress.slice(0, 10)}...</p>
                      </div>
                      {dataset.trust && (
                        <TrustScoreBadge
                          score={dataset.trust.score}
                          verifiedByNautilus={dataset.trust.verifiedByNautilus}
                          compact
                        />
                      )}
                    </header>
                    <p className="muted">{dataset.description}</p>
                    <Link to={`/datasets/${dataset.id}`} className="btn ghost" style={{ marginTop: '0.75rem', width: 'fit-content' }}>
                      View details →
                    </Link>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="features-grid">
            <div className="feature-card">
              <h3>🌊 Walrus Storage</h3>
              <p>Decentralized blob storage with erasure coding and proof of retrievability</p>
            </div>

            <div className="feature-card">
              <h3>⛓️ Sui Blockchain</h3>
              <p>Immutable provenance records with on-chain certificates and claims</p>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
