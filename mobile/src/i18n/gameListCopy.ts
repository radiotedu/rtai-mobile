import type {AppLanguage} from './index';

export interface GameListText {
  title: string;
  description: string;
}

type LocalizedGameText = Record<AppLanguage, GameListText>;

const GAME_LIST_COPY: Record<string, LocalizedGameText> = {
  snake: {
    en: {title: 'Neon Snake', description: 'Swipe through obstacles, collect rare notes and protect three lives.'},
    tr: {title: 'Neon Yılan', description: 'Engelleri kaydırarak aş, nadir notaları topla ve üç canını koru.'},
    ru: {title: 'Неоновая змейка', description: 'Обходите препятствия, собирайте редкие ноты и берегите три жизни.'},
    ar: {title: 'الثعبان النيون', description: 'تجاوز العقبات واجمع النوتات النادرة وحافظ على الأرواح الثلاثة.'},
    de: {title: 'Neon Snake', description: 'Weiche Hindernissen aus, sammle seltene Noten und schütze drei Leben.'},
    fr: {title: 'Serpent néon', description: 'Évitez les obstacles, attrapez les notes rares et protégez vos trois vies.'},
  },
  memory: {
    en: {title: 'Memory', description: 'Match cards and test your memory.'},
    tr: {title: 'Hafıza', description: 'Kartları eşleştir, hafızanı test et.'},
    ru: {title: 'Память', description: 'Сопоставляйте карточки и проверяйте память.'},
    ar: {title: 'الذاكرة', description: 'طابق البطاقات واختبر ذاكرتك.'},
    de: {title: 'Memory', description: 'Ordne Karten zu und teste dein Gedächtnis.'},
    fr: {title: 'Mémoire', description: 'Associez les cartes et testez votre mémoire.'},
  },
  tetris: {
    en: {title: 'Blocks', description: 'Arrange falling blocks and clear lines.'},
    tr: {title: 'Bloklar', description: 'Düşen blokları diz, satırları temizle.'},
    ru: {title: 'Блоки', description: 'Собирайте падающие блоки и очищайте линии.'},
    ar: {title: 'الكتل', description: 'رتّب الكتل الساقطة وأكمل الخطوط.'},
    de: {title: 'Blöcke', description: 'Ordne fallende Blöcke und lösche Reihen.'},
    fr: {title: 'Blocs', description: 'Alignez les blocs qui tombent et effacez les lignes.'},
  },
  'rhythm-tap': {
    en: {title: 'Song Guess', description: 'Guess the song from its visual clues.'},
    tr: {title: 'Şarkı Bilmece', description: 'Görsel ipuçlarından şarkıyı bul.'},
    ru: {title: 'Угадай песню', description: 'Угадайте песню по визуальным подсказкам.'},
    ar: {title: 'خمّن الأغنية', description: 'خمّن الأغنية من التلميحات المرئية.'},
    de: {title: 'Song-Quiz', description: 'Errate den Song anhand visueller Hinweise.'},
    fr: {title: 'Devine la chanson', description: 'Devinez la chanson grâce aux indices visuels.'},
  },
  'word-guess': {
    en: {title: 'Music IQ', description: 'Twelve random challenges from a 256-question music catalog.'},
    tr: {title: 'Müzik IQ', description: '256 soruluk müzik havuzundan rastgele on iki soru.'},
    ru: {title: 'Музыкальный IQ', description: 'Двенадцать случайных заданий из каталога на 256 вопросов.'},
    ar: {title: 'ذكاء الموسيقى', description: 'اثنا عشر تحدياً عشوائياً من مجموعة تضم 256 سؤالاً.'},
    de: {title: 'Musik-IQ', description: 'Zwölf zufällige Aufgaben aus einem Katalog mit 256 Fragen.'},
    fr: {title: 'QI musical', description: 'Douze défis aléatoires tirés d’un catalogue de 256 questions.'},
  },
};

function normalizeLanguage(language?: string): AppLanguage {
  const code = (language ?? 'en').split(/[-_]/)[0] as AppLanguage;
  return GAME_LIST_COPY.snake[code] ? code : 'en';
}

export function gameListCopy(
  slug: string | undefined,
  language: string | undefined,
  fallback: Partial<GameListText> = {},
): GameListText {
  const localized = slug ? GAME_LIST_COPY[slug.trim().toLowerCase()]?.[normalizeLanguage(language)] : undefined;
  return {
    title: localized?.title ?? fallback.title ?? '',
    description: localized?.description ?? fallback.description ?? '',
  };
}
