'use client';

import { useState, useEffect, useCallback } from 'react';
import { BotTab } from './bot-tab';
import { KeyManager } from './key-manager';
import { BotConfig } from '@/lib/types';

export function DashboardClient() {
  const [bots, setBots] = useState<BotConfig[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  const fetchBots = useCallback(async () => {
    const res = await fetch('/api/bots', { cache: 'no-store' });
    const data = await res.json();
    setBots(data);
    if (data.length > 0 && !activeTabId) {
      setActiveTabId(data[0].id);
    }
  }, [activeTabId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchBots();
  }, [fetchBots]);

  const addBot = async () => {
    const res = await fetch('/api/bots', { method: 'POST', body: JSON.stringify({ name: 'New Node' }) });
    const { id } = await res.json();
    await fetchBots();
    setActiveTabId(id);
  };

  const deleteBot = async (id: string) => {
    await fetch(`/api/bots/${id}`, { method: 'DELETE' });
    if (activeTabId === id) setActiveTabId(bots[0]?.id || null);
    await fetchBots();
  };

  return (
    <div className="p-4 md:p-8 flex flex-col gap-6 h-full min-h-screen max-w-[1400px] mx-auto bg-zinc-950 text-zinc-50">
      <header className="flex justify-between items-center pb-4 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-zinc-100 rounded-md flex items-center justify-center font-bold text-xl text-zinc-900 shadow-sm">N</div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-100">Nexus Dashboard</h1>
            <p className="text-xs text-zinc-500">Node Management & Keys</p>
          </div>
        </div>
        <div className="hidden md:flex gap-6 items-center text-sm text-zinc-400">
          <div>Active Nodes: <span className="font-medium text-zinc-100">{bots.filter((b: any) => b.status === 'online').length}/{bots.length}</span></div>
          <div className="px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-full text-xs">SQLite Mounted</div>
        </div>
      </header>

      <main className="flex-1 grid grid-cols-1 xl:grid-cols-12 gap-6 h-full min-h-0">
        <aside className="xl:col-span-3 flex flex-col gap-3 overflow-hidden">
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Bot Instances</h3>
          <div className="flex flex-col gap-2 overflow-y-auto pr-2 custom-scrollbar">
            {bots.map((bot) => (
              <div 
                key={bot.id} 
                onClick={() => setActiveTabId(bot.id)}
                className={`cursor-pointer p-4 transition-all rounded-lg border ${activeTabId === bot.id ? 'bg-zinc-900 border-zinc-700 shadow-sm' : 'bg-transparent border-transparent hover:bg-zinc-900/50'}`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className={`font-semibold text-sm truncate pr-2 ${activeTabId === bot.id ? 'text-zinc-100' : 'text-zinc-300'}`}>{bot.name || 'Unnamed Bot'}</span>
                  <span className={`w-2 h-2 rounded-full ${(bot as any).status === 'online' ? 'bg-emerald-500' : 'bg-zinc-600'}`}></span>
                </div>
                <div className="text-xs text-zinc-500 truncate">{bot.model || bot.provider}</div>
              </div>
            ))}
            <button
              onClick={addBot}
              className="mt-2 py-3 border border-dashed border-zinc-800 text-zinc-500 rounded-lg text-sm hover:text-zinc-300 hover:border-zinc-600 hover:bg-zinc-900/50 transition-colors"
            >
              + Create Bot Instance
            </button>
          </div>
        </aside>

        <section className="xl:col-span-6 bg-zinc-900/40 border border-zinc-800/80 p-6 rounded-xl flex flex-col gap-6 shadow-sm">
          {bots.length === 0 ? (
            <div className="text-center py-12 text-zinc-500 flex items-center justify-center h-full">
              <p className="text-sm">No bot instances configured. Create one to get started.</p>
            </div>
          ) : (
            activeTabId && <BotTab key={activeTabId} bot={bots.find(b => b.id === activeTabId)!} onUpdate={fetchBots} onDelete={() => deleteBot(activeTabId)} />
          )}
        </section>

        <section className="xl:col-span-3 flex flex-col gap-4">
          <div className="bg-zinc-900/40 border border-zinc-800/80 p-5 rounded-xl flex-1 overflow-hidden flex flex-col shadow-sm">
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">Keys & Limits</h3>
            <KeyManager />
          </div>
        </section>
      </main>
    </div>
  );
}
