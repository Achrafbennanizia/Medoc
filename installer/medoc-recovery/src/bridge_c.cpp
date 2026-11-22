#include "recovery.hpp"

#include "recovery_share.hpp"

#include <sodium.h>

#include <cstring>
#include <fstream>
#include <stdexcept>
#include <vector>

RecoveredKey recover_bridge_c(const std::string& practice_path, const std::string& vendor_path,
                              const std::string& vendor_sk_path, const std::string& passphrase) {
  if (sodium_init() < 0) throw std::runtime_error("libsodium init failed");

  std::string pj = read_file(practice_path);
  std::string vj = read_file(vendor_path);

  if (field(pj, "kind") != "practice-recovery.share.v1") {
    throw std::runtime_error("practice share kind mismatch");
  }
  if (field(vj, "kind") != "vendor-recovery.share.v1") {
    throw std::runtime_error("vendor share kind mismatch");
  }

  auto salt  = unb64(field(pj, "salt"));
  auto nonce = unb64(field(pj, "nonce"));
  auto ct    = unb64(field(pj, "ciphertext"));
  unsigned long long ops = json_num(pj, "ops");
  size_t             mem = static_cast<size_t>(json_num(pj, "mem"));

  std::vector<unsigned char> wrap(crypto_aead_xchacha20poly1305_ietf_KEYBYTES);
  if (crypto_pwhash(wrap.data(), wrap.size(), passphrase.c_str(), passphrase.size(), salt.data(),
                    ops, mem, crypto_pwhash_ALG_ARGON2ID13) != 0) {
    secure_zero(wrap);
    throw std::runtime_error("practice-share KDF failed");
  }

  const unsigned char* ad =
      reinterpret_cast<const unsigned char*>(PRACTICE_SHARE_DOMAIN);
  const unsigned long long adlen =
      static_cast<unsigned long long>(std::strlen(PRACTICE_SHARE_DOMAIN));

  std::vector<unsigned char> practice(ct.size());
  unsigned long long         plen = 0;
  if (crypto_aead_xchacha20poly1305_ietf_decrypt(practice.data(), &plen, nullptr, ct.data(),
                                                 ct.size(), ad, adlen, nonce.data(),
                                                 wrap.data()) != 0) {
    secure_zero(wrap);
    secure_zero(practice);
    throw std::runtime_error("practice-share decrypt failed");
  }
  practice.resize(plen);
  secure_zero(wrap);
  if (practice.size() != 32) throw std::runtime_error("practice share length != 32");

  auto sealed = unb64(field(vj, "sealed_box"));
  auto pk     = unb64(field(vj, "vendor_recovery_pubkey"));

  std::ifstream skf(vendor_sk_path, std::ios::binary);
  if (!skf) throw std::runtime_error("cannot read vendor recovery sk: " + vendor_sk_path);
  std::vector<unsigned char> sk(crypto_box_SECRETKEYBYTES);
  skf.read(reinterpret_cast<char*>(sk.data()), static_cast<std::streamsize>(sk.size()));
  if (skf.gcount() != static_cast<std::streamsize>(sk.size())) {
    secure_zero(sk);
    secure_zero(practice);
    throw std::runtime_error("vendor-recovery.sk short");
  }

  std::vector<unsigned char> vendor(sealed.size());
  if (crypto_box_seal_open(vendor.data(), sealed.data(), sealed.size(), pk.data(), sk.data()) !=
      0) {
    secure_zero(sk);
    secure_zero(practice);
    secure_zero(vendor);
    throw std::runtime_error("vendor-share decrypt failed");
  }
  vendor.resize(32);
  secure_zero(sk);

  // Binding check: stored AAD must match reconstructed AAD
  auto cluster_id = unb64(field(vj, "cluster_id"));
  auto fp         = field(vj, "device_fingerprint");
  int  policy     = static_cast<int>(json_num(vj, "recovery_policy_version"));
  auto expect_aad = build_vendor_aad(cluster_id, fp, policy);
  auto stored_aad = unb64(field(vj, "aad"));
  if (expect_aad.size() != stored_aad.size() ||
      sodium_memcmp(expect_aad.data(), stored_aad.data(), expect_aad.size()) != 0) {
    secure_zero(practice);
    secure_zero(vendor);
    throw std::runtime_error("vendor share AAD binding mismatch");
  }

  RecoveredKey out;
  out.key.resize(32);
  for (std::size_t i = 0; i < 32; ++i) {
    out.key[i] = static_cast<unsigned char>(practice[i] ^ vendor[i]);
  }
  secure_zero(practice);
  secure_zero(vendor);
  return out;
}
