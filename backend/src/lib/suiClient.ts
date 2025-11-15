import { SuiClient as SuiSDKClient } from '@mysten/sui/client'
import type { SuiObjectChangeCreated, SuiTransactionBlockResponse } from '@mysten/sui/client'
import { Transaction } from '@mysten/sui/transactions'
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519'
import { config } from '../config.js'

interface MintCertificateInput {
  datasetId: string
  ownerAddress: string
  walrusBlobId: string
  sha256: string
  poseidon: string
  license: string
  categories: string[]
  minStake?: number
}

interface RecordAccessInput {
  datasetId: string
  requester: string
  purpose: string
  certificateId?: string
  stakeAmount?: number
}

interface UpdateTrustScoreInput {
  datasetId: string
  provenanceScore: number
  integrityScore: number
  auditScore: number
  usageScore: number
  verifiedByNautilus: boolean
}

interface UpdateTrustScoreWithNautilusInput extends UpdateTrustScoreInput {
  blobId: string
  expectedSha256: string
  computedSha256: string
  verified: boolean
  blobSize: number
  walrusGateway: string
  timestampMs: number
  signature: string
}

interface FileClaimInput {
  datasetId: string
  severity: number  // 0=info, 1=warning, 2=critical
  statement: string
  evidenceUri: string
}

export class SuiClient {
  private client: SuiSDKClient
  private keypair: Ed25519Keypair | null = null

  constructor() {
    this.client = new SuiSDKClient({ url: config.suiFullnode })

    // Try to load keypair from env or generate one
    try {
      if (process.env.SUI_PRIVATE_KEY) {
        const privKey = process.env.SUI_PRIVATE_KEY

        // Support both bech32 (suiprivkey1...) and hex formats
        if (privKey.startsWith('suiprivkey1')) {
          // Bech32 format - use fromSecretKey with the bech32 string
          this.keypair = Ed25519Keypair.fromSecretKey(privKey)
        } else {
          // Hex format
          const secretKey = Buffer.from(privKey, 'hex')
          this.keypair = Ed25519Keypair.fromSecretKey(secretKey)
        }
        console.log('✅ Sui keypair loaded successfully')
      } else {
        console.warn('⚠️  No SUI_PRIVATE_KEY found, using mock mode for Sui transactions')
      }
    } catch (e) {
      console.warn('⚠️  Failed to load Sui keypair, using mock mode:', (e as Error).message)
    }
  }

  async mintCertificate(input: MintCertificateInput): Promise<{ certificateId: string; digest?: string }> {
    if (!this.keypair) {
      // Mock mode - return fake certificate
      console.log('📝 Mock: Would mint certificate for', input.datasetId)
      return { certificateId: `0xmock_cert_${input.datasetId}_${Date.now()}`, digest: undefined }
    }

    try {
      const tx = new Transaction()

      // Convert sha256 and poseidon to vector<u8>
      const sha256Bytes = Array.from(Buffer.from(input.sha256, 'hex'))
      const poseidonBytes = Array.from(Buffer.from(input.poseidon, 'hex'))

      // Call mint_certificate function
      tx.moveCall({
        target: `${config.suiPackageId}::dataset_certificate::mint_certificate`,
        arguments: [
          tx.pure('string', input.datasetId),
          tx.pure('string', input.walrusBlobId),
          tx.pure('vector<u8>', sha256Bytes),
          tx.pure('vector<u8>', poseidonBytes),
          tx.pure('string', input.license),
          tx.pure('vector<string>', input.categories),
          tx.pure('string', 'stake_gated'), // seal_policy
          tx.pure('u64', BigInt(input.minStake ?? 0)), // min_stake
        ],
      })

      const result: SuiTransactionBlockResponse = await this.client.signAndExecuteTransaction({
        signer: this.keypair,
        transaction: tx,
        options: {
          showEffects: true,
          showObjectChanges: true,
        },
      })

      // Extract certificate ID from created objects
      const createdObjects = (result.objectChanges ?? []).filter(
        (change): change is SuiObjectChangeCreated => change.type === 'created'
      )

      const certificateObject = createdObjects.find(obj =>
        obj.objectType?.includes('DatasetCertificate')
      )

      let certificateId = certificateObject?.objectId
      if (!certificateId) {
        console.warn('⚠️  Could not locate created DatasetCertificate object, returning mock id')
        certificateId = `mock-${result.digest}`
      }

      console.log('✅ Certificate minted:', certificateId)
      console.log('   Transaction:', result.digest)

      return { certificateId, digest: result.digest }
    } catch (error) {
      console.error('❌ Sui mint certificate error:', error)
      // Fallback to mock
      return { certificateId: `0xmock_fallback_${input.datasetId}_${Date.now()}`, digest: undefined }
    }
  }

  async recordAccess(input: RecordAccessInput): Promise<{ tx: string }> {
    const hasUsableCert = this.isValidObjectId(input.certificateId)
    const hasAccessCap = this.isValidObjectId(config.suiAccessRecorderCap)
    const hasAccessRegistry = this.isValidObjectId(config.suiAccessRegistry)

    if (!this.keypair || !hasUsableCert || !hasAccessCap || !hasAccessRegistry) {
      // Mock mode
      console.log('📝 Mock: Would record access for', input.datasetId)
      return { tx: `0xmock_access_${Date.now()}` }
    }

    try {
      const tx = new Transaction()

      tx.moveCall({
        target: `${config.suiPackageId}::dataset_certificate::record_access`,
        arguments: [
          tx.object(config.suiAccessRecorderCap), // Pass capability first
          tx.object(config.suiAccessRegistry),    // Pass AccessRegistry
          tx.object(input.certificateId!),
          tx.pure('string', input.purpose),
          tx.pure('u64', BigInt(input.stakeAmount ?? 0)),
        ],
      })

      const result = await this.client.signAndExecuteTransaction({
        signer: this.keypair,
        transaction: tx,
        options: {
          showEffects: true,
        },
      })

      console.log('✅ Access recorded:', result.digest)
      return { tx: result.digest }
    } catch (error) {
      console.error('❌ Sui record access error:', error)
      return { tx: `0xmock_fallback_access_${Date.now()}` }
    }
  }

