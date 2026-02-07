import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import LoginPage from './components/auth/LoginPage';
import HomePage from './pages/HomePage';
import CreateCompetition from './components/admin/CreateCompetition';
import ManageCompetition from './components/admin/ManageCompetition';
import ViewingModeSelect from './components/scoring/ViewingModeSelect';
import ScoringPage from './components/scoring/ScoringPage';
import ResultsPage from './components/results/ResultsPage';

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-pulse">🏆</div>
          <div className="text-text-secondary">読み込み中...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/admin/create" element={<CreateCompetition />} />
      <Route path="/admin/competition/:id" element={<ManageCompetition />} />
      <Route path="/competition/:competitionId/mode" element={<ViewingModeSelect />} />
      <Route path="/competition/:competitionId/scoring" element={<ScoringPage />} />
      <Route path="/competition/:competitionId/results" element={<ResultsPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </HashRouter>
  );
}

export default App;
