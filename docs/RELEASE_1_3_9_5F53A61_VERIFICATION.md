# 5f53a61 verification — artwork loading still fails on two stations

September 13, 2026. This candidate is not release-ready. The sizing correction resolves the observed landscape artwork overflow and Lo-Fi's blank tile, but English and French artwork checks still fail. Source `6414c3ca9b610257f21f8cfb3ee189b484ae3fe6` keeps the foreground image invisible until its own load succeeds; its replacement build [34761669968](https://github.com/radiotedu/rtai-mobile/actions/runs/34761669968) needs fresh artifact/device verification.

## Actual 5f binary and checks

- Source `5f53a61fe7c318530ad58591479e1ffe74576939`, embedded clean; package `com.radiotedumobile`, version 1.3.9, versionCode 13090.
- APK SHA-256 `20cb8de75792da11b1f1c1a3f98ce27f57c75cef1f0af6387f51803ab837fe96`; AAB SHA-256 `c626a4cf66cd4f7bacbebbcdf37ec145a0cd8407a7503bafdbfefc7947be53c4`.
- Production certificate SHA-256 `b3b08db1c4aefbf4251d53951061ada727796479de45d817f9576232ff2d9439`.
- All 26 ELF libraries in both artifacts pass 16 KB alignment; APK zipalign passes 16 KB packaging. Actual manifest includes the Google car declaration, RadioTeduCarService and MediaLibraryService.
- [Signed build](https://github.com/radiotedu/rtai-mobile/actions/runs/34760546289), [CI including iOS simulator compilation](https://github.com/radiotedu/rtai-mobile/actions/runs/34760544942), [phone/tablet automation](https://github.com/radiotedu/rtai-mobile/actions/runs/34761239586), and [Automotive automation](https://github.com/radiotedu/rtai-mobile/actions/runs/34761240726) passed. Device driver: `e9eb0219c24440a1389a745dfef8eb826aaa9f89`.
- Local signed upgrade retained guest consent. Portrait/landscape, 130% text, station/song/artist, bounded lyrics card, 48dp transport targets, rendered audio and touch pause/resume passed. Added pixel checks also confirm artwork does not extend behind the transport controls. Evidence: `output/device-5f-controls-20260913-150322/`; landscape screenshot visually reviewed.
- All nine stations passed native rendered-audio start, eight-second sustained observation, selected-station metadata and pause. Seven had nonblank artwork. English and French remained uniformly blank; the run retained every station result and rejected the candidate. Evidence: `output/5f-stations-social-20260913-145544/`, including separate recordings and screenshots. Lo-Fi, English and French screenshots visually reviewed. Lo-Fi intentionally has station-only metadata.
- All 19 terminal ZIP file contents equal the previously tested b630 package. TGZ hash remains `175e6cbff5f3b8600708098e0bbb98fa9076ac79ddce20cbeacc835b6dc3fafd`.

## Earlier evidence and boundaries

The previous a4 candidate's exported Story and square PNGs were visually reviewed: artwork, song, artist and station rendered without text clipping. This is image-export evidence, not proof of receipt in WhatsApp or Instagram. Its corrected English Social page was captured and visually reviewed at `output/a4-social-visual-20260913-144423/02-social.png`.

The latest available local Antigravity walkthrough found during this recheck is the September 7 v1.3.8 artifact in brain folder `b87809e2-af84-4fc7-8459-2664e8cec677`. It reports header, localization, signing, phone-emulator and terminal work. Its Auto claim cites services/manifest integration; this does not establish full projection. These local plan/walkthrough artifacts are not a complete transcript of every historical user issue, so no claim that all 10–15 earlier issues are resolved is made.

Full Android Auto projection, isolated authenticated registration/session/Gold/game tests, recipient-app PNG receipt, external Jukebox locale/branding repair and remaining store/runtime gates stay open. Only the emulator is connected; its Auto package remains `1.2.542030-stub`, and neither WhatsApp nor Instagram is installed. See [device prerequisites](RELEASE_1_3_9_DEVICE_TEST_HANDOFF.md) and [server frontend handoff](JUKE_CONTROLLER_LOCALE_SERVER_HANDOFF.md). No public release or Play submission has occurred.
