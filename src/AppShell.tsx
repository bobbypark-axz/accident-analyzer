import { useState } from 'react';
import { App } from './App';
import CommunityPage from './community/CommunityPage';
import { trackEvent } from './lib/analytics';

export default function AppShell() {
  const [activeTab, setActiveTab] = useState<'analysis' | 'community'>('analysis');
  const [refreshKey, setRefreshKey] = useState(0);

  const goToCommunity = () => {
    setRefreshKey(k => k + 1);
    setActiveTab('community');
  };

  const tabs = [
    { key: 'analysis' as const, icon: 'search', label: '분석' },
    { key: 'community' as const, icon: 'forum', label: '커뮤니티' },
  ];

  return (
    <div>
      <div style={{ display: activeTab === 'analysis' ? 'block' : 'none' }}>
        <App bottomOffset={100} onNavigateToCommunity={goToCommunity} />
      </div>
      <div style={{ display: activeTab === 'community' ? 'block' : 'none' }}>
        <CommunityPage key={refreshKey} />
      </div>

      {/* 플로팅 캡슐 탭바 */}
      <div style={{
        position: 'fixed',
        bottom: 'max(env(safe-area-inset-bottom), 16px)',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 50,
      }}>
        <div style={{
          display: 'flex',
          gap: 3,
          padding: 3,
          borderRadius: 20,
          background: 'linear-gradient(135deg, #1E3A5F 0%, #1a2d4a 100%)',
          backdropFilter: 'saturate(180%) blur(20px)',
          WebkitBackdropFilter: 'saturate(180%) blur(20px)',
          boxShadow: '0 4px 24px rgba(30,58,95,0.35), 0 0 0 0.5px rgba(49,130,246,0.15) inset',
        }}>
          {tabs.map(tab => {
            const isActive = activeTab === tab.key;
            return (
              <button key={tab.key}
                onClick={() => { trackEvent('tab_switch', { tab: tab.key }); setActiveTab(tab.key); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '8px 16px',
                  borderRadius: 17,
                  border: 'none',
                  cursor: 'pointer',
                  background: isActive ? '#3182F6' : 'transparent',
                  transition: 'all 0.25s ease',
                  WebkitTapHighlightColor: 'transparent',
                }}>
                <span className={`material-symbols-rounded ${isActive ? 'icon-filled' : ''}`}
                  style={{ fontSize: 18, color: isActive ? '#fff' : 'rgba(255,255,255,0.35)', transition: 'color 0.25s' }}>
                  {tab.icon}
                </span>
                <span style={{ fontSize: 12, fontWeight: isActive ? 600 : 400, color: isActive ? '#fff' : 'rgba(255,255,255,0.35)', letterSpacing: -0.3, transition: 'all 0.25s' }}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
