import React, { useEffect, useRef } from 'react';

export interface PowerChipData {
  base: string;
  exponent: string;
}

interface PowerChipProps {
  data: PowerChipData;
  editing: boolean;
  onChange: (data: PowerChipData) => void;
  onLock: () => void;
  onEdit: () => void;
  onDelete?: () => void;
}

export function PowerChip({ data, editing, onChange, onLock, onEdit, onDelete }: PowerChipProps) {
  const baseRef = useRef<HTMLInputElement>(null);
  const expRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (editing) {
      baseRef.current?.focus();
      baseRef.current?.select();
    }
  }, [editing]);

  const handleBlur = (e: React.FocusEvent) => {
    if (containerRef.current?.contains(e.relatedTarget as Node)) return;
    onLock();
  };

  if (editing) {
    return (
      <span
        ref={containerRef}
        onBlur={handleBlur}
        style={{
          display: 'inline-flex',
          alignItems: 'flex-end',
          verticalAlign: 'middle',
          margin: '0 2px',
          padding: '3px 4px',
          borderRadius: 6,
          border: '1.5px solid rgba(245,166,35,0.35)',
          background: 'rgba(245,166,35,0.05)',
          gap: 3,
        }}
      >
        <input
          ref={baseRef}
          value={data.base}
          onChange={e => onChange({ ...data, base: e.target.value })}
          onKeyDown={e => {
            if (e.key === 'Tab') { e.preventDefault(); expRef.current?.focus(); }
            if (e.key === 'Enter') { e.preventDefault(); onLock(); }
          }}
          style={{
            width: 40,
            textAlign: 'center',
            fontSize: 15,
            padding: '2px 3px',
            border: '1.5px solid rgba(245,166,35,0.5)',
            borderRadius: 4,
            background: 'rgba(245,166,35,0.07)',
            outline: 'none',
            fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
            color: '#3d3530',
            boxSizing: 'border-box',
          }}
          placeholder="x"
        />
        <input
          ref={expRef}
          value={data.exponent}
          onChange={e => onChange({ ...data, exponent: e.target.value })}
          onKeyDown={e => {
            if (e.key === 'Tab') { e.preventDefault(); onLock(); }
            if (e.key === 'Enter') { e.preventDefault(); onLock(); }
          }}
          style={{
            width: 28,
            textAlign: 'center',
            fontSize: 11,
            padding: '1px 2px',
            border: '1.5px solid rgba(245,166,35,0.5)',
            borderRadius: 4,
            background: 'rgba(245,166,35,0.07)',
            outline: 'none',
            fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
            color: '#3d3530',
            marginBottom: 10,
            boxSizing: 'border-box',
          }}
          placeholder="n"
        />
      </span>
    );
  }

  return (
    <span
      onClick={onEdit}
      title="Click to edit"
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'flex-start',
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
      <span style={{ fontSize: 15, color: '#3d3530', lineHeight: 1.6 }}>
        {data.base || '?'}
      </span>
      <span style={{ fontSize: 11, color: '#3d3530', lineHeight: 1, marginTop: 2 }}>
        {data.exponent || '?'}
      </span>
      {onDelete && (
        <span
          role="button"
          aria-label="Delete"
          onMouseDown={e => e.preventDefault()}
          onClick={e => { e.stopPropagation(); onDelete(); }}
          style={{
            position: 'absolute', top: -8, right: -8,
            width: 20, height: 20, borderRadius: '50%',
            background: '#E23D28', color: '#fff',
            fontSize: 12, fontWeight: 700, lineHeight: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', zIndex: 1,
            WebkitTapHighlightColor: 'transparent' as any,
            userSelect: 'none' as any,
          }}
        >×</span>
      )}
    </span>
  );
}
