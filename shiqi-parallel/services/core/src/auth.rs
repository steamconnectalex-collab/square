use jsonwebtoken::{decode, decode_header, jwk::JwkSet, Algorithm, DecodingKey, Validation};
use serde::Deserialize;
use std::{
    env,
    sync::Arc,
    time::{Duration, Instant},
};
use tokio::sync::RwLock;

const JWKS_CACHE_TTL: Duration = Duration::from_secs(10 * 60);
const UNKNOWN_KID_REFRESH_COOLDOWN: Duration = Duration::from_secs(30);
const HTTP_TIMEOUT: Duration = Duration::from_secs(5);

#[derive(Debug, thiserror::Error)]
pub enum AuthError {
    #[error("invalid Supabase JWT configuration")]
    InvalidConfig,
    #[error("invalid or unsupported bearer token")]
    InvalidToken,
    #[error("Supabase JWKS endpoint is unavailable or invalid")]
    JwksUnavailable,
    #[error("HTTP request failed: {0}")]
    Http(#[from] reqwest::Error),
    #[error("JWT verification failed: {0}")]
    Jwt(#[from] jsonwebtoken::errors::Error),
}

#[derive(Debug, Deserialize)]
pub struct SupabaseClaims {
    pub sub: String,
    pub role: String,
    pub iss: String,
    pub aud: serde_json::Value,
    pub exp: u64,
    pub nbf: Option<u64>,
}

struct CachedJwks {
    keys: Arc<JwkSet>,
    expires_at: Instant,
    refreshed_at: Instant,
}

/// Verifies Supabase user access tokens using only public asymmetric JWKS keys.
/// Legacy HS256 is deliberately rejected: it requires a separately managed
/// shared secret and must not be silently enabled without confirming the
/// original project's signing-key configuration.
pub struct SupabaseJwtVerifier {
    issuer: String,
    audience: String,
    jwks_url: String,
    http: reqwest::Client,
    cache: RwLock<Option<CachedJwks>>,
}

impl SupabaseJwtVerifier {
    pub fn new(supabase_url: &str, audience: &str) -> Result<Self, AuthError> {
        let mut base = reqwest::Url::parse(supabase_url).map_err(|_| AuthError::InvalidConfig)?;
        if base.scheme() != "https" || base.host_str().is_none() || audience.trim().is_empty() {
            return Err(AuthError::InvalidConfig);
        }

        base.set_path("/auth/v1");
        base.set_query(None);
        base.set_fragment(None);
        let issuer = base.as_str().trim_end_matches('/').to_owned();

        base.set_path("/auth/v1/.well-known/jwks.json");
        let jwks_url = base.to_string();

        let http = reqwest::Client::builder()
            .timeout(HTTP_TIMEOUT)
            .https_only(true)
            .build()?;

        Ok(Self {
            issuer,
            audience: audience.trim().to_owned(),
            jwks_url,
            http,
            cache: RwLock::new(None),
        })
    }

    pub fn from_env() -> Result<Self, AuthError> {
        let url = env::var("SUPABASE_URL").map_err(|_| AuthError::InvalidConfig)?;
        let audience =
            env::var("SUPABASE_JWT_AUDIENCE").unwrap_or_else(|_| "authenticated".to_owned());
        Self::new(&url, &audience)
    }

    pub async fn verify_bearer(&self, token: &str) -> Result<SupabaseClaims, AuthError> {
        let header = decode_header(token).map_err(|_| AuthError::InvalidToken)?;
        if !is_supported_algorithm(header.alg) {
            return Err(AuthError::InvalidToken);
        }
        let kid = header
            .kid
            .as_deref()
            .filter(|value| !value.is_empty())
            .ok_or(AuthError::InvalidToken)?;

        let keys = self.load_jwks(false).await?;
        let decoding_key = if let Some(jwk) = keys.find(kid) {
            DecodingKey::from_jwk(jwk).map_err(|_| AuthError::InvalidToken)?
        } else {
            let refreshed = self.load_jwks(true).await?;
            let jwk = refreshed.find(kid).ok_or(AuthError::InvalidToken)?;
            DecodingKey::from_jwk(jwk).map_err(|_| AuthError::InvalidToken)?
        };

        decode_verified_claims(
            token,
            &decoding_key,
            header.alg,
            &self.issuer,
            &self.audience,
        )
    }

    async fn load_jwks(&self, force_refresh: bool) -> Result<Arc<JwkSet>, AuthError> {
        if !force_refresh {
            let cache = self.cache.read().await;
            if let Some(cached) = cache
                .as_ref()
                .filter(|entry| entry.expires_at > Instant::now())
            {
                return Ok(Arc::clone(&cached.keys));
            }
        }

        let mut cache = self.cache.write().await;
        if let Some(cached) = cache.as_ref() {
            let fresh = cached.expires_at > Instant::now();
            let refresh_recent = cached.refreshed_at.elapsed() < UNKNOWN_KID_REFRESH_COOLDOWN;
            if fresh && (!force_refresh || refresh_recent) {
                return Ok(Arc::clone(&cached.keys));
            }
        }

        let response = self
            .http
            .get(&self.jwks_url)
            .send()
            .await?
            .error_for_status()?;
        let jwks: JwkSet = response.json().await?;
        if jwks.keys.is_empty() {
            return Err(AuthError::JwksUnavailable);
        }

        let keys = Arc::new(jwks);
        let now = Instant::now();
        *cache = Some(CachedJwks {
            keys: Arc::clone(&keys),
            expires_at: now + JWKS_CACHE_TTL,
            refreshed_at: now,
        });
        Ok(keys)
    }
}


fn decode_verified_claims(
    token: &str,
    decoding_key: &DecodingKey,
    algorithm: Algorithm,
    issuer: &str,
    audience: &str,
) -> Result<SupabaseClaims, AuthError> {
    if !is_supported_algorithm(algorithm) {
        return Err(AuthError::InvalidToken);
    }

    let mut validation = Validation::new(algorithm);
    validation.set_issuer(&[issuer]);
    validation.set_audience(&[audience]);
    validation.set_required_spec_claims(&["exp", "iss", "aud", "sub"]);
    validation.validate_exp = true;
    validation.validate_nbf = true;
    validation.leeway = 30;

    let claims = decode::<SupabaseClaims>(token, decoding_key, &validation)
        .map_err(|_| AuthError::InvalidToken)?
        .claims;
    if uuid::Uuid::parse_str(&claims.sub).is_err() || claims.role != "authenticated" {
        return Err(AuthError::InvalidToken);
    }
    Ok(claims)
}

fn is_supported_algorithm(algorithm: Algorithm) -> bool {
    matches!(algorithm, Algorithm::ES256 | Algorithm::RS256)
}

#[cfg(test)]
mod tests {
    use super::*;


    // Chave RSA exclusiva dos testes. Nunca usar em ambientes ou dados reais.
    const TEST_PRIVATE_KEY: &str = "-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQC0yq5gAks7AMq0\neZ9KR09ie64XC280K6wmdD6FuNIZlBQT2kAkuKRfijFKv2K2IVaa42sNz4UkoDlk\nC4dCl1Bid1donWeH1AyaX70XHGkuslQfmmGOv/6pWlyEq32z8jo8XLnIhFWeiPnC\nhisESyJYEA03JNgC++w1b3vviNZ/toPq2RWzscZQbs1I9cmeGivWNgzsBo9KcW6F\nNvari37jxbdBoXx84eZ/fU4eiB8qdaDIjPQEXkYw5r72Lrxmq5DOLlE1tRhajrg1\nf9fte0fGTIHLXnj81tgxnqDTlhzO8jQvCCx0nKRb1XEQgIhJpS8rKyWDvgqCOkB9\nNkR7L/wHAgMBAAECggEAJ9qSLAn1aZFYHga9jZNAtbYL/3p+ziJeda+kZLgEYK0a\n6/FtuGqXmZQOH6sm6H1a6RP+8nFvqU5EuIAuFgjjKIGkXCRuwSuGh7VZKrIRocCf\n+MOAhAZg7hZEVN60/CkGm23ZapF5ilQpsq7+5phlfsIzF5fgom/Ed1cXHAuvNUG4\nv4IgWlFycYPYUPTF9itPPxJAkFWIT7vYzFDgNdXRb0FL7BaNd0klHlHF9fb7ccs0\nUMgtBzmG0vk5do25TV8fhba0v982kejokfZSq7BI2Aj2iMfie9jDKJ3giU6DZ9j+\nFee5YduSNre9/YoaCrh4wJTZwJDXQxWzQtxohhCo6QKBgQDjIY+n/KCTh1/+J+m1\nVBeFD4k5dSGgBWWoucnqVwyQ6Asu9ocpG2AfTNK3mSnQ204sQaz0IZiPWnVNe0xc\nC90H6n1iKHYVV6vxGiRS+NBMs01fI4DQQObccRBsa7mm7JqWWfXxyup77EHPYp8Q\nX+1Jm69nrgO8naiOyfXhZuXu4wKBgQDLxVHdoFqQK47SKahRQ7J/LteAitzp7mkP\nBzyOnLjHy6jBkzt4S10pW7CgITvne/3mZTvc8+XN3V7rD3r7qxaahg4PxS4HOff6\n4wcXIJivMRaoSU4Ix+3yDXoknS36MUuV+/O+6gmxdYN+beRz6VHEsGV2L46uSmgC\nvcPqU8JDjQKBgB4QnDZtT0gX/FHlMJ9rAS4Az3ZGlevbqwg5h4u4eBZaUNink16S\nnBeokJ/y60EVNnTPQLiUFeCr5aka8BGjFF/u3yf2GSNcFot0nWhKPTBZ75zvUya9\n4JE/eiAP5mQ9H31VbSPTa1R6AoAUGuANApjivcYol6AI8n3sJ9rtRvRnAoGAAxJq\ndYjhVKMTeB+gpfj7S+eM4Cc3xV8OvmdBhnTeZESxuplZoCqisOjs9L0LhiXcYgjM\nqjwTDtNzht+o3vppUNMMizhRxVIeZu3dQYAATUPUL51LS96Xu7pwSPUFqGvt08kE\nl7A3jTFUVieZ9hViYjC2lt2IrR/6CXCK75FrsFECgYBadvra1qlkb1WwsUWhDciC\nR36A4V9w+kYErdIFe6mT7PICSbT5TB6A2uImnErFU21GpC/fQ3vpLj4Rj5updWJu\nPEaFlq69lckba24EwvcoiKE+hjf9EqYMal+agACX6S2xNFuom7khofsDEGjIIW5P\nkj074FMkZFAtEOwB3G2vwQ==\n-----END PRIVATE KEY-----";
    const TEST_PUBLIC_KEY: &str = "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAtMquYAJLOwDKtHmfSkdP\nYnuuFwtvNCusJnQ+hbjSGZQUE9pAJLikX4oxSr9itiFWmuNrDc+FJKA5ZAuHQpdQ\nYndXaJ1nh9QMml+9FxxpLrJUH5phjr/+qVpchKt9s/I6PFy5yIRVnoj5woYrBEsi\nWBANNyTYAvvsNW9774jWf7aD6tkVs7HGUG7NSPXJnhor1jYM7AaPSnFuhTb2q4t+\n48W3QaF8fOHmf31OHogfKnWgyIz0BF5GMOa+9i68ZquQzi5RNbUYWo64NX/X7XtH\nxkyBy154/NbYMZ6g05YczvI0LwgsdJykW9VxEICISaUvKyslg74KgjpAfTZEey/8\nBwIDAQAB\n-----END PUBLIC KEY-----";
    const TEST_ISSUER: &str = "https://example-project.supabase.co/auth/v1";
    const TEST_AUDIENCE: &str = "authenticated";

    fn test_claims() -> serde_json::Value {
        serde_json::json!({
            "sub": "7b9f8b5d-0f3a-4e3c-a3c2-5f7d6e8a9b10",
            "role": "authenticated",
            "iss": TEST_ISSUER,
            "aud": TEST_AUDIENCE,
            "exp": unix_now() + 300,
            "nbf": unix_now() - 10
        })
    }

    fn unix_now() -> u64 {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .expect("system clock")
            .as_secs()
    }

    fn sign_rs256(claims: &serde_json::Value) -> String {
        let mut header = jsonwebtoken::Header::new(Algorithm::RS256);
        header.kid = Some("test-key".to_owned());
        let key = jsonwebtoken::EncodingKey::from_rsa_pem(TEST_PRIVATE_KEY.as_bytes())
            .expect("test private key");
        jsonwebtoken::encode(&header, claims, &key).expect("signed test JWT")
    }

    fn test_decoding_key() -> DecodingKey {
        DecodingKey::from_rsa_pem(TEST_PUBLIC_KEY.as_bytes()).expect("test public key")
    }

    #[test]
    fn builds_project_pinned_issuer_and_jwks_url() {
        let verifier =
            SupabaseJwtVerifier::new("https://example-project.supabase.co", "authenticated")
                .expect("valid verifier configuration");

        assert_eq!(
            verifier.issuer,
            "https://example-project.supabase.co/auth/v1"
        );
        assert_eq!(
            verifier.jwks_url,
            "https://example-project.supabase.co/auth/v1/.well-known/jwks.json"
        );
    }

    #[test]
    fn rejects_http_project_urls() {
        assert!(
            SupabaseJwtVerifier::new("http://example-project.supabase.co", "authenticated")
                .is_err()
        );
    }

    #[test]
    fn rejects_empty_audience() {
        assert!(SupabaseJwtVerifier::new("https://example-project.supabase.co", " ").is_err());
    }


    #[test]
    fn verifies_a_valid_signed_supabase_claim_set() {
        let token = sign_rs256(&test_claims());
        let claims = decode_verified_claims(
            &token,
            &test_decoding_key(),
            Algorithm::RS256,
            TEST_ISSUER,
            TEST_AUDIENCE,
        )
        .expect("valid signed claims");

        assert_eq!(claims.role, "authenticated");
        assert_eq!(claims.sub, "7b9f8b5d-0f3a-4e3c-a3c2-5f7d6e8a9b10");
    }

    #[test]
    fn rejects_wrong_issuer_and_audience() {
        let token = sign_rs256(&test_claims());
        assert!(decode_verified_claims(
            &token,
            &test_decoding_key(),
            Algorithm::RS256,
            "https://another-project.supabase.co/auth/v1",
            TEST_AUDIENCE,
        )
        .is_err());
        assert!(decode_verified_claims(
            &token,
            &test_decoding_key(),
            Algorithm::RS256,
            TEST_ISSUER,
            "another-audience",
        )
        .is_err());
    }

    #[test]
    fn rejects_expired_and_not_yet_valid_tokens() {
        let mut expired = test_claims();
        expired["exp"] = serde_json::json!(unix_now().saturating_sub(60));
        assert!(decode_verified_claims(
            &sign_rs256(&expired),
            &test_decoding_key(),
            Algorithm::RS256,
            TEST_ISSUER,
            TEST_AUDIENCE,
        )
        .is_err());

        let mut not_yet_valid = test_claims();
        not_yet_valid["nbf"] = serde_json::json!(unix_now() + 60);
        assert!(decode_verified_claims(
            &sign_rs256(&not_yet_valid),
            &test_decoding_key(),
            Algorithm::RS256,
            TEST_ISSUER,
            TEST_AUDIENCE,
        )
        .is_err());
    }

    #[test]
    fn rejects_non_authenticated_role_and_non_uuid_subject() {
        let mut wrong_role = test_claims();
        wrong_role["role"] = serde_json::json!("service_role");
        assert!(decode_verified_claims(
            &sign_rs256(&wrong_role),
            &test_decoding_key(),
            Algorithm::RS256,
            TEST_ISSUER,
            TEST_AUDIENCE,
        )
        .is_err());

        let mut wrong_subject = test_claims();
        wrong_subject["sub"] = serde_json::json!("not-a-uuid");
        assert!(decode_verified_claims(
            &sign_rs256(&wrong_subject),
            &test_decoding_key(),
            Algorithm::RS256,
            TEST_ISSUER,
            TEST_AUDIENCE,
        )
        .is_err());
    }

    #[test]
    fn rejects_hs256_even_when_token_is_correctly_signed() {
        let claims = test_claims();
        let token = jsonwebtoken::encode(
            &jsonwebtoken::Header::new(Algorithm::HS256),
            &claims,
            &jsonwebtoken::EncodingKey::from_secret(b"test-only-secret"),
        )
        .expect("signed HS256 test JWT");

        assert!(decode_verified_claims(
            &token,
            &jsonwebtoken::DecodingKey::from_secret(b"test-only-secret"),
            Algorithm::HS256,
            TEST_ISSUER,
            TEST_AUDIENCE,
        )
        .is_err());
    }

    #[test]
    fn only_allows_asymmetric_algorithms() {
        assert!(is_supported_algorithm(Algorithm::ES256));
        assert!(is_supported_algorithm(Algorithm::RS256));
        assert!(!is_supported_algorithm(Algorithm::HS256));
    }
}
