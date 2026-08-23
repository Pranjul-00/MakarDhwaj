import React, { useEffect, useState } from 'react';
import { Shield, Play, Cpu, Eye, RefreshCw, Terminal, CheckCircle2, AlertCircle } from 'lucide-react';

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
    userGoal: 'Click Submit Privacy Form',
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
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({ action: 'GET_STATE' }, (res) => {
        if (res) {
          setState(res);
          setInputGoal(res.userGoal || 'Click Submit Privacy Form');
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
    <div className="w-[380px] bg-[#0b0f19] text-slate-100 min-h-[530px] p-4 flex flex-col gap-3.5 font-sans text-xs border border-slate-800/80 shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <div className="font-semibold text-sm text-slate-100 tracking-tight flex items-center gap-1.5">
              <span>MakarDhwaj</span>
              <span className="text-[10px] px-1.5 py-0.2 bg-indigo-500/20 text-indigo-300 rounded border border-indigo-500/30 font-mono">v1.0</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-none mt-0.5">Privacy Perception Agent</p>
          </div>
        </div>
        
        <div className="flex items-center gap-1.5 bg-slate-900/90 px-2.5 py-1 rounded-full border border-slate-800 text-[10px] text-slate-300">
          <Cpu className={`w-3 h-3 ${state.stats.wasmUsed ? 'text-emerald-400' : 'text-amber-400'}`} />
          <span className="font-mono">{state.stats.wasmUsed ? 'Rust WASM' : 'Canvas2D'}</span>
        </div>
      </div>

      {/* Goal Input & Trigger */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center justify-between">
          <span>Agent Goal</span>
          <span className="text-slate-500 normal-case font-normal">Active Tab Perception</span>
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={inputGoal}
            onChange={(e) => setInputGoal(e.target.value)}
            placeholder="e.g. Click Submit Privacy Form"
            className="flex-1 bg-slate-900/90 border border-slate-700/80 rounded-lg px-3 py-2 text-slate-100 text-xs focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-500"
          />
          <button
            onClick={handleStart}
            disabled={state.isProcessing}
            className="bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 text-white font-semibold px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
          >
            {state.isProcessing ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
            <span>{state.isProcessing ? 'Working' : 'Run'}</span>
          </button>
        </div>
      </div>

      {/* Redaction Mode Switcher */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
          Local Redaction Algorithm
        </label>
        <div className="grid grid-cols-3 gap-1.5 bg-slate-900/90 p-1 rounded-lg border border-slate-800">
          {(['blackout', 'pixelate', 'blur'] as const).map((m) => (
            <button
              key={m}
              onClick={() => handleModeChange(m)}
              className={`py-1.5 capitalize font-medium rounded-md text-[11px] transition-all cursor-pointer text-center ${
                state.redactionMode === m
                  ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Metrics & Performance KPI Card */}
      <div className="grid grid-cols-3 gap-2 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80">
        <div className="flex flex-col items-center justify-center p-1">
          <span className="text-[10px] text-slate-400">PII Redacted</span>
          <span className="font-mono font-bold text-emerald-400 text-sm mt-0.5">{state.stats.redactedCount}</span>
        </div>
        <div className="flex flex-col items-center justify-center p-1 border-x border-slate-800/80">
          <span className="text-[10px] text-slate-400">Filter Latency</span>
          <span className="font-mono font-bold text-indigo-400 text-sm mt-0.5">{state.stats.redactTimeMs}ms</span>
        </div>
        <div className="flex flex-col items-center justify-center p-1">
          <span className="text-[10px] text-slate-400">Server Latency</span>
          <span className="font-mono font-bold text-amber-400 text-sm mt-0.5">{state.stats.serverTimeMs}ms</span>
        </div>
      </div>

      {/* Sanitized Frame Debug Preview */}
      {state.lastSanitizedImage && (
        <div className="flex flex-col gap-1 bg-slate-900/50 p-2 rounded-xl border border-slate-800/80">
          <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
            <span className="flex items-center gap-1 font-medium text-slate-300">
              <Eye className="w-3 h-3 text-indigo-400" /> Sanitized Viewport Frame
            </span>
            <span className="text-emerald-400 font-mono text-[9px] bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
              PII Censored
            </span>
          </div>
          <div className="border border-slate-800 rounded-lg overflow-hidden max-h-[105px] bg-black flex items-center justify-center">
            <img src={state.lastSanitizedImage} alt="Sanitized preview" className="w-full object-contain" />
          </div>
        </div>
      )}

      {/* Live Log Console */}
      <div className="flex-1 flex flex-col gap-1.5 pt-1">
        <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider">
          <span className="flex items-center gap-1.5">
            <Terminal className="w-3 h-3 text-indigo-400" />
            <span>Execution Ledger</span>
          </span>
          <span className="text-[9px] font-mono text-slate-500">{state.logs.length} events</span>
        </div>
        <div className="bg-[#070b13] border border-slate-800/80 rounded-lg p-2 h-[105px] overflow-y-auto font-mono text-[10px] flex flex-col gap-1.5">
          {state.logs.length === 0 ? (
            <div className="text-slate-500 italic py-6 text-center">
              Agent ready. Enter goal and press Run.
            </div>
          ) : (
            state.logs.map((log, idx) => (
              <div key={idx} className="flex items-start gap-1.5 leading-tight text-slate-300">
                <span className="text-slate-600 select-none text-[9px]">{log.timestamp}</span>
                <span className={`font-semibold text-[9px] px-1 rounded uppercase ${
                  log.stage === 'error' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                  log.stage === 'redact' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                  log.stage === 'server' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 
                  'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                }`}>
                  {log.stage}
                </span>
                <span className="flex-1 text-slate-300 break-all">{log.message}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
