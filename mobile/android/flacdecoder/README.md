# Media3 FLAC decoder

The car player uses Media3 1.10.1. RN Track Player's ExoPlayer 2 FLAC extension
cannot serve Media3. Android Automotive testing exposed a platform FLAC codec
failure, so this module supplies Media3's preferred libFLAC renderer.

Run `python scripts/prepare-media3-flac.py` before a native build in GitHub Actions.
The script fetches immutable Media3 1.10.1 and libFLAC 1.5.0 source revisions into
ignored Android build output. No native build runs during preparation.

Upstream Java/JNI sources retain their copyright notices. Apache 2.0 and Xiph
license texts are packaged as app assets. The loader adaptations rename
the shared library to `media3flacJNI` and select that name in FlacLibrary, avoiding
a collision with the existing ExoPlayer 2 `flacJNI` library. JNI method names
remain upstream's Media3 names.

The libFLAC fseeko feature probe compiles and links against stdio.h with large-file
support, so Android's 32-bit fseeko64 alias is detected correctly. It does not
force feature availability or suppress compiler errors.
The pre-24 guard uses NDK's `ANDROID_PLATFORM_LEVEL`; its legacy toolchain sets
`CMAKE_SYSTEM_VERSION` to 1 even when targeting API 24 or later.

NDK 28 builds position-independent code with flexible page sizes. The release
workflow must still inspect every final ELF and the APK's ZIP alignment.
