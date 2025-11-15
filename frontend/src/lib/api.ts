import type { DatasetRecord, UploadSession } from '../types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {})
    },
    ...options
  })
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}))
    throw new Error(errorBody?.error?.message ?? 'API request failed')
  }
  return await response.json() as T
}

export async function fetchDatasets(): Promise<DatasetRecord[]> {
  const data = await request<{ data: DatasetRecord[] }>('/api/datasets')
  return data.data
}

interface UploadPayload {
  fileName: string
  mimeType: string
  contentBase64: string
}

export async function uploadDataset(payload: UploadPayload): Promise<UploadSession> {
  return await request<UploadSession>('/api/datasets/upload', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

interface RegisterPayload {
  sessionId: string
  ownerAddress: string
  title: string
  description: string
  categories: string[]
  tags: string[]
  license: string
  sensitivity: 'public' | 'restricted' | 'confidential'
  accessPolicy: {
    type: 'public' | 'token_gated' | 'stake_gated'
    minStake?: number
    allowedTokens?: string[]
  }
}

export async function registerDataset(payload: RegisterPayload): Promise<DatasetRecord> {
  return await request<DatasetRecord>('/api/datasets/register', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

interface ClaimPayload {
  datasetId: string
  role: 'auditor' | 'buyer' | 'creator'
  statement: string
  severity: 'info' | 'warning' | 'critical'
  evidenceUri?: string
}

export async function submitClaim(payload: ClaimPayload): Promise<DatasetRecord> {
  return await request<DatasetRecord>(`/api/datasets/${payload.datasetId}/claims`, {
    method: 'POST',
    body: JSON.stringify({
      role: payload.role,
      statement: payload.statement,
      severity: payload.severity,
      evidenceUri: payload.evidenceUri
    })
  })
}

interface AccessRequestPayload {
  datasetId: string
  requester: string
  purpose: string
  stakeAmount?: number
  tokenHoldings?: string[]
}

export async function requestAccess(payload: AccessRequestPayload) {
  return await request<{
    datasetId: string
    downloadUrl: string
    certificateId?: string
    tx: string
  }>(`/api/datasets/${payload.datasetId}/access`, {
    method: 'POST',
    body: JSON.stringify({
      requester: payload.requester,
      purpose: payload.purpose,
      stakeAmount: payload.stakeAmount,
      tokenHoldings: payload.tokenHoldings
    })
  })
}
