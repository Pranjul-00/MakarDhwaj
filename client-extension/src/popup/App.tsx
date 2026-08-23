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
    <div className="w-[380px] bg-[#09090b] text-[#f4f4f5] min-h-[530px] p-4 flex flex-col gap-3 font-sans text-xs border border-[#27272a] select-none relative">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#27272a]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-[#450a0a] border border-[#dc2626] flex items-center justify-center text-[#ef4444] rounded">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-sm text-white tracking-wide flex items-center gap-1.5">
              <span>MakarDhwaj</span>
              <span className="text-[9px] px-1 py-0.2 bg-[#450a0a] text-[#f87171] rounded border border-[#991b1b] font-mono">AGENT</span>
            </div>
            <p className="text-[10px] text-[#a1a1aa] leading-none">Privacy Perception Agent</p>
          </div>
        </div>
        
        <div className="flex items-center gap-1.5 bg-[#18181b] px-2 py-1 border border-[#27272a] rounded text-[10px] text-[#d4d4d8]">
          <Cpu className={`w-3 h-3 ${state.stats.wasmUsed ? 'text-[#ef4444]' : 'text-[#a1a1aa]'}`} />
          <span className="font-mono">{state.stats.wasmUsed ? 'Rust WASM' : 'Canvas2D'}</span>
        </div>
      </div>

      {/* Goal Input & Trigger */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] uppercase font-bold tracking-wider text-[#a1a1aa]">
          Agent Goal
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={inputGoal}
            onChange={(e) => setInputGoal(e.target.value)}
            placeholder="e.g. Click Submit Privacy Form"
            className="flex-1 bg-[#18181b] border border-[#3f3f46] rounded px-3 py-1.5 text-[#f4f4f5] text-xs focus:outline-none focus:border-[#dc2626] transition-colors placeholder:text-[#71717a]"
          />
          <button
            onClick={handleStart}
            disabled={state.isProcessing}
            className="bg-[#dc2626] hover:bg-[#b91c1c] active:bg-[#991b1b] disabled:opacity-50 text-white font-bold px-3.5 py-1.5 rounded flex items-center gap-1.5 transition-colors cursor-pointer"
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
        <label className="text-[10px] uppercase font-bold tracking-wider text-[#a1a1aa]">
          Redaction Mode
        </label>
        <div className="grid grid-cols-3 gap-1.5 bg-[#18181b] p-1 border border-[#27272a] rounded">
          {(['blackout', 'pixelate', 'blur'] as const).map((m) => (
            <button
              key={m}
              onClick={() => handleModeChange(m)}
              className={`py-1.5 capitalize font-medium rounded text-[11px] transition-colors cursor-pointer text-center ${
                state.redactionMode === m
                  ? 'bg-[#dc2626] text-white font-bold'
                  : 'text-[#a1a1aa] hover:text-white hover:bg-[#27272a]'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Metrics & Performance KPI Card */}
      <div className="grid grid-cols-3 gap-2 bg-[#18181b] p-2 border border-[#27272a] rounded">
        <div className="flex flex-col items-center justify-center p-1">
          <span className="text-[10px] text-[#a1a1aa]">PII Redacted</span>
          <span className="font-mono font-bold text-[#ef4444] text-sm mt-0.5">{state.stats.redactedCount}</span>
        </div>
        <div className="flex flex-col items-center justify-center p-1 border-x border-[#27272a]">
          <span className="text-[10px] text-[#a1a1aa]">Filter Time</span>
          <span className="font-mono font-bold text-white text-sm mt-0.5">{state.stats.redactTimeMs}ms</span>
        </div>
        <div className="flex flex-col items-center justify-center p-1">
          <span className="text-[10px] text-[#a1a1aa]">Server Time</span>
          <span className="font-mono font-bold text-[#d4d4d8] text-sm mt-0.5">{state.stats.serverTimeMs}ms</span>
        </div>
      </div>

      {/* Sanitized Frame Debug Preview (Expandable & High-Res) */}
      {state.lastSanitizedImage && (
        <div className="flex flex-col gap-1 bg-[#18181b] p-2 border border-[#27272a] rounded">
          <div className="flex items-center justify-between text-[10px] text-[#a1a1aa] mb-1">
            <span className="flex items-center gap-1 font-medium text-[#e4e4e7]">
              <Eye className="w-3 h-3 text-[#ef4444]" /> Sanitized Viewport Frame
            </span>
            <button
              onClick={() => setIsImageModalOpen(true)}
              className="text-[#ef4444] hover:text-[#f87171] font-mono text-[9px] flex items-center gap-1 border border-[#7f1d1d] bg-[#450a0a] px-1.5 py-0.5 rounded cursor-pointer"
            >
              <ZoomIn className="w-2.5 h-2.5" /> Enlarge
            </button>
          </div>
          <div 
            onClick={() => setIsImageModalOpen(true)}
            className="group relative border border-[#27272a] rounded overflow-hidden max-h-[110px] bg-black flex items-center justify-center cursor-pointer hover:border-[#dc2626] transition-colors"
          >
            <img 
              src={state.lastSanitizedImage} 
              alt="Sanitized preview" 
              className="w-full object-contain" 
            />
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[11px] font-medium transition-opacity gap-1">
              <ZoomIn className="w-3.5 h-3.5 text-[#ef4444]" />
              <span>Click to Expand</span>
            </div>
          </div>
        </div>
      )}

      {/* Live Log Console with Copy & Expandable Details */}
      <div className="flex-1 flex flex-col gap-1.5 pt-1">
        <div className="flex items-center justify-between text-[10px] text-[#a1a1aa] font-bold uppercase tracking-wider">
          <span className="flex items-center gap-1.5">
            <Terminal className="w-3 h-3 text-[#ef4444]" />
            <span>Execution Ledger</span>
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleCopyLogs}
              disabled={state.logs.length === 0}
              className="flex items-center gap-1 bg-[#18181b] hover:bg-[#27272a] disabled:opacity-40 text-[#d4d4d8] hover:text-white px-2 py-0.5 rounded border border-[#27272a] cursor-pointer font-sans transition-colors"
              title="Copy all logs to clipboard"
            >
              {copied ? <Check className="w-2.5 h-2.5 text-[#10b981]" /> : <Copy className="w-2.5 h-2.5 text-[#ef4444]" />}
              <span className="text-[9px] capitalize">{copied ? 'Copied!' : 'Copy Logs'}</span>
            </button>
            <button
              onClick={handleClearLogs}
              disabled={state.logs.length === 0}
              className="p-1 text-[#71717a] hover:text-[#ef4444] transition-colors cursor-pointer"
              title="Clear logs"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
        
        <div className="bg-black border border-[#27272a] rounded p-2 h-[120px] overflow-y-auto font-mono text-[10px] flex flex-col gap-1">
          {state.logs.length === 0 ? (
            <div className="text-[#52525b] italic py-8 text-center">
              System ready. Enter goal and press Run.
            </div>
          ) : (
            state.logs.map((log, idx) => {
              const isExpanded = expandedLogIdx === idx;
              const hasDetails = log.details && Object.keys(log.details).length > 0;
              return (
                <div key={idx} className="flex flex-col border-b border-[#18181b] pb-1">
                  <div 
                    onClick={() => hasDetails && setExpandedLogIdx(isExpanded ? null : idx)}
                    className={`flex items-start gap-1.5 leading-tight ${hasDetails ? 'cursor-pointer hover:bg-[#18181b] p-0.5 rounded' : ''}`}
                  >
                    <span className="text-[#52525b] select-none text-[9px] shrink-0">[{log.timestamp}]</span>
                    <span className={`font-semibold text-[8.5px] px-1 rounded uppercase shrink-0 ${
                      log.stage === 'error' ? 'bg-[#450a0a] text-[#f87171] border border-[#7f1d1d]' :
                      log.stage === 'success' ? 'bg-[#064e3b] text-[#34d399] border border-[#065f46]' :
                      log.stage === 'redact' ? 'bg-[#18181b] text-[#f87171] border border-[#3f3f46]' :
                      log.stage === 'server' ? 'bg-[#18181b] text-[#d4d4d8] border border-[#3f3f46]' : 
                      'bg-[#450a0a] text-[#fca5a5] border border-[#991b1b]'
                    }`}>
                      {log.stage}
                    </span>
                    <span className="flex-1 text-[#d4d4d8] break-all">{log.message}</span>
                    {hasDetails && (
                      <span className="text-[#71717a] shrink-0">
                        {isExpanded ? <ChevronDown className="w-2.5 h-2.5" /> : <ChevronRight className="w-2.5 h-2.5" />}
                      </span>
                    )}
                  </div>
                  {isExpanded && hasDetails && (
                    <pre className="mt-1 p-1.5 bg-[#18181b] border border-[#27272a] rounded text-[8.5px] text-[#a1a1aa] overflow-x-auto whitespace-pre-wrap">
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
        <div className="fixed inset-0 z-50 bg-black/95 p-3 flex flex-col justify-between border border-[#dc2626]">
          <div className="flex items-center justify-between pb-2 border-b border-[#27272a]">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-[#ef4444]" />
              <span className="font-bold text-xs text-white">Sanitized Frame (High-Res)</span>
            </div>
            <button
              onClick={() => setIsImageModalOpen(false)}
              className="p-1 rounded bg-[#18181b] hover:bg-[#dc2626] text-[#d4d4d8] hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-auto my-2 border border-[#27272a] rounded bg-black flex items-center justify-center p-1">
            <img 
              src={state.lastSanitizedImage} 
              alt="High resolution sanitized frame" 
              className="max-h-[360px] w-full object-contain rounded" 
            />
          </div>

          <div className="flex items-center justify-between text-[10px] text-[#a1a1aa] pt-1 border-t border-[#27272a]">
            <span>Redacted Regions: <strong className="text-[#ef4444] font-mono">{state.stats.redactedCount}</strong></span>
            <span>Filter Time: <strong className="text-white font-mono">{state.stats.redactTimeMs}ms</strong></span>
            <button
              onClick={() => setIsImageModalOpen(false)}
              className="bg-[#18181b] hover:bg-[#27272a] text-[#d4d4d8] px-3 py-1 rounded text-[10px] border border-[#3f3f46] cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
