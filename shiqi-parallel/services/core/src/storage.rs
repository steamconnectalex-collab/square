//! Proxy de upload para o bucket privado de anexos.
//! Encaminha o JWT do usuário: as policies do Supabase Storage continuam sendo
//! a autoridade de autorização. Nunca usa service_role.

use crate::attachments::ImageFormat;
use reqwest::{Client, StatusCode};
use std::time::Duration;

#[derive(Debug, thiserror::Error)]
pub enum StorageError {
    #[error("invalid Supabase Storage configuration")]
    InvalidConfig,
    #[error("invalid attachment object path")]
    InvalidPath,
    #[error("Supabase Storage rejected the upload with status {0}")]
    Rejected(StatusCode),
    #[error("Supabase Storage request failed: {0}")]
    Http(#[from] reqwest::Error),
}

pub struct StorageProxy {
    base_url: reqwest::Url,
    publishable_key: String,
    http: Client,
}

impl StorageProxy {
    pub fn new(supabase_url: &str, publishable_key: &str) -> Result<Self, StorageError> {
        Self::build(supabase_url, publishable_key, true)
    }

    fn build(
        supabase_url: &str,
        publishable_key: &str,
        https_only: bool,
    ) -> Result<Self, StorageError> {
        let mut base_url =
            reqwest::Url::parse(supabase_url).map_err(|_| StorageError::InvalidConfig)?;
        let valid_scheme = if https_only {
            base_url.scheme() == "https"
        } else {
            matches!(base_url.scheme(), "http" | "https")
        };
        if !valid_scheme || base_url.host_str().is_none() || publishable_key.trim().is_empty() {
            return Err(StorageError::InvalidConfig);
        }
        base_url.set_path("/");
        base_url.set_query(None);
        base_url.set_fragment(None);

        let http = Client::builder()
            .timeout(Duration::from_secs(20))
            .https_only(https_only)
            .build()?;

        Ok(Self {
            base_url,
            publishable_key: publishable_key.trim().to_owned(),
            http,
        })
    }

    #[cfg(test)]
    fn new_test(supabase_url: &str, publishable_key: &str) -> Result<Self, StorageError> {
        Self::build(supabase_url, publishable_key, false)
    }

