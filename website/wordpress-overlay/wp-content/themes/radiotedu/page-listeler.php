<?php
declare(strict_types=1);

$isEnglish = radiotedu_current_language() === 'en';
$pageTitle = $isEnglish ? 'Playlists — RadioTEDU' : 'Listeler — RadioTEDU';
add_filter('pre_get_document_title', static fn (): string => $pageTitle);

$playlists = [
    ['id' => '2Rdo4y4YFNRSV5FcXeIXNC', 'title' => 'Rock', 'count' => 431, 'tag' => 'ROCK', 'tr' => 'Klasik rifflerden yeni nesil alternative’a uzanan geniş bir seçki. Gitarın sesini yükseltmek, tempoyu diri tutmak ve günün enerjisini toplamak isteyenler için.', 'en' => 'A wide-ranging selection from classic riffs to new-generation alternative. Built for turning up the guitars, keeping the pace alive and gathering the day’s energy.'],
    ['id' => '5hTt4t2LRlpBzYvqPw16hj', 'title' => 'Jazz', 'count' => 387, 'tag' => 'JAZZ', 'tr' => 'Bebop, cool jazz, vokal caz ve fusion arasında zarif bir yolculuk. Çalışırken odaklanmak ya da akşamın ritmini yavaşlatmak için rafine bir eşlikçi.', 'en' => 'An elegant journey through bebop, cool jazz, vocal jazz and fusion. A refined companion for focused work or slowing down the rhythm of the evening.'],
    ['id' => '2efgunnCLkfh31AbHPWxJX', 'title' => 'radio', 'count' => 236, 'tag' => 'ON AIR', 'tr' => 'RadioTEDU yayınlarının müzikal omurgası. Farklı saatlere, ruh hâllerine ve kampüs anlarına uyum sağlayan; türler arasında özgürce dolaşan ana seçkimiz.', 'en' => 'The musical backbone of RadioTEDU broadcasts: our main selection moves freely across genres and adapts to different hours, moods and campus moments.'],
    ['id' => '4lBMY146NhbqH5ntgugeSi', 'title' => 'Kolej Playlist', 'count' => 38, 'tag' => 'KOLEJ', 'tr' => 'Kolej’in gündelik temposunu taşıyan sıcak, hareketli ve tanıdık şarkılar. Kampüse gelişten ders çıkışına kadar şehrin merkezindeki RadioTEDU hissi.', 'en' => 'Warm, energetic and familiar songs carrying Kolej’s everyday tempo—from arriving on campus to leaving class, this is the RadioTEDU feeling at the heart of the city.'],
    ['id' => '7KkjcDhROUkavZVk44RtVH', 'title' => 'If Peter Parker had an iPod', 'count' => 38, 'tag' => 'ALT / POP-PUNK', 'tr' => 'Peter Parker’ın cebinde bir iPod olsaydı muhtemelen böyle çalardı: pop-punk, alternatif rock ve gençlik filmi enerjisiyle hızlı, eğlenceli bir zaman kapsülü.', 'en' => 'If Peter Parker carried an iPod, it would probably sound like this: a fast, playful time capsule of pop-punk, alternative rock and coming-of-age energy.'],
    ['id' => '7KRqeDEo9zdijXCCWCDaLh', 'title' => 'few words,much fear', 'count' => 31, 'tag' => 'DARK SCORE', 'tr' => 'Az söz, yüksek gerilim. Korku filmi müzikleri, karanlık elektronik dokular ve sessizliği daha da belirginleştiren atmosferik kayıtlar.', 'en' => 'Few words, high tension: horror scores, dark electronic textures and atmospheric recordings that make the silence feel even sharper.'],
    ['id' => '5f0JeN6fRMTCDKEk01zctz', 'title' => '2026 is new 2016', 'count' => 50, 'tag' => 'NOSTALGIA', 'tr' => '2010’ların ortasındaki indie, pop ve alternatif heyecanını bugüne taşıyan nostaljik bir geri dönüş. Eski fotoğraflar kadar tanıdık, yeni bir yıl kadar canlı.', 'en' => 'A nostalgic return that brings the mid-2010s indie, pop and alternative rush into today—familiar as old photographs, alive as a new year.'],
    ['id' => '1MAkXaLUzE3IAic1OUqdfr', 'title' => 'Türkçe Punk', 'count' => 24, 'tag' => 'PUNK', 'tr' => 'Türkiye punk ve post-punk sahnesinden doğrudan, sert ve sözünü sakınmayan kayıtlar. Kısa şarkılar, yüksek enerji ve güçlü bir bağımsız ruh.', 'en' => 'Direct, uncompromising records from Türkiye’s punk and post-punk scene: short songs, high energy and a strong independent spirit.'],
    ['id' => '73SPKV6DgDpg1xnE3KqDTp', 'title' => 'Autumn Vibe', 'count' => 100, 'tag' => 'AUTUMN', 'tr' => 'Serin hava, sararan yapraklar ve sıcak bir içecek için akustik, indie ve yumuşak pop tonları. Sonbaharın dinginliğini gün boyu yanında taşır.', 'en' => 'Acoustic, indie and soft-pop tones for cool weather, amber leaves and a warm drink—carrying autumn calm with you throughout the day.'],
    ['id' => '3fHaGO1TsLI2PWeAXHS1Fb', 'title' => 'Spooky Vibe', 'count' => 50, 'tag' => 'SPOOKY', 'tr' => 'Tekinsiz ama eğlenceli; sinematik gerilim, karanlık alternatif ve Halloween ruhunu bir araya getiren atmosferik bir gece seçkisi.', 'en' => 'Unsettling but playful: an atmospheric night selection bringing together cinematic tension, dark alternative and the spirit of Halloween.'],
    ['id' => '5VtLJcvY7DMRF9p6SdTdUR', 'title' => 'TEDÜ’ de Yalnızken Dinlenecek Şarkılar', 'count' => 30, 'tag' => 'AFTER HOURS', 'tr' => 'Koridorlar sessizleştiğinde ve kampüs sana kaldığında açılacak içe dönük şarkılar. Geç saatlere, düşüncelere ve boş sınıflara eşlik eder.', 'en' => 'Introspective songs for when the corridors go quiet and the campus feels like yours—made for late hours, wandering thoughts and empty classrooms.'],
    ['id' => '5Nbgi5eNTEA8aU2hKT886s', 'title' => 'Snowy Nights Sparkling Lights', 'count' => 96, 'tag' => 'WINTER', 'tr' => 'Karlı gecelerin sessizliğiyle ışıklı sokakların sıcaklığını buluşturan kış seçkisi. Caz, pop ve yumuşak dokularla mevsime sinematik bir çerçeve.', 'en' => 'A winter selection joining the hush of snowy nights with the warmth of illuminated streets, framing the season through jazz, pop and soft textures.'],
    ['id' => '5dSYhDX6saxTx6OsejTcsj', 'title' => 'Kalabalık Ortamda Dinlenecek Şarkılar', 'count' => 32, 'tag' => 'SOCIAL', 'tr' => 'Sohbetin önüne geçmeden ortamın enerjisini yükselten tanıdık ve akıcı parçalar. Arkadaş buluşmaları, kulüp odaları ve uzun masalar için.', 'en' => 'Familiar, flowing tracks that lift the room without overtaking the conversation—made for gatherings, club rooms and long shared tables.'],
    ['id' => '0dDnH5sfmwsOO5iHDyCexG', 'title' => 'Deep Pulse', 'count' => 39, 'tag' => 'ELECTRONIC', 'tr' => 'Derin baslar, karanlık elektronik katmanlar ve kesintisiz bir ileri hareket. Gece yürüyüşlerine, odak seanslarına ve yüksek tempoya göre tasarlandı.', 'en' => 'Deep bass, dark electronic layers and continuous forward motion—designed for night walks, focused sessions and a high-tempo state of mind.'],
    ['id' => '1KOj8EcStn3dJykMgnv1cM', 'title' => 'Bir Sonraki Dersi Beklerken', 'count' => 26, 'tag' => 'BETWEEN CLASSES', 'tr' => 'İki ders arasındaki kısa boşluğu iyi değerlendiren, hemen açılan ve enerjiyi tazeleyen şarkılar. Kahve sırası, merdivenler ve kampüs turu için.', 'en' => 'Instant, energising songs that make the most of the short gap between classes—for the coffee queue, the stairs and a quick lap around campus.'],
    ['id' => '3h92kW5H3mDIpOS6FQVkhu', 'title' => 'Spooky Season', 'count' => 26, 'tag' => 'HALLOWEEN', 'tr' => 'Halloween klasiklerini ve sezonun karanlık pop kültürünü tek yerde buluşturan eğlenceli bir seçki. Kostüm hazırlanırken ya da gece başlarken aç.', 'en' => 'A playful collection uniting Halloween classics with the season’s dark pop culture—press play while getting the costume ready or starting the night.'],
    ['id' => '3YHcLPDMsTJzLUfSJnIUqV', 'title' => 'Soul of TEDU', 'count' => 18, 'tag' => 'SOUL / R&B', 'tr' => 'Soul, R&B ve funk’ın sıcaklığını TEDÜ ruhuyla buluşturan kısa ama karakterli bir seçki. Akıcı vokaller, güçlü groove ve iyi hisler.', 'en' => 'A compact collection with character, joining the warmth of soul, R&B and funk with the spirit of TEDU—smooth vocals, strong grooves and good feelings.'],
    ['id' => '3dGi7HNlH3UWS7MHCzhNAH', 'title' => 'Train To Sun', 'count' => 31, 'tag' => 'JOURNEY', 'tr' => 'Gün doğumuna giden hayalî bir tren yolculuğu: sinematik indie, elektronik ve genişleyen melodiler. Pencere kenarı, uzun yollar ve yeni başlangıçlar için.', 'en' => 'An imaginary train journey toward sunrise, shaped by cinematic indie, electronics and expanding melodies—for window seats, long roads and new beginnings.'],
    ['id' => '62sLClCagk42uOEhc6GjFR', 'title' => 'Sounds From The Dark Side', 'count' => 11, 'tag' => 'GOTH / POST-PUNK', 'tr' => 'Goth, post-punk ve darkwave’in gölgeli köşelerinden seçilmiş yoğun bir mini koleksiyon. Soğuk baslar, keskin gitarlar ve geceye yakışan vokaller.', 'en' => 'An intense mini-collection from the shadowed corners of goth, post-punk and darkwave: cold bass, sharp guitars and vocals made for the night.'],
    ['id' => '4D2rhdMD0vR6rqG20R1bE4', 'title' => 'Silver Screen Sounds', 'count' => 55, 'tag' => 'SOUNDTRACK', 'tr' => 'Beyaz perdenin unutulmaz temaları, büyük orkestralar ve güçlü sahne duygusu. Günlük anları bile bir film sekansına dönüştüren soundtrack seçkisi.', 'en' => 'Unforgettable screen themes, grand orchestras and powerful scene-setting—a soundtrack collection that can turn everyday moments into a film sequence.'],
    ['id' => '7GkeHg6U8exa3gkCxRp7Ag', 'title' => 'Get Ready & Hype Up', 'count' => 30, 'tag' => 'ENERGY', 'tr' => 'Hazırlanırken tempoyu yükselten, özgüveni yerine getiren ve geceyi başlatan yüksek enerjili parçalar. İlk şarkıdan itibaren hareketli.', 'en' => 'High-energy tracks that raise the tempo, restore confidence and start the night while you get ready—moving from the very first song.'],
    ['id' => '5cs06YntEZOkzdosf2OSbZ', 'title' => 'Çim Amfi Basamakları', 'count' => 37, 'tag' => 'CAMPUS', 'tr' => 'Çim amfide güneş, arkadaşlar ve ders arası sohbetleri için ferah indie, akustik ve alternatif tonlar. Kampüsün açık hava soundtrack’i.', 'en' => 'Airy indie, acoustic and alternative tones for sunshine, friends and conversations on the amphitheatre steps—the campus open-air soundtrack.'],
    ['id' => '0hBGOyOdR1NGe6yyvdXo14', 'title' => '70’s & 80’s', 'count' => 29, 'tag' => 'CLASSICS', 'tr' => 'Diskodan synth-pop’a, rock klasiklerinden zamansız pop melodilerine iki güçlü on yıl. Tanıdık nakaratlar ve analog sıcaklıkla dolu.', 'en' => 'Two defining decades from disco to synth-pop, rock classics to timeless pop melodies—filled with familiar choruses and analogue warmth.'],
];

