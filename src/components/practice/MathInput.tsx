import { useEffect, useRef, useState } from 'react';
import { renderMathInText } from '@/lib/renderMathInText';

// ─── Symbol definitions ────────────────────────────────────────────────────────

interface Sym {
  display: string;
  label: string;
  unicode?: string; // insert directly into textarea — no popup
  seed?: string;    // open MathLive popup seeded with this LaTeX template
  isText?: boolean; // render button label as text (not a symbol glyph)
}

const PRIMARY: Sym[] = [
  { display: 'a/b',  label: 'Fraction',    seed: '\\frac{#?}{#?}',  isText: true },
  { display: 'x²',   label: 'Squared',     seed: '#?^{2}',           isText: true },
  { display: 'xⁿ',   label: 'Power',       seed: '#?^{#?}',          isText: true },
  { display: '√',    label: 'Square root', seed: '\\sqrt{#?}' },
  { display: '∛',    label: 'Cube root',   seed: '\\sqrt[3]{#?}' },
  { display: 'π',    label: 'Pi',          unicode: 'π' },
  { display: '°',    label: 'Degrees',     unicode: '°' },
  { display: '×',    label: 'Multiply',    unicode: '×' },
  { display: '÷',    label: 'Divide',      unicode: '÷' },
  { display: '±',    label: 'Plus/minus',  unicode: '±' },
];

const MORE: Sym[] = [
  { display: 'sin',    label: 'Sine',           seed: '\\sin(#?)',        isText: true },
  { display: 'cos',    label: 'Cosine',         seed: '\\cos(#?)',        isText: true },
  { display: 'tan',    label: 'Tangent',        seed: '\\tan(#?)',        isText: true },
  { display: 'sin⁻¹', label: 'Inverse sine',   seed: '\\sin^{-1}(#?)',  isText: true },
  { display: 'cos⁻¹', label: 'Inverse cosine', seed: '\\cos^{-1}(#?)',  isText: true },
  { display: 'tan⁻¹', label: 'Inverse tangent',seed: '\\tan^{-1}(#?)',  isText: true },
  { display: '≤',  label: 'Less/equal',    unicode: '≤' },
  { display: '≥',  label: 'Greater/equal', unicode: '≥' },
  { display: '≠',  label: 'Not equal',     unicode: '≠' },
  { display: '≈',  label: 'Approximately', unicode: '≈' },
  { display: 'θ',  label: 'Theta',         unicode: 'θ' },
  { display: 'α',  label: 'Alpha',         unicode: 'α' },
  { display: 'β',  label: 'Beta',          unicode: 'β' },
  { display: 'Δ',  label: 'Delta',         unicode: 'Δ' },
];

// ─── SymBtn ───────────────────────────────────────────────────────────────────

function SymBtn({ sym, onPress }: { sym: Sym; onPress: () => void }) {
  const wide = sym.isText || sym.display.length > 2;
  return (
    <button
      type="button"
      onClick={onPress}
      title={sym.label}
      style={{
        minWidth: wide ? 48 : 38,
        height: 34,
        padding: '2px 8px',
        borderRadius: 7,
        border: '1px solid #e8ddd2',
        background: '#fff',
        color: '#3d3530',
        fontSize: wide ? 12 : 17,
        fontWeight: wide ? 700 : 400,
        fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        WebkitTapHighlightColor: 'transparent',
        transition: 'background 0.12s, border-color 0.12s, color 0.12s',
      }}
      onMouseEnter={(e) => Object.assign(e.currentTarget.style, {
        background: 'linear-gradient(135deg,rgba(226,61,40,.10) 0%,rgba(245,166,35,.10) 100%)',
        borderColor: '#E23D28', color: '#E23D28',
      })}
      onMouseLeave={(e) => Object.assign(e.currentTarget.style, {
        background: '#fff', borderColor: '#e8ddd2', color: '#3d3530',
      })}
    >
      {sym.display}
    </button>
  );
}

// ─── MathPopup ────────────────────────────────────────────────────────────────
// A centred modal with a single MathLive field for entering one expression.
// MathLive is ideal for this: single expression, short burst, no multi-line needed.

interface MathPopupProps {
  label: string;
  seed: string;
  onInsert: (latex: string) => void;
  onClose: () => void;
}

