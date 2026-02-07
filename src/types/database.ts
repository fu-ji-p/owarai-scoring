// ===== Enum Types =====
export type CompetitionType = 'm1' | 'r1' | 'koc';
export type CompetitionStatus = 'upcoming' | 'active' | 'scoring' | 'closed';
export type ScoringType = '100point' | 'ranking';
export type ViewingMode = 'realtime' | 'delayed';

// ===== Database Row Types =====
export interface User {
  id: string;
  name: string;
  avatar_emoji: string;
  pin_hash: string;
  is_admin: boolean;
  created_at: string;
}

export interface Competition {
  id: string;
  type: CompetitionType;
  year: number;
  name: string;
  status: CompetitionStatus;
  broadcast_date: string;
  created_at: string;
}

export interface Round {
  id: string;
  competition_id: string;
  name: string;
  round_order: number;
  scoring_type: ScoringType;
}

export interface Performer {
  id: string;
  competition_id: string;
  round_id: string;
  name: string;
  performance_order: number | null;
  display_label: string;
}

export interface Score {
  id: string;
  user_id: string;
  performer_id: string;
  round_id: string;
  competition_id: string;
  score: number;
  comment: string | null;
  scored_at: string;
  is_realtime: boolean;
}

export interface UserCompetitionStatus {
  id: string;
  user_id: string;
  competition_id: string;
  viewing_mode: ViewingMode;
  has_completed_scoring: boolean;
  completed_at: string | null;
}

// ===== Competition Config =====
export interface CompetitionConfig {
  type: CompetitionType;
  label: string;
  emoji: string;
  rounds: {
    name: string;
    defaultPerformerCount: number;
    scoringType: ScoringType;
  }[];
}

export const COMPETITION_CONFIGS: Record<CompetitionType, CompetitionConfig> = {
  m1: {
    type: 'm1',
    label: 'M-1グランプリ',
    emoji: '🎤',
    rounds: [
      { name: '1stラウンド', defaultPerformerCount: 10, scoringType: '100point' },
      { name: '最終決戦', defaultPerformerCount: 3, scoringType: '100point' },
    ],
  },
  r1: {
    type: 'r1',
    label: 'R-1グランプリ',
    emoji: '😂',
    rounds: [
      { name: '1stラウンド', defaultPerformerCount: 10, scoringType: '100point' },
      { name: '最終決戦', defaultPerformerCount: 3, scoringType: '100point' },
    ],
  },
  koc: {
    type: 'koc',
    label: 'キングオブコント',
    emoji: '👑',
    rounds: [
      { name: '1stステージ', defaultPerformerCount: 10, scoringType: '100point' },
      { name: '最終ステージ', defaultPerformerCount: 3, scoringType: '100point' },
    ],
  },
};
