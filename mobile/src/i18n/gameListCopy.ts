import type {AppLanguage} from './index';

export interface GameListText {
  title: string;
  description: string;
}

type LocalizedGameText = Record<AppLanguage, GameListText>;

const GAME_LIST_COPY: Record<string, LocalizedGameText> = {
  snake: {
    en: {title: 'Snake', description: 'Classic snake game — speed increases as you grow.'},
    tr: {title: 'Yılan', description: 'Klasik yılan oyunu — büyüdükçe hızlanır.'},
    ru: {title: 'Змейка', description: 'Классическая змейка — скорость растёт вместе с длиной.'},
    ar: {title: 'الثعبان', description: 'لعبة الثعبان الكلاسيكية — تزداد السرعة كلما كبرت.'},
    de: {title: 'Snake', description: 'Klassisches Snake-Spiel — mit deiner Länge wird es schneller.'},
    fr: {title: 'Serpent', description: 'Jeu du serpent classique — il accélère quand tu grandis.'},
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
    en: {title: 'Word Guess', description: 'Find the hidden word from the clues.'},
    tr: {title: 'Kelime Tahmini', description: 'İpuçlarıyla gizli kelimeyi bul.'},
    ru: {title: 'Угадай слово', description: 'Найдите загаданное слово по подсказкам.'},
    ar: {title: 'خمن الكلمة', description: 'اكتشف الكلمة المخفية من خلال التلميحات.'},
    de: {title: 'Wort raten', description: 'Finde das versteckte Wort anhand der Hinweise.'},
    fr: {title: 'Devine le mot', description: 'Trouvez le mot caché grâce aux indices.'},
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
