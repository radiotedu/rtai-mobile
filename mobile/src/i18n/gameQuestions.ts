import type {AppLanguage} from './index';
import {MUSIC_QUIZ_CATALOG} from '../data/musicQuizCatalog';

export interface WordGuessQuestion {
  prompt: string;
  answer: string;
  options: string[];
}

export interface SongGuessQuestion {
  clue: string;
  year: string;
  genre: string;
  artist: string;
  answer: string;
  options: string[];
}

const SONG_QUESTIONS: SongGuessQuestion[] = [
  {clue: '🌃 ✨ 🚗', year: '2019', genre: 'Synth-pop', artist: 'The Weeknd', answer: 'Blinding Lights', options: ['Blinding Lights', 'Levitating', 'As It Was', 'Bad Guy']},
  {clue: '👑 🍹 🌞', year: '1978', genre: 'Rock', artist: 'Queen', answer: "Don't Stop Me Now", options: ["Don't Stop Me Now", 'Dreams', 'Africa', 'Heroes']},
  {clue: '🌊 💜 🌧️', year: '1984', genre: 'Pop rock', artist: 'Prince', answer: 'Purple Rain', options: ['Purple Rain', 'November Rain', 'Yellow', 'Watermelon Sugar']},
  {clue: '🚀 🌌 👽', year: '1972', genre: 'Glam rock', artist: 'David Bowie', answer: 'Starman', options: ['Starman', 'Rocket Man', 'Space Oddity', 'Supermassive Black Hole']},
  {clue: '💃 🪩 🪩', year: '1976', genre: 'Disco', artist: 'ABBA', answer: 'Dancing Queen', options: ['Dancing Queen', 'Le Freak', 'Stayin Alive', 'I Will Survive']},
  {clue: '🟡 🌟 🎸', year: '2000', genre: 'Alternative rock', artist: 'Coldplay', answer: 'Yellow', options: ['Yellow', 'Fix You', 'Creep', 'Wonderwall']},
  {clue: '👋 🌎 📞', year: '2015', genre: 'Soul pop', artist: 'Adele', answer: 'Hello', options: ['Hello', 'Easy on Me', 'Someone Like You', 'Rolling in the Deep']},
  {clue: '💡 🌀 🤖', year: '2013', genre: 'Disco funk', artist: 'Daft Punk', answer: 'Get Lucky', options: ['Get Lucky', 'Instant Crush', 'One More Time', 'Around the World']},
];

