# Final-APK sharing and initialized-car recheck

September 11, 2026. APK source remains `27ddb0cf440d590d7cf2c786e13ba42895b2f0c2`; SHA-256 `c46f4d298d7e1c139441010b65fb0199a867286924b73c4713916a917ae23874`. No app code changed for these runs.

[Phone run 34603214097](https://github.com/radiotedu/rtai-mobile/actions/runs/34603214097) passed and saved actual now-playing images through Android's document picker: Story 1080×1920 and Square 1080×1080. Both files were downloaded, fully decoded locally and visually inspected. Artwork proportions, track title and artist were retained. Export filenames were unique; no existing image was overwritten. The media/export recording is 88.276 seconds, without hitting its recording limit.

The same run repeated guest navigation, three consent-preserving process restarts, radio rendered audio, background media-key pause/resume, offline return and crash-buffer checks. Its Pixel Launcher ANR was recorded and the hung system launcher closed; RadioTEDU did not have an entry in the crash buffer. This does not establish recipient-app receipt or lyric PNG export.

[Initialized Automotive run 34603870202](https://github.com/radiotedu/rtai-mobile/actions/runs/34603870202) completed guest first-app setup but failed its station-name assertions. **Correction:** subsequent screenshot/source inspection showed that the driver expected short names such as `Classical`, while the native browser correctly uses `RadioTEDU Classical`. The earlier claim that eight stations were missing was a harness false failure and is withdrawn. The driver has been corrected; all-station and Lo-Fi playback verification still require its next result. No stations or stream infrastructure were changed.

Earlier initialized-car attempts exposed driver issues: a swipe outside the actual scroll container and a notification permission prompt covering Home. Those were corrected without changing the app. Diagnostic run 34604767527 confirmed successful stream checks and matching app/service user context; its screenshots exposed the station-name mismatch in the test. It failed the same incorrect name assertions, so it is not a passing full-catalog run.

The release remains a draft. Full Android Auto projection, completed initialized-catalog verification, isolated authenticated Gold/account/game checks and the other gates in the landscape verification report remain open.
