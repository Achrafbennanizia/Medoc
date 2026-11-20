#pragma once

#include "manifest.hpp"
#include "recovery_share.hpp"

#include <string>
#include <vector>

/// Generate sealed activation + Bridge C shares.
/// `vendor_pk` must be 32-byte X25519 public key, or empty to mint an ephemeral
/// keypair (returned in `ephemeral_vendor_sk` as crypto_box_SECRETKEYBYTES).
KeygenBundle generate(const std::string& passphrase,
                      const std::vector<unsigned char>& vendor_pk);
