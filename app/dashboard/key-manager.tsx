'use client';

import { useState, useEffect, useCallback } from 'react';
import { RedeemKey } from '@/lib/types';
import { Check, Copy, Trash2 } from 'lucide-react';

export function KeyManager() {
  const [keys, setKeys] = useState<RedeemKey[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [label, setLabel] = useState('');
  const [rpm, setRpm] = useState(20);
  const [rpd, setRpd] = useState(500);
  const [isCreating, setIsCreating] = useState(false);

  const fetchKeys = useCallback(async () => {
    const res = await fetch('/api/keys');
    const data = await res.json();
    setKeys(data);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchKeys();
  }, [fetchKeys]);

  const generateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('/api/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label, rpm, rpd, max_tokens: 100000 })
    });
    setLabel('');
    setIsCreating(false);
    fetchKeys();
  };

  const deleteKey = async (id: string) => {
    await fetch(`/api/keys/${id}`, { method: 'DELETE' });
    fetchKeys();
  };

  const copyKey = (keyString: string, id: string) => {
    navigator.clipboard.writeText(keyString);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-2 pb-2">
        {keys.length === 0 && !isCreating && (
          <div className="text-center py-6 text-zinc-500 text-xs">
            No active keys
          </div>
        )}
        
        {keys.map(key => (
          <div key={key.id} className="p-3 bg-zinc-950/50 border border-zinc-800/60 rounded-lg group flex flex-col gap-2 transition-colors hover:bg-zinc-900/50">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-xs font-semibold text-zinc-300 mb-0.5">{key.label || 'KEY'}</div>
                <div className="text-xs font-mono text-zinc-400 truncate max-w-[140px] xs:max-w-[180px] sm:max-w-[200px] xl:max-w-[160px]">{key.key_string}</div>
              </div>
              <div className="flex gap-1 opacity-100 xl:opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => copyKey(key.key_string, key.id)} className="p-1.5 bg-zinc-800 rounded-md hover:bg-zinc-700 text-zinc-300 transition-colors">
                  {copiedId === key.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
                <button onClick={() => deleteKey(key.id)} className="p-1.5 bg-zinc-800 rounded-md hover:bg-rose-900/50 text-rose-400 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            
            <div className="space-y-1.5 text-zinc-500 text-xs mt-1">
              <div className="flex justify-between items-center">
                <span>RPM LIMIT</span>
                <span className="text-zinc-300 font-medium">{key.rpm}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>RPD LIMIT</span>
                <span className="text-zinc-300 font-medium">{key.rpd}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {isCreating ? (
        <form onSubmit={generateKey} className="mt-3 p-3 bg-zinc-950/50 border border-zinc-800 rounded-lg space-y-3">
          <input 
            required value={label} onChange={e => setLabel(e.target.value)} 
            placeholder="Label (e.g. Server 1)" 
            className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-zinc-200 text-xs outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 transition-colors placeholder:text-zinc-600" 
          />
          <div className="flex gap-2">
            <input 
              type="number" required value={rpm} onChange={e => setRpm(Number(e.target.value))} 
              placeholder="RPM" title="RPM"
              className="w-1/2 bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-zinc-200 text-xs outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 transition-colors placeholder:text-zinc-600" 
            />
            <input 
              type="number" required value={rpd} onChange={e => setRpd(Number(e.target.value))} 
              placeholder="RPD" title="RPD"
              className="w-1/2 bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-zinc-200 text-xs outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 transition-colors placeholder:text-zinc-600" 
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setIsCreating(false)} className="flex-1 py-2 bg-transparent hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 rounded-md text-xs font-semibold transition-colors">Cancel</button>
            <button type="submit" className="flex-[2] py-2 bg-zinc-100 text-zinc-900 rounded-md text-xs font-semibold hover:bg-zinc-200 transition-colors">Generate</button>
          </div>
        </form>
      ) : (
        <button 
          onClick={() => setIsCreating(true)}
          className="mt-3 w-full py-2.5 bg-zinc-900/50 border border-dashed border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 hover:border-zinc-600 transition-colors text-sm font-medium rounded-lg"
        >
          + Create New Key
        </button>
      )}
    </div>
  );
}
