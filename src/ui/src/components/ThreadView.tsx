import React from 'react';

interface ThreadViewProps {
  messages: any[];
  attachments: any[];
}

function ThreadView({ messages, attachments }: ThreadViewProps) {
  if (messages.length === 0) {
    return <p className="text-slate-400">Select a thread to show messages.</p>;
  }

  return (
    <div className="space-y-4">
      {messages.map((message) => (
        <div key={message.id} className="rounded-3xl border border-slate-700 bg-slate-950/90 p-4 shadow-xl shadow-slate-950/20">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">{message.senderName || message.senderId}</p>
              <p className="text-xs text-slate-500">{new Date(message.timestamp).toLocaleString()}</p>
            </div>
            <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-400">{message.id.slice(-6)}</span>
          </div>
          <p className="mt-4 whitespace-pre-wrap text-slate-200">{message.content || '📎 Attachment or empty message'}</p>
          {attachments.filter((attachment) => attachment.messageId === message.id).length > 0 && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {attachments.filter((attachment) => attachment.messageId === message.id).map((attachment) => (
                <div key={attachment.id} className="rounded-3xl border border-slate-700 bg-slate-900 p-3">
                  <p className="text-sm font-semibold text-white">{attachment.type}</p>
                  <p className="mt-1 text-slate-400">{attachment.filename || attachment.url}</p>
                  {attachment.localPath ? (
                    <a className="mt-2 inline-flex rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-slate-950" href={`/api/attachment-file?path=${encodeURIComponent(attachment.localPath)}`} target="_blank" rel="noreferrer">Open</a>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default ThreadView;
