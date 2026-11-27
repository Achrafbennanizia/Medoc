//! Compressed, encrypted backup files (.mdbk): seal, unseal, write, unpack (split from `backup.rs`).

use super::*;

pub(crate) fn backup_cipher(db_key: &[u8]) -> aes_gcm::Aes256Gcm {
    use aes_gcm::KeyInit;
    use hmac::Mac;
    // A separate key per purpose: the database key itself never encrypts the archive.
    let mut mac = <hmac::Hmac<sha2::Sha256> as Mac>::new_from_slice(db_key)
        .expect("HMAC accepts any key length");
    mac.update(b"medoc-backup-archive-v2");
    aes_gcm::Aes256Gcm::new_from_slice(&mac.finalize().into_bytes()).expect("32-byte key")
}

/// Plain SQLite image of the live database, in memory only. `sqlcipher_export` reads inside
/// one transaction, so the image is consistent even while the practice keeps working.
pub(super) async fn plaintext_image(
    pool: &SqlitePool,
) -> Result<zeroize::Zeroizing<Vec<u8>>, AppError> {
    let mut conn = pool
        .acquire()
        .await
        .map_err(|e| fail("error.backup.snapshot_failed", "BACKUP_SNAPSHOT_FAILED", e))?;
    sqlx::query("ATTACH DATABASE ':memory:' AS medoc_snapshot KEY ''")
        .execute(&mut *conn)
        .await
        .map_err(|e| fail("error.backup.snapshot_failed", "BACKUP_SNAPSHOT_FAILED", e))?;
    let image = async {
        sqlx::query("SELECT sqlcipher_export('medoc_snapshot')")
            .execute(&mut *conn)
            .await?;
        let buf = conn.serialize(Some("medoc_snapshot")).await?;
        Ok::<_, sqlx::Error>(zeroize::Zeroizing::new(buf.to_vec()))
    }
    .await;
    let _ = sqlx::query("DETACH DATABASE medoc_snapshot")
        .execute(&mut *conn)
        .await;
    image.map_err(|e| fail("error.backup.snapshot_failed", "BACKUP_SNAPSHOT_FAILED", e))
}

pub(super) fn seal(image: &[u8], db_key: &[u8]) -> Result<Vec<u8>, AppError> {
    use aes_gcm::aead::{Aead, AeadCore, OsRng, Payload};
    use std::io::Write;
    let mut gz = flate2::write::GzEncoder::new(Vec::new(), flate2::Compression::new(6)); // nearly "best" size at a fraction of the CPU
    gz.write_all(image)
        .map_err(|e| fail("error.backup.compress_failed", "BACKUP_COMPRESS_FAILED", e))?;
    let compressed = zeroize::Zeroizing::new(
        gz.finish()
            .map_err(|e| fail("error.backup.compress_failed", "BACKUP_COMPRESS_FAILED", e))?,
    );
    let nonce = aes_gcm::Aes256Gcm::generate_nonce(&mut OsRng);
    let sealed = backup_cipher(db_key)
        .encrypt(
            &nonce,
            Payload {
                msg: &compressed,
                aad: MDBK_MAGIC,
            },
        )
        .map_err(|_| {
            fail(
                "error.backup.compress_failed",
                "BACKUP_ENCRYPT_FAILED",
                "AES-GCM",
            )
        })?;
    let mut out = Vec::with_capacity(MDBK_MAGIC.len() + nonce.len() + sealed.len());
    out.extend_from_slice(MDBK_MAGIC);
    out.extend_from_slice(&nonce);
    out.extend_from_slice(&sealed);
    Ok(out)
}

pub(super) fn unseal(file: &[u8], db_key: &[u8]) -> Result<zeroize::Zeroizing<Vec<u8>>, AppError> {
    use aes_gcm::aead::{Aead, Payload};
    use std::io::Read;
    if file.len() < MDBK_MAGIC.len() + 12 || &file[..MDBK_MAGIC.len()] != MDBK_MAGIC {
        log_system!(warn, event = "BACKUP_NOT_AN_ARCHIVE", bytes = file.len());
        return Err(AppError::validation_code("error.backup.not_an_archive"));
    }
    let (nonce, sealed) = file[MDBK_MAGIC.len()..].split_at(12);
    let compressed = zeroize::Zeroizing::new(
        backup_cipher(db_key)
            .decrypt(
                aes_gcm::Nonce::from_slice(nonce),
                Payload {
                    msg: sealed,
                    aad: MDBK_MAGIC,
                },
            )
            // Another practice's key, or an altered file.
            .map_err(|_| {
                log_system!(warn, event = "BACKUP_DECRYPT_FAILED");
                AppError::validation_code("error.backup.decrypt_failed")
            })?,
    );
    let mut image = zeroize::Zeroizing::new(Vec::new());
    flate2::read::GzDecoder::new(&compressed[..])
        .read_to_end(&mut image)
        .map_err(|e| fail("error.backup.unpack_failed", "BACKUP_DECOMPRESS_FAILED", e))?;
    Ok(image)
}

/// Writes a compressed, encrypted, signed backup of `pool` to `target`.
pub async fn write_compressed(
    pool: &SqlitePool,
    db_key: &[u8],
    target: &Path,
) -> Result<(), AppError> {
    let image = plaintext_image(pool).await?;
    let key = zeroize::Zeroizing::new(db_key.to_vec());
    // Compression and encryption are CPU-bound: keep them off the async runtime.
    // Compression and encryption: a low-priority thread, off the async runtime.
    let sealed = super::super::backup_files::run_in_background(move || seal(&image, &key)).await?;
    // Write beside, then rename: a crash never leaves a half-written backup under the real name.
    let part = target.with_extension("mdbk.part");
    if let Err(e) = std::fs::write(&part, &sealed) {
        let _ = std::fs::remove_file(&part);
        return Err(io_fail(
            "error.backup.write_failed",
            "BACKUP_WRITE_FAILED",
            e,
        ));
    }
    std::fs::rename(&part, target)
        .map_err(|e| io_fail("error.backup.write_failed", "BACKUP_RENAME_FAILED", e))?;
    write_signature(target)
}

