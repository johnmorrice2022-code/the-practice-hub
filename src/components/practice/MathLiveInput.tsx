import { useEffect, useRef, useState } from 'react';

// ─── Symbol definitions ────────────────────────────────────────────────────────

interface Sym {
  display: string;
  latex: string;
  label: string;
  structured?: boolean; // true = cursor lands in a placeholder box
}

const PRIMARY: Sym[] = [
  { display: 'a/b',  latex: '\\frac{#@}{#?}',     label: 'Fraction',    structured: true },
  { display: 'x²',   latex: '^{2}',                label: 'Squared' },
  { display: 'xⁿ',   latex: '^{#?}',               label: 'Power',       structured: true },
  { display: '√',    latex: '\\sqrt{#@}',           label: 'Square root', structured: true },
  { display: '∛',    latex: '\\sqrt[3]{#@}',        label: 'Cube root',   structured: true },
  { display: 'π',    latex: '\\pi ',                label: 'Pi' },
  { display: '°',    latex: '^{\\circ}',            label: 'Degrees' },
  { display: '×',    latex: '\\times ',             label: 'Multiply' },
  { display: '÷',    latex: '\\div ',               label: 'Divide' },
  { display: '±',    latex: '\\pm ',                label: 'Plus/minus' },
];

const MORE: Sym[] = [
  { display: 'sin',    latex: '\\sin(#?)',          label: 'Sine',        structured: true },
  { display: 'cos',    latex: '\\cos(#?)',          label: 'Cosine',      structured: true },
  { display: 'tan',    latex: '\\tan(#?)',          label: 'Tangent',     structured: true },
  { display: 'sin⁻¹', latex: '\\sin^{-1}(#?)',     label: 'Arcsin',      structured: true },
  { display: 'cos⁻¹', latex: '\\cos^{-1}(#?)',     label: 'Arccos',      structured: true },
  { display: 'tan⁻¹', latex: '\\tan^{-1}(#?)',     label: 'Arctan',      structured: true },
  { display: '≤',     latex: '\\leq ',              label: 'Less/equal' },
  { display: '≥',     latex: '\\geq ',              label: 'Greater/equal' },
  { display: '≠',     latex: '\\neq ',              label: 'Not equal' },
  { display: '≈',     latex: '\\approx ',           label: 'Approximately' },
  { display: 'θ',     latex: '\\theta ',            label: 'Theta' },
  { display: 'α',     latex: '\\alpha ',            label: 'Alpha' },
  { display: 'β',     latex: '\\beta ',             label: 'Beta' },
  { display: 'Δ',     latex: '\\Delta ',            label: 'Delta' },
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
  const mountRef   = useRef<HTMLDivElement>(null);
  const mfRef      = useRef<any>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const [showMore, setShowMore] = useState(false);
  const [isEmpty,  setIsEmpty]  = useState(!(value ?? '').trim());
  const [focused,  setFocused]  = useState(false);

  // ── Mount the math-field element once ────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    import('mathlive').then(() => {
      if (cancelled || !mountRef.current) return;

      const mf = document.createElement('math-field') as any;

      mf.value = value ?? '';

      // MathLive configuration
      mf.smartFence            = true;
      mf.smartSuperscript      = true;
      mf.removeExtraneousParentheses = false;
      mf.mathVirtualKeyboardPolicy = 'auto'; // shows on touch, hidden on desktop

      // Brand colour via CSS variable
      mf.style.cssText = `
        display: block;
        width: 100%;
        min-height: 120px;
        padding: 16px;
        font-size: 18px;
        line-height: 1.9;
        border-radius: 0 0 10px 10px;
        border: 1.5px solid #d4c8bc;
        border-top: 1px dashed #d4c8bc;
        background: #fff;
        outline: none;
        box-sizing: border-box;
        --primary-color: #E23D28;
        --caret-color: #E23D28;
        --selection-background-color: rgba(226,61,40,0.15);
      `;

      mf.addEventListener('input', () => {
        const v: string = mf.value ?? '';
        onChangeRef.current(v);
        setIsEmpty(!v.trim());
      });

      mf.addEventListener('focusin',  () => setFocused(true));
      mf.addEventListener('focusout', () => setFocused(false));

      mountRef.current.appendChild(mf);
      mfRef.current = mf;
      setIsEmpty(!(mf.value ?? '').trim());
    });

    return () => {
      cancelled = true;
      const mf = mfRef.current;
      if (mf) {
        try { mf.parentNode?.removeChild(mf); } catch {}
        mfRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync external value into the field (e.g. question change / reset) ────────
  useEffect(() => {
    const mf = mfRef.current;
    if (!mf) return;
    const next = value ?? '';
    if (mf.value !== next) {
      mf.value = next;
      setIsEmpty(!next.trim());
    }
  }, [value]);

  // ── Sync focus/value border state to the math-field element ─────────────────
  useEffect(() => {
    const mf = mfRef.current;
    if (!mf) return;
    const hasContent = (value ?? '').trim().length > 0;
    mf.style.border = focused
      ? '1.5px solid #E23D28'
      : hasContent
        ? '1.5px solid rgba(245,166,35,0.5)'
        : '1.5px solid #d4c8bc';
    mf.style.borderTop = focused || hasContent ? mf.style.border : '1px dashed #d4c8bc';
    mf.style.boxShadow = focused
      ? '0 0 0 3px rgba(226,61,40,0.12)'
      : hasContent
        ? '0 0 0 3px rgba(245,166,35,0.12)'
        : 'none';
  }, [focused, value]);

  // ── Insert a symbol ───────────────────────────────────────────────────────────
  const insertSymbol = (sym: Sym) => {
    const mf = mfRef.current;
    if (!mf) return;
    mf.focus();
    mf.insert(sym.latex, {
      selectionMode: sym.structured ? 'placeholder' : 'after',
      mode: 'math',
    });
    setIsEmpty(false);
  };

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

        {/* More toggle */}
        <button
          type="button"
          onClick={() => setShowMore((v) => !v)}
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

      {/* ── More symbols panel ── */}
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

      {/* ── Math field mount point ── */}
      <div style={{ position: 'relative' }}>
        {/* Placeholder — shown when field is empty */}
        {isEmpty && (
          <div style={{
            position: 'absolute',
            top: 18,
            left: 18,
            pointerEvents: 'none',
            color: '#b5a89a',
            fontSize: 15,
            fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
            zIndex: 1,
          }}>
            {placeholder}
          </div>
        )}

        {/* MathLive element is appended here by the mount useEffect */}
        <div ref={mountRef} />
      </div>
    </div>
  );
}
