import { useEffect, useMemo, useState } from 'react';
import ThreadView from './components/ThreadView';
import JsonViewer from './components/JsonViewer';
import PluginPanel from './components/PluginPanel';

interface ThreadSummary {
  id: string;
  name: string;
  participants: string[];
  lastActivity: number;
}

const apiBase = '/api';

function App() {
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [messages, setMessages] = useState<any[]>([]);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [plugins, setPlugins] = useState<any[]>([]);
  const [jsonMode, setJsonMode] = useState<'beautify' | 'raw'>('beautify');
  const [rawSource, setRawSource] = useState('');
  const [sourcePath, setSourcePath] = useState('App.tsx');
  const [sourceFiles, setSourceFiles] = useState<string[]>([]);
  const [status, setStatus] = useState('Ready');

  const selectedThread = useMemo(() => threads.find((thread) => thread.id === selected), [threads, selected]);

  useEffect(() => {
    refreshThreads();
    refreshPlugins();
    refreshSourceFiles();
  }, []);

  useEffect(() => {
    if (selected) {
      refreshThreadData(selected);
    }
  }, [selected]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (selected) refreshThreadData(selected);
    }, 8000);
    return () => clearInterval(timer);
  }, [selected]);

  const refreshThreads = async () => {
    try {
      setStatus('Loading threads...');
      const response = await fetch(`${apiBase}/threads`);
      setThreads(await response.json());
      setStatus('Threads loaded');
    } catch (error) {
      setStatus('Unable to load threads');
      console.error(error);
    }
  };

  const refreshThreadData = async (threadId: string) => {
    try {
      setStatus('Loading messages...');
      const [messageRes, attachmentRes] = await Promise.all([
        fetch(`${apiBase}/messages?threadId=${threadId}`),
        fetch(`${apiBase}/attachments?threadId=${threadId}`),
      ]);
      setMessages(await messageRes.json());
      setAttachments(await attachmentRes.json());
      setStatus(`Loaded ${messages.length} messages`);
    } catch (error) {
      setStatus('Unable to load thread data');
      console.error(error);
    }
  };

  const refreshPlugins = async () => {
    try {
      const response = await fetch(`${apiBase}/plugins`);
      setPlugins(await response.json());
    } catch (error) {
      console.error(error);
    }
  };

  const refreshSourceFiles = async () => {
    try {
      const response = await fetch(`${apiBase}/source/list`);
      setSourceFiles(await response.json());
    } catch (error) {
      console.error(error);
    }
  };

  const loadSource = async (file: string) => {
    try {
      const response = await fetch(`${apiBase}/source?path=${encodeURIComponent(file)}`);
      const body = await response.json();
      setSourcePath(file);
      setRawSource(body.code || '');
    } catch (error) {
      console.error(error);
    }
  };

  const saveSource = async () => {
    try {
      await fetch(`${apiBase}/source`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: sourcePath, code: rawSource }),
      });
      setStatus(`Saved ${sourcePath}`);
    } catch (error) {
      console.error(error);
      setStatus('Failed to save source code');
    }
  };

  const jsonData = useMemo(() => ({ threads, selectedThread, messages, attachments, plugins }), [threads, selectedThread, messages, attachments, plugins]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-full px-4 py-4 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-col gap-4 rounded-3xl border border-slate-700 bg-slate-900/80 p-5 shadow-xl shadow-slate-900/20">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-white">Orpheus Echo</h1>
              <p className="mt-1 text-slate-400">Local Messenger thread extractor, replay engine, and plugin-driven UI.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button type="button" className="rounded-full bg-slate-700 px-4 py-2 text-sm hover:bg-slate-600" onClick={refreshThreads}>Refresh threads</button>
              <button type="button" className="rounded-full bg-emerald-600 px-4 py-2 text-sm hover:bg-emerald-500" onClick={() => window.location.reload()}>Reload UI</button>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl bg-slate-800 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Selected thread</p>
              <p className="mt-2 text-lg font-semibold text-white">{selectedThread?.name || 'None selected'}</p>
              <p className="mt-1 text-sm text-slate-400">{selectedThread?.participants.join(', ') || 'Pick a thread from the list.'}</p>
            </div>
            <div className="rounded-2xl bg-slate-800 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Status</p>
              <p className="mt-2 text-lg font-semibold text-white">{status}</p>
            </div>
            <div className="rounded-2xl bg-slate-800 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">JSON view</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className={`rounded-full px-3 py-1 text-sm ${jsonMode === 'beautify' ? 'bg-emerald-500 text-slate-950' : 'bg-slate-700 text-slate-200'}`} onClick={() => setJsonMode('beautify')}>Beautify</button>
                <button type="button" className={`rounded-full px-3 py-1 text-sm ${jsonMode === 'raw' ? 'bg-emerald-500 text-slate-950' : 'bg-slate-700 text-slate-200'}`} onClick={() => setJsonMode('raw')}>Raw</button>
              </div>
            </div>
          </div>
        </header>

        <main className="grid gap-6 xl:grid-cols-[320px_1fr]">
          <section className="space-y-6">
            <div className="rounded-3xl border border-slate-700 bg-slate-900/80 p-5">
              <h2 className="text-xl font-semibold">Threads</h2>
              <div className="mt-4 space-y-2">
                {threads.length === 0 ? (
                  <p className="text-slate-400">No threads available. Run the capture command first.</p>
                ) : (
                  threads.map((thread) => (
                    <button key={thread.id} type="button" onClick={() => setSelected(thread.id)} className={`block w-full rounded-2xl border px-4 py-3 text-left transition ${selected === thread.id ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-700 hover:border-slate-500'}`}>
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium text-white">{thread.name}</span>
                        <span className="rounded-full bg-slate-800 px-2 py-1 text-xs text-slate-300">{new Date(thread.lastActivity).toLocaleString()}</span>
                      </div>
                      <p className="mt-1 text-sm text-slate-400">{thread.participants.join(', ')}</p>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-700 bg-slate-900/80 p-5">
              <h2 className="text-xl font-semibold">Source code editor</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {sourceFiles.slice(0, 8).map((file) => (
                  <button key={file} type="button" className={`rounded-full px-3 py-1 text-sm ${sourcePath === file ? 'bg-emerald-500 text-slate-950' : 'bg-slate-700 text-slate-200'}`} onClick={() => loadSource(file)}>{file}</button>
                ))}
              </div>
              <textarea value={rawSource} onChange={(event) => setRawSource(event.target.value)} className="mt-4 h-56 w-full resize-none rounded-3xl border border-slate-700 bg-slate-950 p-4 text-sm text-slate-100" spellCheck="false" />
              <div className="mt-4 flex gap-3">
                <button type="button" onClick={saveSource} className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-500">Save file</button>
                <button type="button" onClick={() => window.location.reload()} className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800">Reload UI</button>
              </div>
            </div>
          </section>

          <section className="space-y-6">
            <div className="rounded-3xl border border-slate-700 bg-slate-900/80 p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold">Conversation view</h2>
                  <p className="mt-1 text-sm text-slate-400">Messages replayed from local storage.</p>
                </div>
                <button type="button" onClick={() => selected && refreshThreadData(selected)} className="rounded-full bg-slate-700 px-4 py-2 text-sm hover:bg-slate-600">Refresh</button>
              </div>
              <div className="mt-5">
                <ThreadView messages={messages} attachments={attachments} />
              </div>
            </div>

            <div className="rounded-3xl border border-slate-700 bg-slate-900/80 p-5">
              <h2 className="text-xl font-semibold">JSON Inspector</h2>
              <JsonViewer data={jsonData} mode={jsonMode} />
            </div>

            <div className="rounded-3xl border border-slate-700 bg-slate-900/80 p-5">
              <h2 className="text-xl font-semibold">Plugins</h2>
              <PluginPanel plugins={plugins} />
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

export default App;
