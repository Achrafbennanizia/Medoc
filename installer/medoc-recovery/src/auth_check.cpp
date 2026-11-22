#include "recovery.hpp"

#include <sodium.h>

#include <iostream>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>

namespace {

std::string canonical_auth_message(const std::string& j) {
  // medoc-recovery-auth.v1\ncluster_id=...\n...
  std::ostringstream oss;
  oss << "medoc-recovery-auth.v1\n";
  oss << "cluster_id=" << field(j, "cluster_id") << "\n";
  oss << "device_fingerprint=" << field(j, "device_fingerprint") << "\n";
  oss << "customer_ref=" << field(j, "customer_ref") << "\n";
  oss << "issued_at=" << field(j, "issued_at") << "\n";
  oss << "nonce=" << field(j, "nonce") << "\n";
  return oss.str();
}

}  // namespace

int cmd_auth_check(const std::string& ticket_path, const std::string& vendor_pubkey_hex,
                   const std::string& expect_fingerprint) {
  if (sodium_init() < 0) return 1;
  try {
    std::string j = read_file(ticket_path);
    if (field(j, "kind") != "medoc-recovery-auth.v1") {
      std::cerr << "ticket kind mismatch\n";
      return 2;
    }
    if (!expect_fingerprint.empty() &&
        field(j, "device_fingerprint") != expect_fingerprint) {
      std::cerr << "fingerprint mismatch\n";
      return 3;
    }

    auto sig = unb64(field(j, "signature"));
    auto pk  = hex_decode(vendor_pubkey_hex);
    if (pk.size() != crypto_sign_PUBLICKEYBYTES) {
      std::cerr << "vendor pubkey must be 32 bytes (64 hex)\n";
      return 4;
    }
    if (sig.size() != crypto_sign_BYTES) {
      std::cerr << "signature length invalid\n";
      return 5;
    }

    std::string msg = canonical_auth_message(j);
    int ok = crypto_sign_verify_detached(
        sig.data(), reinterpret_cast<const unsigned char*>(msg.data()), msg.size(), pk.data());
    if (ok != 0) {
      std::cerr << "AUTH TICKET SIGNATURE INVALID\n";
      return 6;
    }
    std::cout << "auth ticket OK for fingerprint " << field(j, "device_fingerprint") << "\n";
    std::cout << "NOTE: auth ticket authorizes assistance only; it cannot open the DB alone.\n";
    return 0;
  } catch (const std::exception& e) {
    std::cerr << "error: " << e.what() << "\n";
    return 1;
  }
}
