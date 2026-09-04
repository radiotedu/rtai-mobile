const en = {
  headline: 'Your campus. Your soundtrack.',
  intro: 'Find your station, catch a conversation, see what is next.',
  stations: 'Choose your station',
  podcasts: 'Latest podcasts',
  listen: 'Listen live',
  podcastEmpty: 'No episodes available yet. Browse the podcast library.',
  podcastError: 'Podcasts could not load. Try again.',
  retry: 'Try again',
  playError: 'Playback could not start. Please try again.',
  best: 'Best on this device',
  newBest: 'New personal best',
  target: 'Next score goal',
  firstRound: 'Finish a round to set your first personal best.',
  quickPlay: 'Pick a game for me',
  arcadeIntro: 'A quick round, a new challenge. Beat your own score while you listen.',
  deletion: 'Request account deletion on the website',
  eventsError: 'Events could not load. Pull down to try again.',
};
type Copy = typeof en;
const translations: Record<string, Copy> = {
  en,
  tr: {
    headline: 'Kampüsün sesi, senin ritmin.', intro: 'Kanalını seç, bir sohbete katıl, sıradaki etkinliği keşfet.',
    stations: 'Kanalını seç', podcasts: 'Son podcast bölümleri', listen: 'Canlı dinle',
    podcastEmpty: 'Henüz bölüm yok. Podcast arşivine göz at.', podcastError: 'Podcastler yüklenemedi. Tekrar dene.',
    retry: 'Tekrar dene', playError: 'Oynatma başlatılamadı. Lütfen tekrar dene.', best: 'Bu cihazdaki rekorun',
    newBest: 'Yeni kişisel rekor', target: 'Sıradaki puan hedefin', firstRound: 'İlk rekorunu belirlemek için bir tur tamamla.',
    quickPlay: 'Bana bir oyun seç', arcadeIntro: 'Kısa bir tur, yeni bir oyun. Dinlerken kendi rekorunu geç.',
    deletion: 'Web sitesinden hesap silme talebi', eventsError: 'Etkinlikler yüklenemedi. Tekrar denemek için aşağı çek.',
  },
  de: {
    headline: 'Dein Campus. Dein Soundtrack.', intro: 'Wähle deinen Sender, höre Gespräche und entdecke kommende Veranstaltungen.',
    stations: 'Wähle deinen Sender', podcasts: 'Neueste Podcasts', listen: 'Live hören',
    podcastEmpty: 'Noch keine Folgen verfügbar. Öffne die Podcast-Bibliothek.', podcastError: 'Podcasts konnten nicht geladen werden. Versuche es erneut.',
    retry: 'Erneut versuchen', playError: 'Wiedergabe konnte nicht starten. Versuche es erneut.', best: 'Bestwert auf diesem Gerät',
    newBest: 'Neuer persönlicher Rekord', target: 'Nächstes Punkteziel', firstRound: 'Beende eine Runde für deinen ersten Rekord.',
    quickPlay: 'Wähle ein Spiel für mich', arcadeIntro: 'Eine kurze Runde, eine neue Herausforderung. Übertriff deinen Rekord beim Zuhören.',
    deletion: 'Kontolöschung auf der Website anfordern', eventsError: 'Veranstaltungen konnten nicht geladen werden. Zum Wiederholen nach unten ziehen.',
  },
  fr: {
    headline: 'Ton campus. Ta bande-son.', intro: 'Choisis ta station, écoute une conversation et retrouve les prochains événements.',
    stations: 'Choisis ta station', podcasts: 'Derniers podcasts', listen: 'Écouter en direct',
    podcastEmpty: 'Aucun épisode disponible. Consulte la bibliothèque de podcasts.', podcastError: 'Impossible de charger les podcasts. Réessaie.',
    retry: 'Réessayer', playError: 'Impossible de lancer la lecture. Réessaie.', best: 'Record sur cet appareil',
    newBest: 'Nouveau record personnel', target: 'Prochain objectif de score', firstRound: 'Termine une partie pour établir ton premier record.',
    quickPlay: 'Choisis un jeu pour moi', arcadeIntro: 'Une courte partie, un nouveau défi. Bats ton record en écoutant la radio.',
    deletion: 'Demander la suppression du compte sur le site', eventsError: 'Impossible de charger les événements. Tire vers le bas pour réessayer.',
  },
  ru: {
    headline: 'Твой кампус. Твоя музыка.', intro: 'Выбери станцию, послушай беседу и узнай о ближайших событиях.',
    stations: 'Выбери станцию', podcasts: 'Новые подкасты', listen: 'Слушать эфир',
    podcastEmpty: 'Выпусков пока нет. Открой библиотеку подкастов.', podcastError: 'Не удалось загрузить подкасты. Попробуй ещё раз.',
    retry: 'Повторить', playError: 'Не удалось начать воспроизведение. Попробуй ещё раз.', best: 'Рекорд на этом устройстве',
    newBest: 'Новый личный рекорд', target: 'Следующая цель', firstRound: 'Заверши раунд, чтобы установить первый рекорд.',
    quickPlay: 'Выбрать игру за меня', arcadeIntro: 'Короткий раунд, новый вызов. Побей свой рекорд, слушая радио.',
    deletion: 'Запросить удаление аккаунта на сайте', eventsError: 'Не удалось загрузить события. Потяни вниз, чтобы повторить.',
  },
  ar: {
    headline: 'حرمك الجامعي. موسيقاك.', intro: 'اختر محطتك واستمع إلى حوار وتعرّف على الفعاليات القادمة.',
    stations: 'اختر محطتك', podcasts: 'أحدث البودكاست', listen: 'استمع مباشرة',
    podcastEmpty: 'لا توجد حلقات متاحة بعد. تصفّح مكتبة البودكاست.', podcastError: 'تعذّر تحميل البودكاست. حاول مجددًا.',
    retry: 'حاول مجددًا', playError: 'تعذّر بدء التشغيل. حاول مجددًا.', best: 'أفضل نتيجة على هذا الجهاز',
    newBest: 'رقم قياسي شخصي جديد', target: 'هدف النقاط التالي', firstRound: 'أكمل جولة لتسجيل أول رقم قياسي لك.',
    quickPlay: 'اختر لعبة لي', arcadeIntro: 'جولة قصيرة وتحدٍ جديد. حسّن نتيجتك وأنت تستمع إلى الراديو.',
    deletion: 'طلب حذف الحساب عبر الموقع', eventsError: 'تعذّر تحميل الفعاليات. اسحب للأسفل للمحاولة مجددًا.',
  },
};

export function discoveryCopy(language: string | undefined): Copy {
  return translations[(language ?? 'en').split(/[-_]/)[0]] ?? en;
}
