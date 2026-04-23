// Device integrations (FA-DEV-01..08).
//
// Real DICOM/TWAIN integrations require platform libraries (dcmtk, libtwain).
// These modules expose the contract surface and emit structured `device.log`
// entries so end-to-end tests can run against the file format. Replace with
// concrete drivers once vendor SDKs are integrated.

pub mod dicom;
pub mod gdt;
pub mod scanner;
