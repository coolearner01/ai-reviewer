'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { FileText, MessageSquare, Search } from 'lucide-react';
import type { ReviewCommentRecord } from '@/types';

/**
 * GitHub-style "Files changed" browser, themed for the dark canvas.
 */

interface Hunk {
  oldStart: number;
  newStart: number;
  lines: HunkLine[];
}
interface HunkLine {
  type: 'context' | 'add' | 'remove';
  text: string;
  oldLine?: number;
  newLine?: number;
}
interface FileBlock {
  path: string;
  hunks: Hunk[];
  additions: number;
  deletions: number;
}

export function FilesChangedBrowser({
  diff,
  comments,
  onCommentClick,
  selectedFile,
  onSelectFile,
}: {
  diff: string;
  comments: ReviewCommentRecord[];
  onCommentClick?: (comment: ReviewCommentRecord) => void;
  /** When provided, the component is controlled by the parent. */
  selectedFile?: string | null;
  /** Notified whenever a file is picked (sidebar click). */
  onSelectFile?: (file: string) => void;
}) {
  const files = useMemo(() => parseDiff(diff), [diff]);
  const commentsByFile = useMemo(() => groupBy(comments, (c) => c.file), [comments]);

  const [internalPath, setInternalPath] = useState<string | null>(files[0]?.path ?? null);
  const [filter, setFilter] = useState('');

  // Controlled when parent passes `selectedFile`, otherwise fall back to local state.
  const selectedPath = selectedFile !== undefined ? selectedFile : internalPath;
  const setSelectedPath = (path: string) => {
    if (selectedFile === undefined) setInternalPath(path);
    onSelectFile?.(path);
  };

  if (files.length === 0) {
    return (
      <div className="rounded-md border border-gh-border bg-gh-surface p-6 text-sm text-gh-text-muted text-center">
        Diff is empty or could not be parsed.
      </div>
    );
  }

  const filteredFiles = filter
    ? files.filter((f) => f.path.toLowerCase().includes(filter.toLowerCase()))
    : files;

  const selected =
    files.find((f) => f.path === selectedPath) ?? filteredFiles[0] ?? files[0];
  const selectedComments = commentsByFile.get(selected.path) ?? [];

  const totalAdditions = files.reduce((n, f) => n + f.additions, 0);
  const totalDeletions = files.reduce((n, f) => n + f.deletions, 0);

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 items-stretch">
      {/* Sidebar */}
      <aside
        className={cn(
          'shrink-0 w-full lg:w-72 xl:w-80',
          'rounded-md border border-gh-border bg-gh-surface overflow-hidden',
          'lg:sticky lg:top-16 lg:self-start lg:max-h-[calc(100vh-7rem)] lg:flex lg:flex-col',
        )}
      >
        <div className="px-4 py-3 border-b border-gh-border-muted bg-gh-surface-2">
          <div className="flex items-baseline justify-between">
            <h4 className="text-sm font-semibold text-gh-text">
              {files.length} file{files.length === 1 ? '' : 's'} changed
            </h4>
            <span className="text-xs font-mono">
              <span className="text-[#3fb950]">+{totalAdditions}</span>{' '}
              <span className="text-[#f85149]">−{totalDeletions}</span>
            </span>
          </div>
          {files.length > 6 && (
            <div className="mt-2 relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gh-text-subtle" />
              <input
                type="text"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter files…"
                className="w-full text-xs pl-7 pr-2 py-1.5 rounded-md border border-gh-border bg-gh-canvas text-gh-text placeholder:text-gh-text-subtle focus:outline-none focus:ring-2 focus:ring-gh-blue/40"
              />
            </div>
          )}
        </div>
        <ul className="overflow-y-auto lg:flex-1 max-h-[60vh] lg:max-h-none divide-y divide-gh-border-muted">
          {filteredFiles.map((file) => {
            const isSelected = file.path === selected.path;
            const findingCount = (commentsByFile.get(file.path) ?? []).length;
            return (
              <li key={file.path}>
                <button
                  type="button"
                  onClick={() => setSelectedPath(file.path)}
                  aria-pressed={isSelected}
                  className={cn(
                    'w-full text-left px-3 py-2 flex items-start gap-2 hover:bg-gh-surface-2 transition-colors',
                    isSelected &&
                      'bg-gh-blue/10 hover:bg-gh-blue/15 border-l-2 border-gh-blue -ml-px',
                  )}
                  title={file.path}
                >
                  <FileText
                    className={cn(
                      'h-4 w-4 mt-0.5 shrink-0',
                      isSelected ? 'text-gh-blue-muted' : 'text-gh-text-subtle',
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        'font-mono text-xs leading-snug break-all',
                        isSelected ? 'text-gh-blue-muted' : 'text-gh-text',
                      )}
                    >
                      {file.path}
                    </p>
                    <div className="mt-1 flex items-center gap-2 text-[10px] font-mono">
                      {file.additions > 0 && (
                        <span className="text-[#3fb950]">+{file.additions}</span>
                      )}
                      {file.deletions > 0 && (
                        <span className="text-[#f85149]">−{file.deletions}</span>
                      )}
                      {findingCount > 0 && (
                        <span className="ml-auto inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-gh-red/15 text-[#f85149] border border-gh-red/50">
                          <MessageSquare className="h-2.5 w-2.5" />
                          {findingCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
          {filteredFiles.length === 0 && (
            <li className="px-3 py-6 text-center text-xs text-gh-text-muted">
              No files match.
            </li>
          )}
        </ul>
      </aside>

      {/* Diff panel */}
      <section className="flex-1 min-w-0 rounded-md border border-gh-border bg-gh-surface overflow-hidden">
        <header className="px-4 py-3 bg-gh-surface-2 border-b border-gh-border-muted flex items-center justify-between gap-3">
          <div className="min-w-0 flex items-center gap-2">
            <FileText className="h-4 w-4 text-gh-text-muted shrink-0" />
            <span className="font-mono text-xs text-gh-text truncate">{selected.path}</span>
          </div>
          <div className="flex items-center gap-3 shrink-0 text-xs font-mono">
            {selected.additions > 0 && (
              <span className="text-[#3fb950]">+{selected.additions}</span>
            )}
            {selected.deletions > 0 && (
              <span className="text-[#f85149]">−{selected.deletions}</span>
            )}
            {selectedComments.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gh-red/15 text-[#f85149] border border-gh-red/50">
                <MessageSquare className="h-3 w-3" />
                {selectedComments.length} finding
                {selectedComments.length === 1 ? '' : 's'}
              </span>
            )}
          </div>
        </header>
        <div className="overflow-x-auto max-h-[75vh] overflow-y-auto">
          <table className="w-full font-mono text-xs">
            <tbody>
              {selected.hunks.map((hunk, hIdx) => (
                <RenderHunk
                  key={hIdx}
                  hunk={hunk}
                  comments={selectedComments}
                  onCommentClick={onCommentClick}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function RenderHunk({
  hunk,
  comments,
  onCommentClick,
}: {
  hunk: Hunk;
  comments: ReviewCommentRecord[];
  onCommentClick?: (c: ReviewCommentRecord) => void;
}) {
  return (
    <>
      <tr className="bg-gh-blue/10 text-gh-text-muted">
        <td colSpan={4} className="px-3 py-1">
          @@ -{hunk.oldStart} +{hunk.newStart} @@
        </td>
      </tr>
      {hunk.lines.map((line, i) => {
        const lineComments =
          line.type !== 'remove' && line.newLine
            ? comments.filter((c) => c.line === line.newLine)
            : [];
        return (
          <tr
            key={i}
            className={cn(
              line.type === 'add' && 'bg-gh-accent/10',
              line.type === 'remove' && 'bg-gh-red/10',
              line.type === 'context' && 'bg-gh-surface',
            )}
          >
            <td className="px-2 py-0.5 text-gh-text-subtle text-right select-none w-12 border-r border-gh-border-muted">
              {line.oldLine ?? ''}
            </td>
            <td className="px-2 py-0.5 text-gh-text-subtle text-right select-none w-12 border-r border-gh-border-muted">
              {line.newLine ?? ''}
            </td>
            <td
              className={cn(
                'px-1 py-0.5 w-6 select-none',
                line.type === 'add' && 'text-[#3fb950]',
                line.type === 'remove' && 'text-[#f85149]',
                line.type === 'context' && 'text-gh-text-subtle',
              )}
            >
              {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}
            </td>
            <td className="px-2 py-0.5 whitespace-pre text-gh-text">
              <span className="flex items-start gap-2">
                <span className="flex-1">{line.text || '\u00A0'}</span>
                {lineComments.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onCommentClick?.(lineComments[0])}
                    title={`${lineComments.length} finding${
                      lineComments.length === 1 ? '' : 's'
                    } on this line`}
                    className="shrink-0 inline-flex items-center justify-center h-5 w-5 rounded-full bg-gh-red/20 text-[#f85149] border border-gh-red/50 hover:bg-gh-red/30"
                  >
                    <MessageSquare className="h-3 w-3" />
                  </button>
                )}
              </span>
            </td>
          </tr>
        );
      })}
    </>
  );
}

function parseDiff(raw: string): FileBlock[] {
  if (!raw) return [];
  const lines = raw.split('\n');
  const files: FileBlock[] = [];
  let current: FileBlock | null = null;
  let hunk: Hunk | null = null;
  let oldLine = 0;
  let newLine = 0;

  const flushHunk = () => {
    if (hunk && current) current.hunks.push(hunk);
    hunk = null;
  };
  const flushFile = () => {
    flushHunk();
    if (current) files.push(current);
    current = null;
  };

  for (const line of lines) {
    if (line.startsWith('diff --git ')) {
      flushFile();
      const match = / b\/(.+)$/.exec(line);
      current = {
        path: match?.[1] ?? '(unknown)',
        hunks: [],
        additions: 0,
        deletions: 0,
      };
      continue;
    }
    if (line.startsWith('+++ b/')) {
      if (current) current.path = line.slice('+++ b/'.length);
      continue;
    }
    if (line.startsWith('@@')) {
      flushHunk();
      const m = /@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
      if (!m) continue;
      oldLine = parseInt(m[1], 10);
      newLine = parseInt(m[2], 10);
      hunk = { oldStart: oldLine, newStart: newLine, lines: [] };
      continue;
    }
    if (!hunk || !current) continue;
    if (line.startsWith('+') && !line.startsWith('+++')) {
      hunk.lines.push({ type: 'add', text: line.slice(1), newLine: newLine++ });
      current.additions += 1;
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      hunk.lines.push({ type: 'remove', text: line.slice(1), oldLine: oldLine++ });
      current.deletions += 1;
    } else if (line.startsWith('\\')) {
      // "\ No newline at end of file" — skip
    } else {
      hunk.lines.push({
        type: 'context',
        text: line.startsWith(' ') ? line.slice(1) : line,
        oldLine: oldLine++,
        newLine: newLine++,
      });
    }
  }
  flushFile();
  return files;
}

function groupBy<T, K>(list: T[], keyFn: (t: T) => K): Map<K, T[]> {
  const out = new Map<K, T[]>();
  for (const item of list) {
    const k = keyFn(item);
    const arr = out.get(k) ?? [];
    arr.push(item);
    out.set(k, arr);
  }
  return out;
}
