#include "recovery.hpp"

#include <sodium.h>

#include <fstream>
#include <iostream>
#include <stdexcept>

#ifdef _WIN32
#include <sys/stat.h>
#else
#include <sys/stat.h>
#include <unistd.h>
#endif

int cmd_export_key(const RecoveredKey& key, const std::string& out_path) {
  if (key.key.size() != 32) {
    std::cerr << "key must be 32 bytes\n";
    return 1;
  }
  try {
    std::string encoded = b64_encode(key.key);
    std::ofstream f(out_path, std::ios::binary | std::ios::trunc);
    if (!f) throw std::runtime_error("cannot write " + out_path);
    f << encoded << "\n";
    f.close();
#ifdef _WIN32
    _chmod(out_path.c_str(), _S_IREAD | _S_IWRITE);
#else
    ::chmod(out_path.c_str(), S_IRUSR | S_IWUSR);
#endif
    std::cout << "wrote " << out_path << " (0600, one-shot ops USB)\n";
    unsigned char h[crypto_hash_sha256_BYTES];
    crypto_hash_sha256(h, key.key.data(), key.key.size());
    std::cout << "key sha256: "
              << hex_encode(std::vector<unsigned char>(h, h + sizeof(h))) << "\n";
    return 0;
  } catch (const std::exception& e) {
    std::cerr << "error: " << e.what() << "\n";
    return 1;
  }
}
