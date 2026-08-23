import React, { useEffect, useState } from 'react';
import { Shield, Play, Cpu, Eye, RefreshCw, Terminal, Copy, Check, X, ZoomIn, Trash2, ChevronDown, ChevronRight } from 'lucide-react';

interface AgentLog {
  timestamp: string;
  stage: 'capture' | 'redact' | 'server' | 'execution' | 'error' | 'success';
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
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [expandedLogIdx, setExpandedLogIdx] = useState<number | null>(null);

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

  const handleCopyLogs = () => {
    const formattedLogs = state.logs.map((log) => {
      let str = `[${log.timestamp}] [${log.stage.toUpperCase()}] ${log.message}`;
      if (log.details) {
        str += `\n  Details: ${JSON.stringify(log.details, null, 2)}`;
      }
      return str;
    }).join('\n\n');

    const header = `=== MakarDhwaj Runtime Log Export ===\nTime: ${new Date().toISOString()}\nGoal: "${state.userGoal}"\nMode: ${state.redactionMode}\nStats: PII Redacted=${state.stats.redactedCount}, WASM=${state.stats.wasmUsed}, RedactTime=${state.stats.redactTimeMs}ms, ServerTime=${state.stats.serverTimeMs}ms\n\n`;

    navigator.clipboard.writeText(header + formattedLogs).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleClearLogs = () => {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({ action: 'CLEAR_LOGS' });
      setState((prev) => ({ ...prev, logs: [] }));
    }
  };

