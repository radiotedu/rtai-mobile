import type {AppLanguage} from './index';

type ChannelCopy = {name: string; description: string};

const CHANNEL_COPY: Record<AppLanguage, Record<string, ChannelCopy>> = {
  en: {
    main: {name: 'RadioTEDU', description: 'Main channel'},
    classic: {name: 'Classic', description: 'Classical music'},
    jazz: {name: 'Jazz', description: 'Jazz music'},
    lofi: {name: 'RadioTEDU Lo-Fi', description: 'Lo-Fi beats'},
    energize: {name: 'Energize', description: 'High energy'},
    spark: {name: 'Spark', description: 'rtAI · Radio AI host'},
    rock: {name: 'Rock', description: 'Rock music'},
    english: {name: 'RadioTEDU English', description: 'English broadcast'},
    french: {name: 'RadioTEDU Français', description: 'French broadcast'},
  },
  tr: {
    main: {name: 'RadioTEDU', description: 'Ana kanal'},
    classic: {name: 'Classic', description: 'Klasik müzik'},
    jazz: {name: 'Jazz', description: 'Caz müziği'},
    lofi: {name: 'RadioTEDU Lo-Fi', description: 'Lo-Fi ritimleri'},
    energize: {name: 'Energize', description: 'Yüksek enerji'},
    spark: {name: 'Spark', description: 'rtAI · Radio AI sunucusu'},
    rock: {name: 'Rock', description: 'Rock müziği'},
    english: {name: 'RadioTEDU English', description: 'İngilizce yayın'},
    french: {name: 'RadioTEDU Français', description: 'Fransızca yayın'},
  },
  ru: {
    main: {name: 'RadioTEDU', description: 'Главный канал'}, classic: {name: 'Classic', description: 'Классическая музыка'}, jazz: {name: 'Jazz', description: 'Джазовая музыка'}, lofi: {name: 'RadioTEDU Lo-Fi', description: 'Lo-Fi ритмы'}, energize: {name: 'Energize', description: 'Высокая энергия'}, spark: {name: 'Spark', description: 'rtAI · Радио с ИИ'}, rock: {name: 'Rock', description: 'Рок-музыка'}, english: {name: 'RadioTEDU English', description: 'Англоязычный эфир'}, french: {name: 'RadioTEDU Français', description: 'Французский эфир'},
  },
  ar: {
    main: {name: 'RadioTEDU', description: 'القناة الرئيسية'}, classic: {name: 'Classic', description: 'موسيقى كلاسيكية'}, jazz: {name: 'Jazz', description: 'موسيقى الجاز'}, lofi: {name: 'RadioTEDU Lo-Fi', description: 'إيقاعات Lo-Fi'}, energize: {name: 'Energize', description: 'طاقة عالية'}, spark: {name: 'Spark', description: 'rtAI · مضيف راديو بالذكاء الاصطناعي'}, rock: {name: 'Rock', description: 'موسيقى الروك'}, english: {name: 'RadioTEDU English', description: 'بث باللغة الإنجليزية'}, french: {name: 'RadioTEDU Français', description: 'بث باللغة الفرنسية'},
  },
  de: {
    main: {name: 'RadioTEDU', description: 'Hauptkanal'}, classic: {name: 'Classic', description: 'Klassische Musik'}, jazz: {name: 'Jazz', description: 'Jazzmusik'}, lofi: {name: 'RadioTEDU Lo-Fi', description: 'Lo-Fi-Beats'}, energize: {name: 'Energize', description: 'Hohe Energie'}, spark: {name: 'Spark', description: 'rtAI · Radio-KI-Host'}, rock: {name: 'Rock', description: 'Rockmusik'}, english: {name: 'RadioTEDU English', description: 'Englische Sendung'}, french: {name: 'RadioTEDU Français', description: 'Französische Sendung'},
  },
  fr: {
    main: {name: 'RadioTEDU', description: 'Canal principal'}, classic: {name: 'Classic', description: 'Musique classique'}, jazz: {name: 'Jazz', description: 'Musique jazz'}, lofi: {name: 'RadioTEDU Lo-Fi', description: 'Rythmes Lo-Fi'}, energize: {name: 'Energize', description: 'Énergie intense'}, spark: {name: 'Spark', description: 'rtAI · animateur radio IA'}, rock: {name: 'Rock', description: 'Musique rock'}, english: {name: 'RadioTEDU English', description: 'Émission en anglais'}, french: {name: 'RadioTEDU Français', description: 'Émission en français'},
  },
};

export function getChannelCopy(
  key: string | undefined,
  language: string | undefined,
  fallback: ChannelCopy,
): ChannelCopy {
  const lang = (language ?? 'en').split(/[-_]/)[0] as AppLanguage;
  return CHANNEL_COPY[lang]?.[key ?? ''] ?? CHANNEL_COPY.en[key ?? ''] ?? fallback;
}
