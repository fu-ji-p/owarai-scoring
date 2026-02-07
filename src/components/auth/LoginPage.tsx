import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';

export default function LoginPage() {
  const { users, login } = useAuth();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const selectedUser = users.find((u) => u.id === selectedUserId);

  const handlePinInput = (digit: string) => {
    if (pin.length >= 4) return;
    const newPin = pin + digit;
    setPin(newPin);
    setError('');

    if (newPin.length === 4) {
      handleLogin(newPin);
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setError('');
  };

  const handleLogin = async (pinValue: string) => {
    if (!selectedUserId) return;
    setIsLoading(true);
    setError('');

    const success = await login(selectedUserId, pinValue);
    if (!success) {
      setError('PINが違います');
      setPin('');
    }
    setIsLoading(false);
  };

  const handleBack = () => {
    setSelectedUserId(null);
    setPin('');
    setError('');
  };

  if (!selectedUserId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh px-4 py-8">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold mb-2">
            <span className="text-gold">🏆</span> お笑い採点
          </h1>
          <p className="text-text-secondary text-sm">あなたは誰ですか？</p>
        </div>

        <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
          {users.map((u) => (
            <button
              key={u.id}
              onClick={() => setSelectedUserId(u.id)}
              className="flex flex-col items-center justify-center p-6 rounded-2xl bg-bg-card hover:bg-bg-card-hover transition-all duration-200 active:scale-95 border border-white/10 hover:border-gold/40 min-h-[120px]"
            >
              <span className="text-5xl mb-3">{u.avatar_emoji}</span>
              <span className="text-lg font-medium">{u.name}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-dvh px-4 py-8">
      <button
        onClick={handleBack}
        className="absolute top-4 left-4 text-text-secondary hover:text-white p-2 text-lg"
      >
        ← 戻る
      </button>

      <div className="text-center mb-8">
        <span className="text-6xl mb-4 block">{selectedUser?.avatar_emoji}</span>
        <h2 className="text-2xl font-bold mb-2">{selectedUser?.name}</h2>
        <p className="text-text-secondary text-sm">4桁PINを入力してください</p>
      </div>

      <div className="flex gap-4 mb-6">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full transition-all duration-200 ${
              i < pin.length ? 'bg-gold scale-125' : 'bg-white/20'
            }`}
          />
        ))}
      </div>

      {error && (
        <p className="text-danger text-sm mb-4 animate-fade-in-up">{error}</p>
      )}

      <div className="grid grid-cols-3 gap-3 w-full max-w-[280px]">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
          <button
            key={num}
            onClick={() => handlePinInput(String(num))}
            disabled={isLoading}
            className="w-full aspect-square text-2xl font-bold rounded-xl bg-bg-card hover:bg-bg-card-hover active:bg-gold/20 active:scale-95 transition-all duration-150 border border-white/10 disabled:opacity-50"
          >
            {num}
          </button>
        ))}
        <div />
        <button
          onClick={() => handlePinInput('0')}
          disabled={isLoading}
          className="w-full aspect-square text-2xl font-bold rounded-xl bg-bg-card hover:bg-bg-card-hover active:bg-gold/20 active:scale-95 transition-all duration-150 border border-white/10 disabled:opacity-50"
        >
          0
        </button>
        <button
          onClick={handleBackspace}
          disabled={isLoading}
          className="w-full aspect-square text-xl rounded-xl bg-bg-card hover:bg-bg-card-hover active:scale-95 transition-all duration-150 border border-white/10 disabled:opacity-50 flex items-center justify-center"
        >
          ⌫
        </button>
      </div>

      {isLoading && (
        <div className="mt-6 text-text-secondary">ログイン中...</div>
      )}
    </div>
  );
}
