// keygen.cpp — all crypto via libsodium. No hand-rolled primitives.
#include "base32.hpp"
#include "keygen.hpp"

#include <array>
#include <ctime>
#include <stdexcept>

namespace {

// Secret buffers wiped on scope exit so keys never linger in memory.
struct Secrets {
  std::array<unsigned char, crypto_sign_SECRETKEYBYTES> device_sk{};
  std::array<unsigned char, crypto_sign_SECRETKEYBYTES> ca_sk{};
  std::array<unsigned char, 32>                         db_key{};
  ~Secrets() {
    sodium_memzero(device_sk.data(), device_sk.size());
    sodium_memzero(ca_sk.data(), ca_sk.size());
    sodium_memzero(db_key.data(), db_key.size());
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

}  // namespace

Manifest generate(const std::string& passphrase) {
  if (sodium_init() < 0) throw std::runtime_error("libsodium init failed");

  Manifest m;
  Secrets  s;

  // cluster id — RFC 4122 UUID v4 (16 bytes)
  m.cluster_id.resize(16);
  randombytes_buf(m.cluster_id.data(), m.cluster_id.size());
  m.cluster_id[6] = static_cast<unsigned char>((m.cluster_id[6] & 0x0f) | 0x40);
  m.cluster_id[8] = static_cast<unsigned char>((m.cluster_id[8] & 0x3f) | 0x80);

  // device + cluster CA ed25519 identities
  m.device_pk.resize(crypto_sign_PUBLICKEYBYTES);
  crypto_sign_keypair(m.device_pk.data(), s.device_sk.data());
  m.ca_pk.resize(crypto_sign_PUBLICKEYBYTES);
  crypto_sign_keypair(m.ca_pk.data(), s.ca_sk.data());

  // fingerprint = base32(sha256(device_pk))
  std::array<unsigned char, crypto_hash_sha256_BYTES> fp{};
  crypto_hash_sha256(fp.data(), m.device_pk.data(), m.device_pk.size());
  m.fingerprint = base32_encode(fp.data(), fp.size());

  // database master key (32 random bytes)
  randombytes_buf(s.db_key.data(), s.db_key.size());

  // derive wrap key from passphrase via Argon2id
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

  // pack the three secrets and AEAD-seal them
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
  return m;  // Secrets destructor wipes the raw keys
}
