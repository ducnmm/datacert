import { useState } from 'react'
import { useCurrentAccount } from '@mysten/dapp-kit'
import type { DatasetRecord } from '../types'
import { uploadDataset, registerDataset } from '../lib/api'

interface UploadWizardProps {
  onDatasetCreated: (dataset: DatasetRecord) => void
}

interface FormState {
  ownerAddress: string
  title: string
  description: string
  categories: string
  tags: string
  license: string
  sensitivity: 'public' | 'restricted' | 'confidential'
  accessType: 'public' | 'token_gated' | 'stake_gated'
  minStake: number
  allowedTokens: string
}

const defaultState: FormState = {
  ownerAddress: '0xcreator',
  title: '',
  description: '',
  categories: 'imagery, ecology',
  tags: 'walrus, satellite, consented',
  license: 'CC-BY-NC-4.0',
  sensitivity: 'restricted',
  accessType: 'stake_gated',
  minStake: 25,
  allowedTokens: 'WAL-GOLD'
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1] ?? '')
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export function UploadWizard({ onDatasetCreated }: UploadWizardProps) {
  const currentAccount = useCurrentAccount()
  const [form, setForm] = useState<FormState>(defaultState)
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleInputChange = (field: keyof FormState, value: string | number) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!currentAccount) {
      setStatus('⚠️ Please connect your Sui wallet first.')
      return
    }

    if (!file) {
      setStatus('Please select a dataset file.')
      return
    }

    try {
      setIsSubmitting(true)
      setStatus('Encrypting and uploading to Walrus…')
      const base64 = await fileToBase64(file)
      const upload = await uploadDataset({
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        contentBase64: base64
      })

      setStatus('Minting certificate on Sui…')
      const dataset = await registerDataset({
        sessionId: upload.sessionId,
        ownerAddress: currentAccount.address,
        title: form.title || file.name,
        description: form.description || 'Dataset without detailed description',
        categories: form.categories.split(',').map(item => item.trim()).filter(Boolean),
        tags: form.tags.split(',').map(item => item.trim()).filter(Boolean),
        license: form.license,
        sensitivity: form.sensitivity,
        accessPolicy: {
          type: form.accessType,
          minStake: form.accessType === 'stake_gated' ? form.minStake : undefined,
          allowedTokens:
            form.accessType === 'token_gated'
              ? form.allowedTokens.split(',').map(item => item.trim()).filter(Boolean)
              : undefined
        }
      })
      onDatasetCreated(dataset)
      setStatus('Dataset registered successfully 🎉')
      setForm(defaultState)
      setFile(null)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create dataset'
      setStatus(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="wizard" onSubmit={handleSubmit}>
      {!currentAccount && (
        <div className="wallet-warning">
          ⚠️ Please connect Sui wallet to mint dataset certificate
        </div>
      )}

      {currentAccount && (
        <div className="wallet-info">
          ✅ Owner: {currentAccount.address.slice(0, 10)}...{currentAccount.address.slice(-6)}
        </div>
      )}

      <label className="field">
        <span>Dataset Name</span>
        <input
          value={form.title}
          onChange={event => handleInputChange('title', event.target.value)}
          placeholder="Coastal Walrus Imagery v1"
          disabled={!currentAccount}
        />
      </label>

      <label className="field">
        <span>Short Description</span>
        <textarea
          value={form.description}
          onChange={event => handleInputChange('description', event.target.value)}
          rows={3}
          placeholder="Satellite imagery + annotations with consent"
        />
      </label>

      <div className="grid two">
        <label className="field">
          <span>Categories</span>
          <input
            value={form.categories}
            onChange={event => handleInputChange('categories', event.target.value)}
          />
        </label>
        <label className="field">
          <span>Tags</span>
          <input
            value={form.tags}
            onChange={event => handleInputChange('tags', event.target.value)}
          />
        </label>
      </div>

      <div className="grid two">
        <label className="field">
          <span>License</span>
          <select
            value={form.license}
            onChange={event => handleInputChange('license', event.target.value)}
          >
            <option value="CC0-1.0">CC0 - Public Domain</option>
            <option value="CC-BY-4.0">CC-BY-4.0 - Attribution</option>
            <option value="CC-BY-SA-4.0">CC-BY-SA-4.0 - Attribution ShareAlike</option>
            <option value="CC-BY-NC-4.0">CC-BY-NC-4.0 - Attribution NonCommercial</option>
            <option value="CC-BY-NC-SA-4.0">CC-BY-NC-SA-4.0 - Attribution NonCommercial ShareAlike</option>
            <option value="MIT">MIT License</option>
            <option value="Apache-2.0">Apache 2.0</option>
            <option value="ODbL-1.0">ODbL - Open Database License</option>
            <option value="CDLA-Permissive-2.0">CDLA Permissive 2.0</option>
            <option value="CDLA-Sharing-1.0">CDLA Sharing 1.0</option>
            <option value="Proprietary">Proprietary / Custom</option>
          </select>
        </label>
        <label className="field">
          <span>Sensitivity</span>
          <select
            value={form.sensitivity}
            onChange={event =>
              handleInputChange('sensitivity', event.target.value as FormState['sensitivity'])
            }
          >
            <option value="public">Public</option>
            <option value="restricted">Restricted</option>
            <option value="confidential">Confidential</option>
          </select>
        </label>
      </div>

      <div className="grid two">
        <label className="field">
          <span>Access policy</span>
          <select
            value={form.accessType}
            onChange={event =>
              handleInputChange('accessType', event.target.value as FormState['accessType'])
            }
          >
            <option value="public">Public</option>
            <option value="stake_gated">Stake-gated</option>
            <option value="token_gated">Token-gated</option>
          </select>
        </label>
        {form.accessType === 'stake_gated' && (
          <label className="field">
            <span>Min stake (WAL)</span>
            <input
              type="number"
              value={form.minStake}
              onChange={event => handleInputChange('minStake', Number(event.target.value))}
            />
          </label>
        )}
        {form.accessType === 'token_gated' && (
          <label className="field">
            <span>Allowed tokens</span>
            <input
              value={form.allowedTokens}
              onChange={event => handleInputChange('allowedTokens', event.target.value)}
              placeholder="WAL-GOLD, DATA-VIP"
            />
          </label>
        )}
      </div>

      <label className="upload-zone">
        <input
          type="file"
          onChange={event => setFile(event.target.files?.[0] ?? null)}
          required
        />
        <div>
          <strong>{file ? file.name : 'Drag & drop or select dataset file'}</strong>
          <p>Walrus will store the blob and return integrity proof + Poseidon hash</p>
        </div>
      </label>

      <button className="primary" type="submit" disabled={isSubmitting || !currentAccount}>
        {isSubmitting ? 'Creating certificate…' : !currentAccount ? 'Connect Wallet to Mint' : 'Mint dataset certificate'}
      </button>
      <p className="status">{status}</p>
    </form>
  )
}
