// keygen.cpp — all crypto via libsodium. No hand-rolled primitives.
#include "base32.hpp"
#include "keygen.hpp"

#include <algorithm>
#include <array>
#include <cstring>
#include <ctime>
#include <stdexcept>

namespace {

struct Secrets {
  std::array<unsigned char, crypto_sign_SECRETKEYBYTES> device_sk{};
  std::array<unsigned char, crypto_sign_SECRETKEYBYTES> ca_sk{};
  std::array<unsigned char, 32>                         db_key{};
  std::array<unsigned char, 32>                         practice_share{};
  std::array<unsigned char, 32>                         vendor_share{};
  ~Secrets() {
    sodium_memzero(device_sk.data(), device_sk.size());
    sodium_memzero(ca_sk.data(), ca_sk.size());
    sodium_memzero(db_key.data(), db_key.size());
    sodium_memzero(practice_share.data(), practice_share.size());
    sodium_memzero(vendor_share.data(), vendor_share.size());
  }
};

void utc_tm(std::time_t t, std::tm* out) {
#ifdef _WIN32
  gmtime_s(out, &t);
#else
  gmtime_r(&t, out);
#endif
}

std::string rfc3339_now() {
  std::time_t t = std::time(nullptr);
  std::tm     tmv{};
  utc_tm(t, &tmv);
  char buf[32];
  std::strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%SZ", &tmv);
  return std::string(buf);
}

void append(std::vector<unsigned char>& dst, const unsigned char* p, std::size_t n) {
  dst.insert(dst.end(), p, p + n);
}

// HKDF-SHA256 via libsodium HMAC (portable; avoids requiring 1.0.19-only APIs).
void hkdf_sha256(unsigned char* okm, std::size_t okm_len, const unsigned char* ikm,
                 std::size_t ikm_len, const unsigned char* info, std::size_t info_len) {
  unsigned char salt[32] = {0};
  unsigned char prk[32];
  crypto_auth_hmacsha256_state st;
  crypto_auth_hmacsha256_init(&st, salt, sizeof(salt));
  crypto_auth_hmacsha256_update(&st, ikm, ikm_len);
  crypto_auth_hmacsha256_final(&st, prk);

  unsigned char t[32];
  std::size_t   offset = 0;
  unsigned char counter = 1;
  unsigned char empty = 0;
  while (offset < okm_len) {
    crypto_auth_hmacsha256_init(&st, prk, sizeof(prk));
    if (counter > 1) {
      crypto_auth_hmacsha256_update(&st, t, sizeof(t));
    } else {
      (void)empty;
    }
    if (info_len) crypto_auth_hmacsha256_update(&st, info, info_len);
    crypto_auth_hmacsha256_update(&st, &counter, 1);
    crypto_auth_hmacsha256_final(&st, t);
    std::size_t take = std::min(sizeof(t), okm_len - offset);
    std::memcpy(okm + offset, t, take);
    offset += take;
    ++counter;
  }
  sodium_memzero(prk, sizeof(prk));
  sodium_memzero(t, sizeof(t));
}

}  // namespace

