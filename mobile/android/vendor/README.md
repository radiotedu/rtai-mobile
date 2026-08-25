# Patched KotlinAudio runtime

`kotlinaudio-v2.1.0-radiotedu.aar` is KotlinAudio v2.1.0 with one targeted
change: its ExoPlayer builder uses `DefaultRenderersFactory` with extension
renderers preferred. The app also bundles ExoPlayer's Apache-2.0 libFLAC
extension, avoiding Android platform decoder failures on continuous Ogg/FLAC
radio streams.

`exoplayer-flac-2.19.0-radiotedu.aar` is built from the official ExoPlayer
`r2.19.0` `extensions/flac` module and FLAC 1.3.2 for arm64-v8a,
armeabi-v7a, x86, and x86_64. SHA-256:
`49E9589EF1D4851326CCA18F52D7F13AD9C39D2F08784949517768AF89FF37A5`.
The upstream Apache license is stored in `EXOPLAYER-LICENSE.txt`.

Rebuild from the Gradle-cached upstream AAR:

1. Compile `scripts/PatchKotlinAudio.java` with Gradle's ASM 9.7 JAR.
2. Run it with the upstream AAR and this module's AAR as arguments.

Upstream: `com.github.doublesymmetry:kotlinaudio:v2.1.0`, commit
`bf71120704bfe4be2311cf86fc1e2ee1c3c702b7`, Apache License 2.0.
