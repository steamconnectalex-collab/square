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
        let mut base_url =
            reqwest::Url::parse(supabase_url).map_err(|_| StorageError::InvalidConfig)?;
        if base_url.scheme() != "https"
            || base_url.host_str().is_none()
            || publishable_key.trim().is_empty()
        {
            return Err(StorageError::InvalidConfig);
        }
        base_url.set_path("/");
        base_url.set_query(None);
        base_url.set_fragment(None);

        let http = Client::builder()
            .timeout(Duration::from_secs(20))
            .https_only(true)
            .build()?;

        Ok(Self {
            base_url,
            publishable_key: publishable_key.trim().to_owned(),
            http,
        })
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
}
