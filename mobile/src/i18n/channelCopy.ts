import type {AppLanguage} from './index';

type ChannelCopy = {name: string; description: string};

const CHANNEL_COPY: Record<AppLanguage, Record<string, ChannelCopy>> = {
  en: {
    main: {name: 'RadioTEDU', description: 'Main channel'},
    classic: {name: 'Classical', description: 'Classical music'},
    jazz: {name: 'Jazz', description: 'Jazz music'},
    lofi: {name: 'Lo-Fi', description: 'Lo-Fi beats'},
    energize: {name: 'Energize', description: 'High energy'},
    spark: {name: 'Voting', description: 'Interactive voting radio'},
    rock: {name: 'Rock', description: 'Rock music'},
    english: {name: 'English', description: 'English broadcast'},
    french: {name: 'Français', description: 'French broadcast'},
  },
  tr: {
    main: {name: 'RadioTEDU', description: 'Ana kanal'},
    classic: {name: 'Classical', description: 'Klasik müzik'},
    jazz: {name: 'Jazz', description: 'Caz müziği'},
    lofi: {name: 'Lo-Fi', description: 'Lo-Fi ritimleri'},
    energize: {name: 'Energize', description: 'Yüksek enerji'},
    spark: {name: 'Voting', description: 'Etkileşimli oylama radyosu'},
    rock: {name: 'Rock', description: 'Rock müziği'},
    english: {name: 'English', description: 'İngilizce yayın'},
    french: {name: 'Français', description: 'Fransızca yayın'},
  },
  ru: {
    main: {name: 'RadioTEDU', description: 'Главный канал'}, classic: {name: 'Classical', description: 'Классическая музыка'}, jazz: {name: 'Jazz', description: 'Джазовая музыка'}, lofi: {name: 'Lo-Fi', description: 'Lo-Fi ритмы'}, energize: {name: 'Energize', description: 'Высокая энергия'}, spark: {name: 'Voting', description: 'Интерактивное радио-голосование'}, rock: {name: 'Rock', description: 'Рок-музыка'}, english: {name: 'English', description: 'Англоязычный эфир'}, french: {name: 'Français', description: 'Французский эфир'},
  },
  ar: {
    main: {name: 'RadioTEDU', description: 'القناة الرئيسية'}, classic: {name: 'Classical', description: 'موسيقى كلاسيكية'}, jazz: {name: 'Jazz', description: 'موسيقى الجاز'}, lofi: {name: 'Lo-Fi', description: 'إيقاعات Lo-Fi'}, energize: {name: 'Energize', description: 'طاقة عالية'}, spark: {name: 'Voting', description: 'إذاعة تصويت تفاعلية'}, rock: {name: 'Rock', description: 'موسيقى الروك'}, english: {name: 'English', description: 'بث باللغة الإنجليزية'}, french: {name: 'Français', description: 'بث باللغة الفرنسية'},
  },
  de: {
    main: {name: 'RadioTEDU', description: 'Hauptkanal'}, classic: {name: 'Classical', description: 'Klassische Musik'}, jazz: {name: 'Jazz', description: 'Jazzmusik'}, lofi: {name: 'Lo-Fi', description: 'Lo-Fi-Beats'}, energize: {name: 'Energize', description: 'Hohe Energie'}, spark: {name: 'Voting', description: 'Interaktives Abstimmungsradio'}, rock: {name: 'Rock', description: 'Rockmusik'}, english: {name: 'English', description: 'Englische Sendung'}, french: {name: 'Français', description: 'Französische Sendung'},
  },
  fr: {
    main: {name: 'RadioTEDU', description: 'Canal principal'}, classic: {name: 'Classical', description: 'Musique classique'}, jazz: {name: 'Jazz', description: 'Musique jazz'}, lofi: {name: 'Lo-Fi', description: 'Rythmes Lo-Fi'}, energize: {name: 'Energize', description: 'Énergie intense'}, spark: {name: 'Voting', description: 'Radio de vote interactive'}, rock: {name: 'Rock', description: 'Musique rock'}, english: {name: 'English', description: 'Émission en anglais'}, french: {name: 'Français', description: 'Émission en français'},
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
