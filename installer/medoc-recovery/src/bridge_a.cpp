#include "recovery.hpp"

#include <sodium.h>

#include <stdexcept>
#include <vector>

RecoveredKey recover_bridge_a(const std::string& manifest_path, const std::string& passphrase) {
  if (sodium_init() < 0) throw std::runtime_error("libsodium init failed");
  std::string j = read_file(manifest_path);

  auto salt  = unb64(field(j, "salt"));
  auto nonce = unb64(field(j, "nonce"));
  auto ct    = unb64(field(j, "ciphertext"));
  unsigned long long ops = json_num(j, "ops");
  size_t             mem = static_cast<size_t>(json_num(j, "mem"));

  std::vector<unsigned char> wrap(crypto_aead_xchacha20poly1305_ietf_KEYBYTES);
  if (crypto_pwhash(wrap.data(), wrap.size(), passphrase.c_str(), passphrase.size(), salt.data(),
                    ops, mem, crypto_pwhash_ALG_ARGON2ID13) != 0) {
    secure_zero(wrap);
    throw std::runtime_error("Argon2id KDF failed");
  }

  std::vector<unsigned char> plain(ct.size());
  unsigned long long         plen = 0;
  if (crypto_aead_xchacha20poly1305_ietf_decrypt(plain.data(), &plen, nullptr, ct.data(),
                                                 ct.size(), nullptr, 0, nonce.data(),
                                                 wrap.data()) != 0) {
    secure_zero(wrap);
    secure_zero(plain);
    throw std::runtime_error("Bridge A decrypt failed (wrong passphrase or tampered manifest)");
  }
  plain.resize(plen);
  secure_zero(wrap);

  if (plen != 160) {
    secure_zero(plain);
    throw std::runtime_error("unexpected activation plaintext length");
  }

  RecoveredKey out;
  out.key.assign(plain.begin() + 128, plain.begin() + 160);
  secure_zero(plain);
  return out;
}