KeygenBundle generate(const std::string& passphrase,
                      const std::vector<unsigned char>& vendor_pk_in) {
  if (sodium_init() < 0) throw std::runtime_error("libsodium init failed");

  KeygenBundle bundle;
  Manifest&    m = bundle.manifest;
  Secrets      s;

  m.cluster_id.resize(16);
  randombytes_buf(m.cluster_id.data(), m.cluster_id.size());
  m.cluster_id[6] = static_cast<unsigned char>((m.cluster_id[6] & 0x0f) | 0x40);
  m.cluster_id[8] = static_cast<unsigned char>((m.cluster_id[8] & 0x3f) | 0x80);

  m.device_pk.resize(crypto_sign_PUBLICKEYBYTES);
  crypto_sign_keypair(m.device_pk.data(), s.device_sk.data());
  m.ca_pk.resize(crypto_sign_PUBLICKEYBYTES);
  crypto_sign_keypair(m.ca_pk.data(), s.ca_sk.data());

  std::array<unsigned char, crypto_hash_sha256_BYTES> fp{};
  crypto_hash_sha256(fp.data(), m.device_pk.data(), m.device_pk.size());
  m.fingerprint = base32_encode(fp.data(), fp.size());

  randombytes_buf(s.db_key.data(), s.db_key.size());
  randombytes_buf(s.practice_share.data(), s.practice_share.size());
  for (std::size_t i = 0; i < 32; ++i) {
    s.vendor_share[i] = static_cast<unsigned char>(s.db_key[i] ^ s.practice_share[i]);
  }

  bundle.kcv = compute_kcv(s.db_key.data());

  // --- Bridge A: activation.json ---
  m.kdf_salt.resize(crypto_pwhash_SALTBYTES);
  randombytes_buf(m.kdf_salt.data(), m.kdf_salt.size());
  m.kdf_ops = crypto_pwhash_OPSLIMIT_MODERATE;
  m.kdf_mem = crypto_pwhash_MEMLIMIT_MODERATE;

  std::array<unsigned char, crypto_aead_xchacha20poly1305_ietf_KEYBYTES> wrap{};
  if (crypto_pwhash(wrap.data(), wrap.size(), passphrase.c_str(), passphrase.size(),
                    m.kdf_salt.data(), m.kdf_ops, m.kdf_mem,
                    crypto_pwhash_ALG_ARGON2ID13) != 0) {
    sodium_memzero(wrap.data(), wrap.size());
    throw std::runtime_error("Argon2id KDF failed (out of memory)");
  }

  std::vector<unsigned char> plain;
  append(plain, s.device_sk.data(), s.device_sk.size());
  append(plain, s.ca_sk.data(), s.ca_sk.size());
  append(plain, s.db_key.data(), s.db_key.size());

  m.nonce.resize(crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
  randombytes_buf(m.nonce.data(), m.nonce.size());

  m.sealed.resize(plain.size() + crypto_aead_xchacha20poly1305_ietf_ABYTES);
  unsigned long long clen = 0;
  crypto_aead_xchacha20poly1305_ietf_encrypt(m.sealed.data(), &clen, plain.data(),
                                             plain.size(), nullptr, 0, nullptr,
                                             m.nonce.data(), wrap.data());
  m.sealed.resize(static_cast<std::size_t>(clen));
  sodium_memzero(plain.data(), plain.size());
  sodium_memzero(wrap.data(), wrap.size());

  m.created_at = rfc3339_now();

  // --- Vendor X25519 pubkey ---
  std::vector<unsigned char> vendor_pk = vendor_pk_in;
  if (vendor_pk.empty()) {
    vendor_pk.resize(crypto_scalarmult_BYTES);
    bundle.ephemeral_vendor_sk.resize(crypto_scalarmult_SCALARBYTES);
    randombytes_buf(bundle.ephemeral_vendor_sk.data(), bundle.ephemeral_vendor_sk.size());
    // clamp is done by crypto_scalarmult_base
    crypto_scalarmult_base(vendor_pk.data(), bundle.ephemeral_vendor_sk.data());
  } else if (vendor_pk.size() != crypto_scalarmult_BYTES) {
    throw std::runtime_error("vendor recovery pubkey must be 32 bytes (X25519)");
  }

  auto key_id = key_id_from_vendor_pk(vendor_pk.data());
  std::string key_id_hex = hex_encode(key_id);

  // --- Bridge C practice share (cleartext / printed sheet) ---
  PracticeRecoveryShare& ps = bundle.practice;
  ps.cluster_id = m.cluster_id;
  ps.fingerprint = m.fingerprint;
  ps.created_at = m.created_at;
  ps.key_id_hex = key_id_hex;
  ps.kcv = bundle.kcv;
  ps.share.assign(s.practice_share.begin(), s.practice_share.end());

  // --- Bridge C vendor share: ephemeral X25519 + HKDF + XChaCha20-Poly1305 + AAD ---
  std::array<unsigned char, crypto_scalarmult_SCALARBYTES> eph_sk{};
  std::vector<unsigned char> eph_pk(crypto_scalarmult_BYTES);
  randombytes_buf(eph_sk.data(), eph_sk.size());
  crypto_scalarmult_base(eph_pk.data(), eph_sk.data());

  std::array<unsigned char, crypto_scalarmult_BYTES> shared{};
  if (crypto_scalarmult(shared.data(), eph_sk.data(), vendor_pk.data()) != 0) {
    sodium_memzero(eph_sk.data(), eph_sk.size());
    throw std::runtime_error("X25519 ECDH failed");
  }
  sodium_memzero(eph_sk.data(), eph_sk.size());

  std::array<unsigned char, 32> kek{};
  hkdf_sha256(kek.data(), kek.size(), shared.data(), shared.size(),
              reinterpret_cast<const unsigned char*>(VENDOR_HKDF_INFO),
              sizeof(VENDOR_HKDF_INFO) - 1);
  sodium_memzero(shared.data(), shared.size());

  VendorRecoveryShare& vs = bundle.vendor;
  vs.cluster_id = m.cluster_id;
  vs.fingerprint = m.fingerprint;
  vs.created_at = m.created_at;
  vs.key_id_hex = key_id_hex;
  vs.kcv = bundle.kcv;
  vs.vendor_pk = vendor_pk;
  vs.ephemeral_pk = eph_pk;
  vs.aad = build_vendor_aad(m.cluster_id, m.fingerprint, key_id, RECOVERY_POLICY_VERSION);
  vs.nonce.resize(crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
  randombytes_buf(vs.nonce.data(), vs.nonce.size());
  vs.ciphertext.resize(32 + crypto_aead_xchacha20poly1305_ietf_ABYTES);
  unsigned long long ctlen = 0;
  crypto_aead_xchacha20poly1305_ietf_encrypt(
      vs.ciphertext.data(), &ctlen, s.vendor_share.data(), 32, vs.aad.data(), vs.aad.size(),
      nullptr, vs.nonce.data(), kek.data());
  vs.ciphertext.resize(static_cast<std::size_t>(ctlen));
  sodium_memzero(kek.data(), kek.size());

  return bundle;
}
