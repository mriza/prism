import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ConfigProvider, theme } from 'antd';
import { useAuth } from './contexts/AuthContext';
import { AppLayout } from './layouts/AppLayout';
import { AuthProvider } from './contexts/AuthContext';
import { AgentsProvider } from './contexts/AgentsContext';
import { AppConfigProvider } from './contexts/AppConfigContext';
import { DashboardPage } from './pages/DashboardPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { AccountsPage } from './pages/AccountsPage';
import { SettingsPage } from './pages/SettingsPage';
import { ServersPage } from './pages/ServersPage';
import { ProcessesPage } from './pages/ProcessesPage';
import { SecurityPage } from './pages/SecurityPage';
import { LoginPage } from './pages/LoginPage';
import { UsersPage } from './pages/UsersPage';
import { LogsPage } from './pages/LogsPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

function AppContent() {
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#1677ff',
          borderRadius: 8,
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        },
        components: {
          Layout: {
            headerBg: 'transparent',
            headerPadding: '0 24px',
          },
          Menu: {
            itemBg: 'transparent',
          }
        }
      }}
    >
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }>
          <Route index element={<DashboardPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="projects/:id" element={<ProjectDetailPage />} />
          <Route path="accounts" element={<AccountsPage />} />
          <Route path="servers" element={<ServersPage />} />
          <Route path="processes" element={<ProcessesPage />} />
          <Route path="security" element={<SecurityPage />} />
          <Route path="logs" element={<LogsPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </ConfigProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppConfigProvider>
        <AgentsProvider>
          <AppContent />
        </AgentsProvider>
      </AppConfigProvider>
    </AuthProvider>
  );
}

export default App;

