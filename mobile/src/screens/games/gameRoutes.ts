export type GameRouteName =
  | 'SnakeGame'
  | 'MemoryGame'
  | 'TetrisGame'
  | 'RhythmTapGame'
  | 'WordGuessGame';

const GAME_ROUTE_BY_SLUG: Record<string, GameRouteName> = {
  snake: 'SnakeGame',
  memory: 'MemoryGame',
  tetris: 'TetrisGame',
  'rhythm-tap': 'RhythmTapGame',
  'word-guess': 'WordGuessGame',
};

export function getGameRouteForSlug(slug?: string | null): GameRouteName | null {
  if (!slug) {
    return null;
  }

  return GAME_ROUTE_BY_SLUG[slug.trim().toLowerCase()] ?? null;
}

export function isPracticeGame(game?: {id?: string | null} | null): boolean {
  return String(game?.id ?? '').startsWith('builtin:');
}

/**
 * The games that ship inside the mobile app. These are always listed in the
 * Games screen (even when the backend arcade-games registry is empty), and are
 * enriched with the server record — real id + daily point limit — whenever a
 * matching slug exists on the backend. Without that record, each game runs as
 * local practice and cannot promise a Gold reward.
 */
export interface BuiltinGame {
  slug: string;
  title: string;
  description: string;
  daily_point_limit: number;
}

export const BUILTIN_GAMES: BuiltinGame[] = [
  {
    slug: 'snake',
    title: 'Neon Snake',
    description: 'Swipe through obstacles, collect rare notes and protect three lives.',
    daily_point_limit: 0,
  },
  {
    slug: 'memory',
    title: 'Memory',
    description: 'Match cards and test your memory.',
    daily_point_limit: 0,
  },
  {
    slug: 'tetris',
    title: 'Blocks',
    description: 'Arrange falling blocks and clear lines.',
    daily_point_limit: 0,
  },
  {
    slug: 'rhythm-tap',
    title: 'Song Guess',
    description: 'Guess the song from its visual clues.',
    daily_point_limit: 0,
  },
  {
    slug: 'word-guess',
    title: 'Music IQ',
    description: 'Twelve random challenges from a 256-question music catalog.',
    daily_point_limit: 0,
  },
];
