import React, { useEffect, useRef } from 'react';

export interface RootChipData {
  index: string;    // '' or '2' = square root; '3' = cube root; etc.
  radicand: string; // expression under the radical
  exponent: string; // power of the radicand ('' = none)
}

interface RootChipProps {
  data: RootChipData;
  editing: boolean;
  focusTarget?: 'index' | 'radicand';
  variant?: 'simple' | 'full';
  onChange: (data: RootChipData) => void;
  onLock: () => void;
  onEdit: () => void;
}

const SMALL_INPUT: React.CSSProperties = {
  width: 26,
  textAlign: 'center',
  fontSize: 11,
  padding: '1px 3px',
  border: '1.5px solid rgba(245,166,35,0.5)',
  borderRadius: 4,
  background: 'rgba(245,166,35,0.07)',
  outline: 'none',
  fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
  color: '#3d3530',
  boxSizing: 'border-box',
};

const MAIN_INPUT: React.CSSProperties = {
  width: 52,
  textAlign: 'center',
  fontSize: 14,
  padding: '2px 4px',
  border: '1.5px solid rgba(245,166,35,0.5)',
  borderRadius: 4,
  background: 'rgba(245,166,35,0.07)',
  outline: 'none',
  fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
  color: '#3d3530',
  boxSizing: 'border-box',
};

export function RootChip({ data, editing, focusTarget = 'index', variant = 'full', onChange, onLock, onEdit }: RootChipProps) {
  const indexRef    = useRef<HTMLInputElement>(null);
  const radicandRef = useRef<HTMLInputElement>(null);
  const expRef      = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (editing) {
      const target = focusTarget === 'radicand' ? radicandRef.current : indexRef.current;
      target?.focus();
      target?.select();
    }
  // focusTarget intentionally excluded — only re-run when editing toggles
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  const handleBlur = (e: React.FocusEvent) => {
    if (containerRef.current?.contains(e.relatedTarget as Node)) return;
    onLock();
  };

  const isNthRoot = data.index && data.index !== '2';

  if (editing) {
    const containerStyle: React.CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      verticalAlign: 'middle',
      margin: '0 2px',
      padding: '3px 6px',
      borderRadius: 6,
      border: '1.5px solid rgba(245,166,35,0.35)',
      background: 'rgba(245,166,35,0.05)',
      gap: 4,
    };

    // Simple variant — just √ and radicand
    if (variant === 'simple') {
      return (
        <span ref={containerRef} onBlur={handleBlur} style={containerStyle}>
          <span style={{ fontSize: 20, color: '#3d3530', lineHeight: 1, userSelect: 'none' }}>√</span>
          <input
            ref={radicandRef}
            value={data.radicand}
            onChange={e => onChange({ ...data, radicand: e.target.value })}
            onKeyDown={e => {
              if (e.key === 'Tab' || e.key === 'Enter') { e.preventDefault(); onLock(); }
            }}
            style={MAIN_INPUT}
            placeholder="x"
            title="Number or expression under the root"
          />
        </span>
      );
    }

    // Full variant — index, radicand, exponent
    return (
      <span ref={containerRef} onBlur={handleBlur} style={containerStyle}>
        {/* Index — small, raised to top-left of radical */}
        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 6 }}>
          <input
            ref={indexRef}
            value={data.index}
            onChange={e => onChange({ ...data, index: e.target.value })}
            onKeyDown={e => {
              if (e.key === 'Tab') { e.preventDefault(); radicandRef.current?.focus(); }
              if (e.key === 'Enter') { e.preventDefault(); onLock(); }
            }}
            style={SMALL_INPUT}
            placeholder="n"
            title="Root index (leave blank for square root)"
          />
        </span>

        <span style={{ fontSize: 20, color: '#3d3530', lineHeight: 1, userSelect: 'none' }}>√</span>

        {/* Radicand */}
        <input
          ref={radicandRef}
          value={data.radicand}
          onChange={e => onChange({ ...data, radicand: e.target.value })}
          onKeyDown={e => {
            if (e.key === 'Tab') { e.preventDefault(); expRef.current?.focus(); }
            if (e.key === 'Enter') { e.preventDefault(); onLock(); }
          }}
          style={MAIN_INPUT}
          placeholder="x"
          title="Radicand"
        />

        <span style={{ fontSize: 11, color: '#a39485', userSelect: 'none' }}>^</span>

        {/* Exponent — small, superscript-sized */}
        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', paddingTop: 2 }}>
          <input
            ref={expRef}
            value={data.exponent}
            onChange={e => onChange({ ...data, exponent: e.target.value })}
            onKeyDown={e => {
              if (e.key === 'Tab') { e.preventDefault(); onLock(); }
              if (e.key === 'Enter') { e.preventDefault(); onLock(); }
            }}
            style={SMALL_INPUT}
            placeholder="m"
            title="Exponent on radicand (leave blank if none)"
          />
        </span>
      </span>
    );
  }

  // ── Locked visual ──────────────────────────────────────────────────────────
  return (
    <span
      onClick={onEdit}
      title="Click to edit"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        verticalAlign: 'middle',
        margin: '0 2px',
        padding: '2px 5px',
        borderRadius: 5,
        cursor: 'pointer',
        background: 'rgba(61,53,48,0.04)',
        border: '1px solid rgba(61,53,48,0.15)',
        gap: 1,
      }}
    >
      {/* Index (small, raised) */}
      {isNthRoot && (
        <span style={{ fontSize: 10, color: '#3d3530', lineHeight: 1, marginBottom: 8, marginRight: 1 }}>
          {data.index}
        </span>
      )}

      {/* √ symbol */}
      <span style={{ fontSize: 18, color: '#3d3530', lineHeight: 1 }}>√</span>

      {/* Radicand with vinculum + optional exponent */}
      <span style={{
        borderTop: '1.5px solid #3d3530',
        padding: '0 3px',
        display: 'inline-flex',
        alignItems: 'flex-start',
        gap: 1,
      }}>
        <span style={{ fontSize: 14, color: '#3d3530', lineHeight: 1.6 }}>
          {data.radicand || '?'}
        </span>
        {data.exponent && (
          <span style={{ fontSize: 10, color: '#3d3530', lineHeight: 1, marginTop: 2 }}>
            {data.exponent}
          </span>
        )}
      </span>
    </span>
  );
}
