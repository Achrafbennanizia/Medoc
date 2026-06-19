// base32.hpp — RFC 4648 base32 (no padding, uppercase).
// The Rust side MUST use the identical scheme:
//   base32::encode(base32::Alphabet::Rfc4648 { padding: false }, &bytes)
// so a fingerprint computed here equals the one computed there.
#pragma once
#include <cstdint>
#include <string>

inline std::string base32_encode(const unsigned char* data, std::size_t len) {
  static const char* A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  std::string out;
  out.reserve((len * 8 + 4) / 5);
  std::uint32_t buffer = 0;
  int bits = 0;
  for (std::size_t i = 0; i < len; ++i) {
    buffer = (buffer << 8) | data[i];
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out.push_back(A[(buffer >> bits) & 0x1F]);
    }
  }
  if (bits > 0) {
    out.push_back(A[(buffer << (5 - bits)) & 0x1F]);
  }
  return out;  // no '=' padding
}
