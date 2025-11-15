import { createUploadSession, registerDataset } from '../services/datasetService.js'

async function main() {
  const base64 = Buffer.from('example walrus dataset payload').toString('base64')
  const upload = await createUploadSession({
    fileName: 'sample-dataset.csv',
    mimeType: 'text/csv',
    contentBase64: base64
  })

  await registerDataset({
    sessionId: upload.sessionId,
    ownerAddress: '0xcreator',
    title: 'Coastal Walrus Imagery v1',
    description: 'High-resolution imagery with consented annotations for haulout monitoring',
    categories: ['imagery', 'ecology'],
    tags: ['walrus', 'satellite', 'climate'],
    license: 'CC-BY-NC-4.0',
    sensitivity: 'restricted',
    accessPolicy: {
      type: 'stake_gated',
      minStake: 50
    }
  })

  console.log('Seeded demo dataset')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
