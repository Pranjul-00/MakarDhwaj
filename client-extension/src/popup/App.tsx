import React, { useEffect, useState } from 'react';
import { Shield, Play, Cpu, Eye, RefreshCw, Terminal } from 'lucide-react';

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
    <div className="w-[380px] bg-black text-zinc-100 min-h-[530px] p-4 flex flex-col gap-3 font-sans text-xs border border-zinc-800 select-none">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-red-950/80 border border-red-600 flex items-center justify-center text-red-500 rounded">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-sm text-white tracking-wide">MakarDhwaj</div>
            <p className="text-[10px] text-zinc-400 leading-none">Privacy Perception Agent</p>
          </div>
        </div>
        
        <div className="flex items-center gap-1.5 bg-zinc-950 px-2 py-1 border border-zinc-800 rounded text-[10px] text-zinc-300">
          <Cpu className={`w-3 h-3 ${state.stats.wasmUsed ? 'text-red-500' : 'text-zinc-400'}`} />
          <span className="font-mono">{state.stats.wasmUsed ? 'Rust WASM' : 'Canvas2D'}</span>
        </div>
      </div>

      {/* Goal Input & Trigger */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-400">
          Agent Goal
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={inputGoal}
            onChange={(e) => setInputGoal(e.target.value)}
            placeholder="e.g. Click Submit Privacy Form"
            className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-100 text-xs focus:outline-none focus:border-red-600 transition-colors placeholder:text-zinc-600"
          />
          <button
            onClick={handleStart}
            disabled={state.isProcessing}
            className="bg-red-600 hover:bg-red-700 active:bg-red-800 disabled:opacity-50 text-white font-semibold px-3.5 py-1.5 rounded flex items-center gap-1.5 transition-colors cursor-pointer"
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
        <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-400">
          Redaction Mode
        </label>
        <div className="grid grid-cols-3 gap-1.5 bg-zinc-950 p-1 border border-zinc-800 rounded">
          {(['blackout', 'pixelate', 'blur'] as const).map((m) => (
            <button
              key={m}
              onClick={() => handleModeChange(m)}
              className={`py-1 capitalize font-medium rounded text-[11px] transition-colors cursor-pointer text-center ${
                state.redactionMode === m
                  ? 'bg-red-600 text-white font-semibold'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Metrics & Performance KPI Card */}
      <div className="grid grid-cols-3 gap-2 bg-zinc-950 p-2 border border-zinc-800 rounded">
        <div className="flex flex-col items-center justify-center p-1">
          <span className="text-[10px] text-zinc-400">PII Redacted</span>
          <span className="font-mono font-bold text-red-500 text-sm mt-0.5">{state.stats.redactedCount}</span>
        </div>
        <div className="flex flex-col items-center justify-center p-1 border-x border-zinc-800">
          <span className="text-[10px] text-zinc-400">Filter Time</span>
          <span className="font-mono font-bold text-white text-sm mt-0.5">{state.stats.redactTimeMs}ms</span>
        </div>
        <div className="flex flex-col items-center justify-center p-1">
          <span className="text-[10px] text-zinc-400">Server Time</span>
          <span className="font-mono font-bold text-zinc-300 text-sm mt-0.5">{state.stats.serverTimeMs}ms</span>
        </div>
      </div>

      {/* Sanitized Frame Debug Preview */}
      {state.lastSanitizedImage && (
        <div className="flex flex-col gap-1 bg-zinc-950 p-2 border border-zinc-800 rounded">
          <div className="flex items-center justify-between text-[10px] text-zinc-400 mb-1">
            <span className="flex items-center gap-1 font-medium text-zinc-300">
              <Eye className="w-3 h-3 text-red-500" /> Sanitized Viewport Frame
            </span>
            <span className="text-red-500 font-mono text-[9px] border border-red-900/50 bg-red-950/40 px-1 py-0.2 rounded">
              PII Redacted
            </span>
          </div>
          <div className="border border-zinc-800 rounded overflow-hidden max-h-[100px] bg-black flex items-center justify-center">
            <img src={state.lastSanitizedImage} alt="Sanitized preview" className="w-full object-contain" />
          </div>
        </div>
      )}

      {/* Live Log Console */}
      <div className="flex-1 flex flex-col gap-1 pt-1">
        <div className="flex items-center justify-between text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
          <span className="flex items-center gap-1.5">
            <Terminal className="w-3 h-3 text-red-500" />
            <span>Execution Log</span>
          </span>
          <span className="text-[9px] font-mono text-zinc-600">{state.logs.length} events</span>
        </div>
        <div className="bg-black border border-zinc-800 rounded p-2 h-[105px] overflow-y-auto font-mono text-[10px] flex flex-col gap-1">
          {state.logs.length === 0 ? (
            <div className="text-zinc-600 italic py-6 text-center">
              Ready. Enter goal and press Run.
            </div>
          ) : (
            state.logs.map((log, idx) => (
              <div key={idx} className="flex items-start gap-1.5 leading-tight">
                <span className="text-zinc-600 select-none text-[9px]">[{log.timestamp}]</span>
                <span className={`font-semibold text-[9px] px-1 rounded uppercase ${
                  log.stage === 'error' ? 'bg-red-950 text-red-400 border border-red-800' :
                  log.stage === 'redact' ? 'bg-zinc-900 text-red-400 border border-zinc-700' :
                  log.stage === 'server' ? 'bg-zinc-900 text-zinc-300 border border-zinc-700' : 
                  'bg-red-900/40 text-red-300 border border-red-700/50'
                }`}>
                  {log.stage}
                </span>
                <span className="flex-1 text-zinc-300 break-all">{log.message}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
