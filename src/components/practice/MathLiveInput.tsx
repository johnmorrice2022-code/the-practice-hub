import { useEffect, useRef, useState } from 'react';

// ─── Symbol definitions ────────────────────────────────────────────────────────

interface Sym {
  display: string;
  latex: string;
  label: string;
  structured?: boolean;
  insertMode?: 'math' | 'text'; // default: 'math'
}

const PRIMARY: Sym[] = [
  { display: 'a/b',  latex: '\\frac{#@}{#?}',  label: 'Fraction',    structured: true },
  { display: 'x²',   latex: '^{2}',             label: 'Squared' },
  { display: 'xⁿ',   latex: '^{#?}',            label: 'Power',       structured: true },
  { display: '√',    latex: '\\sqrt{#@}',        label: 'Square root', structured: true },
  { display: '∛',    latex: '\\sqrt[3]{#@}',     label: 'Cube root',   structured: true },
  { display: 'π',    latex: '\\pi ',             label: 'Pi' },
  { display: '°',    latex: '^{\\circ}',         label: 'Degrees' },
  { display: '×',    latex: '\\times ',          label: 'Multiply' },
  { display: '÷',    latex: '\\div ',            label: 'Divide' },
  { display: '±',    latex: '\\pm ',             label: 'Plus/minus' },
  { display: '␣',    latex: ' ',                 label: 'Space',       insertMode: 'text' },
];

const MORE: Sym[] = [
  { display: 'sin',    latex: '\\sin(#?)',       label: 'Sine',        structured: true },
  { display: 'cos',    latex: '\\cos(#?)',       label: 'Cosine',      structured: true },
  { display: 'tan',    latex: '\\tan(#?)',       label: 'Tangent',     structured: true },
  { display: 'sin⁻¹', latex: '\\sin^{-1}(#?)', label: 'Arcsin',      structured: true },
  { display: 'cos⁻¹', latex: '\\cos^{-1}(#?)', label: 'Arccos',      structured: true },
  { display: 'tan⁻¹', latex: '\\tan^{-1}(#?)', label: 'Arctan',      structured: true },
  { display: '≤',     latex: '\\leq ',           label: 'Less/equal' },
  { display: '≥',     latex: '\\geq ',           label: 'Greater/equal' },
  { display: '≠',     latex: '\\neq ',           label: 'Not equal' },
  { display: '≈',     latex: '\\approx ',        label: 'Approximately' },
  { display: 'θ',     latex: '\\theta ',         label: 'Theta' },
  { display: 'α',     latex: '\\alpha ',         label: 'Alpha' },
  { display: 'β',     latex: '\\beta ',          label: 'Beta' },
  { display: 'Δ',     latex: '\\Delta ',         label: 'Delta' },
];

// ─── SymbolButton ──────────────────────────────────────────────────────────────

function SymbolButton({ sym, onInsert }: { sym: Sym; onInsert: (s: Sym) => void }) {
  const isText = sym.display.length > 2;
  return (
    <button
      type="button"
      onClick={() => onInsert(sym)}
      title={sym.label}
      style={{
        minWidth: isText ? 48 : 38,
        height: 34,
        padding: '2px 8px',
        borderRadius: 7,
        border: '1px solid #e8ddd2',
        background: '#fff',
        color: '#3d3530',
        fontSize: isText ? 12 : 16,
        fontWeight: isText ? 700 : 400,
        fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        WebkitTapHighlightColor: 'transparent',
        transition: 'background 0.12s, border-color 0.12s, color 0.12s',
      }}
      onMouseEnter={(e) =>
        Object.assign(e.currentTarget.style, {
          background: 'linear-gradient(135deg,rgba(226,61,40,.10) 0%,rgba(245,166,35,.10) 100%)',
          borderColor: '#E23D28',
          color: '#E23D28',
        })
      }
      onMouseLeave={(e) =>
        Object.assign(e.currentTarget.style, {
          background: '#fff',
          borderColor: '#e8ddd2',
          color: '#3d3530',
        })
      }
    >
      {sym.display}
    </button>
  );
}

// ─── Row data ─────────────────────────────────────────────────────────────────

