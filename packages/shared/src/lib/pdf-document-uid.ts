/**
 * Document id written into every MeDoc PDF (`/MeDocDocumentId`, footer line,
 * trailer `/ID`). For issued documents it equals `issued_document.id`
 * (`documentId`); previews and exports get their own id, logged on save.
 */
export function pdfDocumentUid(bytes: Uint8Array): string | null {
    const needle = "/MeDocDocumentId (";
    // The Info dictionary sits near the end of the file.
    const tail = bytes.subarray(Math.max(0, bytes.length - 8192));
    let text = "";
    for (let i = 0; i < tail.length; i++) text += String.fromCharCode(tail[i]!);
    let at = text.lastIndexOf(needle);
    if (at < 0) {
        text = "";
        for (let i = 0; i < bytes.length; i++) text += String.fromCharCode(bytes[i]!);
        at = text.lastIndexOf(needle);
        if (at < 0) return null;
    }
    const start = at + needle.length;
    const end = text.indexOf(")", start);
    const uid = end > start ? text.slice(start, end) : "";
    return /^[0-9a-zA-Z-]{8,64}$/.test(uid) ? uid : null;
}
