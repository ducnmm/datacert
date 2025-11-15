import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchDatasets } from '../lib/api'
import type { DatasetRecord } from '../types'
import { DatasetGrid } from '../components/DatasetGrid'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

export function DatasetsPage() {
  useDocumentTitle('Datasets')
  const [datasets, setDatasets] = useState<DatasetRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    refreshDatasets()
  }, [])

  const refreshDatasets = async () => {
    setLoading(true)
    try {
      const data = await fetchDatasets()
      setDatasets(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load datasets')
    } finally {
      setLoading(false)
    }
  }

  const handleSelectDataset = (dataset: DatasetRecord) => {
    navigate(`/datasets/${dataset.id}`)
  }

  return (
    <div className="datasets-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Registry</p>
          <h1>All Datasets</h1>
          <p>Browse and certify training datasets on the Walrus Haulout network</p>
        </div>
        <div className="page-stats">
          <strong>{datasets.length}</strong>
          <span>certified datasets</span>
        </div>
      </header>

      {error && <div className="alert error">{error}</div>}

      <section className="panel">
        <header className="panel-header">
          <h2>Certified Datasets</h2>
          {loading && <span className="badge ghost">Loading...</span>}
        </header>

        {loading ? (
          <div className="loading-state">Loading datasets...</div>
        ) : datasets.length === 0 ? (
          <div className="empty-state">
            <p>No datasets yet. Go to home to upload the first one!</p>
          </div>
        ) : (
          <DatasetGrid
            datasets={datasets}
            onSelect={handleSelectDataset}
          />
        )}
      </section>
    </div>
  )
}
