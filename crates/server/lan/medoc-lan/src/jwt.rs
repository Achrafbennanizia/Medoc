//! JWT access tokens for authenticated LAN HTTP requests (HS256, short-lived).

use chrono::Utc;
use jsonwebtoken::{decode, encode, Algorithm, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};

use medoc_core::error::AppError;

const JWT_ISS: &str = "medoc-lan";
const TOKEN_TTL_SECS: i64 = 8 * 3600;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LanClaims {
    pub iss: String,
    pub sub: String,
    pub email: String,
    pub role: String,
    pub exp: i64,
}

pub fn issue_token(
    secret: &[u8],
    user_id: &str,
    email: &str,
    role: &str,
) -> Result<String, AppError> {
    let exp = Utc::now().timestamp() + TOKEN_TTL_SECS;
    let claims = LanClaims {
        iss: JWT_ISS.into(),
        sub: user_id.into(),
        email: email.into(),
        role: role.into(),
        exp,
    };
    let mut header = Header::new(Algorithm::HS256);
    header.typ = Some("JWT".into());
    encode(&header, &claims, &EncodingKey::from_secret(secret))
        .map_err(|e| AppError::Internal(format!("JWT encode: {e}")))
}

pub fn verify_token(secret: &[u8], token: &str) -> Result<LanClaims, AppError> {
    let mut validation = Validation::new(Algorithm::HS256);
    validation.set_issuer(&[JWT_ISS]);
    let key = DecodingKey::from_secret(secret);
    let data = decode::<LanClaims>(token, &key, &validation).map_err(|_| AppError::Unauthorized)?;
    Ok(data.claims)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn roundtrip_token() {
        let secret = b"01234567890123456789012345678901";
        let tok = issue_token(secret, "u1", "a@b.de", "REZEPTION").unwrap();
        let c = verify_token(secret, &tok).unwrap();
        assert_eq!(c.sub, "u1");
        assert_eq!(c.role, "REZEPTION");
        assert_eq!(c.iss, JWT_ISS);
    }
}
