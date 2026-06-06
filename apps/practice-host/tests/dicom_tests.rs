// DICOM header-sniffing unit tests (FA-DEV-01).

use medoc_lib::infrastructure::devices::dicom;
use std::io::Write;

fn tmp(name: &str) -> std::path::PathBuf {
    let p = std::env::temp_dir().join(format!("medoc-dicom-test-{}-{name}", std::process::id()));
    let _ = std::fs::remove_file(&p);
    p
}

#[test]
fn rejects_non_dicom_file() {
    let path = tmp("bad");
    let mut f = std::fs::File::create(&path).expect("create");
    f.write_all(b"not a dicom file at all and definitely longer than 132 bytes ............................................................").unwrap();
    drop(f);
    let info = dicom::inspect(&path).expect("inspect");
    assert!(!info.is_dicom);
    let _ = std::fs::remove_file(&path);
}

#[test]
fn detects_dicm_magic_at_offset_128() {
    let path = tmp("good");
    let mut f = std::fs::File::create(&path).expect("create");
    f.write_all(&[0u8; 128]).unwrap();
    f.write_all(b"DICM").unwrap();
    f.write_all(&[0u8; 16]).unwrap();
    drop(f);
    let info = dicom::inspect(&path).expect("inspect");
    assert!(info.is_dicom);
    assert!(info.size_bytes >= 132);
    let _ = std::fs::remove_file(&path);
}

#[test]
fn missing_file_returns_error() {
    let result = dicom::inspect(std::path::Path::new("/nonexistent/path/to/image.dcm"));
    assert!(result.is_err());
}