function MathPopup({ label, seed, onInsert, onClose }: MathPopupProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const mfRef    = useRef<any>(null);

  const doInsert = () => {
    const latex = (mfRef.current?.value ?? '').trim();
    if (latex) onInsert(latex);
  };

  useEffect(() => {
    let cancelled = false;

    import('mathlive').then(() => {
      if (cancelled || !mountRef.current) return;

      const mf = document.createElement('math-field') as any;
      mf.mathVirtualKeyboardPolicy = 'auto';
      mf.smartFence        = true;
      mf.smartSuperscript  = true;

      mf.style.cssText = `
        display: block;
        width: 100%;
        min-height: 72px;
        padding: 12px 16px;
        font-size: 26px;
        border: 1.5px solid #e8ddd2;
        border-radius: 10px;
        background: #fdfaf6;
        outline: none;
        box-sizing: border-box;
        text-align: center;
        --primary-color: #E23D28;
        --caret-color: #E23D28;
        --selection-background-color: rgba(226,61,40,0.15);
      `;

      mf.addEventListener('keydown', (ev: KeyboardEvent) => {
        if (ev.key === 'Enter')  { ev.preventDefault(); doInsert(); }
        if (ev.key === 'Escape') { ev.preventDefault(); onClose(); }
      });

      mountRef.current.appendChild(mf);
      mfRef.current = mf;

      requestAnimationFrame(() => {
        if (cancelled) return;
        mf.focus();
        if (seed) mf.insert(seed, { selectionMode: 'placeholder', mode: 'math' });
      });
    });

    return () => {
      cancelled = true;
      const mf = mfRef.current;
      if (mf) { try { mf.parentNode?.removeChild(mf); } catch {} mfRef.current = null; }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.40)' }}
      />

      {/* Card */}
      <div style={{
        position: 'fixed',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -55%)',
        zIndex: 201,
        background: '#fff',
        borderRadius: 16,
        padding: '24px 24px 20px',
        width: 'min(400px, 92vw)',
        boxShadow: '0 24px 60px rgba(0,0,0,0.22)',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{
            fontSize: 13, fontWeight: 700, color: '#4a4540',
            fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
            textTransform: 'capitalize',
          }}>
            {label}
          </span>
          <button
            type="button" onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#a39485', lineHeight: 1 }}
          >×</button>
        </div>

        {/* MathLive mounts here */}
        <div ref={mountRef} />

        <p style={{
          margin: 0, fontSize: 11, color: '#b5a89a',
          fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
        }}>
          Tab to move between boxes · Enter to insert
        </p>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 2 }}>
          <button
            type="button" onClick={onClose}
            style={{
              padding: '9px 18px', borderRadius: 9,
              border: '1px solid #e8ddd2', background: '#fff',
              color: '#6b5e52', fontSize: 13, cursor: 'pointer',
              fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
            }}
          >Cancel</button>
          <button
            type="button" onClick={doInsert}
            style={{
              padding: '9px 22px', borderRadius: 9, border: 'none',
              background: 'linear-gradient(135deg,#E23D28 0%,#F5A623 100%)',
              color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
              boxShadow: '0 2px 10px rgba(226,61,40,0.30)',
            }}
          >Insert ↵</button>
        </div>
      </div>
    </>
  );
}

// ─── MathInput ────────────────────────────────────────────────────────────────

