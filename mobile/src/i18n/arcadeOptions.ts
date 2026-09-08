const messages: Record<string, string[]> = {
  en: ['Effects', 'Calm', 'Standard', 'Lively', 'Haptics', 'Online play · server-verified Gold', 'Connect and sign in to earn Gold.', 'This game is not available for online rewards yet.', 'Classic', 'Flash memory', 'Remember the cards', 'Recent rounds'],
  tr: ['Efektler', 'Sakin', 'Standart', 'Canlı', 'Titreşim', 'Çevrimiçi oyun · sunucu onaylı Gold', 'Gold kazanmak için bağlan ve giriş yap.', 'Bu oyun henüz çevrimiçi ödüllere açık değil.', 'Klasik', 'Hızlı hafıza', 'Kartları aklında tut', 'Son turlar'],
  de: ['Effekte', 'Ruhig', 'Standard', 'Lebhaft', 'Haptik', 'Online spielen · serverbestätigtes Gold', 'Verbinde dich und melde dich an, um Gold zu verdienen.', 'Für dieses Spiel sind Online-Belohnungen noch nicht verfügbar.', 'Klassisch', 'Blitzgedächtnis', 'Merke dir die Karten', 'Letzte Runden'],
  fr: ['Effets', 'Calme', 'Standard', 'Vif', 'Vibrations', 'Jeu en ligne · Gold validé par le serveur', 'Connectez-vous pour gagner du Gold.', 'Les récompenses en ligne ne sont pas encore disponibles pour ce jeu.', 'Classique', 'Mémoire flash', 'Mémorisez les cartes', 'Dernières parties'],
  ru: ['Эффекты', 'Спокойно', 'Обычно', 'Ярко', 'Вибрация', 'Онлайн-игра · Gold подтверждён сервером', 'Подключитесь и войдите, чтобы получать Gold.', 'Онлайн-награды для этой игры пока недоступны.', 'Классика', 'Флеш-память', 'Запомните карточки', 'Последние раунды'],
  ar: ['المؤثرات', 'هادئ', 'عادي', 'حيوي', 'الاهتزاز', 'لعب عبر الإنترنت · Gold موثّق من الخادم', 'اتصل وسجّل الدخول لكسب Gold.', 'مكافآت هذه اللعبة عبر الإنترنت غير متاحة بعد.', 'كلاسيكي', 'ذاكرة سريعة', 'تذكّر البطاقات', 'الجولات الأخيرة'],
};
export function arcadeOptions(language: string): string[] {
  return messages[language.split('-')[0]] || messages.en;
}
