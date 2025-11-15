// Copyright (c), Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

use crate::common::{
    to_signed_response, IntentMessage, IntentScope, ProcessDataRequest, ProcessedDataResponse,
};
use crate::{AppState, EnclaveError};
use axum::{extract::State, Json};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

const DEFAULT_WALRUS_GATEWAY: &str = "https://api.walrus.xyz";

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WalrusVerificationResult {
    pub blob_id: String,
    pub expected_sha256: String,
    pub computed_sha256: String,
    pub verified: bool,
    pub blob_size: u64,
    pub walrus_gateway: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WalrusVerificationRequest {
    pub blob_id: String,
    pub expected_sha256: String,
    pub walrus_gateway: Option<String>,
}

pub async fn process_data(
    State(state): State<Arc<AppState>>,
    Json(request): Json<ProcessDataRequest<WalrusVerificationRequest>>,
) -> Result<Json<ProcessedDataResponse<IntentMessage<WalrusVerificationResult>>>, EnclaveError> {
    let normalized_expected = normalize_hex(&request.payload.expected_sha256)?;
    let walrus_gateway = request
        .payload
        .walrus_gateway
        .as_deref()
        .unwrap_or(DEFAULT_WALRUS_GATEWAY)
        .trim_end_matches('/')
        .to_string();
    let blob_url = format!("{}/v1/blobs/{}", walrus_gateway, request.payload.blob_id);

    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| EnclaveError::GenericError(format!("Failed to init HTTP client: {}", e)))?;

    let response = client.get(&blob_url).send().await.map_err(|e| {
        EnclaveError::GenericError(format!(
            "Failed to download Walrus blob {}: {}",
            request.payload.blob_id, e
        ))
    })?;

    if !response.status().is_success() {
        return Err(EnclaveError::GenericError(format!(
            "Walrus gateway {} returned {} for blob {}",
            walrus_gateway,
            response.status(),
            request.payload.blob_id
        )));
    }

    let blob_bytes = response.bytes().await.map_err(|e| {
        EnclaveError::GenericError(format!(
            "Failed to read Walrus blob {}: {}",
            request.payload.blob_id, e
        ))
    })?;

    let mut hasher = Sha256::new();
    hasher.update(&blob_bytes);
    let digest = hasher.finalize();
    let computed_sha256 = format!("{:x}", digest);
    let verified = computed_sha256.eq_ignore_ascii_case(&normalized_expected);

    let timestamp_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| EnclaveError::GenericError(format!("Invalid system time: {}", e)))?
        .as_millis() as u64;

    Ok(Json(to_signed_response(
        &state.eph_kp,
        WalrusVerificationResult {
            blob_id: request.payload.blob_id,
            expected_sha256: normalized_expected,
            computed_sha256,
            verified,
            blob_size: blob_bytes.len() as u64,
            walrus_gateway,
        },
        timestamp_ms,
        IntentScope::ProcessData,
    )))
}

fn normalize_hex(input: &str) -> Result<String, EnclaveError> {
    let trimmed = input.trim().trim_start_matches("0x");
    if trimmed.is_empty() {
        return Err(EnclaveError::GenericError(
            "expected_sha256 is required".to_string(),
        ));
    }
    if trimmed.len() % 2 != 0 || !trimmed.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err(EnclaveError::GenericError(format!(
            "expected_sha256 must be valid hex, got {}",
            input
        )));
    }
    Ok(trimmed.to_ascii_lowercase())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::common::IntentMessage;
    use axum::{extract::State, Json};
    use fastcrypto::{ed25519::Ed25519KeyPair, traits::KeyPair};

    #[tokio::test]
    async fn normalize_rejects_invalid_hex() {
        assert!(normalize_hex("zz").is_err());
        assert!(normalize_hex("").is_err());
        assert!(normalize_hex("0x1").is_err());
    }

    #[tokio::test]
    async fn normalize_accepts_prefixed() {
        assert_eq!(normalize_hex("0xABCD").unwrap(), "abcd".to_string());
    }

    #[tokio::test]
    async fn signing_wraps_response() {
        let state = Arc::new(AppState {
            eph_kp: Ed25519KeyPair::generate(&mut rand::thread_rng()),
            api_key: String::new(),
        });

        let payload = WalrusVerificationResult {
            blob_id: "blob".to_string(),
            expected_sha256: "deadbeef".to_string(),
            computed_sha256: "deadbeef".to_string(),
            verified: true,
            blob_size: 0,
            walrus_gateway: DEFAULT_WALRUS_GATEWAY.to_string(),
        };

        let signed =
            to_signed_response(&state.eph_kp, payload.clone(), 1, IntentScope::ProcessData);
        assert_eq!(signed.response.data.blob_id, payload.blob_id);
        assert!(!signed.signature.is_empty());
    }
}
