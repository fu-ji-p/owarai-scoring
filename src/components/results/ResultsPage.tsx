import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { demoDb } from '../../lib/demoData';
import { standardDeviation, pearsonCorrelation } from '../../lib/utils';
import * as XLSX from 'xlsx';
import type { User, Performer } from '../../types/database';

type Tab = 'personal' | 'all' | 'analysis';

export default function ResultsPage() {
  const { competitionId } = useParams<{ competitionId: string }>();
  const { user, users } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('personal');
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null);

  const competition = competitionId ? demoDb.getCompetitionById(competitionId) : null;
  const rounds = competitionId ? demoDb.getRoundsByCompetition(competitionId) : [];

  useEffect(() => {
    if (rounds.length > 0 && !selectedRoundId) {
      setSelectedRoundId(rounds[0].id);
    }
  }, [rounds, selectedRoundId]);

  const allScores = competitionId ? demoDb.getScoresByCompetition(competitionId) : [];
  const performers = selectedRoundId ? demoDb.getPerformersByRound(selectedRoundId) : [];

  // All performers across all rounds (for analysis)
  const allPerformers = useMemo(() => {
    const perfMap = new Map<string, Performer & { roundName: string }>();
    rounds.forEach((r) => {
      demoDb.getPerformersByRound(r.id).forEach((p) => {
        // Use name as key to deduplicate (same performer in 1st round and final)
        if (!perfMap.has(p.name)) {
          perfMap.set(p.name, { ...p, roundName: r.name });
        }
      });
    });
    return Array.from(perfMap.values());
  }, [rounds]);

  // Sort performers by the user's scoring order (scored_at = ネタ順)
  const sortedPerformers = useMemo(() => {
    if (!user || performers.length === 0) return performers;
    const myScores = allScores.filter(
      (s) => s.user_id === user.id && s.round_id === selectedRoundId
    );
    return [...performers].sort((a, b) => {
      const scoreA = myScores.find((s) => s.performer_id === a.id);
      const scoreB = myScores.find((s) => s.performer_id === b.id);
      const timeA = scoreA ? new Date(scoreA.scored_at).getTime() : Infinity;
      const timeB = scoreB ? new Date(scoreB.scored_at).getTime() : Infinity;
      return timeA - timeB;
    });
  }, [performers, allScores, user, selectedRoundId]);

  // Check visibility: delayed users who haven't completed shouldn't see others' scores
  const myStatus = user && competitionId
    ? demoDb.getUserCompetitionStatus(user.id, competitionId)
    : null;
  const allStatuses = competitionId ? demoDb.getAllCompetitionStatus(competitionId) : [];

  const canSeeOthers = myStatus?.has_completed_scoring || myStatus?.viewing_mode === 'realtime';

  // Get visible users (exclude delayed users who haven't completed)
  const visibleUsers = useMemo(() => {
    if (!canSeeOthers) return users.filter((u) => u.id === user?.id);
    return users.filter((u) => {
      const us = allStatuses.find((s) => s.user_id === u.id);
      if (!us) return false;
      if (us.viewing_mode === 'delayed' && !us.has_completed_scoring) return false;
      return true;
    });
  }, [canSeeOthers, users, user, allStatuses]);

  const roundScores = allScores.filter((s) => s.round_id === selectedRoundId);

  // ==== Per-round Analysis (for personal & all tabs) ====
  const roundAnalysis = useMemo(() => {
    if (sortedPerformers.length === 0 || visibleUsers.length === 0) return null;

    const performerStats = sortedPerformers.map((p) => {
      const pScores = roundScores
        .filter((s) => s.performer_id === p.id && visibleUsers.some((u) => u.id === s.user_id))
        .map((s) => s.score);
      const avg = pScores.length > 0 ? pScores.reduce((a, b) => a + b, 0) / pScores.length : 0;
      return {
        performer: p,
        scores: pScores,
        avg,
        std: standardDeviation(pScores),
        max: pScores.length > 0 ? Math.max(...pScores) : 0,
        min: pScores.length > 0 ? Math.min(...pScores) : 0,
      };
    });

    const ranked = [...performerStats].sort((a, b) => b.avg - a.avg);
    ranked.forEach((r, i) => { (r as typeof r & { rank: number }).rank = i + 1; });

    const champion = ranked[0];

    // Most agreed / disagreed
    const mostAgreed = performerStats.length > 0
      ? [...performerStats].filter((p) => p.scores.length > 1).sort((a, b) => a.std - b.std)[0]
      : null;
    const mostDisagreed = performerStats.length > 0
      ? [...performerStats].filter((p) => p.scores.length > 1).sort((a, b) => b.std - a.std)[0]
      : null;

    return { performerStats, ranked, champion, mostAgreed, mostDisagreed };
  }, [sortedPerformers, visibleUsers, roundScores]);

  // ==== Competition-wide Analysis (全ラウンド横断) ====
  const overallAnalysis = useMemo(() => {
    if (allPerformers.length === 0 || visibleUsers.length === 0) return null;

    // Collect all performer IDs across all rounds, grouped by name
    const allRoundPerformers: { name: string; perfIds: string[] }[] = [];
    const nameMap = new Map<string, string[]>();
    rounds.forEach((r) => {
      demoDb.getPerformersByRound(r.id).forEach((p) => {
        if (!nameMap.has(p.name)) nameMap.set(p.name, []);
        nameMap.get(p.name)!.push(p.id);
      });
    });
    nameMap.forEach((perfIds, name) => {
      allRoundPerformers.push({ name, perfIds });
    });

    // Per user stats (across all rounds)
    const userStats = visibleUsers.map((u) => {
      const uScores = allScores.filter((s) => s.user_id === u.id);
      const scoreValues = uScores.map((s) => s.score);
      const avg = scoreValues.length > 0 ? scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length : 0;

      // Find highest/lowest across all rounds
      const highestScore = uScores.length > 0 ? uScores.reduce((a, b) => a.score > b.score ? a : b) : null;
      const lowestScore = uScores.length > 0 ? uScores.reduce((a, b) => a.score < b.score ? a : b) : null;

      // Find performer name for highest/lowest
      const findPerfName = (performerId: string): string => {
        for (const r of rounds) {
          const perf = demoDb.getPerformersByRound(r.id).find((p) => p.id === performerId);
          if (perf) return perf.name;
        }
        return '-';
      };

      return {
        user: u,
        avg,
        std: standardDeviation(scoreValues),
        scoredCount: scoreValues.length,
        highest: highestScore ? findPerfName(highestScore.performer_id) : '-',
        highestScore: highestScore?.score ?? 0,
        lowest: lowestScore ? findPerfName(lowestScore.performer_id) : '-',
        lowestScore: lowestScore?.score ?? 0,
      };
    });

    // Correlation matrix (across all rounds, matching by performer name)
    const correlations: { user1: User; user2: User; correlation: number }[] = [];
    for (let i = 0; i < visibleUsers.length; i++) {
      for (let j = i + 1; j < visibleUsers.length; j++) {
        const u1Scores: number[] = [];
        const u2Scores: number[] = [];
        allRoundPerformers.forEach(({ perfIds }) => {
          // Find scores for both users for this performer (any round)
          const s1 = allScores.find((s) => s.user_id === visibleUsers[i].id && perfIds.includes(s.performer_id));
          const s2 = allScores.find((s) => s.user_id === visibleUsers[j].id && perfIds.includes(s.performer_id));
          if (s1 && s2) {
            u1Scores.push(s1.score);
            u2Scores.push(s2.score);
          }
        });
        correlations.push({
          user1: visibleUsers[i],
          user2: visibleUsers[j],
          correlation: pearsonCorrelation(u1Scores, u2Scores),
        });
      }
    }

    // Most agreed / disagreed (across all rounds)
    const performerOverallStats = allRoundPerformers.map(({ name, perfIds }) => {
      const pScores = allScores
        .filter((s) => perfIds.includes(s.performer_id) && visibleUsers.some((u) => u.id === s.user_id))
        .map((s) => s.score);
      const avg = pScores.length > 0 ? pScores.reduce((a, b) => a + b, 0) / pScores.length : 0;
      return { name, scores: pScores, avg, std: standardDeviation(pScores) };
    });

    const mostAgreed = performerOverallStats.length > 0
      ? [...performerOverallStats].filter((p) => p.scores.length > 1).sort((a, b) => a.std - b.std)[0]
      : null;
    const mostDisagreed = performerOverallStats.length > 0
      ? [...performerOverallStats].filter((p) => p.scores.length > 1).sort((a, b) => b.std - a.std)[0]
      : null;

    // Judge type
    const getJudgeType = (u: typeof userStats[0]) => {
      const globalAvg = userStats.reduce((a, b) => a + b.avg, 0) / userStats.length;
      const maxStd = Math.max(...userStats.map((s) => s.std));
      const minStd = Math.min(...userStats.map((s) => s.std));

      if (u.avg < globalAvg - 5) return { type: '辛口審査員', emoji: '🧐' };
      if (u.avg > globalAvg + 5) return { type: '優しさの鬼', emoji: '😇' };
      if (u.std === maxStd) return { type: 'メリハリ審査員', emoji: '🎢' };
      if (u.std === minStd) return { type: '安定の職人', emoji: '🧑‍🎨' };
      return { type: 'バランス型', emoji: '⚖️' };
    };

    // Overall champion (highest avg across all rounds)
    const overallChampion = performerOverallStats.length > 0
      ? [...performerOverallStats].sort((a, b) => b.avg - a.avg)[0]
      : null;

    return {
      userStats,
      correlations,
      mostAgreed,
      mostDisagreed,
      getJudgeType,
      overallChampion,
      totalScores: allScores.length,
    };
  }, [allPerformers, visibleUsers, allScores, rounds]);

  // ==== Excel Export ====
  const handleExportExcel = useCallback(() => {
    if (!competition || !competitionId) return;

    const wb = XLSX.utils.book_new();

    // Create a sheet for each round
    rounds.forEach((round) => {
      const roundPerformers = demoDb.getPerformersByRound(round.id);
      const roundAllScores = allScores.filter((s) => s.round_id === round.id);

      const sorted = [...roundPerformers].sort((a, b) => {
        if (!user) return 0;
        const scoreA = roundAllScores.find((s) => s.performer_id === a.id && s.user_id === user.id);
        const scoreB = roundAllScores.find((s) => s.performer_id === b.id && s.user_id === user.id);
        const timeA = scoreA ? new Date(scoreA.scored_at).getTime() : Infinity;
        const timeB = scoreB ? new Date(scoreB.scored_at).getTime() : Infinity;
        return timeA - timeB;
      });

      const scoringUsers = visibleUsers.filter((u) =>
        roundAllScores.some((s) => s.user_id === u.id)
      );

      if (sorted.length === 0) return;

      const header = ['ネタ順', '出場者', ...scoringUsers.map((u) => u.name), '平均', 'コメント'];

      const rows = sorted.map((p, i) => {
        const userScores = scoringUsers.map((u) => {
          const s = roundAllScores.find((sc) => sc.user_id === u.id && sc.performer_id === p.id);
          return s ? s.score : '';
        });
        const validScores = userScores.filter((s): s is number => typeof s === 'number');
        const avg = validScores.length > 0
          ? (validScores.reduce((a, b) => a + b, 0) / validScores.length).toFixed(1)
          : '';

        const myScore = user ? roundAllScores.find((s) => s.user_id === user.id && s.performer_id === p.id) : null;
        const comment = myScore?.comment ?? '';

        return [i + 1, p.name, ...userScores, avg, comment];
      });

      const summaryRow = ['', '平均', ...scoringUsers.map((u) => {
        const uScores = roundAllScores.filter((s) => s.user_id === u.id).map((s) => s.score);
        return uScores.length > 0 ? Number((uScores.reduce((a, b) => a + b, 0) / uScores.length).toFixed(1)) : '';
      }), '', ''];

      const wsData = [header, ...rows, [], summaryRow];
      const ws = XLSX.utils.aoa_to_sheet(wsData);

      ws['!cols'] = [
        { wch: 8 },
        { wch: 20 },
        ...scoringUsers.map(() => ({ wch: 10 })),
        { wch: 8 },
        { wch: 30 },
      ];

      XLSX.utils.book_append_sheet(wb, ws, round.name);
    });

    const fileName = `${competition.name}_採点結果.xlsx`;
    XLSX.writeFile(wb, fileName);
  }, [competition, competitionId, rounds, allScores, visibleUsers, user]);

  if (!competition || !user) return null;

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'personal', label: '個人', icon: '👤' },
    { key: 'all', label: '全員', icon: '👥' },
    { key: 'analysis', label: '分析', icon: '📊' },
  ];

  return (
    <div className="min-h-dvh px-4 py-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => navigate('/')} className="text-text-secondary hover:text-white">
          ← 戻る
        </button>
        <button
          onClick={() => navigate(`/competition/${competitionId}/scoring`)}
          className="text-gold text-sm"
        >
          採点に戻る
        </button>
      </div>

      <h1 className="text-xl font-bold text-center mb-2">{competition.name}</h1>
      <p className="text-center text-text-secondary text-sm mb-4">結果発表</p>

      {/* Tab Bar */}
      <div className="flex gap-1 bg-bg-secondary rounded-xl p-1 mb-6">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
              tab === t.key ? 'bg-gold text-black' : 'text-text-secondary hover:text-white'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Round Tabs (only for personal & all tabs) */}
      {tab !== 'analysis' && rounds.length > 1 && (
        <div className="flex gap-2 justify-center mb-4">
          {rounds.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelectedRoundId(r.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                selectedRoundId === r.id
                  ? 'bg-gold text-black'
                  : 'bg-bg-card text-text-secondary border border-white/10'
              }`}
            >
              {r.name}
            </button>
          ))}
        </div>
      )}

      {/* ===== Personal Tab ===== */}
      {tab === 'personal' && (
        <div className="space-y-3">
          {sortedPerformers.map((p, i) => {
            const myScore = roundScores.find(
              (s) => s.user_id === user.id && s.performer_id === p.id
            );
            return (
              <div
                key={p.id}
                className="flex items-center gap-3 p-4 rounded-xl bg-bg-card border border-white/10 animate-fade-in-up"
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                <div className="w-8 text-center text-text-secondary text-sm">
                  {myScore ? i + 1 : '-'}
                </div>
                <div className="flex-1">
                  <div className="font-medium">{p.name}</div>
                  {myScore?.comment && (
                    <div className="text-xs text-text-secondary mt-1">💬 {myScore.comment}</div>
                  )}
                </div>
                <div className="text-2xl font-black text-gold">
                  {myScore ? myScore.score : '-'}
                </div>
                {myScore && (
                  <div className="w-20 h-2 bg-bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gold rounded-full"
                      style={{ width: `${myScore.score}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ===== All Tab ===== */}
      {tab === 'all' && roundAnalysis && (
        <div className="space-y-6">
          {/* Score Table */}
          <div className="overflow-x-auto -mx-4 px-4">
            <table className="w-full text-sm border-collapse min-w-[500px]">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-2 px-2 text-text-secondary font-normal">出場者</th>
                  {visibleUsers.map((u) => (
                    <th key={u.id} className="text-center py-2 px-1 w-14">
                      <div className="text-lg">{u.avatar_emoji}</div>
                      <div className="text-[10px] text-text-secondary truncate">{u.name}</div>
                    </th>
                  ))}
                  <th className="text-center py-2 px-2 text-gold font-bold">平均</th>
                </tr>
              </thead>
              <tbody>
                {roundAnalysis.ranked.map((ps) => (
                  <tr key={ps.performer.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="py-2 px-2">
                      <span className="mr-1 text-gold text-xs">#{(ps as typeof ps & { rank: number }).rank}</span>
                      {ps.performer.name}
                    </td>
                    {visibleUsers.map((u) => {
                      const s = roundScores.find(
                        (sc) => sc.user_id === u.id && sc.performer_id === ps.performer.id
                      );
                      return (
                        <td key={u.id} className="text-center py-2 px-1 font-mono">
                          {s ? s.score : '-'}
                        </td>
                      );
                    })}
                    <td className="text-center py-2 px-2 font-bold text-gold">
                      {ps.avg.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Stats */}
          {roundAnalysis.mostAgreed && (
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-xl bg-bg-card border border-white/10">
                <div className="text-xs text-text-secondary mb-1">🤝 最も意見が一致</div>
                <div className="font-bold">{roundAnalysis.mostAgreed.performer.name}</div>
                <div className="text-xs text-text-secondary">SD: {roundAnalysis.mostAgreed.std.toFixed(1)}</div>
              </div>
              {roundAnalysis.mostDisagreed && (
                <div className="p-4 rounded-xl bg-bg-card border border-white/10">
                  <div className="text-xs text-text-secondary mb-1">💥 最も意見が分かれた</div>
                  <div className="font-bold">{roundAnalysis.mostDisagreed.performer.name}</div>
                  <div className="text-xs text-text-secondary">SD: {roundAnalysis.mostDisagreed.std.toFixed(1)}</div>
                </div>
              )}
            </div>
          )}

          {/* Our Champion */}
          {roundAnalysis.champion && (
            <div className="p-6 rounded-2xl bg-gradient-to-br from-gold/20 to-gold/5 border-2 border-gold/30 text-center">
              <div className="text-3xl mb-2">🏆</div>
              <div className="text-sm text-gold mb-1">我が家のチャンピオン</div>
              <div className="text-2xl font-black">{roundAnalysis.champion.performer.name}</div>
              <div className="text-gold text-lg mt-1">平均 {roundAnalysis.champion.avg.toFixed(1)}点</div>
            </div>
          )}
        </div>
      )}

      {/* ===== Analysis Tab (大会全体の分析) ===== */}
      {tab === 'analysis' && overallAnalysis && (
        <div className="space-y-6">
          {/* Overall title */}
          <div className="text-center text-text-secondary text-sm">
            全ラウンド通しての分析（{overallAnalysis.totalScores}件の採点データ）
          </div>

          {/* Overall Champion */}
          {overallAnalysis.overallChampion && (
            <div className="p-6 rounded-2xl bg-gradient-to-br from-gold/20 to-gold/5 border-2 border-gold/30 text-center">
              <div className="text-3xl mb-2">🏆</div>
              <div className="text-sm text-gold mb-1">我が家の総合チャンピオン</div>
              <div className="text-2xl font-black">{overallAnalysis.overallChampion.name}</div>
              <div className="text-gold text-lg mt-1">平均 {overallAnalysis.overallChampion.avg.toFixed(1)}点</div>
            </div>
          )}

          {/* Most agreed / disagreed (overall) */}
          {overallAnalysis.mostAgreed && (
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-xl bg-bg-card border border-white/10">
                <div className="text-xs text-text-secondary mb-1">🤝 最も意見が一致</div>
                <div className="font-bold">{overallAnalysis.mostAgreed.name}</div>
                <div className="text-xs text-text-secondary">SD: {overallAnalysis.mostAgreed.std.toFixed(1)}</div>
              </div>
              {overallAnalysis.mostDisagreed && (
                <div className="p-4 rounded-xl bg-bg-card border border-white/10">
                  <div className="text-xs text-text-secondary mb-1">💥 最も意見が分かれた</div>
                  <div className="font-bold">{overallAnalysis.mostDisagreed.name}</div>
                  <div className="text-xs text-text-secondary">SD: {overallAnalysis.mostDisagreed.std.toFixed(1)}</div>
                </div>
              )}
            </div>
          )}

          {/* Judge Types */}
          <div>
            <h3 className="text-lg font-bold mb-3">🎭 審査員タイプ</h3>
            <div className="grid grid-cols-2 gap-3">
              {overallAnalysis.userStats.map((us) => {
                const judgeType = overallAnalysis.getJudgeType(us);
                return (
                  <div key={us.user.id} className="p-4 rounded-xl bg-bg-card border border-white/10 text-center">
                    <div className="text-3xl mb-1">{us.user.avatar_emoji}</div>
                    <div className="text-sm font-medium mb-1">{us.user.name}</div>
                    <div className="text-2xl mb-1">{judgeType.emoji}</div>
                    <div className="text-gold text-sm font-bold">{judgeType.type}</div>
                    <div className="text-xs text-text-secondary mt-1">
                      平均: {us.avg.toFixed(1)} / SD: {us.std.toFixed(1)}
                    </div>
                    <div className="text-[10px] text-text-secondary mt-0.5">
                      {us.scoredCount}組を採点
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* User Scoring Trends */}
          <div>
            <h3 className="text-lg font-bold mb-3">📋 採点傾向</h3>
            <div className="space-y-2">
              {overallAnalysis.userStats.map((us) => (
                <div key={us.user.id} className="p-3 rounded-xl bg-bg-card border border-white/10 flex items-center gap-3">
                  <span className="text-2xl">{us.user.avatar_emoji}</span>
                  <div className="flex-1 text-sm">
                    <div className="font-medium">{us.user.name}</div>
                    <div className="text-text-secondary text-xs">
                      最高: {us.highest}({us.highestScore}点) / 最低: {us.lowest}({us.lowestScore}点)
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-gold">{us.avg.toFixed(1)}</div>
                    <div className="text-[10px] text-text-secondary">SD {us.std.toFixed(1)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Correlation Ranking */}
          {overallAnalysis.correlations.length > 0 && (
            <div>
              <h3 className="text-lg font-bold mb-3">👫 審査員相性ランキング</h3>
              <div className="space-y-2">
                {[...overallAnalysis.correlations]
                  .sort((a, b) => b.correlation - a.correlation)
                  .map((c, i) => (
                    <div key={i} className="p-3 rounded-xl bg-bg-card border border-white/10 flex items-center gap-3">
                      <div className="flex items-center gap-1 flex-1">
                        <span className="text-xl">{c.user1.avatar_emoji}</span>
                        <span className="text-text-secondary text-xs">×</span>
                        <span className="text-xl">{c.user2.avatar_emoji}</span>
                        <span className="text-sm ml-2">
                          {c.user1.name} & {c.user2.name}
                        </span>
                      </div>
                      <div className={`font-bold ${c.correlation > 0.5 ? 'text-success' : c.correlation < 0 ? 'text-danger' : 'text-text-secondary'}`}>
                        {(c.correlation * 100).toFixed(0)}%
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== Excel Export Button ===== */}
      <div className="mt-8 mb-4">
        <button
          onClick={handleExportExcel}
          className="w-full py-4 rounded-xl bg-green-600 text-white font-bold text-base hover:bg-green-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
        >
          <span className="text-xl">📥</span>
          Excelにエクスポート
        </button>
      </div>
    </div>
  );
}
