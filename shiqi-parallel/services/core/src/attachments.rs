//! Validação de anexos de imagem alinhada ao contrato atual do Supabase Storage.
//! Esta função ainda não é exposta por HTTP: a integração exige autenticação JWT
//! e autorização do usuário antes de receber ou gravar qualquer arquivo.

pub const MAX_ATTACHMENT_BYTES: usize = 3 * 1024 * 1024;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ImageFormat {
    Jpeg,
    Png,
    Webp,
    Gif,
}

impl ImageFormat {
    pub fn mime_type(self) -> &'static str {
        match self {
            Self::Jpeg => "image/jpeg",
            Self::Png => "image/png",
            Self::Webp => "image/webp",
            Self::Gif => "image/gif",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AttachmentError {
    Empty,
    TooLarge,
    UnsupportedFormat,
    ContentTypeMismatch,
}

/// Confere tamanho, assinatura binária e Content-Type declarado.
/// Não confia apenas no nome/extensão enviado pelo navegador.
pub fn validate_image(
    bytes: &[u8],
    declared_content_type: &str,
) -> Result<ImageFormat, AttachmentError> {
    if bytes.is_empty() {
        return Err(AttachmentError::Empty);
    }
    if bytes.len() > MAX_ATTACHMENT_BYTES {
        return Err(AttachmentError::TooLarge);
    }

    let detected = if bytes.starts_with(&[0xFF, 0xD8, 0xFF]) {
        Some(ImageFormat::Jpeg)
    } else if bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
        Some(ImageFormat::Png)
    } else if bytes.len() >= 12 && &bytes[0..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
        Some(ImageFormat::Webp)
    } else if bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a") {
        Some(ImageFormat::Gif)
    } else {
        None
    }
    .ok_or(AttachmentError::UnsupportedFormat)?;

    if detected.mime_type() != declared_content_type {
        return Err(AttachmentError::ContentTypeMismatch);
    }

    Ok(detected)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_supported_signatures_with_matching_mime() {
        assert_eq!(
            validate_image(&[0xFF, 0xD8, 0xFF, 0x00], "image/jpeg"),
            Ok(ImageFormat::Jpeg)
        );
        assert_eq!(
            validate_image(b"\x89PNG\r\n\x1a\nrest", "image/png"),
            Ok(ImageFormat::Png)
        );
        assert_eq!(
            validate_image(b"RIFF0000WEBPdata", "image/webp"),
            Ok(ImageFormat::Webp)
        );
    }

    #[test]
    fn rejects_empty_and_oversized_files() {
        assert_eq!(
            validate_image(&[], "image/png"),
            Err(AttachmentError::Empty)
        );
        let oversized = vec![0; MAX_ATTACHMENT_BYTES + 1];
        assert_eq!(
            validate_image(&oversized, "image/png"),
            Err(AttachmentError::TooLarge)
        );
    }

    #[test]
    fn rejects_unknown_signatures_and_mime_spoofing() {
        assert_eq!(
            validate_image(b"not an image", "image/png"),
            Err(AttachmentError::UnsupportedFormat)
        );
        assert_eq!(
            validate_image(&[0xFF, 0xD8, 0xFF], "image/png"),
            Err(AttachmentError::ContentTypeMismatch)
        );
    }

    #[test]
    fn accepts_gif87a_and_gif89a_with_matching_mime() {
        assert_eq!(
            validate_image(b"GIF87a\x00\x00", "image/gif"),
            Ok(ImageFormat::Gif)
        );
        assert_eq!(
            validate_image(b"GIF89a\x00\x00", "image/gif"),
            Ok(ImageFormat::Gif)
        );
    }

    #[test]
    fn rejects_gif_signature_with_wrong_mime() {
        assert_eq!(
            validate_image(b"GIF89a\x00\x00", "image/png"),
            Err(AttachmentError::ContentTypeMismatch)
        );
    }

    #[test]
    fn accepts_exact_storage_size_limit() {
        let mut jpeg = vec![0; MAX_ATTACHMENT_BYTES];
        jpeg[..3].copy_from_slice(&[0xFF, 0xD8, 0xFF]);
        assert_eq!(validate_image(&jpeg, "image/jpeg"), Ok(ImageFormat::Jpeg));
    }
}
