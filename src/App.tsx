import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { SimulatorChat } from './components/SimulatorChat';
import { LeaderboardView } from './components/LeaderboardView';
import { MinigamesArcade } from './components/MinigamesArcade';
import { PenaltiesView } from './components/PenaltiesView';
import { SetupGuide } from './components/SetupGuide';
import { BotCodeExport } from './components/BotCodeExport';
import { BotLogs } from './components/BotLogs';
import { BotConfigModal } from './components/BotConfigModal';
import { BotState } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<'simulator' | 'leaderboard' | 'minigames' | 'penalties' | 'setup' | 'logs' | 'code'>('simulator');
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [botState, setBotState] = useState<BotState>({
    channelId: '1542084929171492955',
    eChannelId: '1542084929171492955',
    currentCount: 0,
    highestCount: 0,
    numberChannelId: '1542148410084171826',
    numberLeaderboardChannelId: '1542151072032755893',
    currentNumber: 0,
    highestNumber: 0,
    lastUserId: null,
    lastUsername: null,
    lastCountTimestamp: null,
    topPlayer: null,
    topNumberPlayer: null,
    leaderboard: {},
    numberLeaderboard: {},
    cooldowns: {},
    botStatus: 'simulated',
  });

  const fetchBotState = useCallback(async () => {
    try {
      const res = await fetch('/api/bot/state');
      if (res.ok) {
        const data = await res.json();
        setBotState(data);
      }
    } catch (err) {
      console.error('Failed to fetch bot state:', err);
    }
  }, []);

  useEffect(() => {
    fetchBotState();
    const interval = setInterval(fetchBotState, 3000);
    return () => clearInterval(interval);
  }, [fetchBotState]);

  return (
    <div className="min-h-screen bg-[#09090B] text-slate-200 font-sans antialiased flex flex-col selection:bg-emerald-500 selection:text-black">
      {/* Top Navigation & Bento Header */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        botState={botState}
        onOpenConfig={() => setIsConfigOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
        {activeTab === 'simulator' && (
          <SimulatorChat
            botState={botState}
            onRefreshState={fetchBotState}
          />
        )}

        {activeTab === 'leaderboard' && (
          <LeaderboardView
            botState={botState}
            onRefreshState={fetchBotState}
          />
        )}

        {activeTab === 'minigames' && (
          <MinigamesArcade
            botState={botState}
            onRefreshState={fetchBotState}
          />
        )}

        {activeTab === 'penalties' && (
          <PenaltiesView
            botState={botState}
            onRefreshState={fetchBotState}
          />
        )}

        {activeTab === 'setup' && (
          <SetupGuide
            botState={botState}
            onRefreshState={fetchBotState}
          />
        )}

        {activeTab === 'code' && (
          <BotCodeExport botState={botState} />
        )}

        {activeTab === 'logs' && (
          <BotLogs onRefreshState={fetchBotState} />
        )}
      </main>

      {/* Settings Modal */}
      <BotConfigModal
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        botState={botState}
        onRefreshState={fetchBotState}
      />
    </div>
  );
}
