import { SuiClient, SuiEventFilter } from '@mysten/sui/client'
import { PrismaClient } from '@prisma/client'
import { config } from '../config.js'

const prisma = new PrismaClient()
const suiClient = new SuiClient({ url: config.suiFullnode })

interface AccessGrantedEvent {
  dataset_id: string
  requester: string
  walrus_blob: string
  purpose: string
  stake_amount: string
}

interface ClaimRaisedEvent {
  dataset_id: string
  claim_id: string
  severity: number
  claimant: string
}

export class BlockchainIndexer {
  private isRunning = false
  private pollInterval = 5000 // 5 seconds
  private lastProcessedTx: string | null = null

  async start() {
    if (this.isRunning) {
      console.log('⚠️ Indexer already running')
      return
    }

    this.isRunning = true
    console.log('🚀 Starting blockchain indexer...')

    // Initial sync from genesis
    await this.syncHistoricalEvents()

    // Start polling for new events
    this.pollEvents()
  }

  stop() {
    this.isRunning = false
    console.log('🛑 Stopping blockchain indexer...')
  }

  private async syncHistoricalEvents() {
    console.log('📚 Syncing historical events...')

    try {
      // Sync AccessGranted events
      await this.indexAccessEvents()

      // Sync ClaimFiled events
      await this.indexClaimEvents()

      console.log('✅ Historical sync completed')
    } catch (error) {
      console.error('❌ Historical sync error:', error)
    }
  }

  private async indexAccessEvents() {
    const filter: SuiEventFilter = {
      MoveEventType: `${config.suiPackageId}::dataset_certificate::AccessGranted`
    }

    try {
      const events = await suiClient.queryEvents({
        query: filter,
        limit: 50,
        order: 'ascending'
      })

      console.log(`📥 Found ${events.data.length} AccessGranted events`)

      for (const event of events.data) {
        await this.processAccessEvent(event)
      }
    } catch (error) {
      console.error('❌ Error indexing access events:', error)
    }
  }

  private async indexClaimEvents() {
    const filter: SuiEventFilter = {
      MoveEventType: `${config.suiPackageId}::dataset_certificate::ClaimRaised`
    }

    try {
      const events = await suiClient.queryEvents({
        query: filter,
        limit: 50,
        order: 'ascending'
      })

      console.log(`📥 Found ${events.data.length} ClaimRaised events`)

      for (const event of events.data) {
        await this.processClaimEvent(event)
      }
    } catch (error) {
      console.error('❌ Error indexing claim events:', error)
    }
  }

  private async processAccessEvent(event: any) {
    const data = event.parsedJson as AccessGrantedEvent
    const txHash = event.id.txDigest

    try {
      // Find or create dataset
      let dataset = await prisma.dataset.findFirst({
        where: { datasetId: data.dataset_id }
      })

      if (!dataset) {
        // Create dataset if doesn't exist
        dataset = await prisma.dataset.create({
          data: {
            datasetId: data.dataset_id,
            name: data.dataset_id,
            description: 'Indexed from blockchain',
            owner: data.requester,
            walrusBlobId: data.walrus_blob,
            status: 'certified'
          }
        })
      }

      // Check if access record already exists
      const existing = await prisma.accessRecord.findFirst({
        where: { txHash }
      })

      if (!existing) {
        // Create access record
        await prisma.accessRecord.create({
          data: {
            datasetId: dataset.id,
            requester: data.requester,
            purpose: data.purpose,
            stakeAmount: parseInt(data.stake_amount),
            txHash,
            timestamp: new Date(event.timestampMs ? parseInt(event.timestampMs) : Date.now())
          }
        })

        // Update dataset metrics
        await prisma.dataset.update({
          where: { id: dataset.id },
          data: {
            downloads: { increment: 1 },
            totalRevenue: { increment: parseInt(data.stake_amount) }
          }
        })

        console.log(`✅ Indexed access: ${data.dataset_id} by ${data.requester.slice(0, 8)}...`)
      }
    } catch (error) {
      console.error(`❌ Error processing access event:`, error)
    }
  }

  private async processClaimEvent(event: any) {
    const data = event.parsedJson as ClaimRaisedEvent

    try {
      // Find dataset
      const dataset = await prisma.dataset.findFirst({
        where: { datasetId: data.dataset_id }
      })

      if (!dataset) {
        console.warn(`⚠️ Dataset ${data.dataset_id} not found for claim`)
        return
      }

      // Map severity number to string
      const severityMap = ['low', 'medium', 'critical']
      const severity = severityMap[data.severity] || 'medium'

      // Check if claim already exists (by on-chain claim_id or claimant)
      const existing = await prisma.claim.findFirst({
        where: {
          datasetId: dataset.id,
          claimant: data.claimant
        }
      })

      if (existing) {
        console.log(`✅ Claim on-chain: ${data.dataset_id} claim_id=${data.claim_id} (already in DB)`)
      } else {
        // Claim was filed on-chain but not in our DB (shouldn't happen normally)
        console.log(`⚠️  On-chain claim ${data.claim_id} for ${data.dataset_id} not found in DB`)
        // We could fetch full claim details from ClaimRegistry here if needed
      }
    } catch (error) {
      console.error(`❌ Error processing claim event:`, error)
    }
  }

  private async pollEvents() {
    if (!this.isRunning) return

    try {
      await this.indexAccessEvents()
      await this.indexClaimEvents()
    } catch (error) {
      console.error('❌ Polling error:', error)
    }

    // Schedule next poll
    setTimeout(() => this.pollEvents(), this.pollInterval)
  }
}

// Singleton instance
export const indexer = new BlockchainIndexer()
