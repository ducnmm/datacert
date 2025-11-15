import dotenv from 'dotenv'

dotenv.config()

export const config = {
  port: Number(process.env.PORT ?? 4000),
  walrusApiKey: process.env.WALRUS_API_KEY ?? 'demo-key',
  walrusGateway: process.env.WALRUS_GATEWAY ?? 'https://api.walrus.xyz',
  walrusCliPath: process.env.WALRUS_CLI_PATH ?? 'walrus',
  walrusForceMock: process.env.WALRUS_FORCE_MOCK === 'true',
  suiFullnode: process.env.SUI_FULLNODE ?? 'https://fullnode.devnet.sui.io',
  suiPackageId: process.env.SUI_PACKAGE_ID ?? '0xabc',
  suiClaimRegistry: process.env.SUI_CLAIM_REGISTRY ?? '0x0',
  suiClaimRegistryVersion: process.env.SUI_CLAIM_REGISTRY_VERSION ?? '0',
  suiAccessRegistry: process.env.SUI_ACCESS_REGISTRY ?? '0x0',
  suiAccessRecorderCap: process.env.SUI_ACCESS_RECORDER_CAP ?? '0x0',
  suiTrustOracle: process.env.SUI_TRUST_ORACLE ?? '0x0',
  suiOracleCap: process.env.SUI_ORACLE_CAP ?? '0x0',
  suiNautilusVerifier: process.env.SUI_NAUTILUS_VERIFIER ?? '0x0',
  appBaseUrl: process.env.APP_BASE_URL ?? 'http://localhost:4000',
  nautilusServerUrl: process.env.NAUTILUS_SERVER_URL ?? '',
  nautilusWalrusGateway: process.env.NAUTILUS_WALRUS_GATEWAY
}
