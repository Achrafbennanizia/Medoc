#include "recovery.hpp"

#include <argon2.h>
#include <sodium.h>

#include <fstream>
#include <stdexcept>
#include <string>
#include <vector>

namespace {

// Must match medoc-core db_key.rs: Params::new(19_456, 2, 1, Some(32))
// and domain salt = salt || "medoc-db-key-wrap-v2"
constexpr uint32_t WRAP_T_COST = 2;
constexpr uint32_t WRAP_M_COST = 19456;  // KiB
constexpr uint32_t WRAP_P_COST = 1;
constexpr char     WRAP_V2_TAG[] = "v2:";
constexpr char     WRAP_DOMAIN[] = "medoc-db-key-wrap-v2";

std::vector<unsigned char> derive_wrap_kek(const std::string& passphrase,
                                           const std::vector<unsigned char>& salt) {
  std::vector<unsigned char> kek_salt = salt;
  kek_salt.insert(kek_salt.end(), WRAP_DOMAIN, WRAP_DOMAIN + sizeof(WRAP_DOMAIN) - 1);

  std::vector<unsigned char> out(32);
  int rc = argon2id_hash_raw(WRAP_T_COST, WRAP_M_COST, WRAP_P_COST, passphrase.data(),
                             passphrase.size(), kek_salt.data(), kek_salt.size(), out.data(),
                             out.size());
  if (rc != ARGON2_OK) {
    secure_zero(out);
    throw std::runtime_error(std::string("argon2id wrap KDF failed: ") + argon2_error_message(rc));
  }
  return out;
}

}  // namespace

RecoveredKey recover_bridge_b(const std::string& app_dir, const std::string& passphrase) {
  if (sodium_init() < 0) throw std::runtime_error("libsodium init failed");

  std::string salt_path = app_dir + "/db-key.salt";
  std::string wrap_path = app_dir + "/db-key.wrap";

  std::ifstream sf(salt_path, std::ios::binary);
  if (!sf) throw std::runtime_error("missing db-key.salt in " + app_dir);
  std::vector<unsigned char> salt((std::istreambuf_iterator<char>(sf)),
                                  std::istreambuf_iterator<char>());
  if (salt.size() != 16) throw std::runtime_error("db-key.salt must be 16 bytes");

  std::string encoded = read_file(wrap_path);
  while (!encoded.empty() &&
         (encoded.back() == '\n' || encoded.back() == '\r' || encoded.back() == ' '))
    encoded.pop_back();

  if (encoded.rfind(WRAP_V2_TAG, 0) != 0) {
    throw std::runtime_error("Bridge B requires db-key.wrap v2 (prefix v2:)");
  }
  auto blob = unb64(encoded.substr(sizeof(WRAP_V2_TAG) - 1));
  if (blob.size() < 24 + 16 + 32) throw std::runtime_error("db-key.wrap invalid length");

  auto kek = derive_wrap_kek(passphrase, salt);
  std::vector<unsigned char> key(blob.size());
  unsigned long long         plen = 0;
  if (crypto_aead_xchacha20poly1305_ietf_decrypt(key.data(), &plen, nullptr, blob.data() + 24,
                                                 blob.size() - 24, nullptr, 0, blob.data(),
                                                 kek.data()) != 0) {
    secure_zero(kek);
    secure_zero(key);
    throw std::runtime_error("Wrong database passphrase (Bridge B)");
  }
  key.resize(plen);
  secure_zero(kek);
  if (key.size() != 32) {
    // normalize like Rust
    if (key.size() > 32) key.resize(32);
    else key.resize(32, 0);
  }
  RecoveredKey out;
  out.key = std::move(key);
  return out;
}
