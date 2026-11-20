#include "recovery.hpp"

#include <sodium.h>

#include <cstdlib>
#include <fstream>
#include <iostream>
#include <stdexcept>
#include <string>

#ifdef _WIN32
#include <sys/stat.h>
#else
#include <sys/stat.h>
#endif

namespace {

std::string keyring_account() {
  std::string account = "sqlcipher-key";
  if (const char* inst = std::getenv("MEDOC_INSTANCE")) {
    if (inst[0] != '\0') {
      account += "-";
      account += inst;
    }
  }
  return account;
}

}  // namespace

int cmd_rehydrate(const RecoveredKey& key, const std::string& app_dir) {
  if (key.key.size() != 32) {
    std::cerr << "key must be 32 bytes\n";
    return 1;
  }
  try {
    // Portable fallback matching medoc-core write_local_key_file: sqlcipher.key
    // OS keychain write is platform-specific; file fallback always works for
    // the main app's ensure_sqlcipher_key path.
    std::string path = app_dir + "/sqlcipher.key";
    std::string tmp  = path + ".tmp";
    std::string encoded = b64_encode(key.key);
    {
      std::ofstream f(tmp, std::ios::binary | std::ios::trunc);
      if (!f) throw std::runtime_error("cannot write " + tmp);
      f << encoded;
    }
#ifdef _WIN32
    _chmod(tmp.c_str(), _S_IREAD | _S_IWRITE);
#else
    ::chmod(tmp.c_str(), S_IRUSR | S_IWUSR);
#endif
    if (std::rename(tmp.c_str(), path.c_str()) != 0) {
      throw std::runtime_error("rename to sqlcipher.key failed");
    }

#if defined(__APPLE__)
    // Best-effort Keychain insert (service de.medoc.app). Failures are non-fatal
    // because sqlcipher.key is already written.
    std::string account = keyring_account();
    std::string cmd =
        "security add-generic-password -U -s 'de.medoc.app' -a '" + account + "' -w '" +
        encoded + "' 2>/dev/null";
    int rc = std::system(cmd.c_str());
    if (rc == 0) {
      std::cout << "rehydrated OS keychain account " << account << "\n";
    } else {
      std::cout << "keychain update skipped or failed (sqlcipher.key written)\n";
    }
#else
    (void)keyring_account;
    std::cout << "OS keychain write not automated on this platform; sqlcipher.key written\n";
#endif

    std::cout << "wrote " << path << "\n";
    std::cout << "Start MeDoc; it will adopt the key from keychain or sqlcipher.key.\n";
    return 0;
  } catch (const std::exception& e) {
    std::cerr << "error: " << e.what() << "\n";
    return 1;
  }
}
