# Android Auto review video evidence

Source: `C:\Users\akgul\OneDrive\Desktop\vid.mp4`

- SHA-256: `D8D2F40B0BE766FA2B214F48F86E67759D3E11D55C3788E2387CFCC271FD551B`
- Duration: 98.905 seconds
- Video: H.264, 478×850, 30 fps
- Audio: AAC
- Transcript: local `faster-whisper-medium`, Turkish forced, detected probability 1.0000
- Evidence frames: `artifacts/video-frames-1s`, `artifacts/video-frames`, and `artifacts/video-contact.jpg`

## Timestamped machine transcript

This is preserved as machine output, including likely recognition errors. It is not represented as a legally certified or human-verbatim transcript.

```text
[00:00.50–00:03.08] Abi selam, uygulamayı şöyle bir göstereyim istedim.
[00:03.08–00:04.28] Şöyle gözüküyor.
[00:04.28–00:06.28] Biraz videoda onu anlamadınız herhalde.
[00:07.46–00:08.98] İşte bu mobilde böyle gözüküyor.
[00:08.98–00:10.98] Şu işaret, radyonunki.
[00:10.98–00:12.98] Mobilepte de böyle gözüküyor.
[00:12.98–00:14.98] Mobilepte de böyle gözüküyor.
[00:14.98–00:16.98] Ona muhtemelen ekmeci koymamız lazım.
[00:16.98–00:18.98] Şuradaki semboller gözükmüyor.
[00:18.98–00:21.70] Podcastlere bakayım, burada çalışacak var mı?
[00:21.70–00:27.60] Basalım.
[00:27.60–00:29.60] Evet, çalıyor. Gayet güzel.
[00:29.60–00:31.60] Çok iyi.
[00:32.56–00:34.56] Bence arabada...
[00:34.56–00:36.56] Biraz kastı şu an.
[00:36.56–00:38.56] Uygulamadan mı? Telefondan mı bilmiyorum. Telefonda kastı.
[00:38.56–00:40.56] Şu rankings kısmını bence kaldıralım.
[00:40.56–00:42.56] Burada rankings'e gerek yok.
[00:42.56–00:44.56] More'da ne var ona bakalım.
[00:50.61–00:52.61] Bence sadece live radio podcastler olsun.
[00:52.61–00:54.61] Gerisini burada olmasını getireyim, bir şey yok.
[01:00.93–01:02.93] What Did You Place falan şey muhtemelen bizim
[01:02.93–01:04.93] Vodlama sistemiyle ayakalı galiba.
[01:04.93–01:06.93] Bence o da falan gerek yok. Şunu durdurayım.
[01:07.89–01:11.90] Yayına geçti.
[01:11.90–01:13.90] Bence podcast
[01:13.90–01:15.90] serisi seçmeli.
[01:15.90–01:17.90] Seriden sonra gitmemiz lazım.
[01:17.90–01:19.90] Onu öyle ayarlamamız lazım.
[01:19.90–01:21.90] Ama yayınlar falan düzgün çalıyor.
[01:21.90–01:23.90] Sanki ses kalitesi
[01:23.90–01:25.90] bir öncekine göre birazcık daha
[01:25.90–01:27.90] kötü. Kötü değil yani.
[01:27.90–01:29.90] Kötü değil ses kalitesi ama daha kötü.
[01:29.90–01:31.90] Radyoya göre çok
[01:31.90–01:33.90] daha iyi. Daba gerçekten çok
[01:33.90–01:35.90] yakın bir ses seviyesinde. O galiba bizim
[01:35.90–01:37.90] ayarladığımız şeyle alakalı.
[01:37.90–01:39.90] Bence gayet düzgün çalıyor.
```

## Human interpretation and frame findings

- 00:09–00:19: radio/category artwork symbols are blank or missing. The unclear “ekmeci” phrase is interpreted from the visible context as a request to add an image/icon.
- 00:27–00:31: podcast playback succeeds.
- 00:34–00:38: visible lag occurs; reviewer is unsure whether the phone or app caused it.
- 00:38–00:42: remove Rankings from the driving interface.
- 00:50–00:54: keep only Live Radio and Podcasts as primary car destinations.
- 01:00–01:07: remove the “What TEDU Plays”/voting-related car section.
- 01:11–01:20: group podcast episodes by series and keep Next/Previous within the selected series.
- 01:20–01:40: streams play correctly; reviewer perceives a possible quality difference and relates it to stream configuration.

## Acceptance mapping

- Car browse root: Live Radio + Podcasts only.
- Artwork: car-compatible local resource/content URIs; no blank bitmap tiles.
- Live radio: station name plus Icecast song/artist metadata; quality choice stays in playback UI.
- FLAC: Classic and Jazz only; warn or block on metered mobile data.
- Podcasts: grouped by feed/series; Next/Previous remains in the active series.
- Driving safety: no rankings, voting, games, Study, account, or Jukebox-control UI in the car browse tree.

Runtime DHU/AAOS validation is still required after the final signed build; source tests alone do not prove the host rendering.
