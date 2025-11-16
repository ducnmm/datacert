#!/bin/bash
# Setup Walrus and Sui configuration at runtime

CONFIG_DIR="/root/.config/walrus"
SUI_CONFIG_DIR="/root/.sui/sui_config"
KEYSTORE_FILE="$SUI_CONFIG_DIR/sui.keystore"
CONFIG_FILE="$CONFIG_DIR/client_config.yaml"

# Create config directories
mkdir -p "$CONFIG_DIR"
mkdir -p "$SUI_CONFIG_DIR"

# Generate Sui keystore and client config from SUI_PRIVATE_KEY
if [ -n "$SUI_PRIVATE_KEY" ]; then
  # Create Sui keystore with the private key (proper JSON format)
  cat > "$KEYSTORE_FILE" << EOF
[
  "$SUI_PRIVATE_KEY"
]
EOF

  # Create Sui client config
  cat > "$SUI_CONFIG_DIR/client.yaml" << EOF
---
keystore:
  File: $KEYSTORE_FILE
external_keys: ~
envs:
  - alias: testnet
    rpc: "https://fullnode.testnet.sui.io:443"
    ws: ~
    basic_auth: ~
active_env: testnet
EOF

  # Create Walrus config with proper context structure
  cat > "$CONFIG_FILE" << 'EOF'
contexts:
  testnet:
    system_object: 0x6c2547cbbc38025cf3adac45f63cb0a8d12ecf777cdc75a4971612bf97fdf6af
    staking_object: 0xbe46180321c30aab2f8b3501e24048377287fa708018a5b7c2792b35fe339ee3
    wallet_config:
      active_env: testnet
    rpc_urls:
      - https://fullnode.testnet.sui.io:443
default_context: testnet
EOF

  echo "✅ Walrus config created at $CONFIG_FILE"
  echo "✅ Sui client config created at $SUI_CONFIG_DIR/client.yaml"
  echo "✅ Sui keystore created at $KEYSTORE_FILE"
else
  echo "⚠️ SUI_PRIVATE_KEY not set, Walrus will use mock mode"
fi
