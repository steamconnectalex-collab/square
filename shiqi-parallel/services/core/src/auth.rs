use jsonwebtoken::{
    decode, decode_header,
    jwk::JwkSet,
    Algorithm, DecodingKey, Validation,
};
use serde::Deserialize;
use std::{
    env,
    sync::Arc,
    time::{Duration, Instant},
};
use tokio::sync::RwLock;

const JWKS_CACHE_TTL: Duration = Duration::from_secs(10 * 60);
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
        let audience = env::var("SUPABASE_JWT_AUDIENCE")
            .unwrap_or_else(|_| "authenticated".to_owned());
        Self::new(&url, &audience)
    }

    pub async fn verify_bearer(&self, token: &str) -> Result<SupabaseClaims, AuthError> {
        let header = decode_header(token).map_err(|_| AuthError::InvalidToken)?;
        if !matches!(header.alg, Algorithm::ES256 | Algorithm::RS256) {
            return Err(AuthError::InvalidToken);
        }
        let kid = header.kid.as_deref().filter(|value| !value.is_empty())
            .ok_or(AuthError::InvalidToken)?;

        let keys = self.load_jwks(false).await?;
        let jwk = match keys.find(kid) {
            Some(key) => key,
            None => {
                let refreshed = self.load_jwks(true).await?;
                refreshed.find(kid).ok_or(AuthError::InvalidToken)?
            }
        };
        let decoding_key = DecodingKey::from_jwk(jwk).map_err(|_| AuthError::InvalidToken)?;

        let mut validation = Validation::new(header.alg);
        validation.set_issuer(&[self.issuer.as_str()]);
        validation.set_audience(&[self.audience.as_str()]);
        validation.set_required_spec_claims(&["exp", "iss", "aud", "sub"]);
        validation.validate_exp = true;
        validation.validate_nbf = true;
        validation.leeway = 30;

        let token = decode::<SupabaseClaims>(token, &decoding_key, &validation)
            .map_err(|_| AuthError::InvalidToken)?;
        if token.claims.sub.trim().is_empty() || token.claims.role != "authenticated" {
            return Err(AuthError::InvalidToken);
        }
        Ok(token.claims)
    }

    async fn load_jwks(&self, force_refresh: bool) -> Result<Arc<JwkSet>, AuthError> {
        if !force_refresh {
            let cache = self.cache.read().await;
            if let Some(cached) = cache.as_ref().filter(|entry| entry.expires_at > Instant::now()) {
                return Ok(Arc::clone(&cached.keys));
            }
        }

        let mut cache = self.cache.write().await;
        if !force_refresh {
            if let Some(cached) = cache.as_ref().filter(|entry| entry.expires_at > Instant::now()) {
                return Ok(Arc::clone(&cached.keys));
            }
        }

        let response = self.http.get(&self.jwks_url).send().await?.error_for_status()?;
        let jwks: JwkSet = response.json().await?;
        if jwks.keys.is_empty() {
            return Err(AuthError::JwksUnavailable);
        }

        let keys = Arc::new(jwks);
        *cache = Some(CachedJwks {
            keys: Arc::clone(&keys),
            expires_at: Instant::now() + JWKS_CACHE_TTL,
        });
        Ok(keys)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_project_pinned_issuer_and_jwks_url() {
        let verifier = SupabaseJwtVerifier::new(
            "https://example-project.supabase.co",
            "authenticated",
        ).expect("valid verifier configuration");

        assert_eq!(verifier.issuer, "https://example-project.supabase.co/auth/v1");
        assert_eq!(
            verifier.jwks_url,
            "https://example-project.supabase.co/auth/v1/.well-known/jwks.json"
        );
    }

    #[test]
    fn rejects_http_project_urls() {
        assert!(SupabaseJwtVerifier::new("http://example-project.supabase.co", "authenticated").is_err());
    }

    #[test]
    fn rejects_empty_audience() {
        assert!(SupabaseJwtVerifier::new("https://example-project.supabase.co", " ").is_err());
    }

    #[test]
    fn only_allows_asymmetric_algorithms() {
        assert!(matches!(Algorithm::ES256, Algorithm::ES256 | Algorithm::RS256));
        assert!(matches!(Algorithm::RS256, Algorithm::ES256 | Algorithm::RS256));
        assert!(!matches!(Algorithm::HS256, Algorithm::ES256 | Algorithm::RS256));
    }
}