/// Creates a compressed backup in the backup folder, then applies retention.
pub async fn create_compressed(
    pool: &SqlitePool,
    app_data_dir: &Path,
) -> Result<PathBuf, AppError> {
    let dir = backup_dir();
    std::fs::create_dir_all(&dir)
        .map_err(|e| io_fail("error.backup.folder_unavailable", "BACKUP_DIR_FAILED", e))?;
    let ts = Utc::now().format("%Y%m%dT%H%M%SZ");
    let mut target = dir.join(format!("medoc-{ts}.{COMPRESSED_EXT}"));
    let mut n = 1u32;
    while target.exists() {
        target = dir.join(format!("medoc-{ts}-{n}.{COMPRESSED_EXT}"));
        n += 1;
    }
    log_system!(info, event = "BACKUP_START", target = %target.display(), format = "mdbk");
    let key = backup_key(app_data_dir)?;
    if let Err(e) = write_compressed(pool, &key, &target).await {
        log_system!(error, event = "BACKUP_FAILED", target = %target.display(), code = %e.wire_code());
        let _ = std::fs::remove_file(&target);
        let _ = std::fs::remove_file(sig_path(&target));
        return Err(e);
    }
    // Attachments (X-rays, scans…): new files go into the folder's shared encrypted store.
    let files = {
        let (app_dir, archive, key) = (app_data_dir.to_path_buf(), target.clone(), key.clone());
        super::super::backup_files::run_in_background(move || {
            super::super::backup_files::back_up_attachments(&app_dir, &archive, &key)
        })
        .await
    };
    if let Err(e) = files {
        log_system!(error, event = "BACKUP_FAILED", target = %target.display(), code = %e.wire_code());
        for p in backup_and_sidecars(&target) {
            let _ = std::fs::remove_file(p);
        }
        return Err(e);
    }
    copy_recovery_sidecars(app_data_dir, &target);
    let report = enforce_retention(&dir)?;
    super::super::backup_files::collect_garbage(&dir);
    let size = std::fs::metadata(&target).map(|m| m.len()).unwrap_or(0);
    log_system!(
        info,
        event = "BACKUP_COMPLETE",
        target = %target.display(),
        bytes = size,
        kept = report.kept,
        deleted = report.deleted.len(),
    );
    Ok(target)
}

/// `file:` URI for an absolute path (escaping `%`, `?`, `#`; Windows drive paths get a `/`).
pub(super) fn sqlite_file_uri(path: &Path) -> String {
    let mut p = path.to_string_lossy().replace('\\', "/");
    if !p.starts_with('/') {
        p.insert(0, '/');
    }
    let p = p
        .replace('%', "%25")
        .replace('?', "%3f")
        .replace('#', "%23")
        .replace('\'', "''");
    format!("file:{p}?mode=rwc")
}

/// Unpacks a `.mdbk` into an encrypted database file at `out` (never a plain file on disk):
/// the image is loaded into a plain in-memory connection and `sqlcipher_export` writes it into
/// the attached, encrypted target.
pub async fn unpack_to_encrypted_db(
    mdbk: &Path,
    db_key: &[u8],
    out: &Path,
) -> Result<(), AppError> {
    use sqlx::Connection;
    let file = std::fs::read(mdbk)
        .map_err(|e| io_fail("error.backup.read_failed", "BACKUP_READ_FAILED", e))?;
    let key = zeroize::Zeroizing::new(db_key.to_vec());
    let image = super::super::backup_files::run_in_background(move || unseal(&file, &key)).await?;
    let buf = sqlx::sqlite::SqliteOwnedBuf::try_from(&image[..])
        .map_err(|e| fail("error.backup.unpack_failed", "BACKUP_UNPACK_FAILED", e))?;
    drop(image);
    let _ = std::fs::remove_file(out);
    let key_hex = zeroize::Zeroizing::new(
        db_key
            .iter()
            .map(|b| format!("{b:02x}"))
            .collect::<String>(),
    );
    let mut conn = sqlx::sqlite::SqliteConnection::connect("sqlite::memory:")
        .await
        .map_err(|e| fail("error.backup.unpack_failed", "BACKUP_UNPACK_FAILED", e))?;
    let result = async {
        conn.deserialize(None, buf, false).await?;
        // The memory connection is opened in URI mode: a bare path would also be in memory.
        sqlx::query(&format!(
            "ATTACH DATABASE '{}' AS restored KEY \"x'{}'\"",
            sqlite_file_uri(out),
            key_hex.as_str()
        ))
        .execute(&mut conn)
        .await?;
        sqlx::query("SELECT sqlcipher_export('restored')")
            .execute(&mut conn)
            .await?;
        sqlx::query("DETACH DATABASE restored")
            .execute(&mut conn)
            .await?;
        Ok::<_, sqlx::Error>(())
    }
    .await;
    let _ = conn.close().await;
    if let Err(e) = result {
        let _ = std::fs::remove_file(out);
        return Err(fail(
            "error.backup.unpack_failed",
            "BACKUP_UNPACK_FAILED",
            e,
        ));
    }
    if !out.is_file() {
        return Err(fail(
            "error.backup.unpack_failed",
            "BACKUP_UNPACK_FAILED",
            "no file written",
        ));
    }
    log_system!(info, event = "BACKUP_UNPACKED", from = %mdbk.display());
    Ok(())
}