  async updateTrustScore(input: UpdateTrustScoreInput): Promise<string> {
    const hasOracleCap = this.isValidObjectId(config.suiOracleCap)
    const hasTrustOracle = this.isValidObjectId(config.suiTrustOracle)

    if (!this.keypair || !hasOracleCap || !hasTrustOracle) {
      // Mock mode
      console.log('📝 Mock: Would update trust score for', input.datasetId, 'to',
        input.provenanceScore + input.integrityScore + input.auditScore + input.usageScore)
      return `0xmock_trust_${Date.now()}`
    }

    try {
      const tx = new Transaction()

      tx.moveCall({
        target: `${config.suiPackageId}::dataset_certificate::update_trust_score`,
        arguments: [
          tx.object(config.suiOracleCap),      // OracleCap capability
          tx.object(config.suiTrustOracle),    // TrustOracle shared object
          tx.pure('string', input.datasetId),
          tx.pure('u8', input.provenanceScore),
          tx.pure('u8', input.integrityScore),
          tx.pure('u8', input.auditScore),
          tx.pure('u8', input.usageScore),
          tx.pure('bool', input.verifiedByNautilus),
        ],
      })

      const result = await this.client.signAndExecuteTransaction({
        signer: this.keypair,
        transaction: tx,
        options: {
          showEffects: true,
        },
      })

      console.log('✅ Trust score updated:', result.digest)
      console.log('   Dataset:', input.datasetId)
      console.log('   Score:', input.provenanceScore + input.integrityScore + input.auditScore + input.usageScore)
      return result.digest
    } catch (error) {
      console.error('❌ Sui update trust score error:', error)
      return `0xmock_fallback_trust_${Date.now()}`
    }
  }

  private isValidObjectId(value?: string): boolean {
    if (!value) return false
    return /^0x[0-9a-fA-F]{64}$/.test(value)
  }

  async updateTrustScoreWithNautilus(input: UpdateTrustScoreWithNautilusInput): Promise<string> {
    const hasOracleCap = this.isValidObjectId(config.suiOracleCap)
    const hasTrustOracle = this.isValidObjectId(config.suiTrustOracle)
    const hasVerifier = this.isValidObjectId(config.suiNautilusVerifier)

    if (!this.keypair || !hasOracleCap || !hasTrustOracle || !hasVerifier) {
      console.log('📝 Mock: Would update trust score with Nautilus proof for', input.datasetId)
      return `0xmock_trust_nautilus_${Date.now()}`
    }

    try {
      const tx = new Transaction()

      tx.moveCall({
        target: `${config.suiPackageId}::dataset_certificate::update_trust_score_with_nautilus`,
        arguments: [
          tx.object(config.suiOracleCap),
          tx.object(config.suiTrustOracle),
          tx.object(config.suiNautilusVerifier),
          tx.pure('string', input.datasetId),
          tx.pure('u8', input.provenanceScore),
          tx.pure('u8', input.integrityScore),
          tx.pure('u8', input.auditScore),
          tx.pure('u8', input.usageScore),
          tx.pure('string', input.blobId),
          tx.pure('string', input.expectedSha256),
          tx.pure('string', input.computedSha256),
          tx.pure('bool', input.verified),
          tx.pure('u64', BigInt(input.blobSize)),
          tx.pure('string', input.walrusGateway),
          tx.pure('u64', BigInt(input.timestampMs)),
          tx.pure('vector<u8>', Array.from(Buffer.from(input.signature, 'hex'))),
        ],
      })

      const result = await this.client.signAndExecuteTransaction({
        signer: this.keypair,
        transaction: tx,
        options: { showEffects: true },
      })

      console.log('✅ Nautilus trust score updated:', result.digest)
      return result.digest
    } catch (error) {
      console.error('❌ Sui update trust score with Nautilus error:', error)
      return `0xmock_fallback_nautilus_${Date.now()}`
    }
  }

  async fileClaim(input: FileClaimInput): Promise<string> {
    if (!this.keypair) {
      console.error('❌ Sui fileClaim error: Keypair not initialized')
      return `0xmock_fallback_claim_${Date.now()}`
    }

    try {
      const tx = new Transaction()

      tx.moveCall({
        target: `${config.suiPackageId}::dataset_certificate::file_claim`,
        arguments: [
          tx.object(config.suiClaimRegistry),
          tx.pure.string(input.datasetId),
          tx.pure.u8(input.severity),
          tx.pure.string(input.statement),
          tx.pure.string(input.evidenceUri || ''),
        ],
      })

      const result = await this.client.signAndExecuteTransaction({
        signer: this.keypair,
        transaction: tx,
        options: { showEffects: true },
      })

      console.log('✅ Claim filed on-chain:', result.digest)
      return result.digest
    } catch (error) {
      console.error('❌ Sui fileClaim error:', error)
      return `0xmock_fallback_claim_${Date.now()}`
    }
  }
}

export const suiClient = new SuiClient()