  return (
    <div className="w-[380px] bg-black text-zinc-100 min-h-[530px] p-4 flex flex-col gap-3 font-sans text-xs border border-zinc-800 select-none relative">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-red-950/80 border border-red-600 flex items-center justify-center text-red-500 rounded">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-sm text-white tracking-wide flex items-center gap-1.5">
              <span>MakarDhwaj</span>
              <span className="text-[9px] px-1 py-0.2 bg-red-950 text-red-400 rounded border border-red-800 font-mono">AGENT</span>
            </div>
            <p className="text-[10px] text-zinc-400 leading-none">On-Device Privacy Perception</p>
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

      {/* Sanitized Frame Debug Preview (Expandable & High-Res) */}
      {state.lastSanitizedImage && (
        <div className="flex flex-col gap-1 bg-zinc-950 p-2 border border-zinc-800 rounded">
          <div className="flex items-center justify-between text-[10px] text-zinc-400 mb-1">
            <span className="flex items-center gap-1 font-medium text-zinc-300">
              <Eye className="w-3 h-3 text-red-500" /> Sanitized Viewport Frame
            </span>
            <button
              onClick={() => setIsImageModalOpen(true)}
              className="text-red-400 hover:text-red-300 font-mono text-[9px] flex items-center gap-1 border border-red-900/50 bg-red-950/40 px-1.5 py-0.5 rounded cursor-pointer"
            >
              <ZoomIn className="w-2.5 h-2.5" /> Enlarge
            </button>
          </div>
          <div 
            onClick={() => setIsImageModalOpen(true)}
            className="group relative border border-zinc-800 rounded overflow-hidden max-h-[110px] bg-black flex items-center justify-center cursor-pointer hover:border-red-600 transition-colors"
          >
            <img 
              src={state.lastSanitizedImage} 
              alt="Sanitized preview" 
              className="w-full object-contain group-hover:scale-[1.02] transition-transform duration-150" 
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[11px] font-medium transition-opacity gap-1">
              <ZoomIn className="w-3.5 h-3.5 text-red-500" />
              <span>Click to Expand High-Res</span>
            </div>
          </div>
        </div>
      )}

      {/* Live Log Console with Copy & Expandable Details */}
      <div className="flex-1 flex flex-col gap-1.5 pt-1">
        <div className="flex items-center justify-between text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
          <span className="flex items-center gap-1.5">
            <Terminal className="w-3 h-3 text-red-500" />
            <span>Execution Ledger</span>
          </span>
          <div className="flex items-center gap-1.5 lowercase">
            <button
              onClick={handleCopyLogs}
              disabled={state.logs.length === 0}
              className="flex items-center gap-1 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 text-zinc-300 hover:text-white px-2 py-0.5 rounded border border-zinc-800 cursor-pointer font-sans transition-colors"
              title="Copy all logs to clipboard"
            >
              {copied ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5 text-red-400" />}
              <span className="text-[9px] capitalize">{copied ? 'Copied!' : 'Copy Logs'}</span>
            </button>
            <button
              onClick={handleClearLogs}
              disabled={state.logs.length === 0}
              className="p-1 text-zinc-500 hover:text-red-400 transition-colors cursor-pointer"
              title="Clear logs"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
        
        <div className="bg-black border border-zinc-800 rounded p-2 h-[120px] overflow-y-auto font-mono text-[10px] flex flex-col gap-1">
          {state.logs.length === 0 ? (
            <div className="text-zinc-600 italic py-8 text-center">
              System ready. Enter goal and press Run.
            </div>
          ) : (
            state.logs.map((log, idx) => {
              const isExpanded = expandedLogIdx === idx;
              const hasDetails = log.details && Object.keys(log.details).length > 0;
              return (
                <div key={idx} className="flex flex-col border-b border-zinc-900/60 pb-1">
                  <div 
                    onClick={() => hasDetails && setExpandedLogIdx(isExpanded ? null : idx)}
                    className={`flex items-start gap-1.5 leading-tight ${hasDetails ? 'cursor-pointer hover:bg-zinc-950/80 p-0.5 rounded' : ''}`}
                  >
                    <span className="text-zinc-600 select-none text-[9px] shrink-0">[{log.timestamp}]</span>
                    <span className={`font-semibold text-[8.5px] px-1 rounded uppercase shrink-0 ${
                      log.stage === 'error' ? 'bg-red-950 text-red-400 border border-red-800' :
                      log.stage === 'success' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                      log.stage === 'redact' ? 'bg-zinc-900 text-red-400 border border-zinc-700' :
                      log.stage === 'server' ? 'bg-zinc-900 text-zinc-300 border border-zinc-700' : 
                      'bg-red-900/40 text-red-300 border border-red-700/50'
                    }`}>
                      {log.stage}
                    </span>
                    <span className="flex-1 text-zinc-300 break-all">{log.message}</span>
                    {hasDetails && (
                      <span className="text-zinc-600 shrink-0">
                        {isExpanded ? <ChevronDown className="w-2.5 h-2.5" /> : <ChevronRight className="w-2.5 h-2.5" />}
                      </span>
                    )}
                  </div>
                  {isExpanded && hasDetails && (
                    <pre className="mt-1 p-1.5 bg-zinc-950 border border-zinc-800 rounded text-[8.5px] text-zinc-400 overflow-x-auto whitespace-pre-wrap">
                      {JSON.stringify(log.details, null, 2)}
                    </pre>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* High-Resolution Expanded Image Lightbox Modal */}
      {isImageModalOpen && state.lastSanitizedImage && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm p-3 flex flex-col justify-between border border-red-600 animate-in fade-in duration-150">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-red-500" />
              <span className="font-bold text-xs text-white">Sanitized Screenshot (High-Res)</span>
            </div>
            <button
              onClick={() => setIsImageModalOpen(false)}
              className="p-1 rounded bg-zinc-900 hover:bg-red-600 text-zinc-300 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-auto my-2 border border-zinc-800 rounded bg-black flex items-center justify-center p-1">
            <img 
              src={state.lastSanitizedImage} 
              alt="High resolution sanitized frame" 
              className="max-h-[360px] w-full object-contain rounded" 
            />
          </div>

          <div className="flex items-center justify-between text-[10px] text-zinc-400 pt-1 border-t border-zinc-800">
            <span>Redacted Regions: <strong className="text-red-500 font-mono">{state.stats.redactedCount}</strong></span>
            <span>Filter Time: <strong className="text-white font-mono">{state.stats.redactTimeMs}ms</strong></span>
            <button
              onClick={() => setIsImageModalOpen(false)}
              className="bg-zinc-900 hover:bg-zinc-800 text-zinc-200 px-3 py-1 rounded text-[10px] border border-zinc-700 cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
