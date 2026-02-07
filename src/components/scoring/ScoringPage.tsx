import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { demoDb } from '../../lib/demoData';
import { deterministicShuffle, isGojuonOrder } from '../../lib/utils';
import ScoreCard from './ScoreCard';
import type { Round, Performer, Score } from '../../types/database';

type Phase = 'first-round' | 'select-finalists' | 'final-round';

export default function ScoringPage() {
  const { competitionId } = useParams<{ competitionId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [rounds, setRounds] = useState<Round[]>([]);
  const [performers, setPerformers] = useState<Record<string, Performer[]>>({});
  const [scores, setScores] = useState<Score[]>([]);
  const [selectedPerformerId, setSelectedPerformerId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Final round selection
  const [selectedFinalists, setSelectedFinalists] = useState<Set<string>>(new Set());
  const [finalistNames, setFinalistNames] = useState<string[]>([]);

  const competition = competitionId ? demoDb.getCompetitionById(competitionId) : null;
  const status = user && competitionId
    ? demoDb.getUserCompetitionStatus(user.id, competitionId)
    : null;
  const isDelayed = status?.viewing_mode === 'delayed';

  const firstRound = rounds[0] ?? null;
  const finalRound = rounds.length > 1 ? rounds[rounds.length - 1] : null;

  // Load rounds
  useEffect(() => {
    if (!competitionId) return;
    const rds = demoDb.getRoundsByCompetition(competitionId);
    setRounds(rds);
  }, [competitionId]);

  // Load performers for all rounds
  useEffect(() => {
    if (rounds.length === 0) return;
    const perfMap: Record<string, Performer[]> = {};
    rounds.forEach((r) => {
      perfMap[r.id] = demoDb.getPerformersByRound(r.id);
    });
    setPerformers(perfMap);
  }, [rounds, refreshKey]);

  // Load user's scores
  useEffect(() => {
    if (!user || !competitionId) return;
    setScores(demoDb.getScoresByUser(user.id, competitionId));
  }, [user, competitionId, refreshKey]);

  // 1st round performers (shuffled for delayed mode)
  const firstRoundPerformers = useMemo(() => {
    if (!firstRound) return [];
    const perfs = performers[firstRound.id] || [];
    if (!isDelayed) return perfs;
    if (!user || !competitionId) return perfs;
    let shuffled = deterministicShuffle(
      perfs,
      `${user.id}-${competitionId}-${firstRound.id}`
    );
    if (isGojuonOrder(shuffled.map((p) => p.name))) {
      shuffled = deterministicShuffle(perfs, `${user.id}-${competitionId}-${firstRound.id}-alt`);
    }
    return shuffled;
  }, [performers, firstRound, isDelayed, user, competitionId]);

  // Final round performers that this user has selected
  const finalRoundPerformers = useMemo(() => {
    if (!finalRound) return [];
    return performers[finalRound.id] || [];
  }, [performers, finalRound]);

  // My final round performers (only those I picked and scored/will score)
  const myFinalPerformers = useMemo(() => {
    if (finalistNames.length === 0) return [];
    return finalRoundPerformers.filter((p) => finalistNames.includes(p.name));
  }, [finalRoundPerformers, finalistNames]);

  // Count scored in each round
  const firstRoundScored = firstRoundPerformers.filter((p) =>
    scores.some((s) => s.performer_id === p.id)
  ).length;
  const firstRoundAllScored = firstRoundScored === firstRoundPerformers.length && firstRoundPerformers.length > 0;

  const finalRoundScored = myFinalPerformers.filter((p) =>
    scores.some((s) => s.performer_id === p.id)
  ).length;
  const finalRoundAllScored = finalRoundScored === myFinalPerformers.length && myFinalPerformers.length > 0;

  // Determine current phase
  const phase: Phase = useMemo(() => {
    if (!firstRoundAllScored) return 'first-round';
    if (finalistNames.length === 0) return 'select-finalists';
    return 'final-round';
  }, [firstRoundAllScored, finalistNames]);

  // Get selected performer and score for ScoreCard
  const currentRoundPerformers = phase === 'final-round' ? myFinalPerformers : firstRoundPerformers;
  const selectedPerformer = currentRoundPerformers.find((p) => p.id === selectedPerformerId) ?? null;
  const selectedScore = selectedPerformer
    ? scores.find((s) => s.performer_id === selectedPerformer.id)
    : undefined;

  const handleScore = (score: number, comment: string) => {
    if (!user || !selectedPerformer || !competitionId) return;
    const roundId = phase === 'final-round' ? finalRound?.id : firstRound?.id;
    if (!roundId) return;

    demoDb.upsertScore({
      user_id: user.id,
      performer_id: selectedPerformer.id,
      round_id: roundId,
      competition_id: competitionId,
      score,
      comment: comment || null,
      is_realtime: !isDelayed,
    });

    setRefreshKey((k) => k + 1);
    setTimeout(() => setSelectedPerformerId(null), 600);
  };

  const handleConfirmFinalists = () => {
    if (!competitionId || selectedFinalists.size === 0) return;
    // Get the names of selected 1st round performers
    const names: string[] = [];
    selectedFinalists.forEach((perfId) => {
      const perf = firstRoundPerformers.find((p) => p.id === perfId);
      if (perf) {
        // Ensure the performer exists in the final round
        demoDb.ensureFinalRoundPerformer(competitionId, perf.name);
        names.push(perf.name);
      }
    });
    setFinalistNames(names);
    setRefreshKey((k) => k + 1);
  };

  const toggleFinalist = (perfId: string) => {
    setSelectedFinalists((prev) => {
      const next = new Set(prev);
      if (next.has(perfId)) next.delete(perfId);
      else next.add(perfId);
      return next;
    });
  };

  const handleComplete = () => {
    if (!user || !competitionId) return;
    demoDb.upsertUserCompetitionStatus({
      user_id: user.id,
      competition_id: competitionId,
      viewing_mode: status?.viewing_mode || 'realtime',
      has_completed_scoring: true,
      completed_at: new Date().toISOString(),
    });
    navigate(`/competition/${competitionId}/results`);
  };

  if (!competition || !user) return null;

  // === ScoreCard view ===
  if (selectedPerformer) {
    return (
      <div className="min-h-dvh px-4 py-6 max-w-lg mx-auto">
        <button
          onClick={() => setSelectedPerformerId(null)}
          className="text-text-secondary hover:text-white mb-4 flex items-center gap-1"
        >
          ← 一覧に戻る
        </button>
        <ScoreCard
          key={selectedPerformer.id}
          performerName={selectedPerformer.name}
          orderLabel={undefined}
          initialScore={selectedScore?.score}
          initialComment={selectedScore?.comment ?? ''}
          isScored={!!selectedScore}
          onSubmit={handleScore}
        />
      </div>
    );
  }

  // === Select finalists phase ===
  if (phase === 'select-finalists' && finalRound) {
    return (
      <div className="min-h-dvh px-4 py-6 max-w-lg mx-auto">
        <button onClick={() => navigate('/')} className="text-text-secondary hover:text-white mb-4">
          ← 戻る
        </button>

        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🎉</div>
          <h1 className="text-xl font-bold mb-2">1stラウンド採点完了！</h1>
          <p className="text-text-secondary text-sm">
            最終決戦に進んだ3組を選んでください
          </p>
        </div>

        <div className="space-y-2 mb-6">
          {firstRoundPerformers.map((perf) => {
            const selected = selectedFinalists.has(perf.id);
            const myScore = scores.find((s) => s.performer_id === perf.id);
            return (
              <button
                key={perf.id}
                onClick={() => toggleFinalist(perf.id)}
                className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                  selected
                    ? 'border-gold bg-gold/10'
                    : 'border-white/10 bg-bg-card hover:border-white/30'
                }`}
              >
                <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                  selected ? 'border-gold bg-gold' : 'border-white/30'
                }`}>
                  {selected && <span className="text-black text-sm font-bold">✓</span>}
                </div>
                <span className="flex-1 font-medium">{perf.name}</span>
                {myScore && (
                  <span className="text-gold text-sm font-bold">{myScore.score}点</span>
                )}
              </button>
            );
          })}
        </div>

        <div className="text-center text-sm text-text-secondary mb-4">
          {selectedFinalists.size}組 選択中
        </div>

        <button
          onClick={handleConfirmFinalists}
          disabled={selectedFinalists.size === 0}
          className="w-full py-4 rounded-xl bg-gold text-black font-bold text-lg hover:bg-gold-dark active:scale-[0.98] transition-all disabled:opacity-30"
        >
          {selectedFinalists.size > 0
            ? `${selectedFinalists.size}組で最終決戦へ`
            : '最終決戦の出場者を選んでください'}
        </button>
      </div>
    );
  }

  // === Scoring list view (1st round or final round) ===
  const isFirstRound = phase === 'first-round';
  const displayPerformers = isFirstRound ? firstRoundPerformers : myFinalPerformers;
  const scoredCount = isFirstRound ? firstRoundScored : finalRoundScored;
  const allScored = isFirstRound ? firstRoundAllScored : finalRoundAllScored;
  const roundLabel = isFirstRound ? (firstRound?.name ?? '1stラウンド') : (finalRound?.name ?? '最終決戦');

  return (
    <div className="min-h-dvh px-4 py-6 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => navigate('/')} className="text-text-secondary hover:text-white">
          ← 戻る
        </button>
        <div className="text-sm text-text-secondary">
          {isDelayed ? '📼 録画モード' : '📺 リアルタイム'}
        </div>
      </div>

      <h1 className="text-xl font-bold text-center mb-1">{competition.name}</h1>
      <div className="text-center mb-2">
        <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${
          isFirstRound ? 'bg-blue-500/20 text-blue-400' : 'bg-gold/20 text-gold'
        }`}>
          {roundLabel}
        </span>
      </div>
      <p className="text-center text-text-secondary text-sm mb-6">
        {isFirstRound
          ? '放送を見ながら、採点する出場者をタップしてください'
          : '最終決戦の出場者を採点してください'}
      </p>

      {/* Progress */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-text-secondary mb-2">
          <span>採点進捗</span>
          <span>{scoredCount}/{displayPerformers.length}</span>
        </div>
        <div className="h-2 bg-bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full bg-gold rounded-full transition-all duration-500"
            style={{ width: displayPerformers.length > 0 ? `${(scoredCount / displayPerformers.length) * 100}%` : '0%' }}
          />
        </div>
      </div>

      {/* Performer Grid */}
      {displayPerformers.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 mb-6">
          {displayPerformers.map((p) => {
            const isScored = scores.some((s) => s.performer_id === p.id);
            const performerScore = scores.find((s) => s.performer_id === p.id);
            return (
              <button
                key={p.id}
                onClick={() => setSelectedPerformerId(p.id)}
                className={`relative p-4 rounded-2xl border-2 text-left transition-all active:scale-[0.97] ${
                  isScored
                    ? 'bg-success/10 border-success/40 hover:bg-success/20'
                    : 'bg-bg-card border-white/10 hover:border-gold/50 hover:bg-bg-card-hover'
                }`}
              >
                {isScored && (
                  <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-success flex items-center justify-center">
                    <span className="text-white text-xs">✓</span>
                  </div>
                )}
                <div className="font-bold text-base mb-1 pr-6">{p.name}</div>
                {isScored && performerScore && (
                  <div className="text-gold font-bold text-lg">
                    {performerScore.score}
                    <span className="text-sm text-text-secondary ml-0.5">点</span>
                  </div>
                )}
                {!isScored && (
                  <div className="text-text-secondary text-sm">タップして採点</div>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="text-center text-text-secondary py-12">
          <p className="text-xl mb-2">出場者が登録されていません</p>
          <p className="text-sm">管理者が出場者を追加するまでお待ちください</p>
        </div>
      )}

      {/* 1st round all scored → proceed to finalist selection */}
      {isFirstRound && allScored && finalRound && (
        <div className="mt-4 text-center animate-fade-in-up">
          <p className="text-gold font-bold mb-3">🎉 1stラウンドの採点が完了しました！</p>
          <p className="text-text-secondary text-sm mb-4">最終決戦に進んだ3組を選びましょう</p>
          {/* This will trigger phase change automatically */}
        </div>
      )}

      {/* 1st round all scored but no final round → show results */}
      {isFirstRound && allScored && !finalRound && (
        <div className="mt-4 text-center animate-fade-in-up">
          <p className="text-gold font-bold mb-3">🎉 全員の採点が完了しました！</p>
          <button
            onClick={handleComplete}
            className="px-8 py-4 rounded-xl bg-gold text-black font-bold text-lg hover:bg-gold-dark active:scale-[0.98] transition-all w-full"
          >
            📊 結果を見る
          </button>
        </div>
      )}

      {/* Final round all scored → show results */}
      {!isFirstRound && allScored && (
        <div className="mt-4 text-center animate-fade-in-up">
          <p className="text-gold font-bold mb-3">🎉 最終決戦の採点が完了しました！</p>
          <button
            onClick={handleComplete}
            className="px-8 py-4 rounded-xl bg-gold text-black font-bold text-lg hover:bg-gold-dark active:scale-[0.98] transition-all w-full"
          >
            📊 結果を見る
          </button>
        </div>
      )}

      {/* Partial results */}
      {scoredCount > 0 && !allScored && (
        <div className="mt-4 text-center">
          <button
            onClick={handleComplete}
            className="px-6 py-3 rounded-xl bg-bg-card border border-white/10 text-text-secondary text-sm hover:bg-bg-card-hover transition-all"
          >
            途中結果を見る →
          </button>
        </div>
      )}
    </div>
  );
}
