#include "recovery.hpp"

#include <sodium.h>

#include <cctype>
#include <cstdio>
#include <fstream>
#include <iostream>
#include <sstream>
#include <stdexcept>

#ifdef _WIN32
#include <conio.h>
#include <io.h>
#define isatty _isatty
#define fileno _fileno
#else
#include <termios.h>
#include <unistd.h>
#endif

std::string read_file(const std::string& path) {
  std::ifstream f(path, std::ios::binary);
  if (!f) throw std::runtime_error("cannot read " + path);
  std::stringstream ss;
  ss << f.rdbuf();
  return ss.str();
}

std::string field(const std::string& j, const std::string& key) {
  auto k = j.find("\"" + key + "\"");
  if (k == std::string::npos) return {};
  auto c  = j.find(':', k);
  auto q1 = j.find('"', c + 1);
  auto q2 = j.find('"', q1 + 1);
  if (q1 == std::string::npos || q2 == std::string::npos) return {};
  return j.substr(q1 + 1, q2 - q1 - 1);
}

unsigned long long json_num(const std::string& j, const std::string& key) {
  auto k = j.find("\"" + key + "\"");
  if (k == std::string::npos) return 0;
  auto c = j.find(':', k);
  return std::strtoull(j.c_str() + c + 1, nullptr, 10);
}

std::vector<unsigned char> unb64(const std::string& s) {
  std::vector<unsigned char> out(s.size());
  size_t                     olen = 0;
  if (sodium_base642bin(out.data(), out.size(), s.c_str(), s.size(), nullptr, &olen, nullptr,
                        sodium_base64_VARIANT_ORIGINAL) != 0) {
    throw std::runtime_error("base64 decode failed");
  }
  out.resize(olen);
  return out;
}

std::string b64_encode(const std::vector<unsigned char>& v) {
  std::string out;
  out.resize(sodium_base64_encoded_len(v.size(), sodium_base64_VARIANT_ORIGINAL));
  sodium_bin2base64(out.data(), out.size(), v.data(), v.size(), sodium_base64_VARIANT_ORIGINAL);
  if (!out.empty() && out.back() == '\0') out.pop_back();
  return out;
}

std::string hex_encode(const std::vector<unsigned char>& v) {
  static const char* hexd = "0123456789abcdef";
  std::string out;
  out.resize(v.size() * 2);
  for (std::size_t i = 0; i < v.size(); ++i) {
    out[i * 2]     = hexd[(v[i] >> 4) & 0xf];
    out[i * 2 + 1] = hexd[v[i] & 0xf];
  }
  return out;
}

std::vector<unsigned char> hex_decode(const std::string& s) {
  if (s.size() % 2 != 0) throw std::runtime_error("odd hex length");
  std::vector<unsigned char> out(s.size() / 2);
  for (std::size_t i = 0; i < out.size(); ++i) {
    auto nib = [](char c) -> int {
      if (c >= '0' && c <= '9') return c - '0';
      if (c >= 'a' && c <= 'f') return c - 'a' + 10;
      if (c >= 'A' && c <= 'F') return c - 'A' + 10;
      throw std::runtime_error("invalid hex");
    };
    out[i] = static_cast<unsigned char>((nib(s[i * 2]) << 4) | nib(s[i * 2 + 1]));
  }
  return out;
}

std::string read_passphrase_prompt(const char* prompt) {
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

void secure_zero(std::string& s) {
  if (!s.empty()) sodium_memzero(s.data(), s.size());
  s.clear();
}

void secure_zero(std::vector<unsigned char>& v) {
  if (!v.empty()) sodium_memzero(v.data(), v.size());
  v.clear();
}
