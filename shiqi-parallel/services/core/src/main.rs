pub mod attachments;
pub mod auth;

use axum::{routing::get, Json, Router};
use serde::Serialize;
use std::{env, net::SocketAddr};
use tokio::net::TcpListener;
use tower_http::trace::TraceLayer;
use tracing_subscriber::EnvFilter;

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

// Until external dependencies are connected, readiness means only that the
// process completed startup. It must be extended before business routes ship.
async fn readyz() -> Json<HealthResponse> {
    Json(HealthResponse {
        service: "shiqi-core",
        status: "ready",
    })
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

    let app = Router::new()
        .route("/healthz", get(healthz))
        .route("/readyz", get(readyz))
        .layer(TraceLayer::new_for_http());

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