    /// Faz upload no bucket privado usando a identidade JWT do próprio usuário.
    /// O path é limitado à pasta do usuário autenticado antes de chamar Storage.
    pub async fn upload(
        &self,
        user_id: &str,
        object_path: &str,
        bearer_token: &str,
        format: ImageFormat,
        bytes: &[u8],
    ) -> Result<(), StorageError> {
        let filename = validate_object_path(object_path, user_id, format)?;
        let mut url = self.base_url.clone();
        url.path_segments_mut()
            .map_err(|_| StorageError::InvalidConfig)?
            .pop_if_empty()
            .extend(["storage", "v1", "object", "attachments", user_id, filename]);

        let response = self
            .http
            .post(url)
            .header("apikey", &self.publishable_key)
            .bearer_auth(bearer_token)
            .header(reqwest::header::CONTENT_TYPE, format.mime_type())
            .header("x-upsert", "false")
            .body(bytes.to_vec())
            .send()
            .await?;

        let status = response.status();
        if status.is_success() {
            Ok(())
        } else {
            Err(StorageError::Rejected(status))
        }
    }
}

fn validate_object_path<'a>(
    object_path: &'a str,
    user_id: &str,
    format: ImageFormat,
) -> Result<&'a str, StorageError> {
    let mut parts = object_path.split('/');
    let owner = parts.next().ok_or(StorageError::InvalidPath)?;
    let filename = parts.next().ok_or(StorageError::InvalidPath)?;
    if owner != user_id || parts.next().is_some() || filename.is_empty() {
        return Err(StorageError::InvalidPath);
    }
    if !filename
        .bytes()
        .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.'))
        || filename.starts_with('.')
        || filename.contains("..")
    {
        return Err(StorageError::InvalidPath);
    }

    let extension = match format {
        ImageFormat::Jpeg => "jpg",
        ImageFormat::Png => "png",
        ImageFormat::Webp => "webp",
        ImageFormat::Gif => "gif",
    };
    if !filename.ends_with(&format!(".{extension}")) {
        return Err(StorageError::InvalidPath);
    }
    Ok(filename)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_only_user_owned_paths_with_matching_extensions() {
        assert!(validate_object_path("user-1/file-123.jpg", "user-1", ImageFormat::Jpeg).is_ok());
        assert!(validate_object_path("user-1/file.gif", "user-1", ImageFormat::Gif).is_ok());
        assert!(validate_object_path("other-user/file.jpg", "user-1", ImageFormat::Jpeg).is_err());
        assert!(validate_object_path("user-1/../file.jpg", "user-1", ImageFormat::Jpeg).is_err());
        assert!(validate_object_path("user-1/sub/file.jpg", "user-1", ImageFormat::Jpeg).is_err());
        assert!(validate_object_path("user-1/file.png", "user-1", ImageFormat::Jpeg).is_err());
        assert!(validate_object_path("user-1/%2fetc.jpg", "user-1", ImageFormat::Jpeg).is_err());
    }

    #[test]
    fn rejects_insecure_or_incomplete_storage_configuration() {
        assert!(StorageProxy::new("http://example.supabase.co", "sb_publishable_test").is_err());
        assert!(StorageProxy::new("https://example.supabase.co", " ").is_err());
    }

    #[tokio::test]
    async fn forwards_user_jwt_and_upload_to_private_storage_endpoint() {
        use axum::{body::Bytes, http::HeaderMap, routing::post, Router};
        use std::sync::{Arc, Mutex};
        use tokio::net::TcpListener;

        let received = Arc::new(Mutex::new(None));
        let capture = received.clone();
        let app = Router::new().route(
            "/storage/v1/object/attachments/user-1/photo.jpg",
            post(move |headers: HeaderMap, body: Bytes| {
                let capture = capture.clone();
                async move {
                    *capture.lock().expect("capture lock") = Some((
                        headers
                            .get("authorization")
                            .and_then(|v| v.to_str().ok())
                            .unwrap_or_default()
                            .to_owned(),
                        headers
                            .get("apikey")
                            .and_then(|v| v.to_str().ok())
                            .unwrap_or_default()
                            .to_owned(),
                        headers
                            .get("content-type")
                            .and_then(|v| v.to_str().ok())
                            .unwrap_or_default()
                            .to_owned(),
                        headers
                            .get("x-upsert")
                            .and_then(|v| v.to_str().ok())
                            .unwrap_or_default()
                            .to_owned(),
                        body.to_vec(),
                    ));
                    StatusCode::CREATED
                }
            }),
        );
        let listener = TcpListener::bind("127.0.0.1:0").await.expect("bind mock Storage");
        let address = listener.local_addr().expect("mock Storage address");
        let server = tokio::spawn(async move {
            axum::serve(listener, app).await.expect("mock Storage server");
        });

        let proxy = StorageProxy::new_test(&format!("http://{address}"), "sb_publishable_test")
            .expect("test proxy");
        let payload = b"\xFF\xD8\xFFmock-jpeg";
        let result = proxy
            .upload(
                "user-1",
                "user-1/photo.jpg",
                "user-access-jwt",
                ImageFormat::Jpeg,
                payload,
            )
            .await;

        server.abort();
        assert!(result.is_ok(), "Storage response should be forwarded");
        let captured = received.lock().expect("capture lock").clone().expect("request received");
        assert_eq!(captured.0, "Bearer user-access-jwt");
        assert_eq!(captured.1, "sb_publishable_test");
        assert_eq!(captured.2, "image/jpeg");
        assert_eq!(captured.3, "false");
        assert_eq!(captured.4, payload);
    }
}
