pub mod attachments;
pub mod auth;

use axum::{
    body::Bytes,
    extract::{DefaultBodyLimit, State},
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use serde::Serialize;
use serde_json::json;
use std::{env, net::SocketAddr, sync::Arc};
use tokio::net::TcpListener;
use tower_http::trace::TraceLayer;
use tracing_subscriber::EnvFilter;

use crate::{
    attachments::{validate_image, AttachmentError},
    auth::{AuthError, SupabaseClaims, SupabaseJwtVerifier},
};

const MAX_REQUEST_BYTES: usize = attachments::MAX_ATTACHMENT_BYTES;

#[derive(Clone)]
struct AppState {
    jwt: Option<Arc<SupabaseJwtVerifier>>,
}

#[derive(Serialize)]
struct HealthResponse {
    service: &'static str,
    status: &'static str,
}

async fn healthz() -> Json<HealthResponse> {
    Json(HealthResponse {
        service: "shiqi-core",
        status: "ok",
    })
}

async fn readyz(State(state): State<AppState>) -> (StatusCode, Json<HealthResponse>) {
    let configured = state.jwt.is_some();
    (
        if configured {
            StatusCode::OK
        } else {
            StatusCode::SERVICE_UNAVAILABLE
        },
        Json(HealthResponse {
            service: "shiqi-core",
            status: if configured {
                "ready"
            } else {
                "missing_supabase_jwt_config"
            },
        }),
    )
}

async fn authenticate(headers: &HeaderMap, state: &AppState) -> Result<SupabaseClaims, StatusCode> {
    let token = headers
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "))
        .filter(|value| !value.is_empty())
        .ok_or(StatusCode::UNAUTHORIZED)?;

    let verifier = state.jwt.as_ref().ok_or(StatusCode::SERVICE_UNAVAILABLE)?;
    verifier
        .verify_bearer(token)
        .await
        .map_err(|error| match error {
            AuthError::InvalidToken => StatusCode::UNAUTHORIZED,
            _ => StatusCode::SERVICE_UNAVAILABLE,
        })
}

fn api_error(status: StatusCode, code: &'static str) -> Response {
    (
        status,
        Json(json!({
            "ok": false,
            "error": code
        })),
    )
        .into_response()
}

/// Rota protegida para confirmar a identidade validada pelo JWT do Supabase.
/// Retorna somente o identificador e o papel; nunca devolve o token.
async fn me(State(state): State<AppState>, headers: HeaderMap) -> Response {
    let claims = match authenticate(&headers, &state).await {
        Ok(claims) => claims,
        Err(status) => {
            return api_error(
                status,
                if status == StatusCode::UNAUTHORIZED {
                    "unauthorized"
                } else {
                    "auth_unavailable"
                },
            )
        }
    };

    (
        StatusCode::OK,
        Json(json!({
            "ok": true,
            "user": {
                "id": claims.sub,
                "role": claims.role
            }
        })),
    )
        .into_response()
}

/// Valida assinatura, MIME e limite do arquivo após autenticar o usuário.
/// Não grava nem publica o arquivo; o armazenamento continua sob as policies
/// e signed URLs do Supabase até a próxima etapa de integração.
async fn validate_attachment(
    State(state): State<AppState>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    if let Err(status) = authenticate(&headers, &state).await {
        return api_error(
            status,
            if status == StatusCode::UNAUTHORIZED {
                "unauthorized"
            } else {
                "auth_unavailable"
            },
        );
    }

    let declared_type = headers
        .get(header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("");

    match validate_image(&body, declared_type) {
        Ok(format) => (
            StatusCode::OK,
            Json(json!({
                "ok": true,
                "content_type": format.mime_type(),
                "bytes": body.len()
            })),
        )
            .into_response(),
        Err(AttachmentError::Empty) => api_error(StatusCode::BAD_REQUEST, "empty_file"),
        Err(AttachmentError::TooLarge) => {
            api_error(StatusCode::PAYLOAD_TOO_LARGE, "file_too_large")
        }
        Err(AttachmentError::UnsupportedFormat) => {
            api_error(StatusCode::UNSUPPORTED_MEDIA_TYPE, "unsupported_image")
        }
        Err(AttachmentError::ContentTypeMismatch) => {
            api_error(StatusCode::UNSUPPORTED_MEDIA_TYPE, "content_type_mismatch")
        }
    }
}

#[tokio::main]
async fn main() {
    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("shiqi_core=info,tower_http=info"));
    tracing_subscriber::fmt().with_env_filter(filter).init();

    let port = env::var("PORT")
        .ok()
        .and_then(|value| value.parse::<u16>().ok())
        .unwrap_or(8080);
    let address = SocketAddr::from(([0, 0, 0, 0], port));

    let jwt = match SupabaseJwtVerifier::from_env() {
        Ok(verifier) => {
            tracing::info!("Supabase JWT verifier configured");
            Some(Arc::new(verifier))
        }
        Err(_) => {
            tracing::warn!("SUPABASE_URL/JWT configuration missing or invalid; protected routes are unavailable");
            None
        }
    };
    let state = AppState { jwt };

    let app = Router::new()
        .route("/healthz", get(healthz))
        .route("/readyz", get(readyz))
        .route("/v1/me", get(me))
        .route("/v1/attachments/validate", post(validate_attachment))
        .layer(DefaultBodyLimit::max(MAX_REQUEST_BYTES))
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    let listener = TcpListener::bind(address)
        .await
        .expect("failed to bind HTTP listener");

    tracing::info!(%address, "shiqi-core listening");

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await
        .expect("HTTP server failed");
}

async fn shutdown_signal() {
    let ctrl_c = async {
        tokio::signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("failed to install termination handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }

    tracing::info!("shutdown signal received");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn protected_routes_reject_missing_bearer_token() {
        let headers = HeaderMap::new();
        let state = AppState { jwt: None };

        assert_eq!(
            authenticate(&headers, &state).await.unwrap_err(),
            StatusCode::UNAUTHORIZED
        );
    }

    #[tokio::test]
    async fn protected_routes_fail_closed_when_jwt_config_is_missing() {
        let mut headers = HeaderMap::new();
        headers.insert(
            header::AUTHORIZATION,
            "Bearer placeholder".parse().expect("valid header"),
        );
        let state = AppState { jwt: None };

        assert_eq!(
            authenticate(&headers, &state).await.unwrap_err(),
            StatusCode::SERVICE_UNAVAILABLE
        );
    }
}
