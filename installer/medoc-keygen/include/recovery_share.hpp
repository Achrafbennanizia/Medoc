// recovery_share.hpp — Bridge C practice (cleartext v2) + vendor recovery share JSON.
#pragma once
#include "manifest.hpp"

#include <sodium.h>

#include <cstdint>
#include <cstring>
#include <string>
#include <vector>

inline constexpr int RECOVERY_POLICY_VERSION = 2;
inline constexpr char VENDOR_SHARE_AAD_PREFIX[] = "medoc-vendor-share-v2";
inline constexpr char KCV_INFO[] = "medoc-kcv-v1";
inline constexpr char VENDOR_HKDF_INFO[] = "medoc-vendor-share-v2";

struct PracticeRecoveryShare {
  int                        version = 2;
  std::string                kind = "practice-recovery.share.v2";
  std::vector<unsigned char> cluster_id;
  std::string                fingerprint;
  int                        recovery_policy_version = RECOVERY_POLICY_VERSION;
  std::string                key_id_hex;  // 8 bytes → 16 hex
  std::vector<unsigned char> kcv;         // 16 bytes
  std::vector<unsigned char> share;       // 32 bytes cleartext
  std::string                created_at;
};

struct VendorRecoveryShare {
  int                        version = 2;
  std::string                kind = "vendor-recovery.share.v2";
  std::vector<unsigned char> cluster_id;
  std::string                fingerprint;
  int                        recovery_policy_version = RECOVERY_POLICY_VERSION;
  std::string                key_id_hex;
  std::vector<unsigned char> kcv;
  std::vector<unsigned char> vendor_pk;      // X25519
  std::vector<unsigned char> ephemeral_pk;   // X25519
  std::vector<unsigned char> aad;
  std::vector<unsigned char> nonce;
  std::vector<unsigned char> ciphertext;
  std::string                created_at;
};

struct KeygenBundle {
  Manifest              manifest;
  std::vector<unsigned char> kcv;  // also embedded in manifest JSON
  PracticeRecoveryShare practice;
  VendorRecoveryShare   vendor;
  std::vector<unsigned char> ephemeral_vendor_sk;  // only if minted
};

inline std::string hex_encode(const unsigned char* p, std::size_t n) {
  static const char* hexd = "0123456789abcdef";
  std::string out;
  out.resize(n * 2);
  for (std::size_t i = 0; i < n; ++i) {
    out[i * 2]     = hexd[(p[i] >> 4) & 0xf];
    out[i * 2 + 1] = hexd[p[i] & 0xf];
  }
  return out;
}

inline std::string hex_encode(const std::vector<unsigned char>& v) {
  return hex_encode(v.data(), v.size());
}

inline void hkdf_sha256_okm(unsigned char* okm, std::size_t okm_len, const unsigned char* ikm,
                            std::size_t ikm_len, const unsigned char* info,
                            std::size_t info_len) {
  unsigned char salt[32] = {0};
  unsigned char prk[32];
  crypto_auth_hmacsha256_state st;
  crypto_auth_hmacsha256_init(&st, salt, sizeof(salt));
  crypto_auth_hmacsha256_update(&st, ikm, ikm_len);
  crypto_auth_hmacsha256_final(&st, prk);
  unsigned char t[32];
  std::size_t   offset = 0;
  unsigned char counter = 1;
  while (offset < okm_len) {
    crypto_auth_hmacsha256_init(&st, prk, sizeof(prk));
    if (counter > 1) crypto_auth_hmacsha256_update(&st, t, sizeof(t));
    if (info_len) crypto_auth_hmacsha256_update(&st, info, info_len);
    crypto_auth_hmacsha256_update(&st, &counter, 1);
    crypto_auth_hmacsha256_final(&st, t);
    std::size_t take = (sizeof(t) < okm_len - offset) ? sizeof(t) : (okm_len - offset);
    std::memcpy(okm + offset, t, take);
    offset += take;
    ++counter;
  }
  sodium_memzero(prk, sizeof(prk));
  sodium_memzero(t, sizeof(t));
}

inline std::vector<unsigned char> compute_kcv(const unsigned char* db_key_32) {
  std::vector<unsigned char> out(16);
  unsigned char okm[32];
  hkdf_sha256_okm(okm, sizeof(okm), db_key_32, 32,
                  reinterpret_cast<const unsigned char*>(KCV_INFO), sizeof(KCV_INFO) - 1);
  std::memcpy(out.data(), okm, 16);
  sodium_memzero(okm, sizeof(okm));
  return out;
}

inline std::vector<unsigned char> key_id_from_vendor_pk(const unsigned char* pk_32) {
  unsigned char h[32];
  crypto_hash_sha256(h, pk_32, 32);
  return std::vector<unsigned char>(h, h + 8);
}

