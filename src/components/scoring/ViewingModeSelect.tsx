import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { demoDb } from '../../lib/demoData';

export default function ViewingModeSelect() {
  const { competitionId } = useParams<{ competitionId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const competition = competitionId ? demoDb.getCompetitionById(competitionId) : null;

  if (!competition || !user) return null;

  const handleStart = () => {
    if (!competitionId || !user) return;

    demoDb.upsertUserCompetitionStatus({
      user_id: user.id,
      competition_id: competitionId,
      viewing_mode: 'delayed',
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

      <div className="text-center mb-8">
        <div className="text-5xl mb-4">🎤</div>
        <h1 className="text-2xl font-bold mb-3">{competition.name}</h1>
        <p className="text-text-secondary text-sm leading-relaxed">
          採点する（録画で見ながら採点してもネタバレはしません）
        </p>
      </div>

      <div className="w-full max-w-sm">
        <button
          onClick={handleStart}
          className="w-full py-5 rounded-2xl bg-gold text-black font-bold text-lg hover:bg-gold-dark active:scale-[0.98] transition-all"
        >
          🎯 採点を始める
        </button>
      </div>
    </div>
  );
}
