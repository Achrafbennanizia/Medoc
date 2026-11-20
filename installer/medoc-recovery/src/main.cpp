// medoc-recovery — offline safe-bridge CLI (sibling to medoc-keygen).
#include "recovery.hpp"

#include <sodium.h>

#include <cstring>
#include <iostream>
#include <stdexcept>
#include <string>
#include <vector>

namespace {

void usage() {
  std::cerr
      << "medoc-recovery — reconstruct SQLCipher key via safe bridges (not a vendor backdoor)\n\n"
      << "  recover --bridge a --manifest activation.json [--passphrase-file PATH]\n"
      << "  recover --bridge b --app-dir PATH [--passphrase-file PATH]\n"
      << "  recover --bridge c --practice-share PATH --vendor-share PATH \\\n"
      << "          --vendor-sk PATH [--passphrase-file PATH]\n"
      << "  verify-db --db medoc.db --key-hex HEX | --from-recover ...\n"
      << "  export-key --out sqlcipher.key --key-hex HEX\n"
      << "  rehydrate --app-dir PATH --key-hex HEX\n"
      << "  auth-check --ticket PATH --vendor-pubkey HEX [--fingerprint FP]\n\n"
      << "After recover, pipe actions with --then export-key|rehydrate|verify-db.\n";
}

std::string require_passphrase(const std::string& file) {
  if (!file.empty()) return read_passphrase_file(file);
  return read_passphrase_prompt("Practice passphrase: ");
}

}  // namespace