inline std::vector<unsigned char> build_vendor_aad(
    const std::vector<unsigned char>& cluster_id, const std::string& fingerprint,
    const std::vector<unsigned char>& key_id, int policy_version) {
  std::vector<unsigned char> aad;
  const char* prefix = VENDOR_SHARE_AAD_PREFIX;
  aad.insert(aad.end(), prefix, prefix + std::strlen(prefix));
  aad.insert(aad.end(), cluster_id.begin(), cluster_id.end());
  aad.insert(aad.end(), fingerprint.begin(), fingerprint.end());
  aad.insert(aad.end(), key_id.begin(), key_id.end());
  std::uint32_t pv = static_cast<std::uint32_t>(policy_version);
  aad.push_back(static_cast<unsigned char>((pv >> 24) & 0xff));
  aad.push_back(static_cast<unsigned char>((pv >> 16) & 0xff));
  aad.push_back(static_cast<unsigned char>((pv >> 8) & 0xff));
  aad.push_back(static_cast<unsigned char>(pv & 0xff));
  return aad;
}

inline std::string practice_share_to_json(const PracticeRecoveryShare& s) {
  std::string j;
  j += "{\n";
  j += "  \"version\": 2,\n";
  j += "  \"kind\": \"practice-recovery.share.v2\",\n";
  j += "  \"cluster_id\": \"" + b64(s.cluster_id) + "\",\n";
  j += "  \"device_fingerprint\": \"" + json_escape(s.fingerprint) + "\",\n";
  j += "  \"recovery_policy_version\": " + std::to_string(s.recovery_policy_version) + ",\n";
  j += "  \"key_id\": \"" + json_escape(s.key_id_hex) + "\",\n";
  j += "  \"kcv\": \"" + b64(s.kcv) + "\",\n";
  j += "  \"share\": \"" + b64(s.share) + "\",\n";
  j += "  \"created_at\": \"" + json_escape(s.created_at) + "\"\n";
  j += "}\n";
  return j;
}

inline std::string vendor_share_to_json(const VendorRecoveryShare& s) {
  std::string j;
  j += "{\n";
  j += "  \"version\": 2,\n";
  j += "  \"kind\": \"vendor-recovery.share.v2\",\n";
  j += "  \"cluster_id\": \"" + b64(s.cluster_id) + "\",\n";
  j += "  \"device_fingerprint\": \"" + json_escape(s.fingerprint) + "\",\n";
  j += "  \"recovery_policy_version\": " + std::to_string(s.recovery_policy_version) + ",\n";
  j += "  \"key_id\": \"" + json_escape(s.key_id_hex) + "\",\n";
  j += "  \"kcv\": \"" + b64(s.kcv) + "\",\n";
  j += "  \"vendor_recovery_pubkey\": \"" + b64(s.vendor_pk) + "\",\n";
  j += "  \"ephemeral_pubkey\": \"" + b64(s.ephemeral_pk) + "\",\n";
  j += "  \"aad\": \"" + b64(s.aad) + "\",\n";
  j += "  \"nonce\": \"" + b64(s.nonce) + "\",\n";
  j += "  \"ciphertext\": \"" + b64(s.ciphertext) + "\",\n";
  j += "  \"created_at\": \"" + json_escape(s.created_at) + "\"\n";
  j += "}\n";
  return j;
}

inline std::string practice_sheet_text(const PracticeRecoveryShare& s) {
  std::string t;
  t += "MeDoc Bridge C — practice recovery sheet\n";
  t += "KEEP OFFLINE (safe / sealed envelope). Survives forgotten passphrase.\n";
  t += "NOT sealed under the practice passphrase.\n\n";
  t += "device_fingerprint (mint-time): " + s.fingerprint + "\n";
  t += "key_id: " + s.key_id_hex + "\n";
  t += "kcv: " + b64(s.kcv) + "\n";
  t += "share_hex: " + hex_encode(s.share) + "\n";
  t += "share_b64: " + b64(s.share) + "\n";
  t += "\nPrint this page. QR of share_hex is optional.\n";
  t += "Combine with vendor-recovery.share.v2.json via medoc-recovery --bridge c.\n";
  return t;
}

// Manifest JSON with cleartext kcv field.
inline std::string manifest_to_json_with_kcv(const Manifest& m,
                                             const std::vector<unsigned char>& kcv) {
  std::string j;
  j += "{\n";
  j += "  \"version\": " + std::to_string(m.version) + ",\n";
  j += "  \"cluster_id\": \"" + b64(m.cluster_id) + "\",\n";
  j += "  \"device_pubkey\": \"" + b64(m.device_pk) + "\",\n";
  j += "  \"device_fingerprint\": \"" + json_escape(m.fingerprint) + "\",\n";
  j += "  \"cluster_ca_pubkey\": \"" + b64(m.ca_pk) + "\",\n";
  j += "  \"created_at\": \"" + json_escape(m.created_at) + "\",\n";
  j += "  \"kcv\": \"" + b64(kcv) + "\",\n";
  j += "  \"kdf\": { \"alg\": \"argon2id13\", \"salt\": \"" + b64(m.kdf_salt) +
       "\", \"ops\": " + std::to_string(m.kdf_ops) +
       ", \"mem\": " + std::to_string(m.kdf_mem) + " },\n";
  j += "  \"sealed\": { \"nonce\": \"" + b64(m.nonce) + "\", \"ciphertext\": \"" +
       b64(m.sealed) + "\" }\n";
  j += "}\n";
  return j;
}
