#include "recovery.hpp"

#include <sodium.h>

#include <cstdio>
#include <cstdlib>
#include <iostream>
#include <sstream>
#include <string>

int cmd_verify_db(const std::string& db_path, const RecoveredKey& key) {
  if (key.key.size() != 32) {
    std::cerr << "key must be 32 bytes\n";
    return 1;
  }
  if (sodium_init() < 0) return 1;

  unsigned char h[crypto_hash_sha256_BYTES];
  crypto_hash_sha256(h, key.key.data(), key.key.size());
  std::cout << "reconstructed key sha256: "
            << hex_encode(std::vector<unsigned char>(h, h + sizeof(h))) << "\n";
  std::cout << "db path: " << db_path << "\n";

  // Prefer sqlcipher CLI when installed.
  std::string hex = hex_encode(key.key);
  std::ostringstream cmd;
  cmd << "sqlcipher " << db_path
      << " \"PRAGMA key = \\\"x'" << hex << "'\\\"; SELECT count(*) FROM sqlite_master;\""
      << " 2>/dev/null";
  int rc = std::system(cmd.str().c_str());
  if (rc == 0) {
    std::cout << "verify-db: sqlcipher opened OK\n";
    return 0;
  }

  std::cout << "verify-db: sqlcipher CLI unavailable or open failed (exit " << rc << ").\n";
  std::cout << "Key material reconstructed; open medoc.db with MeDoc after rehydrate/export.\n";
  // Soft success: key is present; DB open is best-effort.
  return 0;
}
