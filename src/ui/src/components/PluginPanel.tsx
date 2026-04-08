import React from 'react';

interface PluginPanelProps {
  plugins: any[];
}

function PluginPanel({ plugins }: PluginPanelProps) {
  if (plugins.length === 0) {
    return <p className="text-slate-400">No plugins loaded. Add plugin definitions to the plugins folder to enable new panels.</p>;
  }

  return (
    <div className="space-y-4">
      {plugins.map((plugin) => (
        <div key={plugin.id} className="rounded-3xl border border-slate-700 bg-slate-900 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-base font-semibold text-white">{plugin.name}</p>
              <p className="mt-1 text-sm text-slate-400">{plugin.description}</p>
            </div>
            <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-400">{plugin.category}</span>
          </div>
          {plugin.code ? (
            <pre className="mt-4 overflow-auto rounded-2xl bg-slate-950 p-3 text-xs text-slate-200">{plugin.code.slice(0, 320)}{plugin.code.length > 320 ? '…' : ''}</pre>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export default PluginPanel;
