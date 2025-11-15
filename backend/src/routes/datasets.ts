import { Router } from 'express'
import { z } from 'zod'
import {
  createUploadSession,
  registerDataset,
  listDatasets,
  getDataset,
  addClaim,
  recordAccess,
  getTrustScoreHistory
} from '../services/datasetService.js'
import { calculateTrustScore, calculateAndPublishTrustScore } from '../services/trustOracle.js'

const router = Router()

const uploadSchema = z.object({
  fileName: z.string(),
  mimeType: z.string(),
  contentBase64: z.string()
})

const registerSchema = z.object({
  sessionId: z.string(),
  ownerAddress: z.string(),
  title: z.string(),
  description: z.string(),
  categories: z.array(z.string()),
  tags: z.array(z.string()).default([]),
  license: z.string(),
  sensitivity: z.enum(['public', 'restricted', 'confidential']),
  accessPolicy: z.object({
    type: z.enum(['public', 'token_gated', 'stake_gated']),
    minStake: z.number().optional(),
    allowedTokens: z.array(z.string()).optional()
  })
})

const claimSchema = z.object({
  role: z.enum(['auditor', 'buyer', 'creator']),
  statement: z.string(),
  severity: z.enum(['info', 'warning', 'critical']),
  evidenceUri: z.string().optional()
})

const accessSchema = z.object({
  requester: z.string(),
  purpose: z.string(),
  stakeAmount: z.number().optional(),
  tokenHoldings: z.array(z.string()).optional()
})

router.get('/', async (_req, res, next) => {
  try {
    const datasets = await listDatasets()
    // Recalculate trust scores to ensure they're up-to-date
    const datasetsWithFreshScores = datasets.map(dataset => ({
      ...dataset,
      trust: calculateTrustScore(dataset)
    }))
    res.json({ data: datasetsWithFreshScores })
  } catch (error) {
    next(error)
  }
})

router.get('/lookup', async (req, res, next) => {
  try {
    const { url } = req.query

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL parameter required' })
    }

    // Search datasets by URL in tags or description
    const datasets = await listDatasets()
    const match = datasets.find(d => {
      // Check if dataset metadata contains this URL
      return (
        d.tags?.some(tag => tag.includes(url) || url.includes(tag)) ||
        d.description?.includes(url) ||
        url.includes(d.title)
      )
    })

    if (match) {
      res.json(match)
    } else {
      res.status(404).json({ error: 'Dataset not certified' })
    }
  } catch (error) {
    next(error)
  }
})

router.post('/upload', async (req, res, next) => {
  try {
    const payload = uploadSchema.parse(req.body)
    const session = await createUploadSession(payload)
    res.status(201).json(session)
  } catch (error) {
    next(error)
  }
})

router.post('/register', async (req, res, next) => {
  try {
    const payload = registerSchema.parse(req.body)
    const dataset = await registerDataset(payload)
    res.status(201).json(dataset)
  } catch (error) {
    next(error)
  }
})

router.get('/:id', async (req, res, next) => {
  try {
    const dataset = await getDataset(req.params.id)
    res.json(dataset)
  } catch (error) {
    next(error)
  }
})

router.post('/:id/claims', async (req, res, next) => {
  try {
    const payload = claimSchema.parse(req.body)
    const dataset = await addClaim({
      datasetId: req.params.id,
      ...payload
    })
    res.status(201).json(dataset)
  } catch (error) {
    next(error)
  }
})

router.post('/:id/access', async (req, res, next) => {
  try {
    const payload = accessSchema.parse(req.body)
    const response = await recordAccess({
      datasetId: req.params.id,
      ...payload
    })
    res.json(response)
  } catch (error) {
    next(error)
  }
})

// Get trust score for a dataset (calculate on the fly)
router.get('/:id/trust-score', async (req, res, next) => {
  try {
    const dataset = await getDataset(req.params.id)
    const trustScore = calculateTrustScore(dataset)
    res.json(trustScore)
  } catch (error) {
    next(error)
  }
})

router.get('/:id/trust-score/history', async (req, res, next) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 20
    const history = await getTrustScoreHistory(req.params.id, Number.isNaN(limit) ? 20 : limit)
    res.json({ data: history })
  } catch (error) {
    next(error)
  }
})

// Calculate and publish trust score to blockchain
router.post('/:id/trust-score', async (req, res, next) => {
  try {
    const dataset = await getDataset(req.params.id)
    const verifiedByNautilus = req.body?.verifiedByNautilus ?? false
    const performWalrusVerification = req.body?.performWalrusVerification ?? false
    const trustScore = await calculateAndPublishTrustScore(dataset, verifiedByNautilus, {
      performWalrusVerification
    })
    res.json(trustScore)
  } catch (error) {
    next(error)
  }
})

export default router