interface Row { id: number; value: string }

let _rowIdCounter = 0;
const newRow = (value = ''): Row => ({ id: _rowIdCounter++, value });

// ─── MathRow: one line of working ─────────────────────────────────────────────

interface MathRowProps {
  row: Row;
  rowIndex: number;
  totalRows: number;
  focusedRowId: number | null;
  mfById: React.MutableRefObject<Map<number, any>>;
  onValue: (id: number, value: string) => void;
  onEnter: (id: number) => void;
  onBackspaceEmpty: (id: number) => void;
  onFocus: (id: number) => void;
  onBlur: () => void;
}

function MathRow({
  row, rowIndex, totalRows, focusedRowId,
  mfById, onValue, onEnter, onBackspaceEmpty, onFocus, onBlur,
}: MathRowProps) {
  const mountRef  = useRef<HTMLDivElement>(null);
  const mfRef     = useRef<any>(null);

  // Stable callback refs — avoids stale closures in the imperative event listeners
  const cbRefs = useRef({ onValue, onEnter, onBackspaceEmpty, onFocus, onBlur, rowId: row.id });
  cbRefs.current = { onValue, onEnter, onBackspaceEmpty, onFocus, onBlur, rowId: row.id };

  // Mount the math-field once per row lifetime
  useEffect(() => {
    let cancelled = false;

    import('mathlive').then(() => {
      if (cancelled || !mountRef.current) return;

      const mf = document.createElement('math-field') as any;
      mf.value = row.value || '';
      mf.defaultMode = 'text';
      mf.smartFence = true;
      mf.smartSuperscript = true;
      mf.mathVirtualKeyboardPolicy = 'auto';

      mf.style.cssText = `
        display: block;
        width: 100%;
        min-height: 48px;
        padding: 10px 14px;
        font-size: 18px;
        line-height: 1.6;
        border: none;
        outline: none;
        box-sizing: border-box;
        background: transparent;
        --primary-color: #E23D28;
        --caret-color: #E23D28;
        --selection-background-color: rgba(226,61,40,0.15);
      `;

      mf.addEventListener('input', () => {
        cbRefs.current.onValue(cbRefs.current.rowId, mf.value || '');
      });
      mf.addEventListener('focusin',  () => cbRefs.current.onFocus(cbRefs.current.rowId));
      mf.addEventListener('focusout', () => cbRefs.current.onBlur());

      mf.addEventListener('keydown', (ev: KeyboardEvent) => {
        // Enter → new row
        if (ev.key === 'Enter') {
          ev.preventDefault();
          cbRefs.current.onEnter(cbRefs.current.rowId);
          return;
        }
        // Backspace at start of empty row → remove row
        if (ev.key === 'Backspace') {
          const v: string = mf.value || '';
          if (!v.trim()) {
            ev.preventDefault();
            cbRefs.current.onBackspaceEmpty(cbRefs.current.rowId);
          }
        }
      });

      mountRef.current.appendChild(mf);
      mfRef.current = mf;
      mfById.current.set(row.id, mf);

      // Inject CSS into MathLive's shadow DOM — the only way to remove the
      // blue text-zone highlight (CSS vars on the host element don't reach it)
      requestAnimationFrame(() => {
        const shadow = (mf as any).shadowRoot as ShadowRoot | null;
        if (shadow) {
          const s = document.createElement('style');
          s.textContent = `
            :host { --_contains-highlight-background-color: transparent !important; --_contains-highlight-color: inherit !important; }
            .ML__contains-highlight { background: transparent !important; }
            .ML__highlight { background: transparent !important; }
          `;
          shadow.prepend(s);
        }
        // Clear any auto-selection set on mount
        mf.executeCommand('moveToMathfieldEnd');
      });
    });

    return () => {
      cancelled = true;
      const mf = mfRef.current;
      if (mf) {
        try { mf.parentNode?.removeChild(mf); } catch {}
        mfRef.current = null;
      }
      mfById.current.delete(row.id);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps — mount once

  // Sync value into field (e.g. external reset)
  useEffect(() => {
    const mf = mfRef.current;
    if (!mf) return;
    const next = row.value || '';
    if (mf.value !== next) mf.value = next;
  }, [row.value]);

  const isFocused = focusedRowId === row.id;
  const isLast = rowIndex === totalRows - 1;

  return (
    <div
      style={{
        position: 'relative',
        borderBottom: isLast ? 'none' : '1px solid #ede7e0',
      }}
    >
      {/* Row number pill for multi-row */}
      {totalRows > 1 && (
        <span style={{
          position: 'absolute',
          top: 14,
          right: 10,
          fontSize: 10,
          color: isFocused ? '#E23D28' : '#c4bab2',
          fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
          fontWeight: 600,
          pointerEvents: 'none',
          userSelect: 'none',
          transition: 'color 0.15s',
        }}>
          {rowIndex + 1}
        </span>
      )}
      <div ref={mountRef} />
    </div>
  );
}

// ─── MathLiveInput ─────────────────────────────────────────────────────────────

interface MathLiveInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function MathLiveInput({
  value,
  onChange,
  placeholder = 'Show your working here…',
}: MathLiveInputProps) {
  // Stable ID → math-field map for imperative focus
  const mfById = useRef(new Map<number, any>());

  // Rows state — source of truth for the working area
  const [rows, setRows] = useState<Row[]>(() =>
    (value ? value.split('\n') : ['']).map(v => newRow(v))
  );

  const [showMore,     setShowMore]     = useState(false);
  const [focusedRowId, setFocusedRowId] = useState<number | null>(null);

  // Prevent onChange → value → setRows loop
  const skipNextSync = useRef(false);

  // Propagate rows → parent
  useEffect(() => {
    const joined = rows.map(r => r.value).join('\n');
    skipNextSync.current = true;
    onChange(joined);
  }, [rows]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync parent value → rows (question change / external reset)
  useEffect(() => {
    if (skipNextSync.current) {
      skipNextSync.current = false;
      return;
    }
    const incoming = value ?? '';
    const current  = rows.map(r => r.value).join('\n');
    if (incoming !== current) {
      setRows((incoming ? incoming.split('\n') : ['']).map(v => newRow(v)));
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Row event handlers ──────────────────────────────────────────────────────

  const handleValue = (id: number, v: string) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, value: v } : r));
  };

  const handleEnter = (id: number) => {
    setRows(prev => {
      const idx = prev.findIndex(r => r.id === id);
      const next = [...prev];
      next.splice(idx + 1, 0, newRow(''));
      return next;
    });
    // Focus the new row — it won't exist yet so we delay
    setTimeout(() => {
      setRows(prev => {
        const idx = prev.findIndex(r => r.id === id);
        const newRowEntry = prev[idx + 1];
        if (newRowEntry) mfById.current.get(newRowEntry.id)?.focus();
        return prev;
      });
    }, 80);
  };

  const handleBackspaceEmpty = (id: number) => {
    setRows(prev => {
      const idx = prev.findIndex(r => r.id === id);
      if (idx === 0 || prev.length <= 1) return prev;
      const prevRow = prev[idx - 1];
      setTimeout(() => mfById.current.get(prevRow.id)?.focus(), 40);
      return prev.filter(r => r.id !== id);
    });
  };

  const handleFocus = (id: number) => {
    setFocusedRowId(id);
  };

  // ── Insert symbol into the currently focused row ───────────────────────────

  const insertSymbol = (sym: Sym) => {
    const mf = focusedRowId !== null
      ? mfById.current.get(focusedRowId)
      : mfById.current.get(rows[rows.length - 1]?.id);

    if (!mf) return;
    mf.focus();
    mf.insert(sym.latex, {
      selectionMode: sym.structured ? 'placeholder' : 'after',
      mode: sym.insertMode ?? 'math',
    });
  };

  // ── Derived display state ──────────────────────────────────────────────────

  const isEmpty    = rows.every(r => !r.value.trim());
  const isFocused  = focusedRowId !== null;
  const hasContent = !isEmpty;

  const containerBorder = isFocused
    ? '1.5px solid #E23D28'
    : hasContent
      ? '1.5px solid rgba(245,166,35,0.5)'
      : '1.5px solid #d4c8bc';

  const containerShadow = isFocused
    ? '0 0 0 3px rgba(226,61,40,0.12)'
    : hasContent
      ? '0 0 0 3px rgba(245,166,35,0.12)'
      : 'none';

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>

      {/* ── Primary toolbar ── */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 5,
        padding: '8px 10px',
        background: '#faf6f1',
        borderRadius: '10px 10px 0 0',
        border: '1.5px solid #d4c8bc',
        borderBottom: 'none',
        alignItems: 'center',
      }}>
        {PRIMARY.map((sym) => (
          <SymbolButton key={sym.label} sym={sym} onInsert={insertSymbol} />
        ))}

        {/* New line button — works on all devices including mobile */}
        <button
          type="button"
          title="New line"
          onClick={() => {
            const id = focusedRowId ?? rows[rows.length - 1]?.id;
            if (id !== null && id !== undefined) handleEnter(id);
          }}
          style={{
            minWidth: 38,
            height: 34,
            padding: '2px 8px',
            borderRadius: 7,
            border: '1px solid #e8ddd2',
            background: '#fff',
            color: '#3d3530',
            fontSize: 16,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            WebkitTapHighlightColor: 'transparent',
          }}
          onMouseEnter={(e) => Object.assign(e.currentTarget.style, { background: 'linear-gradient(135deg,rgba(226,61,40,.10) 0%,rgba(245,166,35,.10) 100%)', borderColor: '#E23D28', color: '#E23D28' })}
          onMouseLeave={(e) => Object.assign(e.currentTarget.style, { background: '#fff', borderColor: '#e8ddd2', color: '#3d3530' })}
        >
          ↵
        </button>

        <button
          type="button"
          onClick={() => setShowMore(v => !v)}
          style={{
            height: 34,
            padding: '2px 10px',
            borderRadius: 7,
            border: showMore ? '1.5px solid #E23D28' : '1px solid #e8ddd2',
            background: showMore
              ? 'linear-gradient(135deg,rgba(226,61,40,.08) 0%,rgba(245,166,35,.08) 100%)'
              : '#fff',
            color: showMore ? '#E23D28' : '#8c857c',
            fontSize: 12,
            fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            flexShrink: 0,
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          More
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
            style={{ transform: showMore ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
            <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5"
              strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* ── More symbols ── */}
      {showMore && (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 5,
          padding: '7px 10px',
          background: '#faf6f1',
          border: '1.5px solid #d4c8bc',
          borderTop: '1px solid #ece4da',
          borderBottom: 'none',
        }}>
          {MORE.map((sym) => (
            <SymbolButton key={sym.label} sym={sym} onInsert={insertSymbol} />
          ))}
        </div>
      )}

      {/* ── Working area (multi-row) ── */}
      <div style={{
        position: 'relative',
        border: containerBorder,
        borderRadius: '0 0 10px 10px',
        background: '#fff',
        boxShadow: containerShadow,
        transition: 'border-color 0.15s, box-shadow 0.15s',
        overflow: 'hidden',
      }}>
        {/* Placeholder */}
        {isEmpty && (
          <div style={{
            position: 'absolute',
            top: 12,
            left: 16,
            pointerEvents: 'none',
            color: '#b5a89a',
            fontSize: 15,
            fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
            zIndex: 1,
          }}>
            {placeholder}
          </div>
        )}

        {rows.map((row, i) => (
          <MathRow
            key={row.id}
            row={row}
            rowIndex={i}
            totalRows={rows.length}
            focusedRowId={focusedRowId}
            mfById={mfById}
            onValue={handleValue}
            onEnter={handleEnter}
            onBackspaceEmpty={handleBackspaceEmpty}
            onFocus={handleFocus}
            onBlur={() => setFocusedRowId(null)}
          />
        ))}

        {/* Hint */}
        <div style={{
          padding: '4px 14px 8px',
          fontSize: 10,
          color: '#c4bab2',
          fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
        }}>
          Enter for new line · Tab between boxes
        </div>
      </div>
    </div>
  );
}
