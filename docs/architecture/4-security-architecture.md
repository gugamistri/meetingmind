# 4. Security Architecture

## 4.1 Privacy-First Design

### Local Data Processing
- **Default Behavior**: All transcription happens locally using Whisper models
- **User Control**: Explicit consent required for external API usage
- **Data Minimization**: Only necessary data sent to external services
- **Transparency**: Clear indication when data leaves the device

### Device-Based Authentication
```rust
struct DeviceAuth {
    device_id: String,
    hardware_fingerprint: String,
    install_date: DateTime<Utc>,
    app_version: String,
}

impl DeviceAuth {
    fn generate_device_id() -> String {
        let machine_id = machine_uid::get().unwrap_or_default();
        let install_uuid = Uuid::new_v4();
        format!("{}_{}", machine_id, install_uuid)
    }
    
    async fn validate_session(&self) -> Result<bool> {
        // Verify device integrity
        // Check app signature
        // Validate local data consistency
    }
}
```

## 4.2 Data Encryption

### Encryption at Rest
```rust
struct DataEncryption {
    key_derivation: Scrypt,
    cipher: ChaCha20Poly1305,
    secure_key_store: SecureKeyStore,
}

impl DataEncryption {
    async fn encrypt_sensitive_data(&self, data: &[u8]) -> Result<Vec<u8>> {
        let key = self.derive_encryption_key().await?;
        let nonce = ChaCha20Poly1305::generate_nonce(&mut OsRng);
        
        let cipher = ChaCha20Poly1305::new(&key);
        cipher.encrypt(&nonce, data).map_err(Into::into)
    }
    
    async fn setup_database_encryption(&self) -> Result<()> {
        // Use SQLCipher for database encryption
        // Encrypt audio files with ChaCha20Poly1305
        // Maintain performance for search indexes
    }
}
```

### Encryption in Transit
- **TLS 1.3**: All external API communications
- **Certificate Pinning**: Prevent man-in-the-middle attacks
- **Request Signing**: Verify request integrity
- **Rate Limiting**: Prevent API abuse

## 4.3 PII Detection and Protection

### Automated PII Detection
```rust
#[derive(Debug, Serialize, Deserialize)]
struct PIIClassification {
    text: String,
    pii_detected: Vec<PIIType>,
    confidence: f32,
    redaction_applied: bool,
}

enum PIIType {
    EmailAddress,
    PhoneNumber,
    SocialSecurityNumber,
    CreditCardNumber,
    PersonalName,
    Address,
    IPAddress,
}

impl PIIDetector {
    async fn scan_transcription(&self, text: &str) -> PIIClassification {
        // Regex pattern matching for common PII types
        // ML-based detection for names and addresses
        // Confidence scoring for manual review
        // Automatic redaction for high-confidence matches
    }
}
```

### User Data Control
- **Granular Permissions**: Control what data can be processed externally
- **Audit Trail**: Log all data processing activities
- **Right to Delete**: Complete data removal on user request
- **Data Export**: Full data portability in standard formats

---