get_header();
?>
<main id="rt-page" class="rt-playlists" data-rt-page>
    <header class="rt-playlists__hero">
        <div class="rt-playlists__hero-copy">
            <p class="rt-kicker">RadioTEDU / Spotify</p>
            <h1><?php echo esc_html($isEnglish ? 'A different frequency for every mood.' : 'Her ruh hâline ayrı bir frekans.'); ?></h1>
            <p><?php echo esc_html($isEnglish ? 'From the rhythm of Kolej to late-night campus corridors, RadioTEDU selections are curated for moments, seasons, and stories.' : 'Kolejin ritminden gece kampüs koridorlarına; RadioTEDU seçkileri anlar, mevsimler ve hikâyeler için hazırlandı.'); ?></p>
            <a class="rt-button rt-button--dark" href="https://open.spotify.com/user/31qub2lbtxckv7cjzuxgcv7qes4a/playlists" target="_blank" rel="noopener noreferrer" data-no-pjax><?php echo esc_html($isEnglish ? 'Follow on Spotify' : 'Spotify’da takip et'); ?></a>
        </div>
        <div class="rt-playlists__hero-stat" aria-label="<?php echo esc_attr($isEnglish ? 'Playlist count' : 'Liste sayısı'); ?>">
            <strong><?php echo esc_html((string) count($playlists)); ?></strong>
            <span><?php echo esc_html($isEnglish ? 'curated playlists' : 'özenle hazırlanmış liste'); ?></span>
        </div>
    </header>

    <section class="rt-playlists__intro" aria-labelledby="rt-playlists-title">
        <div>
            <p class="rt-kicker"><?php echo esc_html($isEnglish ? 'THE RADIOTEDU COLLECTION' : 'RADIOTEDU SEÇKİSİ'); ?></p>
            <h2 id="rt-playlists-title"><?php echo esc_html($isEnglish ? 'Choose the moment. We set the soundtrack.' : 'Anı seç. Soundtrack’i biz hazırladık.'); ?></h2>
        </div>
        <p><?php echo esc_html($isEnglish ? 'Every player below is an official Spotify embed. Start any list here, save it to your library or open the full collection in Spotify.' : 'Aşağıdaki her oynatıcı resmî Spotify embed’idir. İstediğin listeyi burada başlatabilir, kitaplığına kaydedebilir veya Spotify’da açabilirsin.'); ?></p>
    </section>

    <div class="rt-playlists__grid">
        <?php foreach ($playlists as $index => $playlist) : ?>
            <article class="rt-playlist-card">
                <div class="rt-playlist-card__meta">
                    <span><?php echo esc_html(str_pad((string) ($index + 1), 2, '0', STR_PAD_LEFT)); ?></span>
                    <span><?php echo esc_html($playlist['tag']); ?></span>
                    <span><?php echo esc_html(sprintf($isEnglish ? '%d tracks' : '%d parça', $playlist['count'])); ?></span>
                </div>
                <h3><?php echo esc_html($playlist['title']); ?></h3>
                <p><?php echo esc_html($isEnglish ? $playlist['en'] : $playlist['tr']); ?></p>
                <iframe
                    src="<?php echo esc_url('https://open.spotify.com/embed/playlist/' . $playlist['id'] . '?utm_source=generator&theme=0'); ?>"
                    title="<?php echo esc_attr($playlist['title'] . ' — Spotify'); ?>"
                    width="100%"
                    height="352"
                    loading="lazy"
                    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                ></iframe>
            </article>
        <?php endforeach; ?>
    </div>

    <footer class="rt-playlists__footer">
        <p><?php echo esc_html($isEnglish ? 'The collection keeps changing as RadioTEDU discovers new sounds.' : 'RadioTEDU yeni sesler keşfettikçe bu seçki değişmeye devam eder.'); ?></p>
        <a href="https://open.spotify.com/user/31qub2lbtxckv7cjzuxgcv7qes4a/playlists" target="_blank" rel="noopener noreferrer" data-no-pjax><?php echo esc_html($isEnglish ? 'See every playlist on Spotify ↗' : 'Tüm listeleri Spotify’da gör ↗'); ?></a>
    </footer>
</main>
<?php get_footer(); ?>
