# DEPRECATED: prefer the Rust binary (`cargo build -p medoc-recovery`).
# This CMake target was Safe Bridge v1 and is kept only for transitional builds.
cmake_minimum_required(VERSION 3.16)
project(medoc_recovery LANGUAGES C CXX)
message(WARNING "medoc-recovery C++ build is deprecated; use cargo build -p medoc-recovery")

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
set(CMAKE_C_STANDARD 99)

set(ARGON2_ROOT ${CMAKE_CURRENT_SOURCE_DIR}/third_party/argon2)
add_library(argon2_ref STATIC
  ${ARGON2_ROOT}/src/argon2.c
  ${ARGON2_ROOT}/src/core.c
  ${ARGON2_ROOT}/src/blake2/blake2b.c
  ${ARGON2_ROOT}/src/encoding.c
  ${ARGON2_ROOT}/src/thread.c
  ${ARGON2_ROOT}/src/ref.c
)
target_include_directories(argon2_ref PUBLIC ${ARGON2_ROOT}/include)
target_include_directories(argon2_ref PRIVATE ${ARGON2_ROOT}/src)
target_compile_definitions(argon2_ref PRIVATE ARGON2_NO_THREADS)

add_executable(medoc-recovery
  src/main.cpp
  src/json_util.cpp
  src/bridge_a.cpp
  src/bridge_b.cpp
  src/bridge_c.cpp
  src/auth_check.cpp
  src/export_key.cpp
  src/rehydrate.cpp
  src/verify_db.cpp
)
target_include_directories(medoc-recovery PRIVATE
  include
  ${CMAKE_CURRENT_SOURCE_DIR}/../medoc-keygen/include
)
target_link_libraries(medoc-recovery PRIVATE argon2_ref)

if(MSVC)
  target_compile_options(medoc-recovery PRIVATE /W4)
else()
  target_compile_options(medoc-recovery PRIVATE -Wall -Wextra -Wpedantic)
endif()

if(WIN32)
  find_package(unofficial-sodium CONFIG REQUIRED)
  target_link_libraries(medoc-recovery PRIVATE unofficial-sodium::sodium)
else()
  find_package(PkgConfig QUIET)
  if(PkgConfig_FOUND)
    pkg_check_modules(SODIUM REQUIRED libsodium)
    target_include_directories(medoc-recovery PRIVATE ${SODIUM_INCLUDE_DIRS})
    target_link_libraries(medoc-recovery PRIVATE ${SODIUM_LIBRARIES})
    target_link_directories(medoc-recovery PRIVATE ${SODIUM_LIBRARY_DIRS})
  else()
    find_path(SODIUM_INCLUDE_DIR sodium.h
      HINTS
        /opt/homebrew/opt/libsodium/include
        /opt/homebrew/Cellar/libsodium/*/include
        /usr/local/opt/libsodium/include)
    find_library(SODIUM_LIBRARY NAMES sodium libsodium
      HINTS
        /opt/homebrew/opt/libsodium/lib
        /opt/homebrew/Cellar/libsodium/*/lib
        /usr/local/opt/libsodium/lib)
    if(NOT SODIUM_INCLUDE_DIR OR NOT SODIUM_LIBRARY)
      message(FATAL_ERROR "libsodium not found")
    endif()
    target_include_directories(medoc-recovery PRIVATE ${SODIUM_INCLUDE_DIR})
    target_link_libraries(medoc-recovery PRIVATE ${SODIUM_LIBRARY})
  endif()
endif()
