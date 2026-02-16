import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Competition, Round, Performer, CompetitionStatus } from '../../types/database';
import { demoDb } from '../../lib/demoData';

export default function ManageCompetition() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [performers, setPerformers] = useState<Record<string, Performer[]>>({});
  const [newPerformerName, setNewPerformerName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!id) return;
    const comp = demoDb.getCompetitionById(id);
    if (!comp) { navigate('/'); return; }
    setCompetition(comp);
    refresh();
  }, [id, navigate]);

  // Focus edit input when editing starts
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const refresh = () => {
    if (!id) return;
    const rds = demoDb.getRoundsByCompetition(id);
    setRounds(rds);
    const perfMap: Record<string, Performer[]> = {};
    rds.forEach((r) => { perfMap[r.id] = demoDb.getPerformersByRound(r.id); });
    setPerformers(perfMap);
  };

  const firstRound = rounds[0];
  const firstRoundPerformers = firstRound ? (performers[firstRound.id] || []) : [];

  const handleAddPerformer = async () => {
    const name = newPerformerName.trim();
    if (!name || !id || !firstRound) return;
    await demoDb.createPerformer({
      competition_id: id,
      round_id: firstRound.id,
      name,
      performance_order: null,
      display_label: `出場者${String.fromCharCode(65 + firstRoundPerformers.length)}`,
    });
    setNewPerformerName('');
    refresh();
  };

  const handleDeletePerformer = (perfId: string) => {
    demoDb.deletePerformer(perfId);
    refresh();
  };

  const handleStartEdit = (perf: Performer) => {
    setEditingId(perf.id);
    setEditingName(perf.name);
  };

  const handleSaveEdit = () => {
    if (!editingId) return;
    const name = editingName.trim();
    if (!name) {
      setEditingId(null);
      return;
    }
    demoDb.updatePerformer(editingId, { name });
    setEditingId(null);
    setEditingName('');
    refresh();
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName('');
  };

  const handleStatusChange = (status: CompetitionStatus) => {
    if (!id) return;
    demoDb.updateCompetition(id, { status });
    setCompetition((prev) => prev ? { ...prev, status } : null);
  };

  const handleDeleteCompetition = async () => {
    if (!id || isDeleting) return;
    setIsDeleting(true);
    try {
      await demoDb.deleteCompetition(id);
      navigate('/');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!competition) return null;

  const statusLabels: Record<CompetitionStatus, string> = {
    upcoming: '📅 開催前',
    active: '🔴 放送中',
    scoring: '✏️ 採点中',
    closed: '✅ 終了',
  };

  return (
    <div className="min-h-dvh px-4 py-6 max-w-lg mx-auto">
      <button onClick={() => navigate('/')} className="text-text-secondary hover:text-white mb-4 block">
        ← ホームに戻る
      </button>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold mb-2">{competition.name}</h1>
        <div className="flex gap-2 flex-wrap">
          {(Object.keys(statusLabels) as CompetitionStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => handleStatusChange(s)}
              className={`px-3 py-1.5 text-sm rounded-full transition-all ${
                competition.status === s
                  ? 'bg-gold text-black font-bold'
                  : 'bg-bg-card text-text-secondary border border-white/10 hover:border-white/30'
              }`}
            >
              {statusLabels[s]}
            </button>
          ))}
        </div>
      </div>

      {/* === 1st Round: 出場者登録 === */}
      {firstRound && (
        <div className="mb-8">
          <h2 className="text-lg font-bold mb-3 text-gold">{firstRound.name} — 出場者</h2>

          <div className="space-y-2 mb-3">
            {firstRoundPerformers.map((perf, i) => (
              <div
                key={perf.id}
                className="flex items-center gap-3 p-3 rounded-xl bg-bg-card border border-white/10"
              >
                <span className="w-8 text-center text-text-secondary text-sm">{i + 1}</span>
                {editingId === perf.id ? (
                  <>
                    <input
                      ref={editInputRef}
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveEdit();
                        if (e.key === 'Escape') handleCancelEdit();
                      }}
                      onBlur={handleSaveEdit}
                      className="flex-1 px-3 py-1.5 rounded-lg bg-bg-secondary border border-gold focus:outline-none text-sm"
                    />
                    <button
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={handleSaveEdit}
                      className="text-success text-sm px-2 font-bold"
                    >
                      ✓
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => handleStartEdit(perf)}
                      className="flex-1 font-medium text-left hover:text-gold transition-colors"
                      title="タップして名前を編集"
                    >
                      {perf.name}
                    </button>
                    <button
                      onClick={() => handleDeletePerformer(perf.id)}
                      className="text-danger/60 hover:text-danger text-lg px-2"
                    >
                      ×
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="芸人名を入力..."
              value={newPerformerName}
              onChange={(e) => setNewPerformerName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddPerformer(); }}
              className="flex-1 px-4 py-3 rounded-xl bg-bg-card border border-white/10 focus:border-gold focus:outline-none text-sm"
            />
            <button
              onClick={handleAddPerformer}
              className="px-4 py-3 rounded-xl bg-gold text-black font-bold text-sm hover:bg-gold-dark active:scale-95 transition-all"
            >
              追加
            </button>
          </div>

          <p className="text-xs text-text-secondary mt-2">
            ※ 名前をタップすると編集できます（採点データは保持されます）
            <br />
            ※ ネタ順は各ユーザーが放送を見ながら自分で採点した順番になります
          </p>
        </div>
      )}

      {/* === Final Round Info === */}
      {rounds.length > 1 && (
        <div className="mb-8 p-4 rounded-xl bg-bg-secondary border border-white/10">
          <h2 className="text-lg font-bold mb-2 text-gold">{rounds[rounds.length - 1].name}</h2>
          <p className="text-text-secondary text-sm">
            最終決戦の出場者は、各ユーザーが1stラウンドの採点を完了した後に自分で選択します。
          </p>
        </div>
      )}

      {/* === 大会を削除 === */}
      <div className="mt-12 pt-6 border-t border-white/10">
        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full py-3 rounded-xl text-danger/70 hover:text-danger text-sm border border-danger/20 hover:border-danger/50 transition-all"
          >
            大会を削除
          </button>
        ) : (
          <div className="p-4 rounded-xl bg-danger/10 border border-danger/30">
            <p className="text-center font-bold mb-2">本当に大会を削除しますか？</p>
            <p className="text-center text-text-secondary text-xs mb-4">
              「{competition.name}」と全ての採点データが削除されます。この操作は取り消せません。
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-3 rounded-xl bg-bg-card border border-white/10 text-sm font-medium hover:bg-bg-card-hover transition-all"
              >
                キャンセル
              </button>
              <button
                onClick={handleDeleteCompetition}
                disabled={isDeleting}
                className="flex-1 py-3 rounded-xl bg-danger text-white text-sm font-bold hover:bg-danger/80 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {isDeleting ? '削除中...' : '削除する'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
