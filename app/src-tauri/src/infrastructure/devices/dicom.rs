// DICOM integration stub (FA-DEV-01).
//
// The full DICOM C-STORE/C-FIND/Worklist protocol requires a DICOM toolkit
// (dcmtk, pydicom or pixelbox). This module provides:
//
// 1. Lightweight inspection of DICOM files (header sniffing) so newly captured
//    images dropped into a watch folder can be linked to the patient record.
// 2. The contract surface for future SCU/SCP integration.

use serde::Serialize;
use std::io::Read;
use std::path::Path;

use crate::error::AppError;
use crate::log_device;

#[derive(Debug, Serialize)]
pub struct DicomFileInfo {
    pub path: String,
    pub size_bytes: u64,
    pub is_dicom: bool,
}

/// Detect a DICOM file by checking for the `DICM` magic at byte offset 128.
pub fn inspect(path: &Path) -> Result<DicomFileInfo, AppError> {
    let mut f =
        std::fs::File::open(path).map_err(|e| AppError::Internal(format!("DICOM open: {e}")))?;
    let size = f.metadata().map(|m| m.len()).unwrap_or(0);

    let mut prefix = [0u8; 132];
    let read_ok = f.read_exact(&mut prefix).is_ok();
    let is_dicom = read_ok && &prefix[128..132] == b"DICM";

    let info = DicomFileInfo {
        path: path.display().to_string(),
        size_bytes: size,
        is_dicom,
    };

    log_device!(info,
        event = "DICOM_INSPECT",
        path = %info.path,
        size_bytes = info.size_bytes,
        is_dicom = info.is_dicom,
    );

    Ok(info)
}

/// Stub for C-STORE — would forward an image to a remote PACS Application
/// Entity. Currently records the intent in the device log for traceability.
pub fn c_store_request(ae_title: &str, host: &str, port: u16, path: &Path) -> Result<(), AppError> {
    log_device!(warn,
        event = "DICOM_C_STORE_NOT_IMPLEMENTED",
        ae_title = %ae_title,
        host = %host,
        port,
        path = %path.display(),
    );
    Err(AppError::Internal(
        "DICOM C-STORE noch nicht implementiert".into(),
    ))
}
