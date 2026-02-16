import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { COMPETITION_CONFIGS, type CompetitionType } from '../../types/database';
import { demoDb } from '../../lib/demoData';

export default function CreateCompetition() {
  const navigate = useNavigate();
  const [type, setType] = useState<CompetitionType>('m1');
  const [year, setYear] = useState(new Date().getFullYear());
  const [step, setStep] = useState<'type' | 'performers'>('type');
  const [performerNames, setPerformerNames] = useState<string[]>([]);
  const [newName, setNewName] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  const config = COMPETITION_CONFIGS[type];

  // Focus edit input when editing starts
  useEffect(() => {
    if (editingIndex !== null && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingIndex]);

  const handleAddPerformer = () => {
    const name = newName.trim();
    if (!name) return;
    if (performerNames.includes(name)) return;
    setPerformerNames((prev) => [...prev, name]);
    setNewName('');
  };

  const handleRemovePerformer = (index: number) => {
    setPerformerNames((prev) => prev.filter((_, i) => i !== index));
    if (editingIndex === index) {
      setEditingIndex(null);
    }
  };

  const handleStartEdit = (index: number) => {
    setEditingIndex(index);
    setEditingName(performerNames[index]);
  };

  const handleSaveEdit = () => {
    if (editingIndex === null) return;
    const name = editingName.trim();
    if (!name) {
      setEditingIndex(null);
      return;
    }
    setPerformerNames((prev) => prev.map((n, i) => i === editingIndex ? name : n));
    setEditingIndex(null);
    setEditingName('');
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditingName('');
  };

  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    if (isCreating) return;
    setIsCreating(true);

    try {
      const comp = await demoDb.createCompetition({
        type,
        year,
        name: `${config.label} ${year}`,
        status: 'upcoming',
        broadcast_date: `${year}-12-01`,
      });

      // Create default rounds (must await each for FK constraints)
      const createdRounds = [];
      for (let i = 0; i < config.rounds.length; i++) {
        const r = config.rounds[i];
        const round = await demoDb.createRound({
          competition_id: comp.id,
          name: r.name,
          round_order: i + 1,
          scoring_type: r.scoringType,
        });
        createdRounds.push(round);
      }

      // Add performers to 1st round (must await each for FK constraints)
      if (createdRounds.length > 0 && performerNames.length > 0) {
        const firstRound = createdRounds[0];
        for (let i = 0; i < performerNames.length; i++) {
          await demoDb.createPerformer({
            competition_id: comp.id,
            round_id: firstRound.id,
            name: performerNames[i],
            performance_order: null,
            display_label: `出場者${String.fromCharCode(65 + i)}`,
          });
        }
      }

      navigate(`/admin/competition/${comp.id}`);
    } finally {
      setIsCreating(false);
    }
  };

  // Step 1: Choose type and year
  if (step === 'type') {
    return (
      <div className="min-h-dvh px-4 py-6 max-w-lg mx-auto">
        <button onClick={() => navigate('/')} className="text-text-secondary hover:text-white mb-6 block">
          ← ホームに戻る
        </button>

        <h1 className="text-2xl font-bold mb-8 text-center">
          <span className="text-gold">✨</span> 新しい大会を作成
        </h1>

        {/* Competition Type Selection */}
        <div className="mb-8">
          <label className="block text-sm text-text-secondary mb-3">大会タイプ</label>
          <div className="grid grid-cols-1 gap-3">
            {(Object.keys(COMPETITION_CONFIGS) as CompetitionType[]).map((key) => {
              const c = COMPETITION_CONFIGS[key];
              return (
                <button
                  key={key}
                  onClick={() => setType(key)}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    type === key
                      ? 'border-gold bg-gold/10'
                      : 'border-white/10 bg-bg-card hover:border-white/30'
                  }`}
                >
                  <span className="text-2xl mr-3">{c.emoji}</span>
                  <span className="text-lg font-medium">{c.label}</span>
                  <div className="text-text-secondary text-xs mt-1 ml-10">
                    {c.rounds.map((r) => r.name).join(' → ')}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Year Input */}
        <div className="mb-8">
          <label className="block text-sm text-text-secondary mb-3">開催年</label>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            min={2020}
            max={2030}
            className="w-full p-4 rounded-xl bg-bg-card border border-white/10 text-xl text-center font-bold focus:border-gold focus:outline-none"
          />
        </div>

        {/* Preview */}
        <div className="mb-8 p-4 rounded-xl bg-bg-secondary border border-white/10">
          <p className="text-sm text-text-secondary mb-1">作成される大会</p>
          <p className="text-xl font-bold">
            {config.emoji} {config.label} {year}
          </p>
          <div className="mt-2 text-sm text-text-secondary">
            {config.rounds.map((r, i) => (
              <span key={i}>
                {i > 0 && ' → '}
                {r.name}({r.defaultPerformerCount}組)
              </span>
            ))}
          </div>
        </div>

        {/* Next Button */}
        <button
          onClick={() => setStep('performers')}
          className="w-full py-4 rounded-xl bg-gold text-black font-bold text-lg hover:bg-gold-dark active:scale-[0.98] transition-all"
        >
          次へ：出場者を登録 →
        </button>
      </div>
    );
  }

  // Step 2: Register performers
  return (
    <div className="min-h-dvh px-4 py-6 max-w-lg mx-auto">
      <button onClick={() => setStep('type')} className="text-text-secondary hover:text-white mb-6 block">
        ← 大会タイプ選択に戻る
      </button>

      <h1 className="text-xl font-bold mb-2 text-center">
        {config.emoji} {config.label} {year}
      </h1>
      <p className="text-center text-text-secondary text-sm mb-6">
        1stラウンドの出場者を登録してください
      </p>

      {/* Performer List */}
      <div className="space-y-2 mb-4">
        {performerNames.map((name, i) => (
          <div
            key={i}
            className="flex items-center gap-3 p-3 rounded-xl bg-bg-card border border-white/10"
          >
            <span className="w-8 text-center text-text-secondary text-sm">{i + 1}</span>
            {editingIndex === i ? (
              <>
                <input
                  ref={editInputRef}
                  type="text"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.nativeEvent.isComposing) return;
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
                  onClick={() => handleStartEdit(i)}
                  className="flex-1 font-medium text-left hover:text-gold transition-colors"
                  title="タップして名前を編集"
                >
                  {name}
                </button>
                <button
                  onClick={() => handleRemovePerformer(i)}
                  className="text-danger/60 hover:text-danger text-lg px-2"
                >
                  ×
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Add Input */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          placeholder="芸人名を入力..."
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return;
            if (e.key === 'Enter') handleAddPerformer();
          }}
          className="flex-1 px-4 py-3 rounded-xl bg-bg-card border border-white/10 focus:border-gold focus:outline-none text-sm"
        />
        <button
          onClick={handleAddPerformer}
          disabled={!newName.trim()}
          className="px-4 py-3 rounded-xl bg-gold text-black font-bold text-sm hover:bg-gold-dark active:scale-95 transition-all disabled:opacity-30"
        >
          追加
        </button>
      </div>

      <p className="text-xs text-text-secondary mb-8">
        ※ 名前をタップすると編集できます。
        <br />
        ※ ネタ順は放送を見ながら各自が入力します。ここでは名前だけでOKです。
      </p>

      {/* Counter */}
      <div className="text-center text-sm text-text-secondary mb-4">
        {performerNames.length}組 登録済み
        {performerNames.length > 0 && performerNames.length < config.rounds[0].defaultPerformerCount && (
          <span className="text-gold ml-2">
            （目安: {config.rounds[0].defaultPerformerCount}組）
          </span>
        )}
      </div>

      {/* Create Button */}
      <button
        onClick={handleCreate}
        disabled={isCreating}
        className="w-full py-4 rounded-xl bg-gold text-black font-bold text-lg hover:bg-gold-dark active:scale-[0.98] transition-all disabled:opacity-50"
      >
        {isCreating
          ? '作成中...'
          : performerNames.length > 0
            ? `大会を作成（${performerNames.length}組登録）`
            : '出場者なしで作成'}
      </button>
    </div>
  );
}
