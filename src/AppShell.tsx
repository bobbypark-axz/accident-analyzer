import { useState } from 'react';
import { App } from './App';
import CommunityPage from './community/CommunityPage';
import { trackEvent } from './lib/analytics';

export default function AppShell() {
  // URL에 ?post=<id> 있으면 커뮤니티로 바로 진입
  const [initialPostId] = useState(() => new URLSearchParams(window.location.search).get('post'));
  const [activeTab, setActiveTab] = useState<'analysis' | 'community'>(initialPostId ? 'community' : 'analysis');
  const [refreshKey, setRefreshKey] = useState(0);
  const [hideTabBar, setHideTabBar] = useState(false);

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
        <App bottomOffset={100} onNavigateToCommunity={goToCommunity} onHideTabBar={setHideTabBar} />
      </div>
      <div style={{ display: activeTab === 'community' ? 'block' : 'none' }}>
        <CommunityPage key={refreshKey} onHideTabBar={setHideTabBar} />
      </div>

      {/* 플로팅 캡슐 탭바 */}
      <div style={{
        position: 'fixed',
        bottom: 'max(env(safe-area-inset-bottom), 20px)',
        left: '50%',
        transform: hideTabBar ? 'translateX(-50%) translateY(100px)' : 'translateX(-50%)',
        zIndex: 50,
        transition: 'transform 0.3s ease',
        pointerEvents: hideTabBar ? 'none' : 'auto',
      }}>
        <div style={{
          display: 'flex',
          gap: 4,
          padding: 5,
          borderRadius: 28,
          background: 'linear-gradient(135deg, #1E3A5F 0%, #1a2d4a 100%)',
          backdropFilter: 'saturate(180%) blur(20px)',
          WebkitBackdropFilter: 'saturate(180%) blur(20px)',
          boxShadow: '0 8px 32px rgba(30,58,95,0.4), 0 0 0 0.5px rgba(49,130,246,0.2) inset',
        }}>
          {tabs.map(tab => {
            const isActive = activeTab === tab.key;
            return (
              <button key={tab.key}
                onClick={() => { trackEvent('tab_switch', { tab: tab.key }); setActiveTab(tab.key); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '12px 24px',
                  borderRadius: 22,
                  border: 'none',
                  cursor: 'pointer',
                  background: isActive ? '#3182F6' : 'transparent',
                  transition: 'all 0.25s ease',
                  WebkitTapHighlightColor: 'transparent',
                }}>
                <span className={`material-symbols-rounded ${isActive ? 'icon-filled' : ''}`}
                  style={{ fontSize: 22, color: isActive ? '#fff' : 'rgba(255,255,255,0.5)', transition: 'color 0.25s' }}>
                  {tab.icon}
                </span>
                <span style={{ fontSize: 14, fontWeight: isActive ? 700 : 500, color: isActive ? '#fff' : 'rgba(255,255,255,0.5)', letterSpacing: -0.3, transition: 'all 0.25s' }}>
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
