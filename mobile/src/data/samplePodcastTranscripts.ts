export interface TranscriptCue {
  id: string;
  startSeconds: number;
  endSeconds: number;
  speaker?: string;
  text: string;
}

export type TakeawayCategory =
  | 'core_concept'
  | 'research_insight'
  | 'exam_key'
  | 'discussion';

export interface AcademicTakeaway {
  id: string;
  title: string;
  description: string;
  category: TakeawayCategory;
  timestampSeconds: number;
  keyTerms?: string[];
}

export function formatTimestamp(totalSeconds: number): string {
  if (isNaN(totalSeconds) || totalSeconds < 0) {
    return '00:00';
  }
  const rounded = Math.floor(totalSeconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const seconds = rounded % 60;
  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export function isCueActive(cue: TranscriptCue, currentSeconds: number): boolean {
  return currentSeconds >= cue.startSeconds && currentSeconds < cue.endSeconds;
}

export const SAMPLE_TEDU_TRANSCRIPT_CUES: TranscriptCue[] = [
  {
    id: 'cue-1',
    startSeconds: 0,
    endSeconds: 18,
    speaker: 'Prof. Dr. Ziya Selçuk',
    text: 'RadioTEDU podcast serimize hoş geldiniz. Bugün TED Üniversitesi Mühendislik ve Eğitim Fakülteleri ortaklığında yapay zeka ve eğitimdeki dönüşümü konuşuyoruz.',
  },
  {
    id: 'cue-2',
    startSeconds: 18,
    endSeconds: 45,
    speaker: 'Dr. Öğr. Üyesi Kaya Demir',
    text: 'Veri odaklı karar verme süreçleri günümüzde sadece bilgisayar mühendisliğinin değil, tüm akademik disiplinlerin temel çalışma metodolojisi haline geldi.',
  },
  {
    id: 'cue-3',
    startSeconds: 45,
    endSeconds: 82,
    speaker: 'Dr. Elif Arslan',
    text: 'TEDÜ Kampüsünde yürüttüğümüz doğal dil işleme (NLP) laboratuvarı çalışmalarında, öğrencilerin derse katılımı ve sesli transkript analizi üzerine modeller geliştiriyoruz.',
  },
  {
    id: 'cue-4',
    startSeconds: 82,
    endSeconds: 125,
    speaker: 'Dr. Kaya Demir',
    text: 'Büyük dil modellerinin (LLM) akademik araştırmalardaki rolü: Halüsinasyon risklerini minimize etmek için RAG (Retrieval-Augmented Generation) mimarisini entegre ediyoruz.',
  },
  {
    id: 'cue-5',
    startSeconds: 125,
    endSeconds: 172,
    speaker: 'Dr. Elif Arslan',
    text: 'Öğrencilerimiz için hazırladığımız interaktif öğrenme platformlarında, ders kayıtları saniyeler içinde taranabilir ve aranabilir bilgi kartlarına dönüştürülüyor.',
  },
  {
    id: 'cue-6',
    startSeconds: 172,
    endSeconds: 220,
    speaker: 'Prof. Dr. Ziya Selçuk',
    text: 'Akademik dürüstlük ve etik kurallar çerçevesinde üretken yapay zeka araçlarının kullanım rehberi TEDÜ Senatosu tarafından onaylandı.',
  },
  {
    id: 'cue-7',
    startSeconds: 220,
    endSeconds: 275,
    speaker: 'Dr. Kaya Demir',
    text: 'Gelecek dönem açılacak İleri Seviye Veri Analitiği dersinde projelere dayalı değerlendirme kriterlerimiz ve açık kaynak katkıları ön planda olacak.',
  },
  {
    id: 'cue-8',
    startSeconds: 275,
    endSeconds: 330,
    speaker: 'Dr. Elif Arslan',
    text: 'RadioTEDU dinleyicileri ve öğrencilerimiz podcast bölüm notlarındaki interaktif transkript üzerinden istedikleri konuya anında atlayabilirler.',
  },
];

export const SAMPLE_TEDU_ACADEMIC_TAKEAWAYS: AcademicTakeaway[] = [
  {
    id: 'card-1',
    title: 'RAG Mimarisi ve Bilgi Doğrulama',
    category: 'core_concept',
    description: 'Halüsinasyonu önlemek için harici akademik veri kaynaklarının vektör tabanlı taranarak LLM promptuna beslenmesi süreci.',
    timestampSeconds: 82,
    keyTerms: ['RAG', 'LLM', 'Doğrulama', 'Vektör Veritabanı'],
  },
  {
    id: 'card-2',
    title: 'Akademik Etik ve Üretken Yapay Zeka',
    category: 'discussion',
    description: 'TEDÜ Senatosu tarafından onaylanan etik kullanım rehberi: Araştırma şeffaflığı, atıf kuralları ve akademik dürüstlük.',
    timestampSeconds: 172,
    keyTerms: ['Akademik Dürüstlük', 'Senato Rehberi', 'Etik'],
  },
  {
    id: 'card-3',
    title: 'Doğal Dil İşleme & Transkript Analitiği',
    category: 'research_insight',
    description: 'TEDÜ NLP laboratuvarında geliştirilen ses kayıtlarının zaman damgalı metne dönüştürülmesi ve anlamsal indeksleme modelleri.',
    timestampSeconds: 45,
    keyTerms: ['NLP', 'Ses Analizi', 'Zaman Damgası'],
  },
  {
    id: 'card-4',
    title: 'Proje Odaklı Değerlendirme Modeli',
    category: 'exam_key',
    description: 'İleri Seviye Veri Analitiği dersinde teorik sınav yerine açık kaynak katkıları ve gerçek veri setleriyle proje teslimi.',
    timestampSeconds: 220,
    keyTerms: ['Proje Tabanlı Öğrenme', 'Açık Kaynak', 'Veri Setleri'],
  },
];
