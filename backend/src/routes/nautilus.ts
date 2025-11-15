import { Router } from 'express'
import { requestNautilusVerification, getLatestVerification } from '../services/nautilusOracle.js'

const router = Router()

/**
 * POST /api/nautilus/verify/:datasetId
 * Trigger a fresh verification against the configured Nautilus enclave.
 */
router.post('/verify/:datasetId', async (req, res, next) => {
  try {
    const { datasetId } = req.params
    const blobId = typeof req.body?.blobId === 'string' ? req.body.blobId : undefined

    const trustScore = await requestNautilusVerification(datasetId, blobId)

    res.status(200).json({
      success: Boolean(trustScore),
      datasetId,
      trustScore
    })
  } catch (error) {
    next(error)
  }
})

/**
 * GET /api/nautilus/:datasetId
 * Return the most recent Nautilus verification proof for a dataset.
 */
router.get('/:datasetId', async (req, res, next) => {
  try {
    const { datasetId } = req.params
    const record = await getLatestVerification(datasetId)
    if (!record) {
      return res.status(404).json({ error: 'Nautilus proof not found' })
    }
    res.status(200).json(record)
  } catch (error) {
    next(error)
  }
})

export default router
