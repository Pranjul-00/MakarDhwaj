import React, { useEffect, useState } from 'react';
import { ShieldCheck, Play, Cpu, Eye, Activity, RefreshCw, Terminal, Layers } from 'lucide-react';

interface AgentLog {
  timestamp: string;
  stage: string;
  message: string;
  details?: any;
}

interface AgentSessionState {
  isProcessing: boolean;
  userGoal: string;
  redactionMode: 'blackout' | 'pixelate' | 'blur';
  serverUrl: string;
  logs: AgentLog[];
  lastAction?: any;
  lastSanitizedImage?: string;
  stats: {
    redactedCount: number;
    wasmUsed: boolean;
    redactTimeMs: number;
    serverTimeMs: number;
    totalTimeMs: number;
  };
}

export function App() {
  const [state, setState] = useState<AgentSessionState>({
    isProcessing: false,
    userGoal: 'Click the primary call-to-action button',
    redactionMode: 'blackout',
    serverUrl: 'http://localhost:8080/api/v1/analyze',
    logs: [],
    stats: {
      redactedCount: 0,
      wasmUsed: true,
      redactTimeMs: 0,
      serverTimeMs: 0,
      totalTimeMs: 0
    }
  });

  const [inputGoal, setInputGoal] = useState(state.userGoal);

  useEffect(() => {
    // Fetch initial background state
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({ action: 'GET_STATE' }, (res) => {
        if (res) {
          setState(res);
          setInputGoal(res.userGoal || '');
        }
      });

      const listener = (msg: any) => {
        if (msg.action === 'STATE_UPDATED' && msg.state) {
          setState(msg.state);
        }
      };
      chrome.runtime.onMessage.addListener(listener);
      return () => chrome.runtime.onMessage.removeListener(listener);
    }
  }, []);

  const handleStart = () => {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({ action: 'SET_GOAL', goal: inputGoal }, () => {
        chrome.runtime.sendMessage({ action: 'START_AGENT' });
      });
    }
  };

  const handleModeChange = (mode: 'blackout' | 'pixelate' | 'blur') => {
    setState((prev) => ({ ...prev, redactionMode: mode }));
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({ action: 'SET_MODE', mode });
    }
  };

  return (
    <div className="w-[390px] bg-slate-950 text-slate-100 min-h-[540px] p-4 flex flex-col gap-4 font-sans text-xs border border-slate-800">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-sm text-slate-100 tracking-tight">MakarDhwaj</h1>
            <p className="text-[10px] text-slate-400">On-Device WebGPU / WASM Perception</p>
          </div>
        </div>
        <div className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded-full border border-slate-800">
          <Cpu className={`w-3 h-3 ${state.stats.wasmUsed ? 'text-emerald-400' : 'text-amber-400'}`} />
          <span className="text-[9px] font-mono text-slate-300">
            {state.stats.wasmUsed ? 'WASM (Rust)' : 'Canvas2D'}
          </span>
        </div>
      </div>

      {/* Goal Input & Trigger */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
          User Agent Goal
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={inputGoal}
            onChange={(e) => setInputGoal(e.target.value)}
            placeholder="e.g., Click Submit Button"
            className="flex-1 bg-slate-900 border border-slate-800 rounded-md px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-indigo-500 text-xs"
          />
          <button
            onClick={handleStart}
            disabled={state.isProcessing}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors shadow-sm"
          >
            {state.isProcessing ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
            <span>{state.isProcessing ? 'Agent Active' : 'Run'}</span>
          </button>
        </div>
      </div>

      {/* Redaction Mode Switcher */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
          Local Redaction Filter
        </label>
        <div className="grid grid-cols-3 gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
          {(['blackout', 'pixelate', 'blur'] as const).map((m) => (
            <button
              key={m}
              onClick={() => handleModeChange(m)}
              className={`py-1 capitalize font-medium rounded text-[11px] transition-colors ${
                state.redactionMode === m
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Metrics & Performance KPI Card */}
      <div className="grid grid-cols-3 gap-2 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
        <div className="flex flex-col items-center">
          <span className="text-[9px] text-slate-400">PII Redacted</span>
          <span className="font-mono font-bold text-emerald-400 text-sm">{state.stats.redactedCount}</span>
        </div>
        <div className="flex flex-col items-center border-x border-slate-800">
          <span className="text-[9px] text-slate-400">Filter Latency</span>
          <span className="font-mono font-bold text-indigo-400 text-sm">{state.stats.redactTimeMs}ms</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-[9px] text-slate-400">Server Latency</span>
          <span className="font-mono font-bold text-amber-400 text-sm">{state.stats.serverTimeMs}ms</span>
        </div>
      </div>

      {/* Sanitized Frame Debug Preview */}
      {state.lastSanitizedImage && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span className="flex items-center gap-1"><Eye className="w-3 h-3 text-indigo-400" /> Sanitized Viewport Frame</span>
            <span className="text-emerald-400 font-mono">PII Censored</span>
          </div>
          <div className="border border-slate-800 rounded-lg overflow-hidden max-h-[110px] bg-black flex items-center justify-center">
            <img src={state.lastSanitizedImage} alt="Sanitized preview" className="w-full object-contain" />
          </div>
        </div>
      )}

      {/* Live Log Console */}
      <div className="flex-1 flex flex-col gap-1 border-t border-slate-800 pt-2">
        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-semibold uppercase">
          <Terminal className="w-3 h-3 text-slate-400" />
          <span>Execution Ledger</span>
        </div>
        <div className="bg-slate-900/90 border border-slate-800/80 rounded-md p-2 h-[100px] overflow-y-auto font-mono text-[10px] flex flex-col gap-1">
          {state.logs.length === 0 ? (
            <span className="text-slate-600 italic">No agent logs yet. Press Run to start.</span>
          ) : (
            state.logs.map((log, idx) => (
              <div key={idx} className="flex gap-1.5 text-slate-300">
                <span className="text-slate-500 select-none">[{log.timestamp}]</span>
                <span className={`font-semibold ${
                  log.stage === 'error' ? 'text-rose-400' :
                  log.stage === 'redact' ? 'text-emerald-400' :
                  log.stage === 'server' ? 'text-amber-400' : 'text-indigo-400'
                }`}>
                  [{log.stage}]
                </span>
                <span className="flex-1 truncate">{log.message}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