int main(int argc, char** argv) {
  if (argc < 2) {
    usage();
    return 1;
  }
  if (sodium_init() < 0) {
    std::cerr << "libsodium init failed\n";
    return 1;
  }

  std::string cmd = argv[1];
  std::string bridge;
  std::string manifest;
  std::string app_dir;
  std::string practice_share;
  std::string vendor_share;
  std::string vendor_sk;
  std::string passphrase_file;
  std::string db_path;
  std::string key_hex;
  std::string out_path;
  std::string ticket;
  std::string vendor_pubkey;
  std::string fingerprint;
  std::string then_action;
  std::string then_out;
  std::string then_db;

  for (int i = 2; i < argc; ++i) {
    auto next = [&](std::string& dst) {
      if (i + 1 >= argc) throw std::runtime_error(std::string("missing value for ") + argv[i]);
      dst = argv[++i];
    };
    try {
      if (std::strcmp(argv[i], "--bridge") == 0) next(bridge);
      else if (std::strcmp(argv[i], "--manifest") == 0) next(manifest);
      else if (std::strcmp(argv[i], "--app-dir") == 0) next(app_dir);
      else if (std::strcmp(argv[i], "--practice-share") == 0) next(practice_share);
      else if (std::strcmp(argv[i], "--vendor-share") == 0) next(vendor_share);
      else if (std::strcmp(argv[i], "--vendor-sk") == 0) next(vendor_sk);
      else if (std::strcmp(argv[i], "--passphrase-file") == 0) next(passphrase_file);
      else if (std::strcmp(argv[i], "--db") == 0) next(db_path);
      else if (std::strcmp(argv[i], "--key-hex") == 0) next(key_hex);
      else if (std::strcmp(argv[i], "--out") == 0) next(out_path);
      else if (std::strcmp(argv[i], "--ticket") == 0) next(ticket);
      else if (std::strcmp(argv[i], "--vendor-pubkey") == 0) next(vendor_pubkey);
      else if (std::strcmp(argv[i], "--fingerprint") == 0) next(fingerprint);
      else if (std::strcmp(argv[i], "--then") == 0) next(then_action);
      else if (std::strcmp(argv[i], "--then-out") == 0) next(then_out);
      else if (std::strcmp(argv[i], "--then-db") == 0) next(then_db);
      else if (std::strcmp(argv[i], "-h") == 0 || std::strcmp(argv[i], "--help") == 0) {
        usage();
        return 0;
      } else {
        std::cerr << "unknown argument: " << argv[i] << "\n";
        usage();
        return 1;
      }
    } catch (const std::exception& e) {
      std::cerr << "error: " << e.what() << "\n";
      return 1;
    }
  }

  try {
    if (cmd == "auth-check") {
      if (ticket.empty() || vendor_pubkey.empty()) {
        std::cerr << "auth-check requires --ticket and --vendor-pubkey\n";
        return 1;
      }
      return cmd_auth_check(ticket, vendor_pubkey, fingerprint);
    }

    RecoveredKey key;
    bool have_key = false;

    if (cmd == "recover") {
      std::string pw = require_passphrase(passphrase_file);
      try {
        if (bridge == "a" || bridge == "A") {
          if (manifest.empty()) throw std::runtime_error("--manifest required");
          key = recover_bridge_a(manifest, pw);
        } else if (bridge == "b" || bridge == "B") {
          if (app_dir.empty()) throw std::runtime_error("--app-dir required");
          key = recover_bridge_b(app_dir, pw);
        } else if (bridge == "c" || bridge == "C") {
          if (practice_share.empty() || vendor_share.empty() || vendor_sk.empty()) {
            throw std::runtime_error(
                "Bridge C requires --practice-share --vendor-share --vendor-sk");
          }
          key = recover_bridge_c(practice_share, vendor_share, vendor_sk, pw);
        } else {
          throw std::runtime_error("--bridge must be a, b, or c");
        }
      } catch (...) {
        secure_zero(pw);
        throw;
      }
      secure_zero(pw);
      have_key = true;
      {
        unsigned char h[32];
        crypto_hash_sha256(h, key.key.data(), key.key.size());
        std::cout << "recover OK (bridge " << bridge << "), key sha256="
                  << hex_encode(std::vector<unsigned char>(h, h + 32)) << "\n";
      }
    } else if (cmd == "export-key" || cmd == "rehydrate" || cmd == "verify-db") {
      if (key_hex.empty()) {
        std::cerr << cmd << " requires --key-hex (or use recover --then ...)\n";
        return 1;
      }
      key.key = hex_decode(key_hex);
      if (key.key.size() != 32) throw std::runtime_error("key-hex must be 64 hex chars");
      have_key = true;
    } else {
      usage();
      return 1;
    }

    if (!have_key) return 1;

    auto run_then = [&](const std::string& action) -> int {
      if (action == "export-key") {
        std::string out = then_out.empty() ? out_path : then_out;
        if (out.empty()) out = "sqlcipher.key";
        return cmd_export_key(key, out);
      }
      if (action == "rehydrate") {
        std::string dir = app_dir;
        if (dir.empty()) throw std::runtime_error("rehydrate needs --app-dir");
        return cmd_rehydrate(key, dir);
      }
      if (action == "verify-db") {
        std::string db = then_db.empty() ? db_path : then_db;
        if (db.empty()) throw std::runtime_error("verify-db needs --db / --then-db");
        return cmd_verify_db(db, key);
      }
      if (action.empty()) return 0;
      throw std::runtime_error("unknown --then action: " + action);
    };

    if (cmd == "export-key") {
      if (out_path.empty()) out_path = "sqlcipher.key";
      int rc = cmd_export_key(key, out_path);
      secure_zero(key.key);
      return rc;
    }
    if (cmd == "rehydrate") {
      if (app_dir.empty()) throw std::runtime_error("--app-dir required");
      int rc = cmd_rehydrate(key, app_dir);
      secure_zero(key.key);
      return rc;
    }
    if (cmd == "verify-db") {
      if (db_path.empty()) throw std::runtime_error("--db required");
      int rc = cmd_verify_db(db_path, key);
      secure_zero(key.key);
      return rc;
    }

    // recover with optional --then
    int rc = 0;
    if (!then_action.empty()) rc = run_then(then_action);
    secure_zero(key.key);
    return rc;
  } catch (const std::exception& e) {
    std::cerr << "error: " << e.what() << "\n";
    return 1;
  }
}
