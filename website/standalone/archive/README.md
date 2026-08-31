# RadioTEDU Yayın Arşivi

Canlı adres: `https://radiotedu.com/archive/`

## Yayın ekleme

Kayıtları sunucuda aşağıdaki dizine kopyalayın:

`C:\RadioTEDU\archive-media`

Alt klasörler seri, program veya yıl adı olarak kullanılabilir. Örneğin:

`C:\RadioTEDU\archive-media\2024\Kampüs Gündemi\Bölüm 01.mp3`

Sayfa bu örneği `2024 / Kampüs Gündemi` koleksiyonu altında listeler. Desteklenen dosya türleri: MP3, M4A, AAC, OGG, OPUS, FLAC, WAV ve MP4.

## Depolama davranışı

- Medya dosyaları Git deposuna veya WordPress yüklemelerine girmez.
- Liste yalnızca `/archive/` açıldığında dosya adı, boyut ve değiştirilme tarihini okur.
- Ses dosyası için ağ isteği ancak ziyaretçi `Oynat` düğmesine bastığında başlar.
- Arşiv alt ağacında tarayıcı, IIS çıktı ve kernel önbelleği kapalıdır.
- IIS statik dosya aktarımı byte-range isteklerini desteklediği için büyük kayıtlar tümüyle belleğe alınmadan ileri ve geri sarılabilir.
- Dizin listeleme kapalıdır; yalnızca izin verilen medya uzantıları arşiv sayfasında görünür.

Bu sayfada bir yükleme formu yoktur. Büyük arşivler sunucuya SFTP veya yönetilen dosya aktarımıyla doğrudan kopyalanmalıdır.
