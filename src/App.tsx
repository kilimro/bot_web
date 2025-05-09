import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';

import LoginPage from './pages/LoginPage';
import MainLayout from './components/Layout/MainLayout';
import Dashboard from './pages/Dashboard';
import BotsPage from './pages/BotsPage';
import BotDetailPage from './pages/BotDetailPage';
import KeywordRepliesPage from './pages/KeywordRepliesPage';
import PluginsPage from './pages/PluginsPage';
import AiModelPage from './pages/AiModelPage';
import FriendsPage from './pages/FriendsPage';
import MomentsPage from './pages/MomentsPage';
import AuthKeysPage from './pages/AuthKeysPage';
import MonitoringPage from './pages/MonitoringPage';
import SettingsPage from './pages/SettingsPage';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          
          <Route path="/" element={<MainLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="bots" element={<BotsPage />} />
            <Route path="bots/:id" element={<BotDetailPage />} />
            <Route path="bots/keyword-replies" element={<KeywordRepliesPage />} />
            <Route path="bots/plugins" element={<PluginsPage />} />
            <Route path="bots/ai-model" element={<AiModelPage />} />
            <Route path="bots/friends" element={<FriendsPage />} />
            <Route path="bots/moments" element={<MomentsPage />} />
            <Route path="auth-keys" element={<AuthKeysPage />} />
            <Route path="monitoring" element={<MonitoringPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
          
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App