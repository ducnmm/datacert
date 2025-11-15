import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import datasetsRouter from './routes/datasets.js'
import nautilusRouter from './routes/nautilus.js'
import { config } from './config.js'
import { indexer } from './services/indexer.js'

const app = express()

// CORS configuration to allow Chrome extension
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:3000',
    /^chrome-extension:\/\//,  // Allow all Chrome extensions
    /^moz-extension:\/\//      // Allow Firefox extensions
  ],
  credentials: true
}))
app.use(express.json({ limit: '25mb' }))
app.use(morgan('dev'))

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use('/api/datasets', datasetsRouter)
app.use('/api/nautilus', nautilusRouter)

app.use(
  (
    err: any,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    const status = err.status ?? 400
    res.status(status).json({
      error: {
        message: err.message ?? 'Unexpected error',
        details: err.errors ?? undefined
      }
    })
  }
)

app.listen(config.port, async () => {
  console.log(`DataCert backend running at http://localhost:${config.port}`)

  // Start blockchain indexer
  await indexer.start()
})