export const LEGACY_WORD_QUESTIONS: Record<AppLanguage, WordGuessQuestion[]> = {
  en: [
    {prompt: 'Who performs Shape of You?', answer: 'Ed Sheeran', options: ['Ed Sheeran', 'The Weeknd', 'Dua Lipa', 'Coldplay']},
    {prompt: 'Who released Blinding Lights?', answer: 'The Weeknd', options: ['The Weeknd', 'Bruno Mars', 'Daft Punk', 'Adele']},
    {prompt: 'Who sings Levitating?', answer: 'Dua Lipa', options: ['Dua Lipa', 'Billie Eilish', 'Rihanna', 'Sia']},
    {prompt: 'Which band released Bohemian Rhapsody?', answer: 'Queen', options: ['Queen', 'Muse', 'Nirvana', 'Radiohead']},
    {prompt: 'Who performs Someone Like You?', answer: 'Adele', options: ['Adele', 'Lana Del Rey', 'Beyonce', 'Taylor Swift']},
    {prompt: 'Which band released Yellow?', answer: 'Coldplay', options: ['Coldplay', 'Oasis', 'U2', 'Imagine Dragons']},
    {prompt: 'Who sings Bad Guy?', answer: 'Billie Eilish', options: ['Billie Eilish', 'Lorde', 'Halsey', 'Miley Cyrus']},
    {prompt: 'Who is known for Get Lucky?', answer: 'Daft Punk', options: ['Daft Punk', 'Justice', 'Disclosure', 'Calvin Harris']},
  ],
  tr: [
    {prompt: 'Shape of You şarkısının sanatçısı kim?', answer: 'Ed Sheeran', options: ['Ed Sheeran', 'The Weeknd', 'Dua Lipa', 'Coldplay']},
    {prompt: 'Blinding Lights kime ait?', answer: 'The Weeknd', options: ['The Weeknd', 'Bruno Mars', 'Daft Punk', 'Adele']},
    {prompt: 'Levitating şarkısını kim söylüyor?', answer: 'Dua Lipa', options: ['Dua Lipa', 'Billie Eilish', 'Rihanna', 'Sia']},
    {prompt: 'Bohemian Rhapsody hangi gruba ait?', answer: 'Queen', options: ['Queen', 'Muse', 'Nirvana', 'Radiohead']},
    {prompt: 'Someone Like You şarkısının sanatçısı kim?', answer: 'Adele', options: ['Adele', 'Lana Del Rey', 'Beyonce', 'Taylor Swift']},
    {prompt: 'Yellow hangi grubun şarkısı?', answer: 'Coldplay', options: ['Coldplay', 'Oasis', 'U2', 'Imagine Dragons']},
    {prompt: 'Bad Guy şarkısını kim söylüyor?', answer: 'Billie Eilish', options: ['Billie Eilish', 'Lorde', 'Halsey', 'Miley Cyrus']},
    {prompt: 'Get Lucky hangi ikili/grup ile bilinir?', answer: 'Daft Punk', options: ['Daft Punk', 'Justice', 'Disclosure', 'Calvin Harris']},
  ],
  ru: [
    {prompt: 'Кто исполняет Shape of You?', answer: 'Ed Sheeran', options: ['Ed Sheeran', 'The Weeknd', 'Dua Lipa', 'Coldplay']},
    {prompt: 'Кто выпустил Blinding Lights?', answer: 'The Weeknd', options: ['The Weeknd', 'Bruno Mars', 'Daft Punk', 'Adele']},
    {prompt: 'Кто поёт Levitating?', answer: 'Dua Lipa', options: ['Dua Lipa', 'Billie Eilish', 'Rihanna', 'Sia']},
    {prompt: 'Какая группа выпустила Bohemian Rhapsody?', answer: 'Queen', options: ['Queen', 'Muse', 'Nirvana', 'Radiohead']},
    {prompt: 'Кто исполняет Someone Like You?', answer: 'Adele', options: ['Adele', 'Lana Del Rey', 'Beyonce', 'Taylor Swift']},
    {prompt: 'Какая группа выпустила Yellow?', answer: 'Coldplay', options: ['Coldplay', 'Oasis', 'U2', 'Imagine Dragons']},
    {prompt: 'Кто поёт Bad Guy?', answer: 'Billie Eilish', options: ['Billie Eilish', 'Lorde', 'Halsey', 'Miley Cyrus']},
    {prompt: 'Кто известен песней Get Lucky?', answer: 'Daft Punk', options: ['Daft Punk', 'Justice', 'Disclosure', 'Calvin Harris']},
  ],
  ar: [
    {prompt: 'من يؤدي أغنية Shape of You؟', answer: 'Ed Sheeran', options: ['Ed Sheeran', 'The Weeknd', 'Dua Lipa', 'Coldplay']},
    {prompt: 'من أصدر أغنية Blinding Lights؟', answer: 'The Weeknd', options: ['The Weeknd', 'Bruno Mars', 'Daft Punk', 'Adele']},
    {prompt: 'من يغني Levitating؟', answer: 'Dua Lipa', options: ['Dua Lipa', 'Billie Eilish', 'Rihanna', 'Sia']},
    {prompt: 'أي فرقة أصدرت Bohemian Rhapsody؟', answer: 'Queen', options: ['Queen', 'Muse', 'Nirvana', 'Radiohead']},
    {prompt: 'من يؤدي Someone Like You؟', answer: 'Adele', options: ['Adele', 'Lana Del Rey', 'Beyonce', 'Taylor Swift']},
    {prompt: 'أي فرقة أصدرت Yellow؟', answer: 'Coldplay', options: ['Coldplay', 'Oasis', 'U2', 'Imagine Dragons']},
    {prompt: 'من يغني Bad Guy؟', answer: 'Billie Eilish', options: ['Billie Eilish', 'Lorde', 'Halsey', 'Miley Cyrus']},
    {prompt: 'من اشتهر بأغنية Get Lucky؟', answer: 'Daft Punk', options: ['Daft Punk', 'Justice', 'Disclosure', 'Calvin Harris']},
  ],
  de: [
    {prompt: 'Wer singt Shape of You?', answer: 'Ed Sheeran', options: ['Ed Sheeran', 'The Weeknd', 'Dua Lipa', 'Coldplay']},
    {prompt: 'Wer veröffentlichte Blinding Lights?', answer: 'The Weeknd', options: ['The Weeknd', 'Bruno Mars', 'Daft Punk', 'Adele']},
    {prompt: 'Wer singt Levitating?', answer: 'Dua Lipa', options: ['Dua Lipa', 'Billie Eilish', 'Rihanna', 'Sia']},
    {prompt: 'Welche Band veröffentlichte Bohemian Rhapsody?', answer: 'Queen', options: ['Queen', 'Muse', 'Nirvana', 'Radiohead']},
    {prompt: 'Wer singt Someone Like You?', answer: 'Adele', options: ['Adele', 'Lana Del Rey', 'Beyonce', 'Taylor Swift']},
    {prompt: 'Welche Band veröffentlichte Yellow?', answer: 'Coldplay', options: ['Coldplay', 'Oasis', 'U2', 'Imagine Dragons']},
    {prompt: 'Wer singt Bad Guy?', answer: 'Billie Eilish', options: ['Billie Eilish', 'Lorde', 'Halsey', 'Miley Cyrus']},
    {prompt: 'Wer ist für Get Lucky bekannt?', answer: 'Daft Punk', options: ['Daft Punk', 'Justice', 'Disclosure', 'Calvin Harris']},
  ],
  fr: [
    {prompt: 'Qui interprète Shape of You ?', answer: 'Ed Sheeran', options: ['Ed Sheeran', 'The Weeknd', 'Dua Lipa', 'Coldplay']},
    {prompt: 'Qui a sorti Blinding Lights ?', answer: 'The Weeknd', options: ['The Weeknd', 'Bruno Mars', 'Daft Punk', 'Adele']},
    {prompt: 'Qui chante Levitating ?', answer: 'Dua Lipa', options: ['Dua Lipa', 'Billie Eilish', 'Rihanna', 'Sia']},
    {prompt: 'Quel groupe a sorti Bohemian Rhapsody ?', answer: 'Queen', options: ['Queen', 'Muse', 'Nirvana', 'Radiohead']},
    {prompt: 'Qui interprète Someone Like You ?', answer: 'Adele', options: ['Adele', 'Lana Del Rey', 'Beyonce', 'Taylor Swift']},
    {prompt: 'Quel groupe a sorti Yellow ?', answer: 'Coldplay', options: ['Coldplay', 'Oasis', 'U2', 'Imagine Dragons']},
    {prompt: 'Qui chante Bad Guy ?', answer: 'Billie Eilish', options: ['Billie Eilish', 'Lorde', 'Halsey', 'Miley Cyrus']},
    {prompt: 'Qui est connu pour Get Lucky ?', answer: 'Daft Punk', options: ['Daft Punk', 'Justice', 'Disclosure', 'Calvin Harris']},
  ],
};

