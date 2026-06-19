// manifest.hpp — the activation manifest the Rust app imports.
// Public values are emitted in clear; the three secret keys live only inside
// the AEAD-sealed blob. No external JSON library: we emit a small, fixed shape.
#pragma once
#include <sodium.h>

#include <string>
#include <vector>

struct Manifest {
  int                        version = 1;
  std::vector<unsigned char> cluster_id;   // 16 bytes
  std::vector<unsigned char> device_pk;    // ed25519 public key
  std::string                fingerprint;  // base32(sha256(device_pk))
  std::vector<unsigned char> ca_pk;      // cluster CA public key
  std::string                created_at;   // RFC3339 UTC

  // KDF (Argon2id) parameters needed for the Rust side to re-derive the wrap key
  std::vector<unsigned char> kdf_salt;
  unsigned long long         kdf_ops = 0;
  std::size_t                kdf_mem = 0;

  // sealed = AEAD(device_sk || ca_sk || db_key) under the KDF-derived key
  std::vector<unsigned char> nonce;
  std::vector<unsigned char> sealed;
};

// libsodium base64 (original variant, with padding).
inline std::string b64(const std::vector<unsigned char>& v) {
  if (v.empty()) return std::string();
  std::string out;
  out.resize(sodium_base64_encoded_len(v.size(), sodium_base64_VARIANT_ORIGINAL));
  sodium_bin2base64(out.data(), out.size(), v.data(), v.size(),
                    sodium_base64_VARIANT_ORIGINAL);
  if (!out.empty() && out.back() == '\0') out.pop_back();
  return out;
}

inline std::string json_escape(const std::string& s) {
  std::string o;
  for (char c : s) {
    if (c == '"' || c == '\\') o.push_back('\\');
    o.push_back(c);
  }
  return o;
}

inline std::string manifest_to_json(const Manifest& m) {
  std::string j;
  j += "{\n";
  j += "  \"version\": " + std::to_string(m.version) + ",\n";
  j += "  \"cluster_id\": \"" + b64(m.cluster_id) + "\",\n";
  j += "  \"device_pubkey\": \"" + b64(m.device_pk) + "\",\n";
  j += "  \"device_fingerprint\": \"" + json_escape(m.fingerprint) + "\",\n";
  j += "  \"cluster_ca_pubkey\": \"" + b64(m.ca_pk) + "\",\n";
  j += "  \"created_at\": \"" + json_escape(m.created_at) + "\",\n";
  j += "  \"kdf\": { \"alg\": \"argon2id13\", \"salt\": \"" + b64(m.kdf_salt) +
       "\", \"ops\": " + std::to_string(m.kdf_ops) +
       ", \"mem\": " + std::to_string(m.kdf_mem) + " },\n";
  j += "  \"sealed\": { \"nonce\": \"" + b64(m.nonce) + "\", \"ciphertext\": \"" +
       b64(m.sealed) + "\" }\n";
  j += "}\n";
  return j;
}
