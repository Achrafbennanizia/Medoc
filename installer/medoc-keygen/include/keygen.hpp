#pragma once

#include "manifest.hpp"

#include <string>

/// Generate a sealed activation manifest from the admin passphrase.
Manifest generate(const std::string& passphrase);
