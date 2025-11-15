module datacert_certificates::dataset_certificate {
    use std::string::String;
    use std::option::{Self, Option};
    use std::vector;
    use sui::event;
    use sui::table::{Self, Table};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::object::{Self, UID, ID};
    use sui::clock::{Self, Clock};
    use sui::nitro_attestation;
    use sui::ed25519;
    use sui::bcs;

    const STATUS_CERTIFIED: u8 = 1;
    const STATUS_DISPUTED: u8 = 2;
    const INTENT_PROCESS_DATA: u8 = 0;

    const ENAUTILUS_NOT_INITIALIZED: u64 = 10;
    const ENAUTILUS_INVALID_SIGNATURE: u64 = 11;
    const ENAUTILUS_PCR_MISMATCH: u64 = 12;
    const ENAUTILUS_NO_PUBLIC_KEY: u64 = 13;
    const ENAUTILUS_NOT_AUTHORIZED: u64 = 14;

    /// Main certificate object minted per dataset.
    public struct DatasetCertificate has key, store {
        id: UID,
        dataset_id: String,
        owner: address,
        walrus_blob: String,
        sha256: vector<u8>,
        poseidon: vector<u8>,
        license: String,
        categories: vector<String>,
        seal_policy: String,
        min_stake: u64,
        status: u8,
    }

    /// Claim data persisted in the registry and emitted as events.
    public struct Claim has store {
        id: u64,
        dataset_id: String,
        claimant: address,
        severity: u8,
        statement: String,
        evidence_uri: String,
    }

    public struct ClaimRegistry has key {
        id: UID,
        records: vector<Claim>,
        counter: u64,
    }

    /// Access record data persisted in the registry.
    public struct AccessRecord has store {
        id: u64,
        dataset_id: String,
        certificate_id: ID,
        requester: address,
        purpose: String,
        stake_amount: u64,
        timestamp: u64,
    }

    public struct AccessRegistry has key {
        id: UID,
        records: vector<AccessRecord>,
        counter: u64,
    }

    /// Capability that allows recording access to certificates
    public struct AccessRecorderCap has key {
        id: UID,
    }

    /// Trust score data for each dataset
    public struct TrustScore has store, copy, drop {
        dataset_id: String,
        score: u64,  // 0-100
        provenance_score: u8,  // 0-25
        integrity_score: u8,   // 0-25
        audit_score: u8,       // 0-25
        usage_score: u8,       // 0-25
        last_updated: u64,
        verified_by_nautilus: bool,
    }

    /// Shared registry for trust scores
    public struct TrustOracle has key {
        id: UID,
        scores: Table<String, TrustScore>,  // dataset_id -> TrustScore
    }

    /// Capability that allows updating trust scores
    public struct OracleCap has key {
        id: UID,
    }

    public struct CertificateMinted has copy, drop {
        dataset_id: String,
        certificate_id: ID,
        owner: address,
        walrus_blob: String,
    }

    public struct ClaimRaised has copy, drop {
        dataset_id: String,
        claim_id: u64,
        severity: u8,
        claimant: address,
    }

    public struct AccessGranted has copy, drop {
        dataset_id: String,
        requester: address,
        walrus_blob: String,
        purpose: String,
        stake_amount: u64,
    }

    public struct TrustScoreUpdated has copy, drop {
        dataset_id: String,
        score: u64,
        provenance_score: u8,
        integrity_score: u8,
        audit_score: u8,
        usage_score: u8,
        verified_by_nautilus: bool,
    }

    /// Stores expected PCR measurements and attestation-derived public key.
    public struct NautilusVerifier has key {
        id: UID,
        admin: address,
        expected_pcrs: vector<vector<u8>>,
        enclave_public_key: Option<vector<u8>>,
        last_attestation: Option<vector<u8>>,
    }

    public struct NautilusVerificationRecorded has copy, drop {
        dataset_id: String,
        blob_id: String,
        timestamp_ms: u64,
        verified: bool,
    }

    public struct WalrusVerificationResult has copy, drop, store {
        blob_id: String,
        expected_sha256: String,
        computed_sha256: String,
        verified: bool,
        blob_size: u64,
        walrus_gateway: String,
    }

    public struct IntentEnvelope has copy, drop, store {
        intent: u8,
        timestamp_ms: u64,
        data: WalrusVerificationResult,
    }

    /// Publish shared registries for claims and access records.
    /// Also create and send AccessRecorderCap to the publisher (backend service).
    fun init(ctx: &mut TxContext) {
        // Create and share ClaimRegistry
        let claim_registry = ClaimRegistry {
            id: object::new(ctx),
            records: vector::empty<Claim>(),
            counter: 0,
        };
        transfer::share_object(claim_registry);

        // Create and share AccessRegistry
        let access_registry = AccessRegistry {
            id: object::new(ctx),
            records: vector::empty<AccessRecord>(),
            counter: 0,
        };
        transfer::share_object(access_registry);

        // Create and share TrustOracle
        let trust_oracle = TrustOracle {
            id: object::new(ctx),
            scores: table::new<String, TrustScore>(ctx),
        };
        transfer::share_object(trust_oracle);

        // Send AccessRecorderCap to publisher (backend)
        transfer::transfer(AccessRecorderCap {
            id: object::new(ctx)
        }, ctx.sender());

        // Send OracleCap to publisher (backend)
        transfer::transfer(OracleCap {
            id: object::new(ctx)
        }, ctx.sender());
    }

    /// Publish Nautilus verifier object that stores attestation configuration.
    public entry fun init_nautilus_verifier(expected_pcrs: vector<vector<u8>>, ctx: &mut TxContext) {
        let verifier = NautilusVerifier {
            id: object::new(ctx),
            admin: ctx.sender(),
            expected_pcrs,
            enclave_public_key: option::none(),
            last_attestation: option::none(),
        };
        transfer::share_object(verifier);
    }

    public entry fun update_nautilus_pcrs(
        verifier: &mut NautilusVerifier,
        expected_pcrs: vector<vector<u8>>,
        ctx: &mut TxContext,
    ) {
        assert_is_admin(verifier, ctx.sender());
        verifier.expected_pcrs = expected_pcrs;
    }

    /// Register enclave public key directly (for dev/hackathon without AWS Nitro)
    public entry fun register_nautilus_public_key(
        verifier: &mut NautilusVerifier,
        public_key: vector<u8>,
        ctx: &mut TxContext,
    ) {
        assert_is_admin(verifier, ctx.sender());
        assert!(vector::length(&public_key) == 32, ENAUTILUS_NO_PUBLIC_KEY);
        verifier.enclave_public_key = option::some(public_key);
    }

    fun assert_is_admin(verifier: &NautilusVerifier, sender: address) {
        assert!(verifier.admin == sender, ENAUTILUS_NOT_AUTHORIZED);
    }

    fun validate_pcrs(
        expected: &vector<vector<u8>>,
        document: &nitro_attestation::NitroAttestationDocument,
    ) {
        if (vector::length(expected) == 0) {
            return
        };
        let entries = nitro_attestation::pcrs(document);
        let len = vector::length(expected);
        let mut i = 0;
        while (i < len) {
            let target = vector::borrow(expected, i);
            if (vector::length(target) > 0) {
                let actual = borrow_pcr_value(entries, i as u8);
                assert!(vector::length(&actual) > 0, ENAUTILUS_PCR_MISMATCH);
                assert!(vectors_equal(target, &actual), ENAUTILUS_PCR_MISMATCH);
            };
            i = i + 1;
        };
    }

    fun borrow_pcr_value(
        entries: &vector<nitro_attestation::PCREntry>,
        idx: u8,
    ): vector<u8> {
        let len = vector::length(entries);
        let mut i = 0;
        while (i < len) {
            let entry = vector::borrow(entries, i);
            if (nitro_attestation::index(entry) == idx) {
                return clone_vector(nitro_attestation::value(entry));
            };
            i = i + 1;
        };
        vector::empty()
    }

    fun vectors_equal(a: &vector<u8>, b: &vector<u8>): bool {
        if (vector::length(a) != vector::length(b)) {
            return false
        };
        let mut i = 0;
        let len = vector::length(a);
        while (i < len) {
            if (*vector::borrow(a, i) != *vector::borrow(b, i)) {
                return false
            };
            i = i + 1;
        };
        true
    }

    fun clone_vector(data: &vector<u8>): vector<u8> {
        let mut result = vector::empty<u8>();
        let len = vector::length(data);
        let mut i = 0;
        while (i < len) {
            vector::push_back(&mut result, *vector::borrow(data, i));
            i = i + 1;
        };
        result
    }

    /// Mint a new certificate object and emit an event for the off-chain indexer.
    public entry fun mint_certificate(
        dataset_id: String,
        walrus_blob: String,
        sha256: vector<u8>,
        poseidon: vector<u8>,
        license: String,
        categories: vector<String>,
        seal_policy: String,
        min_stake: u64,
        ctx: &mut TxContext,
    ) {
        let sender = ctx.sender();
        let certificate = DatasetCertificate {
            id: object::new(ctx),
            dataset_id,
            owner: sender,
            walrus_blob,
            sha256,
            poseidon,
            license,
            categories,
            seal_policy,
            min_stake,
            status: STATUS_CERTIFIED,
        };
        let cert_id = object::id(&certificate);
        event::emit(CertificateMinted {
            dataset_id: certificate.dataset_id,
            certificate_id: cert_id,
            owner: sender,
            walrus_blob: certificate.walrus_blob,
        });
        transfer::public_transfer(certificate, sender);
    }

    /// Allow auditors to append claims on-chain.
    public entry fun file_claim(
        registry: &mut ClaimRegistry,
        dataset_id: String,
        severity: u8,
        statement: String,
        evidence_uri: String,
        ctx: &mut TxContext,
    ) {
        let claim_id = registry.counter;
        registry.counter = claim_id + 1;
        let claimant = ctx.sender();
        let claim = Claim {
            id: claim_id,
            dataset_id,
            claimant,
            severity,
            statement,
            evidence_uri,
        };
        event::emit(ClaimRaised {
            dataset_id: claim.dataset_id,
            claim_id,
            severity,
            claimant,
        });
        registry.records.push_back(claim);
    }

    /// Dataset owner can toggle disputed status (e.g., after automated alerts).
    public entry fun mark_disputed(certificate: &mut DatasetCertificate) {
        certificate.status = STATUS_DISPUTED;
    }

    public entry fun restore_certificate(certificate: &mut DatasetCertificate) {
        certificate.status = STATUS_CERTIFIED;
    }

    /// Log gated access that was granted with on-chain stake validation.
    /// Requires AccessRecorderCap to ensure only authorized backend can record access.
    public entry fun record_access(
        _cap: &AccessRecorderCap,
        registry: &mut AccessRegistry,
        certificate: &DatasetCertificate,
        purpose: String,
        stake_amount: u64,
        ctx: &mut TxContext,
    ) {
        assert!(certificate.status == STATUS_CERTIFIED, 0);
        assert!(stake_amount >= certificate.min_stake, 1);

        // Create and store access record
        let record_id = registry.counter;
        let record = AccessRecord {
            id: record_id,
            dataset_id: certificate.dataset_id,
            certificate_id: object::id(certificate),
            requester: ctx.sender(),
            purpose,
            stake_amount,
            timestamp: ctx.epoch_timestamp_ms(),
        };
        registry.records.push_back(record);
        registry.counter = record_id + 1;

        // Emit event for off-chain indexer
        event::emit(AccessGranted {
            dataset_id: certificate.dataset_id,
            requester: ctx.sender(),
            walrus_blob: certificate.walrus_blob,
            purpose,
            stake_amount,
        });
    }

    /// Update trust score for a dataset. Only callable by oracle with OracleCap.
    public entry fun update_trust_score(
        _cap: &OracleCap,
        oracle: &mut TrustOracle,
        dataset_id: String,
        provenance_score: u8,
        integrity_score: u8,
        audit_score: u8,
        usage_score: u8,
        verified_by_nautilus: bool,
        ctx: &mut TxContext,
    ) {
        upsert_trust_score(
            oracle,
            copy dataset_id,
            provenance_score,
            integrity_score,
            audit_score,
            usage_score,
            verified_by_nautilus,
            ctx,
        );
    }

    /// Update trust score and emit on-chain proof validated by Nautilus.
    public entry fun update_trust_score_with_nautilus(
        _cap: &OracleCap,
        oracle: &mut TrustOracle,
        verifier: &NautilusVerifier,
        dataset_id: String,
        provenance_score: u8,
        integrity_score: u8,
        audit_score: u8,
        usage_score: u8,
        blob_id: String,
        expected_sha256: String,
        computed_sha256: String,
        verified: bool,
        blob_size: u64,
        walrus_gateway: String,
        timestamp_ms: u64,
        signature: vector<u8>,
        ctx: &mut TxContext,
    ) {
        assert!(option::is_some(&verifier.enclave_public_key), ENAUTILUS_NOT_INITIALIZED);
        let pk_ref = option::borrow(&verifier.enclave_public_key);

        let verification = WalrusVerificationResult {
            blob_id,
            expected_sha256,
            computed_sha256,
            verified,
            blob_size,
            walrus_gateway,
        };
        let blob_for_event = copy verification.blob_id;
        let intent = IntentEnvelope {
            intent: INTENT_PROCESS_DATA,
            timestamp_ms: timestamp_ms,
            data: verification,
        };
        let message_bytes = bcs::to_bytes(&intent);
        assert!(
            ed25519::ed25519_verify(&signature, pk_ref, &message_bytes),
            ENAUTILUS_INVALID_SIGNATURE
        );

        upsert_trust_score(
            oracle,
            copy dataset_id,
            provenance_score,
            integrity_score,
            audit_score,
            usage_score,
            true,
            ctx,
        );

        event::emit(NautilusVerificationRecorded {
            dataset_id,
            blob_id: blob_for_event,
            timestamp_ms,
            verified,
        });
    }

    /// Query trust score for a dataset
    public fun get_trust_score(oracle: &TrustOracle, dataset_id: String): Option<TrustScore> {
        if (table::contains(&oracle.scores, dataset_id)) {
            option::some(*table::borrow(&oracle.scores, dataset_id))
        } else {
            option::none()
        }
    }

    /// Internal helper to upsert trust score
    fun upsert_trust_score(
        oracle: &mut TrustOracle,
        dataset_id: String,
        provenance_score: u8,
        integrity_score: u8,
        audit_score: u8,
        usage_score: u8,
        verified_by_nautilus: bool,
        ctx: &mut TxContext,
    ) {
        let total_score = (provenance_score as u64) +
                         (integrity_score as u64) +
                         (audit_score as u64) +
                         (usage_score as u64);

        let trust_score = TrustScore {
            dataset_id: copy dataset_id,
            score: total_score,
            provenance_score,
            integrity_score,
            audit_score,
            usage_score,
            last_updated: ctx.epoch_timestamp_ms(),
            verified_by_nautilus,
        };

        if (table::contains(&oracle.scores, dataset_id)) {
            let _old_score = table::remove(&mut oracle.scores, dataset_id);
            table::add(&mut oracle.scores, dataset_id, trust_score);
            event::emit(TrustScoreUpdated {
                dataset_id,
                score: total_score,
                provenance_score,
                integrity_score,
                audit_score,
                usage_score,
                verified_by_nautilus,
            });
        } else {
            table::add(&mut oracle.scores, dataset_id, trust_score);
            event::emit(TrustScoreUpdated {
                dataset_id,
                score: total_score,
                provenance_score,
                integrity_score,
                audit_score,
                usage_score,
                verified_by_nautilus,
            });
        };
    }

    // ==============================
    // UNIT TESTS
    // ==============================

    #[test_only]
    use sui::test_scenario;

    #[test]
    fun test_init_creates_registries_and_caps() {
        let user = @0xCAFE;
        let mut scenario = test_scenario::begin(user);

        // Init should create shared registries and send caps to sender
        {
            let ctx = test_scenario::ctx(&mut scenario);
            init(ctx);
        };

        // Check ClaimRegistry was shared
        test_scenario::next_tx(&mut scenario, user);
        {
            assert!(test_scenario::has_most_recent_shared<ClaimRegistry>(), 0);
        };

        // Check AccessRegistry was shared
        {
            assert!(test_scenario::has_most_recent_shared<AccessRegistry>(), 1);
        };

        // Check TrustOracle was shared
        {
            assert!(test_scenario::has_most_recent_shared<TrustOracle>(), 2);
        };

        // Check AccessRecorderCap was sent to sender
        {
            assert!(test_scenario::has_most_recent_for_address<AccessRecorderCap>(user), 3);
        };

        // Check OracleCap was sent to sender
        {
            assert!(test_scenario::has_most_recent_for_address<OracleCap>(user), 4);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_mint_certificate() {
        let user = @0xCAFE;
        let mut scenario = test_scenario::begin(user);

        // Mint a certificate
        {
            let ctx = test_scenario::ctx(&mut scenario);
            mint_certificate(
                b"dataset-001".to_string(),
                b"blob-123".to_string(),
                vector[1u8, 2u8, 3u8],
                vector[4u8, 5u8, 6u8],
                b"MIT".to_string(),
                vector[b"AI".to_string(), b"ML".to_string()],
                b"stake_gated".to_string(),
                100u64,
                ctx
            );
        };

        // Check certificate was created and transferred to sender
        test_scenario::next_tx(&mut scenario, user);
        {
            assert!(test_scenario::has_most_recent_for_address<DatasetCertificate>(user), 0);
            let cert = test_scenario::take_from_sender<DatasetCertificate>(&scenario);

            assert!(cert.dataset_id == b"dataset-001".to_string(), 1);
            assert!(cert.walrus_blob == b"blob-123".to_string(), 2);
            assert!(cert.license == b"MIT".to_string(), 3);
            assert!(cert.min_stake == 100u64, 4);
            assert!(cert.status == STATUS_CERTIFIED, 5);

            test_scenario::return_to_sender(&scenario, cert);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_file_claim() {
        let user = @0xCAFE;
        let mut scenario = test_scenario::begin(user);

        // Init to create ClaimRegistry
        {
            let ctx = test_scenario::ctx(&mut scenario);
            init(ctx);
        };

        // File a claim
        test_scenario::next_tx(&mut scenario, user);
        {
            let mut registry = test_scenario::take_shared<ClaimRegistry>(&scenario);
            let ctx = test_scenario::ctx(&mut scenario);

            file_claim(
                &mut registry,
                b"dataset-001".to_string(),
                2u8, // warning severity
                b"Potential bias detected".to_string(),
                b"https://evidence.com".to_string(),
                ctx
            );

            assert!(registry.counter == 1, 0);
            assert!(registry.records.length() == 1, 1);

            test_scenario::return_shared(registry);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_update_trust_score() {
        let user = @0xCAFE;
        let mut scenario = test_scenario::begin(user);

        // Init to create TrustOracle and OracleCap
        {
            let ctx = test_scenario::ctx(&mut scenario);
            init(ctx);
        };

        // Update trust score
        test_scenario::next_tx(&mut scenario, user);
        {
            let oracle_cap = test_scenario::take_from_sender<OracleCap>(&scenario);
            let mut oracle = test_scenario::take_shared<TrustOracle>(&scenario);
            let ctx = test_scenario::ctx(&mut scenario);

            update_trust_score(
                &oracle_cap,
                &mut oracle,
                b"dataset-001".to_string(),
                25u8, // provenance
                20u8, // integrity
                25u8, // audit
                15u8, // usage
                true, // verified by nautilus
                ctx
            );

            // Verify score was stored
            let score_opt = get_trust_score(&oracle, b"dataset-001".to_string());
            assert!(score_opt.is_some(), 0);

            let score = score_opt.destroy_some();
            assert!(score.score == 85, 1); // 25+20+25+15
            assert!(score.provenance_score == 25, 2);
            assert!(score.integrity_score == 20, 3);
            assert!(score.audit_score == 25, 4);
            assert!(score.usage_score == 15, 5);
            assert!(score.verified_by_nautilus == true, 6);

            test_scenario::return_to_sender(&scenario, oracle_cap);
            test_scenario::return_shared(oracle);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_record_access_with_sufficient_stake() {
        let user = @0xCAFE;
        let mut scenario = test_scenario::begin(user);

        // Init and mint certificate
        {
            let ctx = test_scenario::ctx(&mut scenario);
            init(ctx);
        };

        test_scenario::next_tx(&mut scenario, user);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            mint_certificate(
                b"dataset-001".to_string(),
                b"blob-123".to_string(),
                vector[1u8, 2u8],
                vector[3u8, 4u8],
                b"MIT".to_string(),
                vector[b"AI".to_string()],
                b"stake_gated".to_string(),
                50u64, // min_stake = 50
                ctx
            );
        };

        // Record access with sufficient stake (100 >= 50)
        test_scenario::next_tx(&mut scenario, user);
        {
            let cert = test_scenario::take_from_sender<DatasetCertificate>(&scenario);
            let cap = test_scenario::take_from_sender<AccessRecorderCap>(&scenario);
            let mut registry = test_scenario::take_shared<AccessRegistry>(&scenario);
            let ctx = test_scenario::ctx(&mut scenario);

            record_access(
                &cap,
                &mut registry,
                &cert,
                b"Training ML model".to_string(),
                100u64, // stake >= min_stake
                ctx
            );

            assert!(registry.counter == 1, 0);
            assert!(registry.records.length() == 1, 1);

            test_scenario::return_to_sender(&scenario, cert);
            test_scenario::return_to_sender(&scenario, cap);
            test_scenario::return_shared(registry);
        };

        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 1)]
    fun test_record_access_with_insufficient_stake_fails() {
        let user = @0xCAFE;
        let mut scenario = test_scenario::begin(user);

        // Init and mint certificate
        {
            let ctx = test_scenario::ctx(&mut scenario);
            init(ctx);
        };

        test_scenario::next_tx(&mut scenario, user);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            mint_certificate(
                b"dataset-001".to_string(),
                b"blob-123".to_string(),
                vector[1u8, 2u8],
                vector[3u8, 4u8],
                b"MIT".to_string(),
                vector[b"AI".to_string()],
                b"stake_gated".to_string(),
                100u64, // min_stake = 100
                ctx
            );
        };

        // Try to record access with insufficient stake (50 < 100) - should fail!
        test_scenario::next_tx(&mut scenario, user);
        {
            let cert = test_scenario::take_from_sender<DatasetCertificate>(&scenario);
            let cap = test_scenario::take_from_sender<AccessRecorderCap>(&scenario);
            let mut registry = test_scenario::take_shared<AccessRegistry>(&scenario);
            let ctx = test_scenario::ctx(&mut scenario);

            record_access(
                &cap,
                &mut registry,
                &cert,
                b"Training ML model".to_string(),
                50u64, // stake < min_stake - SHOULD ABORT
                ctx
            );

            test_scenario::return_to_sender(&scenario, cert);
            test_scenario::return_to_sender(&scenario, cap);
            test_scenario::return_shared(registry);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_mark_disputed_and_restore() {
        let user = @0xCAFE;
        let mut scenario = test_scenario::begin(user);

        // Mint certificate
        {
            let ctx = test_scenario::ctx(&mut scenario);
            mint_certificate(
                b"dataset-001".to_string(),
                b"blob-123".to_string(),
                vector[1u8],
                vector[2u8],
                b"MIT".to_string(),
                vector[b"AI".to_string()],
                b"public".to_string(),
                0u64,
                ctx
            );
        };

        // Mark as disputed
        test_scenario::next_tx(&mut scenario, user);
        {
            let mut cert = test_scenario::take_from_sender<DatasetCertificate>(&scenario);
            mark_disputed(&mut cert);
            assert!(cert.status == STATUS_DISPUTED, 0);
            test_scenario::return_to_sender(&scenario, cert);
        };

        // Restore
        test_scenario::next_tx(&mut scenario, user);
        {
            let mut cert = test_scenario::take_from_sender<DatasetCertificate>(&scenario);
            restore_certificate(&mut cert);
            assert!(cert.status == STATUS_CERTIFIED, 1);
            test_scenario::return_to_sender(&scenario, cert);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_trust_score_update_overwrites_previous() {
        let user = @0xCAFE;
        let mut scenario = test_scenario::begin(user);

        // Init
        {
            let ctx = test_scenario::ctx(&mut scenario);
            init(ctx);
        };

        // First update
        test_scenario::next_tx(&mut scenario, user);
        {
            let oracle_cap = test_scenario::take_from_sender<OracleCap>(&scenario);
            let mut oracle = test_scenario::take_shared<TrustOracle>(&scenario);
            let ctx = test_scenario::ctx(&mut scenario);

            update_trust_score(
                &oracle_cap,
                &mut oracle,
                b"dataset-001".to_string(),
                10u8, 10u8, 10u8, 10u8,
                false,
                ctx
            );

            let score = get_trust_score(&oracle, b"dataset-001".to_string()).destroy_some();
            assert!(score.score == 40, 0);

            test_scenario::return_to_sender(&scenario, oracle_cap);
            test_scenario::return_shared(oracle);
        };

        // Second update - should overwrite
        test_scenario::next_tx(&mut scenario, user);
        {
            let oracle_cap = test_scenario::take_from_sender<OracleCap>(&scenario);
            let mut oracle = test_scenario::take_shared<TrustOracle>(&scenario);
            let ctx = test_scenario::ctx(&mut scenario);

            update_trust_score(
                &oracle_cap,
                &mut oracle,
                b"dataset-001".to_string(),
                25u8, 25u8, 25u8, 25u8,
                true,
                ctx
            );

            let score = get_trust_score(&oracle, b"dataset-001".to_string()).destroy_some();
            assert!(score.score == 100, 1); // Should be updated to 100
            assert!(score.verified_by_nautilus == true, 2);

            test_scenario::return_to_sender(&scenario, oracle_cap);
            test_scenario::return_shared(oracle);
        };

        test_scenario::end(scenario);
    }
}
