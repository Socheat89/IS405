import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { LanguageProvider } from './context/LanguageContext';

// Navigation & Common Components
import { Navbar } from './components/layout/Navbar';
import { AppLauncherModal } from './components/layout/AppLauncherModal';

// Auth Flow Pages
import { LoginPage } from './pages/auth/LoginPage';
import { SetupTwoFactorPage } from './pages/auth/SetupTwoFactorPage';
import { VerifyTwoFactorPage } from './pages/auth/VerifyTwoFactorPage';
import { SetPasswordPage } from './pages/auth/SetPasswordPage';

// Microservices Module Pages (each module has its own sub-navigation)
import { DashboardPage }    from './pages/dashboard/DashboardPage';
import { StockModule }      from './pages/stock/index';
import { PurchaseModule }   from './pages/po/index';
import { SalesModule }      from './pages/sales/index';
import { UserListPage }     from './pages/users/UserListPage';
import { RoleListPage }     from './pages/roles/RoleListPage';
import { Security2FAPage }  from './pages/security/Security2FAPage';
import { SystemSettingsPage } from './pages/settings/SystemSettingsPage';
import { ForbiddenPage }    from './pages/common/ForbiddenPage';


const getInitialApp = () => {
  const hash = window.location.hash.replace(/^#\/?/, '').trim();
  if (hash.startsWith('set-password')) return 'set-password';
  if (hash) return hash;
  return localStorage.getItem('is405_active_app') || 'dashboard';
};

const MainApp = () => {
  const { authStep, canAccessApp } = useAuth();
  const [activeApp, setActiveApp] = useState(getInitialApp);
  const [previousApp, setPreviousApp] = useState('dashboard');
  const [launcherOpen, setLauncherOpen] = useState(false);

  const navigateToApp = (nextApp) => {
    if (nextApp !== activeApp) {
      setPreviousApp(activeApp);
      setActiveApp(nextApp);
      localStorage.setItem('is405_active_app', nextApp);
      window.location.hash = nextApp;
    }
  };

  // Sync with browser URL hash change (Back/Forward buttons)
  React.useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace(/^#\/?/, '').trim();
      if (hash && hash !== activeApp) {
        setActiveApp(hash);
        localStorage.setItem('is405_active_app', hash);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [activeApp]);

  // Ensure hash matches active app on load
  React.useEffect(() => {
    if (authStep === 'AUTHENTICATED' && activeApp) {
      localStorage.setItem('is405_active_app', activeApp);
      if (window.location.hash.replace(/^#\/?/, '') !== activeApp) {
        window.location.hash = activeApp;
      }
    }
  }, [activeApp, authStep]);

  // Set Password from Invitation Link route
  if (activeApp?.startsWith('set-password') || window.location.hash.includes('set-password')) {
    return <SetPasswordPage onNavigateLogin={() => navigateToApp('dashboard')} />;
  }

  // Auth Flow Router according to Backend requirements
  if (authStep === 'LOGIN') {
    return <LoginPage />;
  }

  // MANDATORY REQUIRED FLOW: User First Login MUST setup 2FA first before accessing the app!
  if (authStep === 'SETUP_2FA') {
    return <SetupTwoFactorPage />;
  }

  // Verification challenge for existing 2FA users
  if (authStep === 'VERIFY_2FA') {
    return <VerifyTwoFactorPage />;
  }

  // Security Route Guard
  const isAuthorized = canAccessApp(activeApp);

  if (!isAuthorized) {
    return (
      <ForbiddenPage
        code={activeApp}
        onReturnDashboard={() => navigateToApp('dashboard')}
        onGoBack={() => navigateToApp(previousApp === activeApp ? 'dashboard' : previousApp)}
      />
    );
  }

  // Main Authenticated Dashboard Layout
  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col font-sans">
      {/* Top Navbar */}
      <Navbar
        activeApp={activeApp}
        setActiveApp={navigateToApp}
        onOpenLauncher={() => setLauncherOpen(true)}
      />

      {/* Main Microservices View Switcher */}
      <main className="flex-1">
        {activeApp === 'dashboard' && (
          <DashboardPage
            setActiveApp={navigateToApp}
            onOpenLauncher={() => setLauncherOpen(true)}
          />
        )}
        {activeApp === 'stock'    && <StockModule onNavigateApp={navigateToApp} />}
        {activeApp === 'po'       && <PurchaseModule onNavigateApp={navigateToApp} />}
        {activeApp === 'sales'    && <SalesModule onNavigateApp={navigateToApp} />}
        {activeApp === 'users' && <UserListPage />}
        {activeApp === 'roles' && <RoleListPage />}
        {activeApp === 'security' && <Security2FAPage />}
        {activeApp === 'settings' && <SystemSettingsPage />}
      </main>

      {/* App Launcher Modal */}
      <AppLauncherModal
        isOpen={launcherOpen}
        onClose={() => setLauncherOpen(false)}
        activeApp={activeApp}
        setActiveApp={navigateToApp}
      />
    </div>
  );
};

export default function App() {
  return (
    <LanguageProvider>
      <ToastProvider>
        <AuthProvider>
          <MainApp />
        </AuthProvider>
      </ToastProvider>
    </LanguageProvider>
  );
}
