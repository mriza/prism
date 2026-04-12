import { useEffect, useMemo } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ConfigProvider, theme } from 'antd';
import { useAuth } from './contexts/AuthContext';
import { useTheme } from './contexts/ThemeContext';
import { AppLayout } from './layouts/AppLayout';
import { NewLayout } from './layouts/NewLayout';
import { AgentsProvider } from './contexts/AgentsContext';
import { AppConfigProvider } from './contexts/AppConfigContext';
import { DashboardPage } from './pages/DashboardPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { AccountsPage } from './pages/AccountsPage';
import { SettingsPage } from './pages/SettingsPage';
import { ServersPage } from './pages/ServersPage';
import { ApplicationsPage } from './pages/ApplicationsPage';
import { SecurityPage } from './pages/SecurityPage';
import { LoginPage } from './pages/LoginPage';
import { UsersPage } from './pages/UsersPage';
import { LogsPage } from './pages/LogsPage';
import { WebhooksPage } from './pages/WebhooksPage';
import { RolesPage } from './pages/RolesPage';
import { ConfigDriftPage } from './pages/ConfigDriftPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

function ThemeSync() {
  const { token } = theme.useToken();

  // Memoize specific token values to prevent unnecessary re-runs
  const cssVars = useMemo(() => ({
    primary: token.colorPrimary,
    borderRadius: token.borderRadius,
    borderRadiusLG: token.borderRadiusLG,
    borderRadiusSM: token.borderRadiusSM,
    colorBorder: token.colorBorder,
    colorBorderSecondary: token.colorBorderSecondary,
    colorFillAlter: token.colorFillAlter,
    colorBgLayout: token.colorBgLayout,
    fontSizeSM: token.fontSizeSM,
    fontSize: token.fontSize,
    colorSuccess: token.colorSuccess,
    colorError: token.colorError,
    colorWarning: token.colorWarning,
    colorInfo: token.colorInfo,
    marginLG: token.marginLG,
    paddingLG: token.paddingLG,
  }), [
    token.colorPrimary,
    token.borderRadius,
    token.borderRadiusLG,
    token.borderRadiusSM,
    token.colorBorder,
    token.colorBorderSecondary,
    token.colorFillAlter,
    token.colorBgLayout,
    token.fontSizeSM,
    token.fontSize,
    token.colorSuccess,
    token.colorError,
    token.colorWarning,
    token.colorInfo,
    token.marginLG,
    token.paddingLG,
  ]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--prism-primary-color', cssVars.primary);
    root.style.setProperty('--prism-border-radius', `${cssVars.borderRadius}px`);
    root.style.setProperty('--prism-border-radius-lg', `${cssVars.borderRadiusLG}px`);
    root.style.setProperty('--prism-border-radius-sm', `${cssVars.borderRadiusSM}px`);
    root.style.setProperty('--prism-color-border', cssVars.colorBorder);
    root.style.setProperty('--prism-color-border-secondary', cssVars.colorBorderSecondary);
    root.style.setProperty('--prism-color-fill-alter', cssVars.colorFillAlter);
    root.style.setProperty('--prism-color-bg-layout', cssVars.colorBgLayout);
    root.style.setProperty('--prism-font-size-sm', `${cssVars.fontSizeSM}px`);
    root.style.setProperty('--prism-font-size', `${cssVars.fontSize}px`);
    root.style.setProperty('--prism-color-success', cssVars.colorSuccess);
    root.style.setProperty('--prism-color-error', cssVars.colorError);
    root.style.setProperty('--prism-color-warning', cssVars.colorWarning);
    root.style.setProperty('--prism-color-info', cssVars.colorInfo);
    root.style.setProperty('--prism-margin-lg', `${cssVars.marginLG}px`);
    root.style.setProperty('--prism-padding-lg', `${cssVars.paddingLG}px`);
  }, [cssVars]);

  return null;
}

function ThemedApp() {
  const { themeConfig } = useTheme();

  return (
    <ConfigProvider theme={themeConfig}>
      <ThemeSync />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        
        {/* New Layout Route */}
        <Route element={
          <ProtectedRoute>
            <NewLayout />
          </ProtectedRoute>
        }>
          <Route index element={<DashboardPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="projects/:id" element={<ProjectDetailPage />} />
          <Route path="accounts" element={<AccountsPage />} />
          <Route path="applications" element={<ApplicationsPage />} />
          <Route path="servers" element={<ServersPage />} />
          <Route path="security" element={<SecurityPage />} />
          <Route path="logs" element={<LogsPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="webhooks" element={<WebhooksPage />} />
          <Route path="roles" element={<RolesPage />} />
          <Route path="config-drift" element={<ConfigDriftPage />} />
        </Route>

        {/* Legacy Layout Route (for backward compatibility) */}
        <Route path="/legacy" element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }>
          <Route path="dashboard" element={<DashboardPage />} />
        </Route>

        {/* Redirect unknown routes to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ConfigProvider>
  );
}

function App() {
  return (
    <AppConfigProvider>
      <AgentsProvider>
        <ThemedApp />
      </AgentsProvider>
    </AppConfigProvider>
  );
}

export default App;

