import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { demoDb } from '../../lib/demoData';
import type { ViewingMode } from '../../types/database';

export default function ViewingModeSelect() {
  const { competitionId } = useParams<{ competitionId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const competition = competitionId ? demoDb.getCompetitionById(competitionId) : null;

  if (!competition || !user) return null;

  const handleSelect = (mode: ViewingMode) => {
    if (!competitionId || !user) return;

    demoDb.upsertUserCompetitionStatus({
      user_id: user.id,
      competition_id: competitionId,
      viewing_mode: mode,
      has_completed_scoring: false,
      completed_at: null,
    });

    navigate(`/competition/${competitionId}/scoring`);
  };

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-4 py-8">
      <button onClick={() => navigate('/')} className="absolute top-4 left-4 text-text-secondary hover:text-white p-2">
        ← 戻る
      </button>

      <div className="text-center mb-10">
        <h1 className="text-2xl font-bold mb-2">{competition.name}</h1>
        <p className="text-text-secondary">視聴モードを選んでください</p>
      </div>

      <div className="w-full max-w-sm space-y-4">
        <button
          onClick={() => handleSelect('realtime')}
          className="w-full p-6 rounded-2xl bg-bg-card border-2 border-white/10 hover:border-gold/50 transition-all active:scale-[0.98] text-left"
        >
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">📺</span>
            <span className="text-lg font-bold">リアルタイムで見ている</span>
          </div>
          <p className="text-text-secondary text-sm ml-12">
            放送を見ながら採点します。ネタ順に表示されます。
          </p>
        </button>

        <button
          onClick={() => handleSelect('delayed')}
          className="w-full p-6 rounded-2xl bg-bg-card border-2 border-white/10 hover:border-gold/50 transition-all active:scale-[0.98] text-left"
        >
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">📼</span>
            <span className="text-lg font-bold">あとから録画で見る</span>
          </div>
          <p className="text-text-secondary text-sm ml-12">
            ネタバレ防止モード。ランダム順で表示されます。
          </p>
        </button>
      </div>
    </div>
  );
}
