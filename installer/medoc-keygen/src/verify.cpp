// verify.cpp — reproduces what the Rust importer must do, to prove the manifest
// round-trips: parse params, re-derive the Argon2id key from the passphrase,
// AEAD-decrypt the sealed blob, then confirm the unwrapped device secret key
// matches the published device public key.
#include <sodium.h>

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

int main(int argc, char** argv) {
  if (sodium_init() < 0) return 1;
  std::string path = argc > 1 ? argv[1] : "activation.json";
  std::ifstream f(path);
  if (!f) {
    std::cerr << "cannot open " << path << "\n";
    return 1;
  }
  std::stringstream ss;
  ss << f.rdbuf();
  std::string j = ss.str();

  std::string pw = argc > 2 ? argv[2] : "correct horse battery staple";

  auto salt      = unb64(field(j, "salt"));
  auto nonce     = unb64(field(j, "nonce"));
  auto ct        = unb64(field(j, "ciphertext"));
  auto device_pk = unb64(field(j, "device_pubkey"));
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
    return 2;
  }
  plain.resize(plen);

  std::cout << "decrypt OK, plaintext bytes = " << plen
            << " (expect 160 = 64 device_sk + 64 ca_sk + 32 db_key)\n";
  if (plen != 160) {
    std::cerr << "unexpected plaintext length\n";
    return 3;
  }

  // device_sk is the first 64 bytes; prove it matches the published device_pk
  std::vector<unsigned char> device_sk(plain.begin(), plain.begin() + 64);
  const unsigned char        msg[] = "medoc-activation-check";
  std::vector<unsigned char> sig(crypto_sign_BYTES);
  unsigned long long         siglen = 0;
  crypto_sign_detached(sig.data(), &siglen, msg, sizeof(msg), device_sk.data());
  int ok = crypto_sign_verify_detached(sig.data(), msg, sizeof(msg), device_pk.data());
  std::cout << "device_sk matches published device_pk: " << (ok == 0 ? "YES" : "NO")
            << "\n";

  sodium_memzero(device_sk.data(), device_sk.size());
  sodium_memzero(plain.data(), plain.size());
  sodium_memzero(wrap.data(), wrap.size());
  return ok == 0 ? 0 : 4;
}
