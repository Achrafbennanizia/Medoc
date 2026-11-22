// verify.cpp — activation + Bridge C v2 (sheet + X25519/AEAD vendor share + KCV).
#include "recovery_share.hpp"

#include <sodium.h>

#include <algorithm>
#include <cstring>
#include <fstream>
#include <iostream>
#include <sstream>
#include <string>
#include <vector>

static std::string field(const std::string& j, const std::string& key) {
  auto k = j.find("\"" + key + "\"");
  if (k == std::string::npos) return {};
  auto c  = j.find(':', k);
  auto q1 = j.find('"', c + 1);
  auto q2 = j.find('"', q1 + 1);
  return j.substr(q1 + 1, q2 - q1 - 1);
}

static unsigned long long num(const std::string& j, const std::string& key) {
  auto k = j.find("\"" + key + "\"");
  if (k == std::string::npos) return 0;
  auto c = j.find(':', k);
  return std::strtoull(j.c_str() + c + 1, nullptr, 10);
}

static std::vector<unsigned char> unb64(const std::string& s) {
  std::vector<unsigned char> out(s.size());
  size_t                     olen = 0;
  sodium_base642bin(out.data(), out.size(), s.c_str(), s.size(), nullptr, &olen, nullptr,
                    sodium_base64_VARIANT_ORIGINAL);
  out.resize(olen);
  return out;
}

static std::string read_file(const std::string& path) {
  std::ifstream f(path);
  if (!f) return {};
  std::stringstream ss;
  ss << f.rdbuf();
  return ss.str();
}

