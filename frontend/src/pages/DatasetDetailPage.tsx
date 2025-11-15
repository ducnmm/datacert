import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useCurrentAccount } from '@mysten/dapp-kit'
import { fetchDatasets, submitClaim, requestAccess } from '../lib/api'
import type { DatasetRecord } from '../types'
import { DatasetDetails } from '../components/DatasetDetails'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

export function DatasetDetailPage() {
  const { id } = useParams<{ id: string }>()
  const currentAccount = useCurrentAccount()
  const [dataset, setDataset] = useState<DatasetRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useDocumentTitle(dataset?.title || 'Dataset Details')

  useEffect(() => {
    if (!id) {
      setError('No dataset ID provided')
      setLoading(false)
      return
    }

    fetchDatasets()
      .then(datasets => {
        const found = datasets.find(d => d.id === id)
        if (found) {
          setDataset(found)
        } else {
          setError('Dataset not found')
        }
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : 'Failed to load dataset')
      })
      .finally(() => setLoading(false))
  }, [id])

  const handleClaim = async (payload: {
    statement: string
    severity: 'info' | 'warning' | 'critical'
    evidenceUri?: string
  }) => {
    if (!dataset) return
    const updated = await submitClaim({
      datasetId: dataset.id,
      role: 'auditor',
      ...payload
    })
    setDataset(updated)
  }

  const handleAccessRequest = async (payload: {
    purpose: string
    stakeAmount?: number
    tokenHoldings?: string[]
  }) => {
    if (!dataset) throw new Error('No dataset selected')
    if (!currentAccount) throw new Error('Please connect wallet first')

    const response = await requestAccess({
      datasetId: dataset.id,
      requester: currentAccount.address,
      ...payload
    })

    // Refresh dataset to update metrics
    const datasets = await fetchDatasets()
    const updated = datasets.find(d => d.id === dataset.id)
    if (updated) setDataset(updated)

    return response.downloadUrl
  }

  if (loading) {
    return (
      <div className="dataset-detail-page">
        <div className="loading-state">Loading dataset...</div>
      </div>
    )
  }

  if (error || !dataset) {
    return (
      <div className="dataset-detail-page">
        <header className="page-header">
          <Link to="/datasets" className="btn ghost">← Back to datasets</Link>
        </header>
        <div className="alert error">{error || 'Dataset not found'}</div>
      </div>
    )
  }

  return (
    <div className="dataset-detail-page">
      <header className="page-header">
        <Link to="/datasets" className="btn ghost">← Back to datasets</Link>
        <div>
          <p className="eyebrow">Dataset Details</p>
          <h1>{dataset.title}</h1>
          <p className="muted">{dataset.id}</p>
        </div>
      </header>

      <DatasetDetails
        dataset={dataset}
        onSubmitClaim={handleClaim}
        onRequestAccess={handleAccessRequest}
        currentAccount={currentAccount}
      />
    </div>
  )
}