interface MathInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function MathInput({ value, onChange, placeholder = 'Show your working here…' }: MathInputProps) {
  const taRef   = useRef<HTMLTextAreaElement>(null);
  const cursorRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });

  const [popup,     setPopup]     = useState<{ seed: string; label: string } | null>(null);
  const [showMore,  setShowMore]  = useState(false);
  const [focused,   setFocused]   = useState(false);

  // Auto-resize textarea
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.max(120, ta.scrollHeight) + 'px';
  }, [value]);

  // Keep cursor position up to date whenever selection changes
  const saveCursor = () => {
    const ta = taRef.current;
    if (ta) cursorRef.current = { start: ta.selectionStart, end: ta.selectionEnd };
  };

  // ── Toolbar button press ────────────────────────────────────────────────────

  const handleSymPress = (sym: Sym) => {
    if (sym.unicode) {
      const ta = taRef.current;
      const { start, end } = cursorRef.current;
      const newVal = value.substring(0, start) + sym.unicode + value.substring(end);
      onChange(newVal);
      requestAnimationFrame(() => {
        if (!ta) return;
        ta.focus();
        const pos = start + sym.unicode!.length;
        ta.setSelectionRange(pos, pos);
        cursorRef.current = { start: pos, end: pos };
      });
    } else if (sym.seed) {
      setPopup({ seed: sym.seed, label: `Insert ${sym.label.toLowerCase()}` });
    }
  };

  // ── Popup insert ────────────────────────────────────────────────────────────

  const handleInsert = (latex: string) => {
    const insertion = `$${latex}$`;
    const { start, end } = cursorRef.current;
    const newVal = value.substring(0, start) + insertion + value.substring(end);
    onChange(newVal);
    setPopup(null);
    requestAnimationFrame(() => {
      const ta = taRef.current;
      if (!ta) return;
      ta.focus();
      const pos = start + insertion.length;
      ta.setSelectionRange(pos, pos);
      cursorRef.current = { start: pos, end: pos };
    });
  };

  // ── Derived style state ─────────────────────────────────────────────────────

  const hasContent    = value.trim().length > 0;
  const borderColor   = focused ? '#E23D28' : hasContent ? 'rgba(245,166,35,0.5)' : '#d4c8bc';
  const shadow        = focused
    ? '0 0 0 3px rgba(226,61,40,0.12)'
    : hasContent ? '0 0 0 3px rgba(245,166,35,0.12)' : 'none';

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column' }}>

        {/* ── Toolbar ── */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 5,
          padding: '8px 10px',
          background: '#faf6f1',
          borderRadius: '10px 10px 0 0',
          border: '1.5px solid #d4c8bc',
          borderBottom: 'none',
          alignItems: 'center',
        }}>
          {PRIMARY.map(sym => (
            <SymBtn key={sym.label} sym={sym} onPress={() => handleSymPress(sym)} />
          ))}

          {/* More toggle */}
          <button
            type="button"
            onClick={() => setShowMore(v => !v)}
            style={{
              height: 34, padding: '2px 10px', borderRadius: 7,
              border: showMore ? '1.5px solid #E23D28' : '1px solid #e8ddd2',
              background: showMore
                ? 'linear-gradient(135deg,rgba(226,61,40,.08) 0%,rgba(245,166,35,.08) 100%)'
                : '#fff',
              color: showMore ? '#E23D28' : '#8c857c',
              fontSize: 12, fontWeight: 500, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
              fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
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
            display: 'flex', flexWrap: 'wrap', gap: 5,
            padding: '7px 10px',
            background: '#faf6f1',
            border: '1.5px solid #d4c8bc',
            borderTop: '1px solid #ece4da',
            borderBottom: 'none',
          }}>
            {MORE.map(sym => (
              <SymBtn key={sym.label} sym={sym} onPress={() => handleSymPress(sym)} />
            ))}
          </div>
        )}

        {/* ── Textarea — the backbone ── */}
        <textarea
          ref={taRef}
          value={value}
          placeholder={placeholder}
          onChange={e => onChange(e.target.value)}
          onSelect={saveCursor}
          onKeyUp={saveCursor}
          onFocus={() => setFocused(true)}
          onBlur={() => { setFocused(false); saveCursor(); }}
          style={{
            display: 'block',
            width: '100%',
            minHeight: 120,
            padding: '14px 16px',
            fontSize: 16,
            lineHeight: 1.75,
            fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
            border: `1.5px solid ${borderColor}`,
            borderTop: '1px dashed #d4c8bc',
            borderBottomLeftRadius: hasContent ? 0 : 10,
            borderBottomRightRadius: hasContent ? 0 : 10,
            borderBottom: hasContent ? '1px solid #ece4da' : undefined,
            background: '#fff',
            outline: 'none',
            resize: 'none',
            overflowY: 'hidden',
            boxSizing: 'border-box',
            boxShadow: shadow,
            transition: 'border-color 0.15s, box-shadow 0.15s',
          }}
        />

        {/* ── KaTeX preview (always visible when content exists) ── */}
        {hasContent && (
          <div style={{
            padding: '12px 16px 14px',
            background: '#fefcfa',
            border: `1.5px solid rgba(245,166,35,0.5)`,
            borderTop: 'none',
            borderRadius: '0 0 10px 10px',
            boxShadow: '0 0 0 3px rgba(245,166,35,0.08)',
          }}>
            <div style={{
              fontSize: 10, fontWeight: 700, color: '#E23D28',
              textTransform: 'uppercase', letterSpacing: '0.8px',
              marginBottom: 6,
              fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
            }}>
              Preview
            </div>
            <div
              className="question-text"
              style={{ fontSize: 17, lineHeight: 1.85, color: '#3d3530' }}
              dangerouslySetInnerHTML={{ __html: renderMathInText(value) }}
            />
          </div>
        )}
      </div>

      {/* ── Math popup ── */}
      {popup && (
        <MathPopup
          label={popup.label}
          seed={popup.seed}
          onInsert={handleInsert}
          onClose={() => setPopup(null)}
        />
      )}
    </>
  );
}
