import type {
  User,
  Competition,
  Round,
  Performer,
  Score,
  UserCompetitionStatus,
} from '../types/database';
import { hashPin } from './utils';

// ===== Demo Users (6人の家族) =====
let demoUsers: User[] = [];
let demoCompetitions: Competition[] = [];
let demoRounds: Round[] = [];
let demoPerformers: Performer[] = [];
let demoScores: Score[] = [];
let demoUserCompetitionStatus: UserCompetitionStatus[] = [];

// Prevent double initialization (StrictMode calls useEffect twice)
let initPromise: Promise<void> | null = null;

// Event listeners for realtime simulation
type Listener = (data: unknown) => void;
const listeners: Record<string, Listener[]> = {};

export function onDemoChange(table: string, callback: Listener) {
  if (!listeners[table]) listeners[table] = [];
  listeners[table].push(callback);
  return () => {
    listeners[table] = listeners[table].filter((l) => l !== callback);
  };
}

function notify(table: string) {
  listeners[table]?.forEach((cb) => cb(null));
}

// ===== Initialize Demo Data =====
export function initDemoData(): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const pins = ['0916', '0105', '0312', '0803', '0417', '0107'];
    const names = ['ひ', 'か', 'り', 'た', 'こ', 'あ'];
    const emojis = ['🎸', '🎹', '📯', '🎵', '🚗', '🌸'];

    for (let i = 0; i < 6; i++) {
      demoUsers.push({
        id: `user-${i + 1}`,
        name: names[i],
        avatar_emoji: emojis[i],
        pin_hash: await hashPin(pins[i]),
        is_admin: i === 0,
        created_at: new Date().toISOString(),
      });
    }
  })();

  return initPromise;
}

