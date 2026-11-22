// main.cpp — medoc-keygen CLI (Safe Bridge v2).
#include "keygen.hpp"

#include <sodium.h>

#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <string>
#include <vector>

#ifdef _WIN32
#include <conio.h>
#include <io.h>
#include <sys/stat.h>
#define isatty _isatty
#define fileno _fileno
#else
#include <sys/stat.h>
#include <termios.h>
#include <unistd.h>
#endif

namespace {

void secure_chmod(const std::string& path) {
#ifdef _WIN32
  _chmod(path.c_str(), _S_IREAD | _S_IWRITE);
#else
  ::chmod(path.c_str(), S_IRUSR | S_IWUSR);
#endif
}

std::string read_passphrase(const char* prompt) {
  std::cerr << prompt << std::flush;
#ifdef _WIN32
  bool tty = _isatty(_fileno(stdin)) != 0;
  std::string pw;
  if (tty) {
    int ch = 0;
    while ((ch = _getch()) != '\r' && ch != '\n') {
      if (ch == '\b' || ch == 127) {
        if (!pw.empty()) pw.pop_back();
      } else if (ch >= 32 && ch < 127) {
        pw.push_back(static_cast<char>(ch));
      }
    }
    std::cerr << "\n";
  } else {
    std::getline(std::cin, pw);
  }
  return pw;
#else
  termios old{}, noecho{};
  bool tty = isatty(STDIN_FILENO) == 1;
  if (tty) {
    tcgetattr(STDIN_FILENO, &old);
    noecho = old;
    noecho.c_lflag &= ~static_cast<tcflag_t>(ECHO);
    tcsetattr(STDIN_FILENO, TCSAFLUSH, &noecho);
  }
  std::string pw;
  std::getline(std::cin, pw);
  if (tty) {
    tcsetattr(STDIN_FILENO, TCSAFLUSH, &old);
    std::cerr << "\n";
  }
  return pw;
#endif
}

std::string read_passphrase_file(const std::string& path) {
  std::ifstream f(path, std::ios::binary);
  if (!f) throw std::runtime_error("cannot read passphrase file: " + path);
  std::string pw;
  std::getline(f, pw);
  while (!pw.empty() && (pw.back() == '\r' || pw.back() == '\n')) pw.pop_back();
  return pw;
}

std::string read_passphrase_env(const std::string& var) {
#ifdef _WIN32
  char* v = nullptr;
  size_t len = 0;
  if (_dupenv_s(&v, &len, var.c_str()) != 0 || v == nullptr || v[0] == '\0') {
    std::free(v);
    throw std::runtime_error("environment variable not set or empty: " + var);
  }
  std::string out(v);
  std::free(v);
  return out;
#else
  const char* v = std::getenv(var.c_str());
  if (v == nullptr || v[0] == '\0') {
    throw std::runtime_error("environment variable not set or empty: " + var);
  }
  return std::string(v);
#endif
}

bool is_hex64(const std::string& s) {
  if (s.size() != 64) return false;
  for (char c : s) {
    if (!((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')))
      return false;
  }
  return true;
}

std::vector<unsigned char> load_vendor_pubkey(const std::string& arg) {
  if (arg.empty()) return {};
  if (is_hex64(arg)) {
    std::vector<unsigned char> out(32);
    for (std::size_t i = 0; i < 32; ++i) {
      out[i] = static_cast<unsigned char>(std::stoul(arg.substr(i * 2, 2), nullptr, 16));
    }
    return out;
  }
  std::ifstream f(arg, std::ios::binary);
  if (!f) throw std::runtime_error("cannot read vendor recovery pubkey: " + arg);
  std::string raw((std::istreambuf_iterator<char>(f)), std::istreambuf_iterator<char>());
  while (!raw.empty() && (raw.back() == '\n' || raw.back() == '\r' || raw.back() == ' '))
    raw.pop_back();
  if (is_hex64(raw)) return load_vendor_pubkey(raw);
  if (raw.size() == 32) {
    return std::vector<unsigned char>(raw.begin(), raw.end());
  }
  std::vector<unsigned char> out(raw.size());
  size_t olen = 0;
  if (sodium_base642bin(out.data(), out.size(), raw.c_str(), raw.size(), nullptr, &olen,
                        nullptr, sodium_base64_VARIANT_ORIGINAL) != 0 ||
      olen != 32) {
    throw std::runtime_error("vendor recovery pubkey must be 32 raw bytes, 64 hex, or base64");
  }
  out.resize(olen);
  return out;
}

void write_file(const std::string& path, const std::string& body) {
  std::ofstream f(path, std::ios::binary | std::ios::trunc);
  if (!f) throw std::runtime_error("cannot write " + path);
  f << body;
  f.close();
  secure_chmod(path);
}

void print_usage() {
  std::cerr << "usage: medoc-keygen [--out activation.json]\n"
            << "       [--passphrase-file PATH | --passphrase-env VAR]\n"
            << "       [--vendor-recovery-pubkey PATH|HEX]\n"
            << "\n"
            << "Safe Bridge v2: prints practice recovery sheet (forgotten-passphrase path).\n"
            << "Vendor share uses X25519 ECDH + AEAD with AAD (not crypto_box_seal).\n";
}

}  // namespace

int main(int argc, char** argv) {
  std::string out = "activation.json";
  std::string passphrase_file;
  std::string passphrase_env;
  std::string vendor_pk_arg;

  for (int i = 1; i < argc; ++i) {
    if (std::strcmp(argv[i], "--out") == 0 && i + 1 < argc) {
      out = argv[++i];
    } else if (std::strcmp(argv[i], "--passphrase-file") == 0 && i + 1 < argc) {
      passphrase_file = argv[++i];
    } else if (std::strcmp(argv[i], "--passphrase-env") == 0 && i + 1 < argc) {
      passphrase_env = argv[++i];
    } else if (std::strcmp(argv[i], "--vendor-recovery-pubkey") == 0 && i + 1 < argc) {
      vendor_pk_arg = argv[++i];
    } else if (std::strcmp(argv[i], "-h") == 0 || std::strcmp(argv[i], "--help") == 0) {
      print_usage();
      return 0;
    } else {
      std::cerr << "unknown argument: " << argv[i] << "\n";
      print_usage();
      return 1;
    }
  }

  if (sodium_init() < 0) {
    std::cerr << "libsodium init failed\n";
    return 1;
  }

  std::string pw;
  std::string pw2;
  try {
    if (!passphrase_file.empty()) {
      pw = read_passphrase_file(passphrase_file);
    } else if (!passphrase_env.empty()) {
      pw = read_passphrase_env(passphrase_env);
    } else {
      pw  = read_passphrase("Admin passphrase: ");
      pw2 = read_passphrase("Repeat passphrase: ");
      if (pw.empty() || pw != pw2) {
        sodium_memzero(pw.data(), pw.size());
        sodium_memzero(pw2.data(), pw2.size());
        std::cerr << "passphrases empty or do not match\n";
        return 1;
      }
      sodium_memzero(pw2.data(), pw2.size());
    }
  } catch (const std::exception& e) {
    std::cerr << "error: " << e.what() << "\n";
    return 1;
  }

  if (pw.empty()) {
    std::cerr << "passphrase empty\n";
    return 1;
  }

  std::vector<unsigned char> vendor_pk;
  try {
    if (vendor_pk_arg.empty()) {
#ifndef _WIN32
      if (const char* v = std::getenv("MEDOC_VENDOR_RECOVERY_PUBKEY")) {
        if (v[0]) vendor_pk_arg = v;
      }
#endif
    }
    vendor_pk = load_vendor_pubkey(vendor_pk_arg);
  } catch (const std::exception& e) {
    sodium_memzero(pw.data(), pw.size());
    std::cerr << "error: " << e.what() << "\n";
    return 1;
  }

  KeygenBundle bundle;
  try {
    bundle = generate(pw, vendor_pk);
  } catch (const std::exception& e) {
    sodium_memzero(pw.data(), pw.size());
    std::cerr << "error: " << e.what() << "\n";
    return 1;
  }
  sodium_memzero(pw.data(), pw.size());

  namespace fs = std::filesystem;
  fs::path out_path(out);
  fs::path dir = out_path.parent_path().empty() ? fs::path(".") : out_path.parent_path();

  try {
    write_file(out, manifest_to_json_with_kcv(bundle.manifest, bundle.kcv));
    write_file((dir / "practice-recovery.share.v2.json").string(),
               practice_share_to_json(bundle.practice));
    write_file((dir / "practice-recovery.sheet.txt").string(),
               practice_sheet_text(bundle.practice));
    write_file((dir / "vendor-recovery.share.v2.json").string(),
               vendor_share_to_json(bundle.vendor));

    fs::path code_path = dir / "license.code";
    {
      std::ofstream cf(code_path, std::ios::binary | std::ios::trunc);
      if (!cf) throw std::runtime_error("cannot write " + code_path.string());
      cf << bundle.manifest.fingerprint << "\n";
    }
    secure_chmod(code_path.string());

    if (!bundle.ephemeral_vendor_sk.empty()) {
      fs::path sk_path = dir / "vendor-recovery.sk";
      std::ofstream sf(sk_path, std::ios::binary | std::ios::trunc);
      if (!sf) throw std::runtime_error("cannot write " + sk_path.string());
      sf.write(reinterpret_cast<const char*>(bundle.ephemeral_vendor_sk.data()),
               static_cast<std::streamsize>(bundle.ephemeral_vendor_sk.size()));
      sf.close();
      secure_chmod(sk_path.string());
      sodium_memzero(bundle.ephemeral_vendor_sk.data(), bundle.ephemeral_vendor_sk.size());
      std::cerr << "wrote " << sk_path.string()
                << " (ephemeral X25519 vendor recovery secret — vault only; backup/split)\n";
    }
  } catch (const std::exception& e) {
    std::cerr << "error: " << e.what() << "\n";
    return 1;
  }

  std::cerr << "wrote " << out << "\n";
  std::cerr << "wrote " << (dir / "practice-recovery.share.v2.json").string() << "\n";
  std::cerr << "wrote " << (dir / "practice-recovery.sheet.txt").string()
            << " (PRINT / safe — forgotten-passphrase path)\n";
  std::cerr << "wrote " << (dir / "vendor-recovery.share.v2.json").string() << "\n";
  std::cerr << "license code: " << bundle.manifest.fingerprint << "\n";
  std::cerr << "key_id: " << bundle.practice.key_id_hex << "\n";
  return 0;
}