static void hkdf_sha256(unsigned char* okm, std::size_t okm_len, const unsigned char* ikm,
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
  while (offset < okm_len) {
    crypto_auth_hmacsha256_init(&st, prk, sizeof(prk));
    if (counter > 1) crypto_auth_hmacsha256_update(&st, t, sizeof(t));
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

static int verify_activation(const std::string& j, const std::string& pw,
                             std::vector<unsigned char>& out_db_key,
                             std::vector<unsigned char>& out_kcv) {
  auto salt      = unb64(field(j, "salt"));
  auto nonce     = unb64(field(j, "nonce"));
  auto ct        = unb64(field(j, "ciphertext"));
  auto device_pk = unb64(field(j, "device_pubkey"));
  auto kcv_field = field(j, "kcv");
  unsigned long long ops = num(j, "ops");
  size_t             mem = static_cast<size_t>(num(j, "mem"));

  std::vector<unsigned char> wrap(crypto_aead_xchacha20poly1305_ietf_KEYBYTES);
  if (crypto_pwhash(wrap.data(), wrap.size(), pw.c_str(), pw.size(), salt.data(), ops, mem,
                    crypto_pwhash_ALG_ARGON2ID13) != 0) {
    std::cerr << "KDF failed\n";
    return 1;
  }

  std::vector<unsigned char> plain(ct.size());
  unsigned long long         plen = 0;
  if (crypto_aead_xchacha20poly1305_ietf_decrypt(plain.data(), &plen, nullptr, ct.data(),
                                                 ct.size(), nullptr, 0, nonce.data(),
                                                 wrap.data()) != 0) {
    std::cerr << "DECRYPT FAILED (wrong passphrase or tampered manifest)\n";
    sodium_memzero(wrap.data(), wrap.size());
    return 2;
  }
  plain.resize(plen);
  sodium_memzero(wrap.data(), wrap.size());

  if (plen != 160) {
    std::cerr << "unexpected plaintext length " << plen << "\n";
    return 3;
  }

  std::vector<unsigned char> device_sk(plain.begin(), plain.begin() + 64);
  const unsigned char        msg[] = "medoc-activation-check";
  std::vector<unsigned char> sig(crypto_sign_BYTES);
  unsigned long long         siglen = 0;
  crypto_sign_detached(sig.data(), &siglen, msg, sizeof(msg), device_sk.data());
  int ok = crypto_sign_verify_detached(sig.data(), msg, sizeof(msg), device_pk.data());
  std::cout << "device_sk matches published device_pk: " << (ok == 0 ? "YES" : "NO") << "\n";

  out_db_key.assign(plain.begin() + 128, plain.begin() + 160);
  auto expect_kcv = compute_kcv(out_db_key.data());
  if (!kcv_field.empty()) {
    auto got = unb64(kcv_field);
    bool kcv_ok = got.size() == expect_kcv.size() &&
                  sodium_memcmp(got.data(), expect_kcv.data(), got.size()) == 0;
    std::cout << "activation kcv matches db_key: " << (kcv_ok ? "YES" : "NO") << "\n";
    if (!kcv_ok) {
      sodium_memzero(device_sk.data(), device_sk.size());
      sodium_memzero(plain.data(), plain.size());
      return 11;
    }
  }
  out_kcv = expect_kcv;

  sodium_memzero(device_sk.data(), device_sk.size());
  sodium_memzero(plain.data(), plain.size());
  return ok == 0 ? 0 : 4;
}

static int verify_bridge_c(const std::string& dir, const std::vector<unsigned char>& db_key,
                           const std::vector<unsigned char>& kcv) {
  std::string pj = read_file(dir + "/practice-recovery.share.v2.json");
  std::string vj = read_file(dir + "/vendor-recovery.share.v2.json");
  if (pj.empty() || vj.empty()) {
    std::cout << "Bridge C v2 shares not present — skip\n";
    return 0;
  }
  if (field(pj, "kind") != "practice-recovery.share.v2") {
    std::cerr << "practice share must be v2 cleartext (not passphrase-sealed v1)\n";
    return 5;
  }

  auto practice = unb64(field(pj, "share"));
  if (practice.size() != 32) {
    std::cerr << "practice share length\n";
    return 6;
  }

  // Practice share must NOT equal KDF(anything from passphrase) — just check
  // it is independent of db_key (XOR partner).
  bool practice_alone = sodium_memcmp(practice.data(), db_key.data(), 32) == 0;
  std::cout << "practice share alone equals db_key (must be NO): "
            << (practice_alone ? "YES" : "NO") << "\n";

  auto eph_pk = unb64(field(vj, "ephemeral_pubkey"));
  auto ct     = unb64(field(vj, "ciphertext"));
  auto nonce  = unb64(field(vj, "nonce"));
  auto aad    = unb64(field(vj, "aad"));
  auto pk     = unb64(field(vj, "vendor_recovery_pubkey"));

  std::ifstream skf(dir + "/vendor-recovery.sk", std::ios::binary);
  if (!skf) {
    std::cout << "vendor-recovery.sk missing — practice share OK; skip vendor unwrap\n";
    sodium_memzero(practice.data(), practice.size());
    return practice_alone ? 10 : 0;
  }
  std::vector<unsigned char> sk(crypto_scalarmult_SCALARBYTES);
  skf.read(reinterpret_cast<char*>(sk.data()), static_cast<std::streamsize>(sk.size()));
  if (skf.gcount() != static_cast<std::streamsize>(sk.size())) {
    std::cerr << "vendor-recovery.sk short\n";
    return 8;
  }

  unsigned char shared[32];
  if (crypto_scalarmult(shared, sk.data(), eph_pk.data()) != 0) {
    std::cerr << "ECDH failed\n";
    return 9;
  }
  sodium_memzero(sk.data(), sk.size());

  unsigned char kek[32];
  hkdf_sha256(kek, 32, shared, 32,
              reinterpret_cast<const unsigned char*>(VENDOR_HKDF_INFO),
              sizeof(VENDOR_HKDF_INFO) - 1);
  sodium_memzero(shared, sizeof(shared));

  std::vector<unsigned char> vendor(ct.size());
  unsigned long long         plen = 0;
  if (crypto_aead_xchacha20poly1305_ietf_decrypt(vendor.data(), &plen, nullptr, ct.data(),
                                                 ct.size(), aad.data(), aad.size(), nonce.data(),
                                                 kek) != 0) {
    std::cerr << "vendor-share AEAD decrypt FAILED\n";
    sodium_memzero(kek, sizeof(kek));
    sodium_memzero(practice.data(), practice.size());
    return 9;
  }
  vendor.resize(plen);
  sodium_memzero(kek, sizeof(kek));

  // Header fingerprint used (not current machine) — already in JSON.
  std::cout << "vendor share mint fingerprint: " << field(vj, "device_fingerprint") << "\n";

  std::vector<unsigned char> combined(32);
  for (std::size_t i = 0; i < 32; ++i) {
    combined[i] = static_cast<unsigned char>(practice[i] ^ vendor[i]);
  }

  bool match = sodium_memcmp(combined.data(), db_key.data(), 32) == 0;
  auto got_kcv = compute_kcv(combined.data());
  bool kcv_ok =
      kcv.size() == got_kcv.size() && sodium_memcmp(kcv.data(), got_kcv.data(), kcv.size()) == 0;
  bool vendor_alone = sodium_memcmp(vendor.data(), db_key.data(), 32) == 0;

  std::cout << "Bridge C XOR reconstructs db_key: " << (match ? "YES" : "NO") << "\n";
  std::cout << "Bridge C KCV OK: " << (kcv_ok ? "YES" : "NO") << "\n";
  std::cout << "vendor share alone equals db_key (must be NO): "
            << (vendor_alone ? "YES" : "NO") << "\n";

  sodium_memzero(practice.data(), practice.size());
  sodium_memzero(vendor.data(), vendor.size());
  sodium_memzero(combined.data(), combined.size());
  return (match && kcv_ok && !vendor_alone && !practice_alone) ? 0 : 10;
}

int main(int argc, char** argv) {
  if (sodium_init() < 0) return 1;
  std::string path = argc > 1 ? argv[1] : "activation.json";
  std::string pw = argc > 2 ? argv[2] : "correct horse battery staple";

  std::string j = read_file(path);
  if (j.empty()) {
    std::cerr << "cannot open " << path << "\n";
    return 1;
  }

  std::vector<unsigned char> db_key;
  std::vector<unsigned char> kcv;
  int rc = verify_activation(j, pw, db_key, kcv);
  if (rc != 0) {
    sodium_memzero(db_key.data(), db_key.size());
    return rc;
  }

  std::string dir = ".";
  auto slash = path.find_last_of("/\\");
  if (slash != std::string::npos) dir = path.substr(0, slash);

  rc = verify_bridge_c(dir, db_key, kcv);
  sodium_memzero(db_key.data(), db_key.size());
  return rc;
}
