import React, { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";
import {
  Settings,
  Play,
  Pause,
  Download,
  Upload,
  Trash2,
  ShieldAlert,
} from "lucide-react";

const SOCKET_URL = "http://localhost:3001";
const MAX_LOG_LINES = 250;

interface MidiMessageLog {
  time: number;
  type: string;
  msg: any;
  isBlocked: boolean;
}

interface BlockedCC {
  cc: number;
  channel: number | "all";
}

interface AppState {
  inputs: string[];
  activeInput: string | null;
  blockedCCs: BlockedCC[];
}

function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [state, setState] = useState<AppState>({
    inputs: [],
    activeInput: null,
    blockedCCs: [],
  });
  const [logs, setLogs] = useState<MidiMessageLog[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [ccInput, setCcInput] = useState("");
  const [channelInput, setChannelInput] = useState<number | "all">("all");

  const logsRef = useRef<MidiMessageLog[]>([]);
  const isPausedRef = useRef(isPaused);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);

    newSocket.on("state", (newState: AppState) => {
      setState(newState);
      localStorage.setItem(
        "ohmProxySettings",
        JSON.stringify({
          activeInput: newState.activeInput,
          blockedCCs: newState.blockedCCs,
        }),
      );
    });

    newSocket.on("midiMessage", (log: MidiMessageLog) => {
      if (isPausedRef.current) return;

      logsRef.current = [log, ...logsRef.current].slice(0, MAX_LOG_LINES);
      setLogs([...logsRef.current]);
    });

    newSocket.on("connect", () => {
      newSocket.emit("refreshPorts");
      setTimeout(() => {
        const saved = localStorage.getItem("ohmProxySettings");
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (parsed.blockedCCs && parsed.blockedCCs.length > 0) {
              // Map backward compatible structure
              const mappedCCs =
                typeof parsed.blockedCCs[0] === "number"
                  ? parsed.blockedCCs.map((c: number) => ({
                      cc: c,
                      channel: "all",
                    }))
                  : parsed.blockedCCs;
              newSocket.emit("setBlockedCCs", mappedCCs);
            }
            if (parsed.activeInput) {
              newSocket.emit("selectInput", parsed.activeInput);
            }
          } catch (e) {}
        }
      }, 500);
    });

    return () => {
      newSocket.close();
    };
  }, []);

  const handleAddCC = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseInt(ccInput, 10);
    if (!isNaN(val) && val >= 0 && val <= 127) {
      if (
        !state.blockedCCs.find(
          (rule) => rule.cc === val && rule.channel === channelInput,
        )
      ) {
        socket?.emit("setBlockedCCs", [
          ...state.blockedCCs,
          { cc: val, channel: channelInput },
        ]);
      }
      setCcInput("");
    }
  };

  const handleRemoveCC = (ruleToRemove: BlockedCC) => {
    socket?.emit(
      "setBlockedCCs",
      state.blockedCCs.filter(
        (rule) =>
          !(
            rule.cc === ruleToRemove.cc && rule.channel === ruleToRemove.channel
          ),
      ),
    );
  };

  const handleSelectInput = (e: React.ChangeEvent<HTMLSelectElement>) => {
    socket?.emit("selectInput", e.target.value);
  };

  const triggerExport = () => {
    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(state));
    const dlAnchorElem = document.createElement("a");
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", "ohm-proxy-settings.json");
    dlAnchorElem.click();
  };

  const triggerImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.blockedCCs) socket?.emit("setBlockedCCs", parsed.blockedCCs);
        if (parsed.activeInput) socket?.emit("selectInput", parsed.activeInput);
      } catch (err) {
        alert("Invalid JSON file");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-8 h-8 text-indigo-400" />
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">
              Ohm MIDI Proxy
            </h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={triggerExport}
              className="flex gap-2 items-center px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-md transition-colors text-sm font-medium"
            >
              <Download size={16} /> Export
            </button>
            <label className="flex gap-2 items-center px-4 py-2 bg-gray-800 hover:bg-gray-700 cursor-pointer rounded-md transition-colors text-sm font-medium">
              <Upload size={16} /> Import
              <input
                type="file"
                accept=".json"
                className="hidden"
                onChange={triggerImport}
              />
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1 space-y-6">
            <div className="bg-gray-800 p-5 rounded-xl shadow-lg border border-gray-700">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Settings size={20} className="text-indigo-400" /> Connection
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    Input Device
                  </label>
                  <select
                    value={state.activeInput || ""}
                    onChange={handleSelectInput}
                    className="w-full bg-gray-900 border border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">-- Select MIDI Input --</option>
                    {state.inputs.map((input) => (
                      <option key={input} value={input}>
                        {input}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    Output Device
                  </label>
                  <div className="w-full bg-gray-900 border border-gray-600 rounded-md px-3 py-2 text-sm text-gray-500">
                    Ohm Proxy (Virtual Port)
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Select "Ohm Proxy" as the input inside Ableton.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gray-800 p-5 rounded-xl shadow-lg border border-gray-700">
              <h2 className="text-lg font-semibold mb-4 text-orange-400">
                Blocked CC Messages
              </h2>

              <form onSubmit={handleAddCC} className="flex gap-2 mb-4">
                <input
                  type="number"
                  min="0"
                  max="127"
                  placeholder="CC#"
                  value={ccInput}
                  onChange={(e) => setCcInput(e.target.value)}
                  className="w-1/3 bg-gray-900 border border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
                />
                <select
                  value={channelInput}
                  onChange={(e) =>
                    setChannelInput(
                      e.target.value === "all"
                        ? "all"
                        : parseInt(e.target.value, 10),
                    )
                  }
                  className="w-1/3 bg-gray-900 border border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
                >
                  <option value="all">Ch: All</option>
                  {Array.from({ length: 16 }, (_, i) => (
                    <option key={i} value={i}>
                      Ch: {i + 1}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-md font-medium transition-colors"
                >
                  Add
                </button>
              </form>

              <div className="flex flex-wrap gap-2">
                {state.blockedCCs.length === 0 && (
                  <span className="text-sm text-gray-500">No CCs blocked.</span>
                )}
                {state.blockedCCs.map((rule, idx) => (
                  <div
                    key={`${rule.cc}-${rule.channel}-${idx}`}
                    className="flex items-center gap-2 bg-gray-900 border border-gray-700 px-3 py-1.5 rounded-full text-sm"
                  >
                    <span>
                      CC <strong className="text-orange-400">#{rule.cc}</strong>
                    </span>
                    <span className="text-gray-500 text-xs">
                      (Ch: {rule.channel === "all" ? "All" : rule.channel + 1})
                    </span>
                    <button
                      onClick={() => handleRemoveCC(rule)}
                      className="text-gray-500 hover:text-red-400"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="md:col-span-2 bg-gray-800 rounded-xl shadow-lg border border-gray-700 flex flex-col h-[600px]">
            <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-800 rounded-t-xl">
              <h2 className="font-semibold text-gray-300">MIDI Activity Log</h2>
              <div className="flex gap-3 items-center">
                <button
                  onClick={() => setIsPaused(!isPaused)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    isPaused
                      ? "bg-indigo-500 hover:bg-indigo-600 text-white"
                      : "bg-gray-700 hover:bg-gray-600 text-gray-300"
                  }`}
                >
                  {isPaused ? <Play size={16} /> : <Pause size={16} />}
                  {isPaused ? "Resume" : "Pause"}
                </button>
                <button
                  onClick={() => {
                    setLogs([]);
                    logsRef.current = [];
                  }}
                  className="text-gray-400 hover:text-gray-200 text-sm px-2"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4 font-mono text-xs">
              {logs.length === 0 ? (
                <div className="h-full flex items-center justify-center text-gray-600 italic">
                  Waiting for MIDI messages...
                </div>
              ) : (
                <div className="space-y-1">
                  {logs.map((L, i) => (
                    <div
                      key={L.time + i.toString()}
                      className={`flex items-center gap-4 py-1 border-b border-gray-700/50 ${L.isBlocked ? "text-red-400" : "text-gray-300"}`}
                    >
                      <span className="text-gray-500 w-24 shrink-0">
                        {new Date(L.time)
                          .toISOString()
                          .split("T")[1]
                          .slice(0, -1)}
                      </span>
                      <span className="w-20 shrink-0 font-semibold">
                        {L.type.toUpperCase()}
                      </span>
                      <span className="flex-1 truncate text-gray-400">
                        {JSON.stringify(L.msg)}
                      </span>
                      {L.isBlocked && (
                        <span className="text-red-500 font-bold bg-red-500/10 px-2 py-0.5 rounded text-[10px]">
                          BLOCKED
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
