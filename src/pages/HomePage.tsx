import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { demoDb } from '../lib/demoData';
import type { Competition, CompetitionStatus } from '../types/database';

export default function HomePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [showPast, setShowPast] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setCompetitions(demoDb.getCompetitions());
  }, [refreshKey]);

  // Refresh when coming back to this page
  useEffect(() => {
    const handleFocus = () => setRefreshKey((k) => k + 1);
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  if (!user) return null;

  const activeComps = competitions.filter((c) => c.status !== 'closed');
  const pastComps = competitions.filter((c) => c.status === 'closed');

  const statusConfig: Record<CompetitionStatus, { label: string; color: string }> = {
    upcoming: { label: '開催前', color: 'bg-blue-500/20 text-blue-400' },
    active: { label: '放送中', color: 'bg-red-500/20 text-red-400' },
    scoring: { label: '採点受付中', color: 'bg-gold/20 text-gold' },
    closed: { label: '終了', color: 'bg-white/10 text-text-secondary' },
  };

  const handleStartScoring = (comp: Competition) => {
    const status = demoDb.getUserCompetitionStatus(user.id, comp.id);
    if (status) {
      if (status.has_completed_scoring) {
        navigate(`/competition/${comp.id}/results`);
      } else {
        navigate(`/competition/${comp.id}/scoring`);
      }
    } else {
      navigate(`/competition/${comp.id}/mode`);
    }
  };

  return (
    <div className="min-h-dvh px-4 py-6 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{user.avatar_emoji}</span>
          <div>
            <div className="font-bold text-lg">{user.name}</div>
            <button onClick={logout} className="text-text-secondary text-xs hover:text-white">
              ログアウト
            </button>
          </div>
        </div>
        <h1 className="text-xl font-bold">
          <span className="text-gold">🏆</span> お笑い採点
        </h1>
      </div>

      {user.is_admin && (
        <button
          onClick={() => navigate('/admin/create')}
          className="w-full p-4 mb-6 rounded-xl border-2 border-dashed border-gold/40 text-gold hover:bg-gold/10 transition-all active:scale-[0.98] text-center"
        >
          ＋ 新しい大会を作成
        </button>
      )}

      {activeComps.length > 0 ? (
        <div className="space-y-3 mb-8">
          <h2 className="text-sm text-text-secondary font-medium">開催中・開催予定</h2>
          {activeComps.map((comp) => {
            const myStatus = demoDb.getUserCompetitionStatus(user.id, comp.id);
            const rounds = demoDb.getRoundsByCompetition(comp.id);
            const firstRound = rounds[0];
            const performerCount = firstRound ? demoDb.getPerformersByRound(firstRound.id).length : 0;

            return (
              <div
                key={comp.id}
                className="p-4 rounded-xl bg-bg-card border border-white/10 transition-all"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-lg">{comp.name}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${statusConfig[comp.status].color}`}>
                    {statusConfig[comp.status].label}
                  </span>
                </div>

                {/* Performer count */}
                <div className="text-xs text-text-secondary mb-3">
                  出場者: {performerCount}組登録済み
                  {myStatus && (
                    <span className="ml-2">
                      | {myStatus.viewing_mode === 'realtime' ? '📺 リアルタイム' : '📼 録画'}
                      {myStatus.has_completed_scoring && ' ✅ 採点完了'}
                    </span>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex gap-2">
                  {performerCount > 0 ? (
                    <button
                      onClick={() => handleStartScoring(comp)}
                      className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all active:scale-[0.98] ${
                        myStatus?.has_completed_scoring
                          ? 'bg-success/20 text-success border border-success/30 hover:bg-success/30'
                          : myStatus
                          ? 'bg-gold text-black hover:bg-gold-dark'
                          : 'bg-gold text-black hover:bg-gold-dark'
                      }`}
                    >
                      {myStatus?.has_completed_scoring
                        ? '📊 結果を見る'
                        : myStatus
                        ? '✏️ 採点を続ける'
                        : '🎯 採点を始める'}
                    </button>
                  ) : (
                    <div className="flex-1 py-3 rounded-xl text-center text-text-secondary text-sm bg-bg-secondary border border-white/5">
                      出場者が登録されるまでお待ちください
                    </div>
                  )}

                  {user.is_admin && (
                    <button
                      onClick={() => navigate(`/admin/competition/${comp.id}`)}
                      className="px-4 py-3 rounded-xl text-xs text-text-secondary hover:text-gold border border-white/10 hover:border-gold/30 transition-all"
                    >
                      ⚙️ 管理
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 text-text-secondary">
          <div className="text-4xl mb-4">🎬</div>
          <p>まだ大会がありません</p>
          {user.is_admin && (
            <p className="text-sm mt-2">上のボタンから大会を作成しましょう！</p>
          )}
        </div>
      )}

      {pastComps.length > 0 && (
        <div>
          <button
            onClick={() => setShowPast(!showPast)}
            className="flex items-center gap-2 text-sm text-text-secondary hover:text-white mb-3 w-full"
          >
            <span className={`transition-transform ${showPast ? 'rotate-90' : ''}`}>▶</span>
            過去の大会 ({pastComps.length})
          </button>
          {showPast && (
            <div className="space-y-2">
              {pastComps.map((comp) => (
                <div
                  key={comp.id}
                  onClick={() => navigate(`/competition/${comp.id}/results`)}
                  className="p-3 rounded-xl bg-bg-card/50 border border-white/5 cursor-pointer hover:bg-bg-card transition-all"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{comp.name}</span>
                    <span className="text-xs text-text-secondary">終了</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
