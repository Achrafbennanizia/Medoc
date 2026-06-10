//! Pairing persistence port (DIP — HTTP handlers and tests can swap backends).

use std::future::Future;

use medoc_core::error::AppError;
use sqlx::SqlitePool;

use super::types::{PairingDecideResult, PairingDecision, PairingRequest, PairingRequestSubmit};

/// Master-side pairing persistence contract.
pub trait PairingPersistence: Send + Sync {
    fn submit_request(
        &self,
        submit: PairingRequestSubmit,
    ) -> impl Future<Output = Result<PairingRequest, AppError>> + Send;

    fn list_pending(&self) -> impl Future<Output = Result<Vec<PairingRequest>, AppError>> + Send;

    fn list_all(&self) -> impl Future<Output = Result<Vec<PairingRequest>, AppError>> + Send;

    fn load_by_id(
        &self,
        id: &str,
    ) -> impl Future<Output = Result<Option<PairingRequest>, AppError>> + Send;

    fn load_by_device(
        &self,
        device_id: &str,
    ) -> impl Future<Output = Result<Option<PairingRequest>, AppError>> + Send;

    fn decide(
        &self,
        master_device_id: &str,
        request_id: &str,
        decision: PairingDecision,
        replica_http_port: u16,
    ) -> impl Future<Output = Result<PairingDecideResult, AppError>> + Send;

    fn confirm_pin(
        &self,
        master_device_id: &str,
        request_id: &str,
        pin: &str,
        replica_http_port: u16,
    ) -> impl Future<Output = Result<PairingRequest, AppError>> + Send;

    fn revoke(
        &self,
        master_device_id: &str,
        device_id: &str,
        decided_by: &str,
    ) -> impl Future<Output = Result<(), AppError>> + Send;
}

/// Default SQLite-backed implementation (portable across Tauri + headless binaries).
#[derive(Clone, Copy)]
pub struct SqlitePairingStore<'a>(pub &'a SqlitePool);

impl PairingPersistence for SqlitePairingStore<'_> {
    async fn submit_request(
        &self,
        submit: PairingRequestSubmit,
    ) -> Result<PairingRequest, AppError> {
        super::store::submit_request(self.0, submit).await
    }

    async fn list_pending(&self) -> Result<Vec<PairingRequest>, AppError> {
        super::store::list_pending(self.0).await
    }

    async fn list_all(&self) -> Result<Vec<PairingRequest>, AppError> {
        super::store::list_all(self.0).await
    }

    async fn load_by_id(&self, id: &str) -> Result<Option<PairingRequest>, AppError> {
        super::store::load_by_id(self.0, id).await
    }

    async fn load_by_device(&self, device_id: &str) -> Result<Option<PairingRequest>, AppError> {
        super::store::load_by_device(self.0, device_id).await
    }

    async fn decide(
        &self,
        master_device_id: &str,
        request_id: &str,
        decision: PairingDecision,
        replica_http_port: u16,
    ) -> Result<PairingDecideResult, AppError> {
        super::store::decide(
            self.0,
            master_device_id,
            request_id,
            decision,
            replica_http_port,
        )
        .await
    }

    async fn confirm_pin(
        &self,
        master_device_id: &str,
        request_id: &str,
        pin: &str,
        replica_http_port: u16,
    ) -> Result<PairingRequest, AppError> {
        super::store::confirm_pin(self.0, master_device_id, request_id, pin, replica_http_port)
            .await
    }

    async fn revoke(
        &self,
        master_device_id: &str,
        device_id: &str,
        decided_by: &str,
    ) -> Result<(), AppError> {
        super::store::revoke(self.0, master_device_id, device_id, decided_by).await
    }
}
