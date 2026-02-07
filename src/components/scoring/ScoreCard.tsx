import { useState, useEffect } from 'react';

interface ScoreCardProps {
  performerName: string;
  orderLabel?: string; // e.g. "1番手" or null for spoiler-free
  initialScore?: number;
  initialComment?: string;
  isScored?: boolean;
  onSubmit: (score: number, comment: string) => void;
}

export default function ScoreCard({
  performerName,
  orderLabel,
  initialScore,
  initialComment,
  isScored,
  onSubmit,
}: ScoreCardProps) {
  const [score, setScore] = useState(initialScore ?? 70);
  const [comment, setComment] = useState(initialComment ?? '');
  const [showSparkle, setShowSparkle] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    setScore(initialScore ?? 70);
    setComment(initialComment ?? '');
    setConfirmed(false);
  }, [performerName, initialScore, initialComment]);

  const handleSubmit = () => {
    onSubmit(score, comment);
    setShowSparkle(true);
    setConfirmed(true);
    setTimeout(() => setShowSparkle(false), 800);
  };

  return (
    <div className="relative w-full max-w-md mx-auto animate-fade-in-up">
      {/* Sparkle Effect */}
      {showSparkle && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
          {[...Array(8)].map((_, i) => (
            <span
              key={i}
              className="sparkle-effect absolute text-2xl"
              style={{
                left: `${30 + Math.random() * 40}%`,
                top: `${20 + Math.random() * 40}%`,
                animationDelay: `${i * 0.05}s`,
              }}
            >
              ✨
            </span>
          ))}
        </div>
      )}

      <div
        className={`rounded-2xl bg-bg-card border-2 p-6 transition-all ${
          confirmed ? 'border-gold animate-score-confirm' : isScored ? 'border-success/40' : 'border-white/10'
        }`}
      >
        {/* Order Label */}
        {orderLabel && (
          <div className="text-text-secondary text-sm mb-1 text-center">{orderLabel}</div>
        )}

        {/* Performer Name */}
        <h2 className="text-2xl font-bold text-center mb-6">{performerName}</h2>

        {/* Score Display */}
        <div className="text-center mb-4">
          <span className="text-6xl font-black text-gold">{score}</span>
          <span className="text-xl text-text-secondary ml-1">点</span>
        </div>

        {/* Slider */}
        <div className="mb-4 px-2">
          <input
            type="range"
            min={0}
            max={100}
            value={score}
            onChange={(e) => setScore(Number(e.target.value))}
            className="score-slider w-full"
          />
          <div className="flex justify-between text-xs text-text-secondary mt-1">
            <span>0</span>
            <span>50</span>
            <span>100</span>
          </div>
        </div>

        {/* Fine-tune Buttons */}
        <div className="flex items-center justify-center gap-4 mb-6">
          <button
            onClick={() => setScore((s) => Math.max(0, s - 1))}
            className="w-12 h-12 rounded-full bg-bg-secondary border border-white/20 text-lg font-bold hover:bg-white/10 active:scale-90 transition-all"
          >
            -1
          </button>
          <span className="text-3xl font-bold text-gold w-16 text-center">{score}</span>
          <button
            onClick={() => setScore((s) => Math.min(100, s + 1))}
            className="w-12 h-12 rounded-full bg-bg-secondary border border-white/20 text-lg font-bold hover:bg-white/10 active:scale-90 transition-all"
          >
            +1
          </button>
        </div>

        {/* Comment */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="一言メモ（任意）"
            value={comment}
            onChange={(e) => setComment(e.target.value.slice(0, 50))}
            maxLength={50}
            className="w-full px-4 py-3 rounded-xl bg-bg-secondary border border-white/10 focus:border-gold focus:outline-none text-sm"
          />
          <div className="text-right text-xs text-text-secondary mt-1">{comment.length}/50</div>
        </div>

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          className={`w-full py-4 rounded-xl font-bold text-lg transition-all active:scale-[0.98] ${
            isScored
              ? 'bg-success/80 text-white hover:bg-success'
              : 'bg-gold text-black hover:bg-gold-dark'
          }`}
        >
          {isScored ? '✅ 採点を修正' : '🎯 採点する！'}
        </button>
      </div>
    </div>
  );
}
