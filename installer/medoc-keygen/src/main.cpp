// main.cpp — medoc-keygen CLI.
//   medoc-keygen --out activation.json
//   medoc-keygen --out activation.json --passphrase-file /path/to/pw
//   medoc-keygen --out activation.json --passphrase-env MEDOC_KEYGEN_PASS
// Reads the admin passphrase from the terminal without echo (interactive mode),
// generates the manifest, and writes it with owner-only permissions.
#include "keygen.hpp"

#include <sodium.h>

#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <fstream>
#include <iostream>
#include <string>

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
  ::chmod(path.c_str(), S_IRUSR | S_IWUSR);  // 0600
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
  const char* v = std::getenv(var.c_str());
  if (v == nullptr || v[0] == '\0') {
    throw std::runtime_error("environment variable not set or empty: " + var);
  }
  return std::string(v);
}

void print_usage() {
  std::cerr << "usage: medoc-keygen [--out activation.json]\n"
            << "       [--passphrase-file PATH | --passphrase-env VAR]\n"
            << "\n"
            << "Without --passphrase-* the tool prompts twice (hidden) on a TTY.\n";
}

}  // namespace

int main(int argc, char** argv) {
  std::string out;
  std::string passphrase_file;
  std::string passphrase_env;
  out = "activation.json";

  for (int i = 1; i < argc; ++i) {
    if (std::strcmp(argv[i], "--out") == 0 && i + 1 < argc) {
      out = argv[++i];
    } else if (std::strcmp(argv[i], "--passphrase-file") == 0 && i + 1 < argc) {
      passphrase_file = argv[++i];
    } else if (std::strcmp(argv[i], "--passphrase-env") == 0 && i + 1 < argc) {
      passphrase_env = argv[++i];
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

  Manifest m;
  try {
    m = generate(pw);
  } catch (const std::exception& e) {
    sodium_memzero(pw.data(), pw.size());
    std::cerr << "error: " << e.what() << "\n";
    return 1;
  }
  sodium_memzero(pw.data(), pw.size());

  std::string json = manifest_to_json(m);
  std::ofstream f(out, std::ios::binary | std::ios::trunc);
  if (!f) {
    std::cerr << "cannot write " << out << "\n";
    return 1;
  }
  f << json;
  f.close();
  secure_chmod(out);

  std::cerr << "wrote " << out << "\n";
  std::cerr << "fingerprint: " << m.fingerprint << "\n";
  std::cerr << "NOTE: this file contains sealed key material. Import once on the "
               "owner device, then delete it.\n";
  return 0;
}
