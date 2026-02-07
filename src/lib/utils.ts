/**
 * 4桁PINをハッシュ化（簡易認証用なのでSHA-256で十分）
 */
export async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * ネタバレ防止用: 決定論的ランダム順を生成
 * userId + competitionId + roundId のハッシュからシードを作り、リロードしても同じ順番になる
 */
export function deterministicShuffle<T>(
  items: T[],
  seed: string
): T[] {
  const arr = [...items];
  // Simple seeded PRNG (xorshift32)
  let s = 0;
  for (let i = 0; i < seed.length; i++) {
    s = ((s << 5) - s + seed.charCodeAt(i)) | 0;
  }
  const random = () => {
    s ^= s << 13;
    s ^= s >> 17;
    s ^= s << 5;
    return ((s >>> 0) / 4294967296);
  };
  // Fisher-Yates shuffle with seeded random
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * 五十音順と同じかチェック（ネタバレ防止で五十音順を避けるため）
 */
export function isGojuonOrder(names: string[]): boolean {
  const sorted = [...names].sort((a, b) => a.localeCompare(b, 'ja'));
  return names.every((name, i) => name === sorted[i]);
}

/**
 * 標準偏差を計算
 */
export function standardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
  return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length);
}

/**
 * ピアソン相関係数を計算
 */
export function pearsonCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length === 0) return 0;
  const n = x.length;
  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let denX = 0;
  let denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const den = Math.sqrt(denX * denY);
  return den === 0 ? 0 : num / den;
}

/**
 * 日付を表示用フォーマットに変換
 */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

/**
 * localStorageのヘルパー
 */
export const storage = {
  getUser: (): { id: string; name: string; avatar_emoji: string; is_admin: boolean } | null => {
    const data = localStorage.getItem('owarai_user');
    return data ? JSON.parse(data) : null;
  },
  setUser: (user: { id: string; name: string; avatar_emoji: string; is_admin: boolean }) => {
    localStorage.setItem('owarai_user', JSON.stringify(user));
  },
  clearUser: () => {
    localStorage.removeItem('owarai_user');
  },
};
