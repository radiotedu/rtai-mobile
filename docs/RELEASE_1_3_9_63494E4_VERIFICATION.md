# Current signed candidate — 63494e4

Draft, not release-ready. Source `63494e4f5eedc61d196efe99daa7e6694d633e4a`. This candidate replaces 3d87704 for further testing; older release assets are preserved as historical evidence.

- APK: `RadioTEDU-Mobile-v1.3.9-63494e4.apk`, SHA-256 `bc4852eaec08ac3af13152b212ed272fc9b19e24300a5c48203998e42ca76f01`.
- AAB: `RadioTEDU-Mobile-v1.3.9-63494e4.aab`, SHA-256 `7b988f0f815e9a3d2a98a1de8a5ab18d32a9f2965d92159629b0839e67513e83`.
- Actual APK package `com.radiotedumobile`, version `1.3.9`, code `13090`; embedded source matches the clean commit above.
- Established signing certificate SHA-256 `b3b08db1c4aefbf4251d53951061ada727796479de45d817f9576232ff2d9439` verified from the APK.
- All 26 64-bit native libraries passed ELF 16 KB checks in APK and AAB; APK packaging alignment passed zipalign separately.
- [Signed build](https://github.com/radiotedu/rtai-mobile/actions/runs/34747150086) and [CI](https://github.com/radiotedu/rtai-mobile/actions/runs/34747148892) passed. Local mobile suite: 407 tests/103 suites; TypeScript and targeted lint passed. iOS CI proves simulator compilation, not runtime readiness.

Changes normalize recognized jingles to station artwork and keep a microphone placeholder beneath podcast images. Upgrade installation over 3d87704 succeeded without uninstall; guest navigation remained available. The previously blank Makrofinans cover displayed correctly after upgrade. This does not prove the earlier image-request failure's cause or the fallback's error state.

The terminal ZIP's 19 file entries are byte-identical to the earlier verified package; its TGZ hash is unchanged (`175e6cbff5f3b8600708098e0bbb98fa9076ac79ddce20cbeacc835b6dc3fafd`). No terminal source changed.

## Pending verification

Exact-APK [phone/tablet tests](https://github.com/radiotedu/rtai-mobile/actions/runs/34751263666) passed their driver checks; full visual evidence review remains pending. [Automotive tests](https://github.com/radiotedu/rtai-mobile/actions/runs/34751264804) failed the selected-podcast metadata assertion after station catalog, Lo-Fi rendered audio and radio touch pause/resume passed. The failure screenshot and native session show podcast audio playing with the wrong title, `RadioTEDU Live Broadcast`, while the BPW publisher/artwork and episode duration remain visible. This is a real metadata defect, not a playback pass for the selected-episode requirement.

Fix source `7df67f830bb519cbaec603a6587ec2dd70118187` preserves catalog title/artist for podcast items instead of applying radio metadata normalization to embedded file tags. Its native policy regression and new signed build are pending CI and device verification. This draft's 63494e4 APK does not contain that fix. A local observer is also waiting for an actual broadcast jingle to inspect its artwork. Earlier device results do not count as passes for a replacement candidate.

Full Android Auto projection still needs a full Auto installation/device. Isolated registration, authentication/session, account/Gold, earning/spending/duplicate recovery and authenticated upgrade cases require the [test environment handoff](RELEASE_1_3_9_DEVICE_TEST_HANDOFF.md). Recipient-app sharing, remaining stress/language/device coverage and final store declarations remain open. No public release or Play submission has been made.