export function getWordGuessQuestions(language?: string): WordGuessQuestion[] {
  const code = (language ?? 'en').split(/[-_]/)[0] as AppLanguage;
  const prompt = QUESTION_PROMPTS[code] ?? QUESTION_PROMPTS.en;
  const artists = MUSIC_QUIZ_CATALOG.map(item => item.artist);
  return MUSIC_QUIZ_CATALOG.flatMap((item, artistIndex) =>
    item.tracks.map(track => {
      const distractors = [7, 19, 37].map(
        offset => artists[(artistIndex + offset) % artists.length],
      );
      const options = rotate(
        [item.artist, ...distractors],
        hash(`${track}:${item.artist}`) % 4,
      );
      return {
        prompt: prompt.replace('{track}', track),
        answer: item.artist,
        options,
      };
    }),
  );
}

const QUESTION_PROMPTS: Record<AppLanguage, string> = {
  en: 'Who performs “{track}”?',
  tr: '“{track}” şarkısını kim seslendiriyor?',
  ru: 'Кто исполняет «{track}»?',
  ar: 'من يؤدي أغنية «{track}»؟',
  de: 'Wer singt „{track}“?',
  fr: 'Qui interprète « {track} » ?',
};

function hash(value: string): number {
  return [...value].reduce((total, character) => total + character.charCodeAt(0), 0);
}

function rotate<T>(items: T[], offset: number): T[] {
  return [...items.slice(offset), ...items.slice(0, offset)];
}

export function getSongGuessQuestions(): SongGuessQuestion[] {
  return SONG_QUESTIONS;
}
