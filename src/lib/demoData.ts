import type {
  User,
  Competition,
  Round,
  Performer,
  Score,
  UserCompetitionStatus,
} from '../types/database';
import { hashPin } from './utils';
import { getSupabase, isSupabaseConfigured } from './supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

// ===== In-memory cache =====
let demoUsers: User[] = [];
let demoCompetitions: Competition[] = [];
let demoRounds: Round[] = [];
let demoPerformers: Performer[] = [];
let demoScores: Score[] = [];
let demoUserCompetitionStatus: UserCompetitionStatus[] = [];

// Prevent double initialization (StrictMode calls useEffect twice)
let initPromise: Promise<void> | null = null;

// ===== localStorage persistence (fallback when no Supabase) =====
const STORAGE_KEY = 'owarai-scoring-data';

function saveToStorage() {
  if (isSupabaseConfigured()) return; // Supabase mode doesn't need localStorage
  try {
    const data = {
      competitions: demoCompetitions,
      rounds: demoRounds,
      performers: demoPerformers,
      scores: demoScores,
      userCompetitionStatus: demoUserCompetitionStatus,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // localStorage might be full or unavailable
  }
}

function loadFromStorage(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (data.competitions) demoCompetitions = data.competitions;
    if (data.rounds) demoRounds = data.rounds;
    if (data.performers) demoPerformers = data.performers;
    if (data.scores) demoScores = data.scores;
    if (data.userCompetitionStatus) demoUserCompetitionStatus = data.userCompetitionStatus;
    return true;
  } catch {
    return false;
  }
}

// ===== Event listeners for change notifications =====
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
  // Also notify a global "any" channel
  listeners['*']?.forEach((cb) => cb(null));
  saveToStorage();
}

// ===== Supabase Helpers =====
async function supabaseLoadAll(): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;

  const [comps, rnds, perfs, scrs, ucs] = await Promise.all([
    sb.from('competitions').select('*'),
    sb.from('rounds').select('*'),
    sb.from('performers').select('*'),
    sb.from('scores').select('*'),
    sb.from('user_competition_status').select('*'),
  ]);

  if (comps.data) demoCompetitions = comps.data;
  if (rnds.data) demoRounds = rnds.data;
  if (perfs.data) demoPerformers = perfs.data;
  if (scrs.data) demoScores = scrs.data;
  if (ucs.data) demoUserCompetitionStatus = ucs.data;
}

let realtimeChannel: RealtimeChannel | null = null;

function setupRealtimeSubscription() {
  const sb = getSupabase();
  if (!sb || realtimeChannel) return;

  realtimeChannel = sb
    .channel('db-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'competitions' }, async () => {
      const { data } = await sb.from('competitions').select('*');
      if (data) demoCompetitions = data;
      notify('competitions');
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'rounds' }, async () => {
      const { data } = await sb.from('rounds').select('*');
      if (data) demoRounds = data;
      notify('rounds');
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'performers' }, async () => {
      const { data } = await sb.from('performers').select('*');
      if (data) demoPerformers = data;
      notify('performers');
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'scores' }, async () => {
      const { data } = await sb.from('scores').select('*');
      if (data) demoScores = data;
      notify('scores');
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'user_competition_status' }, async () => {
      const { data } = await sb.from('user_competition_status').select('*');
      if (data) demoUserCompetitionStatus = data;
      notify('user_competition_status');
    })
    .subscribe();
}

// ===== Initialize =====
export function initDemoData(): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    // Always create users in memory first (for PIN auth)
    const pins = ['0916', '0105', '0312', '0803', '0417', '0107'];
    const names = ['ひ', 'か', 'り', 'た', 'こ', 'あ'];
    const emojis = ['🎸', '🎹', '📯', '🎵', '🚗', '🌸'];

    for (let i = 0; i < 6; i++) {
      demoUsers.push({
        id: `user-${i + 1}`,
        name: names[i],
        avatar_emoji: emojis[i],
        pin_hash: await hashPin(pins[i]),
        is_admin: i === 4, // 「こ」が管理者
        created_at: new Date().toISOString(),
      });
    }

    if (isSupabaseConfigured()) {
      const sb = getSupabase();
      if (sb) {
        // Seed users into Supabase if not exist
        await sb.from('users').upsert(
          demoUsers.map((u) => ({
            id: u.id,
            name: u.name,
            avatar_emoji: u.avatar_emoji,
            pin_hash: u.pin_hash,
            is_admin: u.is_admin,
          })),
          { onConflict: 'id' }
        );

        // Load all data from Supabase
        await supabaseLoadAll();

        // Setup realtime
        setupRealtimeSubscription();

        console.log('Supabase connected - data synced across devices');
      }
    } else {
      // Fallback: load from localStorage
      loadFromStorage();
      console.log('Running in offline mode (localStorage)');
    }
  })();

  return initPromise;
}

