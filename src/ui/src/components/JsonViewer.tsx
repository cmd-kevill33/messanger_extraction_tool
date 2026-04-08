import React from 'react';

interface JsonViewerProps {
  data: any;
  mode: 'beautify' | 'raw';
}

function JsonViewer({ data, mode }: JsonViewerProps) {
  const formatted = mode === 'beautify' ? JSON.stringify(data, null, 2) : JSON.stringify(data);
  return (
    <pre className="mt-4 max-h-96 overflow-auto rounded-3xl border border-slate-700 bg-slate-950 p-4 text-xs leading-5 text-slate-200">
      {formatted}
    </pre>
  );
}

export default JsonViewer;
