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

/**
 * The games that ship inside the mobile app. These are always listed in the
 * Games screen (even when the backend arcade-games registry is empty), and are
 * enriched with the server record — real id + daily point limit — whenever a
 * matching slug exists on the backend.
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
    title: 'Snake',
    description: 'Classic snake game — speed increases as you grow.',
    daily_point_limit: 100,
  },
  {
    slug: 'memory',
    title: 'Memory',
    description: 'Match cards and test your memory.',
    daily_point_limit: 100,
  },
  {
    slug: 'tetris',
    title: 'Blocks',
    description: 'Arrange falling blocks and clear lines.',
    daily_point_limit: 100,
  },
  {
    slug: 'rhythm-tap',
    title: 'Rhythm',
    description: 'Tap at the right time with the beat.',
    daily_point_limit: 100,
  },
  {
    slug: 'word-guess',
    title: 'Word Guess',
    description: 'Find the hidden word from the clues.',
    daily_point_limit: 100,
  },
];
