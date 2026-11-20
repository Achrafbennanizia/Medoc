#pragma once

#include <string>
#include <vector>

struct RecoveredKey {
  std::vector<unsigned char> key;  // 32 bytes
};

std::string read_file(const std::string& path);
std::string field(const std::string& j, const std::string& key);
unsigned long long json_num(const std::string& j, const std::string& key);
std::vector<unsigned char> unb64(const std::string& s);
std::string b64_encode(const std::vector<unsigned char>& v);
std::string hex_encode(const std::vector<unsigned char>& v);
std::vector<unsigned char> hex_decode(const std::string& s);
std::string read_passphrase_prompt(const char* prompt);
std::string read_passphrase_file(const std::string& path);
void secure_zero(std::string& s);
void secure_zero(std::vector<unsigned char>& v);

RecoveredKey recover_bridge_a(const std::string& manifest_path, const std::string& passphrase);
RecoveredKey recover_bridge_b(const std::string& app_dir, const std::string& passphrase);
RecoveredKey recover_bridge_c(const std::string& practice_path, const std::string& vendor_path,
                              const std::string& vendor_sk_path, const std::string& passphrase);

int cmd_auth_check(const std::string& ticket_path, const std::string& vendor_pubkey_hex,
                   const std::string& expect_fingerprint);
int cmd_export_key(const RecoveredKey& key, const std::string& out_path);
int cmd_rehydrate(const RecoveredKey& key, const std::string& app_dir);
int cmd_verify_db(const std::string& db_path, const RecoveredKey& key);
