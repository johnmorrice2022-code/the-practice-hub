import React, { useEffect, useRef } from 'react';

export interface FractionChipData {
  numerator: string;
  denominator: string;
}

interface FractionChipProps {
  data: FractionChipData;
  editing: boolean;
  onChange: (data: FractionChipData) => void;
  onLock: () => void;
  onEdit: () => void;
}

const INPUT: React.CSSProperties = {
  width: 48,
  textAlign: 'center',
  fontSize: 14,
  padding: '2px 4px',
  border: '1.5px solid rgba(245,166,35,0.5)',
  borderRadius: 4,
  background: 'rgba(245,166,35,0.07)',
  outline: 'none',
  fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
  color: '#3d3530',
  lineHeight: 1.4,
  boxSizing: 'border-box',
};

const BAR: React.CSSProperties = {
  height: 1.5,
  background: '#3d3530',
  margin: '2px 0',
  display: 'block',
  alignSelf: 'stretch',
  minWidth: 24,
};

export function FractionChip({ data, editing, onChange, onLock, onEdit }: FractionChipProps) {
  const numRef = useRef<HTMLInputElement>(null);
  const denRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (editing) {
      numRef.current?.focus();
      numRef.current?.select();
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
          flexDirection: 'column',
          alignItems: 'stretch',
          verticalAlign: 'middle',
          margin: '0 2px',
          padding: '3px 4px',
          borderRadius: 6,
          border: '1.5px solid rgba(245,166,35,0.35)',
          background: 'rgba(245,166,35,0.05)',
        }}
      >
        <input
          ref={numRef}
          value={data.numerator}
          onChange={e => onChange({ ...data, numerator: e.target.value })}
          onKeyDown={e => {
            if (e.key === 'Tab') { e.preventDefault(); denRef.current?.focus(); }
            if (e.key === 'Enter') { e.preventDefault(); onLock(); }
          }}
          style={INPUT}
          placeholder="·"
        />
        <span style={BAR} />
        <input
          ref={denRef}
          value={data.denominator}
          onChange={e => onChange({ ...data, denominator: e.target.value })}
          onKeyDown={e => {
            if (e.key === 'Tab') { e.preventDefault(); onLock(); }
            if (e.key === 'Enter') { e.preventDefault(); onLock(); }
          }}
          style={INPUT}
          placeholder="·"
        />
      </span>
    );
  }

  return (
    <span
      onClick={onEdit}
      title="Tap to edit"
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        verticalAlign: 'middle',
        margin: '0 3px',
        padding: '2px 6px',
        borderRadius: 5,
        cursor: 'pointer',
        background: 'rgba(61,53,48,0.04)',
        border: '1px solid rgba(61,53,48,0.15)',
      }}
    >
      <span style={{ fontSize: 14, lineHeight: 1.3, color: '#3d3530', whiteSpace: 'nowrap' }}>
        {data.numerator || '?'}
      </span>
      <span style={{ ...BAR, alignSelf: 'stretch', minWidth: 16 }} />
      <span style={{ fontSize: 14, lineHeight: 1.3, color: '#3d3530', whiteSpace: 'nowrap' }}>
        {data.denominator || '?'}
      </span>
    </span>
  );
}