// ===== Refresh from Supabase (call after local mutations) =====
async function syncAfterMutation(table: string) {
  const sb = getSupabase();
  if (!sb) {
    notify(table);
    return;
  }

  // Refresh the specific table from Supabase
  switch (table) {
    case 'competitions': {
      const { data } = await sb.from('competitions').select('*');
      if (data) demoCompetitions = data;
      break;
    }
    case 'rounds': {
      const { data } = await sb.from('rounds').select('*');
      if (data) demoRounds = data;
      break;
    }
    case 'performers': {
      const { data } = await sb.from('performers').select('*');
      if (data) demoPerformers = data;
      break;
    }
    case 'scores': {
      const { data } = await sb.from('scores').select('*');
      if (data) demoScores = data;
      break;
    }
    case 'user_competition_status': {
      const { data } = await sb.from('user_competition_status').select('*');
      if (data) demoUserCompetitionStatus = data;
      break;
    }
  }
  notify(table);
}

// ===== Database Operations =====
export const demoDb = {
  // Users
  getUsers: () => [...demoUsers],
  getUserById: (id: string) => demoUsers.find((u) => u.id === id) || null,

  // Competitions
  getCompetitions: () => [...demoCompetitions].sort((a, b) => b.year - a.year),
  getCompetitionById: (id: string) => demoCompetitions.find((c) => c.id === id) || null,
  createCompetition: async (comp: Omit<Competition, 'id' | 'created_at'>) => {
    const newComp: Competition = {
      ...comp,
      id: `comp-${Date.now()}`,
      created_at: new Date().toISOString(),
    };
    demoCompetitions.push(newComp);

    const sb = getSupabase();
    if (sb) {
      await sb.from('competitions').insert(newComp);
      await syncAfterMutation('competitions');
    } else {
      notify('competitions');
    }
    return newComp;
  },
  updateCompetition: (id: string, updates: Partial<Competition>) => {
    const idx = demoCompetitions.findIndex((c) => c.id === id);
    if (idx >= 0) {
      demoCompetitions[idx] = { ...demoCompetitions[idx], ...updates };

      const sb = getSupabase();
      if (sb) {
        sb.from('competitions').update(updates).eq('id', id).then(() => syncAfterMutation('competitions'));
      } else {
        notify('competitions');
      }
      return demoCompetitions[idx];
    }
    return null;
  },

  // Rounds
  getRoundsByCompetition: (competitionId: string) =>
    demoRounds
      .filter((r) => r.competition_id === competitionId)
      .sort((a, b) => a.round_order - b.round_order),
  createRound: async (round: Omit<Round, 'id'>) => {
    const newRound: Round = { ...round, id: `round-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` };
    demoRounds.push(newRound);

    const sb = getSupabase();
    if (sb) {
      await sb.from('rounds').insert(newRound);
      await syncAfterMutation('rounds');
    } else {
      notify('rounds');
    }
    return newRound;
  },

  // Performers
  getPerformersByRound: (roundId: string) =>
    demoPerformers
      .filter((p) => p.round_id === roundId)
      .sort((a, b) => (a.performance_order || 999) - (b.performance_order || 999)),
  getPerformersByCompetition: (competitionId: string) =>
    demoPerformers.filter((p) => p.competition_id === competitionId),
  createPerformer: async (performer: Omit<Performer, 'id'>) => {
    const newPerformer: Performer = {
      ...performer,
      id: `perf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    };
    demoPerformers.push(newPerformer);

    const sb = getSupabase();
    if (sb) {
      await sb.from('performers').insert(newPerformer);
      await syncAfterMutation('performers');
    } else {
      notify('performers');
    }
    return newPerformer;
  },
  updatePerformer: (id: string, updates: Partial<Performer>) => {
    const idx = demoPerformers.findIndex((p) => p.id === id);
    if (idx >= 0) {
      demoPerformers[idx] = { ...demoPerformers[idx], ...updates };

      const sb = getSupabase();
      if (sb) {
        sb.from('performers').update(updates).eq('id', id).then(() => syncAfterMutation('performers'));
      } else {
        notify('performers');
      }
      return demoPerformers[idx];
    }
    return null;
  },
  deletePerformer: (id: string) => {
    demoPerformers = demoPerformers.filter((p) => p.id !== id);
    demoScores = demoScores.filter((s) => s.performer_id !== id);

    const sb = getSupabase();
    if (sb) {
      Promise.all([
        sb.from('scores').delete().eq('performer_id', id),
        sb.from('performers').delete().eq('id', id),
      ]).then(() => {
        syncAfterMutation('performers');
        syncAfterMutation('scores');
      });
    } else {
      notify('performers');
    }
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
    const now = new Date().toISOString();

    if (existingIdx >= 0) {
      demoScores[existingIdx] = {
        ...demoScores[existingIdx],
        ...score,
        scored_at: now,
      };

      const sb = getSupabase();
      if (sb) {
        sb.from('scores')
          .update({ ...score, scored_at: now })
          .eq('user_id', score.user_id)
          .eq('performer_id', score.performer_id)
          .then(() => syncAfterMutation('scores'));
      } else {
        notify('scores');
      }
      return demoScores[existingIdx];
    }

    const newScore: Score = {
      ...score,
      id: `score-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      scored_at: now,
    };
    demoScores.push(newScore);

    const sb = getSupabase();
    if (sb) {
      sb.from('scores').insert(newScore).then(() => syncAfterMutation('scores'));
    } else {
      notify('scores');
    }
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

    const sb = getSupabase();
    if (sb) {
      sb.from('performers').insert(newPerf).then(() => syncAfterMutation('performers'));
    } else {
      notify('performers');
    }
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

      const sb = getSupabase();
      if (sb) {
        sb.from('user_competition_status')
          .update(status)
          .eq('user_id', status.user_id)
          .eq('competition_id', status.competition_id)
          .then(() => syncAfterMutation('user_competition_status'));
      } else {
        notify('user_competition_status');
      }
      return demoUserCompetitionStatus[existingIdx];
    }

    const newStatus: UserCompetitionStatus = {
      ...status,
      id: `ucs-${Date.now()}`,
    };
    demoUserCompetitionStatus.push(newStatus);

    const sb = getSupabase();
    if (sb) {
      sb.from('user_competition_status').insert(newStatus).then(() => syncAfterMutation('user_competition_status'));
    } else {
      notify('user_competition_status');
    }
    return newStatus;
  },

  // Delete competition and all related data
  deleteCompetition: async (competitionId: string) => {
    // Remove all related data from memory
    demoScores = demoScores.filter((s) => s.competition_id !== competitionId);
    demoPerformers = demoPerformers.filter((p) => p.competition_id !== competitionId);
    demoRounds = demoRounds.filter((r) => r.competition_id !== competitionId);
    demoUserCompetitionStatus = demoUserCompetitionStatus.filter((s) => s.competition_id !== competitionId);
    demoCompetitions = demoCompetitions.filter((c) => c.id !== competitionId);

    const sb = getSupabase();
    if (sb) {
      // Supabase cascades deletes via ON DELETE CASCADE
      await sb.from('competitions').delete().eq('id', competitionId);
      await syncAfterMutation('competitions');
      await syncAfterMutation('rounds');
      await syncAfterMutation('performers');
      await syncAfterMutation('scores');
      await syncAfterMutation('user_competition_status');
    } else {
      notify('competitions');
    }
  },

  // Force refresh all data from Supabase
  refreshAll: async () => {
    if (isSupabaseConfigured()) {
      await supabaseLoadAll();
      notify('*');
    }
  },
};
