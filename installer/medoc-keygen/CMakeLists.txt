cmake_minimum_required(VERSION 3.16)
project(medoc_keygen LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

set(MEDOC_KEYGEN_SOURCES src/main.cpp src/keygen.cpp)

add_executable(medoc-keygen ${MEDOC_KEYGEN_SOURCES})
add_executable(medoc-keygen-verify src/verify.cpp)

target_include_directories(medoc-keygen PRIVATE include)
target_include_directories(medoc-keygen-verify PRIVATE include)

if(MSVC)
  target_compile_options(medoc-keygen PRIVATE /W4 /WX)
  target_compile_options(medoc-keygen-verify PRIVATE /W4 /WX)
else()
  target_compile_options(medoc-keygen PRIVATE -Wall -Wextra -Wpedantic -Werror)
  target_compile_options(medoc-keygen-verify PRIVATE -Wall -Wextra -Wpedantic -Werror)
endif()

if(WIN32)
  find_package(unofficial-sodium CONFIG REQUIRED)
  target_link_libraries(medoc-keygen PRIVATE unofficial-sodium::sodium)
  target_link_libraries(medoc-keygen-verify PRIVATE unofficial-sodium::sodium)
else()
  find_package(PkgConfig QUIET)
  if(PkgConfig_FOUND)
    pkg_check_modules(SODIUM REQUIRED libsodium)
    target_include_directories(medoc-keygen PRIVATE ${SODIUM_INCLUDE_DIRS})
    target_include_directories(medoc-keygen-verify PRIVATE ${SODIUM_INCLUDE_DIRS})
    target_link_libraries(medoc-keygen PRIVATE ${SODIUM_LIBRARIES})
    target_link_libraries(medoc-keygen-verify PRIVATE ${SODIUM_LIBRARIES})
    target_link_directories(medoc-keygen PRIVATE ${SODIUM_LIBRARY_DIRS})
    target_link_directories(medoc-keygen-verify PRIVATE ${SODIUM_LIBRARY_DIRS})
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
      message(FATAL_ERROR "libsodium not found (install via apt/brew or set SODIUM_INCLUDE_DIR/SODIUM_LIBRARY)")
    endif()
    target_include_directories(medoc-keygen PRIVATE ${SODIUM_INCLUDE_DIR})
    target_include_directories(medoc-keygen-verify PRIVATE ${SODIUM_INCLUDE_DIR})
    target_link_libraries(medoc-keygen PRIVATE ${SODIUM_LIBRARY})
    target_link_libraries(medoc-keygen-verify PRIVATE ${SODIUM_LIBRARY})
  endif()
endif()