// ===== User Operations =====
export const demoDb = {
  // Users
  getUsers: () => [...demoUsers],
  getUserById: (id: string) => demoUsers.find((u) => u.id === id) || null,

  // Competitions
  getCompetitions: () => [...demoCompetitions].sort((a, b) => b.year - a.year),
  getCompetitionById: (id: string) => demoCompetitions.find((c) => c.id === id) || null,
  createCompetition: (comp: Omit<Competition, 'id' | 'created_at'>) => {
    const newComp: Competition = {
      ...comp,
      id: `comp-${Date.now()}`,
      created_at: new Date().toISOString(),
    };
    demoCompetitions.push(newComp);
    notify('competitions');
    return newComp;
  },
  updateCompetition: (id: string, updates: Partial<Competition>) => {
    const idx = demoCompetitions.findIndex((c) => c.id === id);
    if (idx >= 0) {
      demoCompetitions[idx] = { ...demoCompetitions[idx], ...updates };
      notify('competitions');
      return demoCompetitions[idx];
    }
    return null;
  },

  // Rounds
  getRoundsByCompetition: (competitionId: string) =>
    demoRounds
      .filter((r) => r.competition_id === competitionId)
      .sort((a, b) => a.round_order - b.round_order),
  createRound: (round: Omit<Round, 'id'>) => {
    const newRound: Round = { ...round, id: `round-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` };
    demoRounds.push(newRound);
    notify('rounds');
    return newRound;
  },

  // Performers
  getPerformersByRound: (roundId: string) =>
    demoPerformers
      .filter((p) => p.round_id === roundId)
      .sort((a, b) => (a.performance_order || 999) - (b.performance_order || 999)),
  getPerformersByCompetition: (competitionId: string) =>
    demoPerformers.filter((p) => p.competition_id === competitionId),
  createPerformer: (performer: Omit<Performer, 'id'>) => {
    const newPerformer: Performer = {
      ...performer,
      id: `perf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    };
    demoPerformers.push(newPerformer);
    notify('performers');
    return newPerformer;
  },
  updatePerformer: (id: string, updates: Partial<Performer>) => {
    const idx = demoPerformers.findIndex((p) => p.id === id);
    if (idx >= 0) {
      demoPerformers[idx] = { ...demoPerformers[idx], ...updates };
      notify('performers');
      return demoPerformers[idx];
    }
    return null;
  },
  deletePerformer: (id: string) => {
    demoPerformers = demoPerformers.filter((p) => p.id !== id);
    demoScores = demoScores.filter((s) => s.performer_id !== id);
    notify('performers');
  },

  // Scores
  getScoresByRound: (roundId: string) =>
    demoScores.filter((s) => s.round_id === roundId),
  getScoresByUser: (userId: string, competitionId: string) =>
    demoScores.filter((s) => s.user_id === userId && s.competition_id === competitionId),
  getScoresByCompetition: (competitionId: string) =>
    demoScores.filter((s) => s.competition_id === competitionId),
  upsertScore: (score: Omit<Score, 'id' | 'scored_at'>) => {
    const existingIdx = demoScores.findIndex(
      (s) => s.user_id === score.user_id && s.performer_id === score.performer_id
    );
    if (existingIdx >= 0) {
      demoScores[existingIdx] = {
        ...demoScores[existingIdx],
        ...score,
        scored_at: new Date().toISOString(),
      };
      notify('scores');
      return demoScores[existingIdx];
    }
    const newScore: Score = {
      ...score,
      id: `score-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      scored_at: new Date().toISOString(),
    };
    demoScores.push(newScore);
    notify('scores');
    return newScore;
  },

  // User Competition Status
  getUserCompetitionStatus: (userId: string, competitionId: string) =>
    demoUserCompetitionStatus.find(
      (s) => s.user_id === userId && s.competition_id === competitionId
    ) || null,
  getAllCompetitionStatus: (competitionId: string) =>
    demoUserCompetitionStatus.filter((s) => s.competition_id === competitionId),
  // Ensure final round performers exist by name (create if not yet present)
  ensureFinalRoundPerformer: (competitionId: string, name: string): Performer => {
    const rounds = demoRounds
      .filter((r) => r.competition_id === competitionId)
      .sort((a, b) => a.round_order - b.round_order);
    const finalRound = rounds[rounds.length - 1];
    if (!finalRound) throw new Error('No final round');

    // Check if already exists
    const existing = demoPerformers.find(
      (p) => p.round_id === finalRound.id && p.name === name
    );
    if (existing) return existing;

    const count = demoPerformers.filter((p) => p.round_id === finalRound.id).length;
    const newPerf: Performer = {
      id: `perf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      competition_id: competitionId,
      round_id: finalRound.id,
      name,
      performance_order: null,
      display_label: `最終${String.fromCharCode(65 + count)}`,
    };
    demoPerformers.push(newPerf);
    notify('performers');
    return newPerf;
  },

  // Get final round performers for display
  getFinalRoundPerformers: (competitionId: string): Performer[] => {
    const rounds = demoRounds
      .filter((r) => r.competition_id === competitionId)
      .sort((a, b) => a.round_order - b.round_order);
    const finalRound = rounds[rounds.length - 1];
    if (!finalRound) return [];
    return demoPerformers.filter((p) => p.round_id === finalRound.id);
  },

  upsertUserCompetitionStatus: (status: Omit<UserCompetitionStatus, 'id'>) => {
    const existingIdx = demoUserCompetitionStatus.findIndex(
      (s) => s.user_id === status.user_id && s.competition_id === status.competition_id
    );
    if (existingIdx >= 0) {
      demoUserCompetitionStatus[existingIdx] = {
        ...demoUserCompetitionStatus[existingIdx],
        ...status,
      };
      notify('user_competition_status');
      return demoUserCompetitionStatus[existingIdx];
    }
    const newStatus: UserCompetitionStatus = {
      ...status,
      id: `ucs-${Date.now()}`,
    };
    demoUserCompetitionStatus.push(newStatus);
    notify('user_competition_status');
    return newStatus;
  },
};
