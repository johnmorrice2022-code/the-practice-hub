import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FractionChip, FractionChipData } from './chips/FractionChip';
import { PowerChip, PowerChipData } from './chips/PowerChip';
import { RootChip, RootChipData } from './chips/RootChip';

// ─── Types ────────────────────────────────────────────────────────────────────

type ChipState =
  | { id: string; type: 'fraction'; editing: boolean; data: FractionChipData }
  | { id: string; type: 'power';    editing: boolean; data: PowerChipData }
  | { id: string; type: 'root';     editing: boolean; data: RootChipData; focusTarget: 'index' | 'radicand'; variant: 'simple' | 'full' };

// Represents the chip currently open in the edit panel (always outside the contenteditable)
type EditingChipState =
  | { id: string; type: 'fraction'; data: FractionChipData }
  | { id: string; type: 'power';    data: PowerChipData }
  | { id: string; type: 'root';     data: RootChipData; focusTarget: 'index' | 'radicand'; variant: 'simple' | 'full' };

// ─── Serialise ────────────────────────────────────────────────────────────────

function serialiseChip(chip: ChipState): string {
  switch (chip.type) {
    case 'fraction':
      return `(${chip.data.numerator || '?'})/(${chip.data.denominator || '?'})`;
    case 'power':
      return `(${chip.data.base || '?'})^(${chip.data.exponent || '?'})`;
    case 'root': {
      const idx = chip.data.index && chip.data.index !== '2' ? chip.data.index : '';
      const rad = chip.data.radicand || '?';
      const inner = chip.data.exponent ? `${rad}^(${chip.data.exponent})` : rad;
      return idx ? `${idx}√(${inner})` : `√(${inner})`;
    }
  }
}

function serialise(div: HTMLElement, chipsMap: Map<string, ChipState>): string {
  let out = '';
  for (const node of Array.from(div.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      // Strip zero-width spaces used as iOS cursor anchors around chips
      out += (node.textContent ?? '').replace(/\u200B/g, '');
    } else if (node instanceof HTMLElement) {
      const chipId = node.dataset.chipId;
      if (chipId) {
        const chip = chipsMap.get(chipId);
        if (chip) out += serialiseChip(chip);
      } else if (node.tagName === 'BR') {
        out += '\n';
      } else {
        out += node.textContent ?? '';
      }
    }
  }
  return out;
}

// ─── Toolbar symbol definitions ───────────────────────────────────────────────

const PRIMARY_SYMS = [
  { label: '×', title: 'Multiply' },
  { label: '÷', title: 'Divide' },
  { label: 'π', title: 'Pi' },
  { label: '°', title: 'Degrees' },
  { label: 'θ', title: 'Theta' },
  { label: '±', title: 'Plus/minus' },
  { label: '≤', title: 'Less or equal' },
  { label: '≥', title: 'Greater or equal' },
  { label: '≈', title: 'Approximately' },
  { label: '≠', title: 'Not equal' },
];

const MORE_SYMS = [
  { label: 'sin',    title: 'Sine' },
  { label: 'cos',    title: 'Cosine' },
  { label: 'tan',    title: 'Tangent' },
  { label: 'sin⁻¹', title: 'Inverse sine' },
  { label: 'cos⁻¹', title: 'Inverse cosine' },
  { label: 'tan⁻¹', title: 'Inverse tangent' },
  { label: 'α', title: 'Alpha' },
  { label: 'β', title: 'Beta' },
  { label: 'Δ', title: 'Delta' },
];

// ─── Toolbar button ───────────────────────────────────────────────────────────

function TBtn({
  label, title, onPress, wide, disabled,
}: { label: string; title: string; onPress: () => void; wide?: boolean; disabled?: boolean }) {
  const isWide = wide ?? label.length > 2;
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onMouseDown={e => { e.preventDefault(); if (!disabled) onPress(); }}
      style={{
        minWidth: isWide ? 46 : 34,
        height: 34,
        padding: '2px 7px',
        borderRadius: 7,
        border: '1px solid #e8ddd2',
        background: '#fff',
        color: disabled ? '#c9bfb5' : '#3d3530',
        fontSize: isWide ? 12 : 16,
        fontWeight: isWide ? 700 : 400,
        fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
        cursor: disabled ? 'default' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        WebkitTapHighlightColor: 'transparent',
        opacity: disabled ? 0.45 : 1,
        transition: 'opacity 0.15s',
      }}
      onMouseEnter={e => {
        if (disabled) return;
        Object.assign(e.currentTarget.style, {
          background: 'linear-gradient(135deg,rgba(226,61,40,.10) 0%,rgba(245,166,35,.10) 100%)',
          borderColor: '#E23D28', color: '#E23D28',
        });
      }}
      onMouseLeave={e => Object.assign(e.currentTarget.style, {
        background: '#fff', borderColor: '#e8ddd2',
        color: disabled ? '#c9bfb5' : '#3d3530',
      })}
    >
      {label}
    </button>
  );
}

// ─── MathEditor ───────────────────────────────────────────────────────────────

interface MathEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function MathEditor({
  value,
  onChange,
  placeholder = 'Show your working here…',
}: MathEditorProps) {
  const divRef = useRef<HTMLDivElement>(null);
  const lastEmittedRef = useRef<string>(value);
  const chipContainersRef = useRef<Map<string, HTMLElement>>(new Map());
  const chipsRef = useRef<Map<string, ChipState>>(new Map());
  const [chips, setChips] = useState<Map<string, ChipState>>(new Map());
  // editingChip drives the edit panel rendered BELOW the contenteditable.
  // Chips inside the contenteditable are always in locked (non-editing) state,
  // which prevents iOS from focusing inputs inside the contenteditable and
  // causing the cursor to veer off-screen.
  const [editingChip, setEditingChip] = useState<EditingChipState | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [focused, setFocused] = useState(false);

  const updateChipsState = useCallback((updater: (prev: Map<string, ChipState>) => Map<string, ChipState>) => {
    setChips(prev => {
      const next = updater(prev);
      chipsRef.current = next;
      return next;
    });
  }, []);

  // ── Initialise ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (divRef.current && value) {
      divRef.current.textContent = value;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Respond to external value resets (e.g. new question)
  useEffect(() => {
    if (!divRef.current) return;
    if (value === lastEmittedRef.current) return;
    updateChipsState(() => new Map());
    chipContainersRef.current.clear();
    divRef.current.textContent = value;
    lastEmittedRef.current = value;
    setEditingChip(null);
  }, [value, updateChipsState]);

  // ── MutationObserver — detect chip deletion by Backspace/Delete ─────────────

  useEffect(() => {
    const div = divRef.current;
    if (!div) return;

    const observer = new MutationObserver(mutations => {
      let anyRemoved = false;
      for (const m of mutations) {
        for (const node of Array.from(m.removedNodes)) {
          if (node instanceof HTMLElement && node.dataset.chipId) {
            const id = node.dataset.chipId;
            chipContainersRef.current.delete(id);
            anyRemoved = true;
            updateChipsState(prev => {
              const next = new Map(prev);
              next.delete(id);
              return next;
            });
          }
        }
      }
      if (anyRemoved) {
        requestAnimationFrame(() => {
          if (!divRef.current) return;
          const text = serialise(divRef.current, chipsRef.current);
          lastEmittedRef.current = text;
          onChange(text);
        });
      }
    });

    observer.observe(div, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [onChange, updateChipsState]);

  // ── Emit ────────────────────────────────────────────────────────────────────

  const emit = useCallback(() => {
    if (!divRef.current) return;
    const text = serialise(divRef.current, chipsRef.current);
    lastEmittedRef.current = text;
    onChange(text);
  }, [onChange]);

  // ── Restore cursor after chip span ──────────────────────────────────────────
  // Places cursor in a text node immediately after the chip span.
  // iOS needs an adjacent text node to anchor the caret — setStartAfter(inlineBlock) alone
  // causes the caret to render outside the input bounds on iPadOS/iOS Safari.

  const restoreCursorAfterChip = useCallback((id: string) => {
    const el = chipContainersRef.current.get(id);
    const div = divRef.current;
    if (!el || !div) return;
    const nextSib = el.nextSibling;
    let anchorNode: Node;
    if (nextSib && nextSib.nodeType === Node.TEXT_NODE) {
      anchorNode = nextSib;
    } else {
      anchorNode = document.createTextNode('\u200B');
      nextSib ? el.parentNode?.insertBefore(anchorNode, nextSib) : el.after(anchorNode);
    }
    const r = document.createRange();
    r.setStart(anchorNode, 0);
    r.collapse(true);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(r);
    div.focus();
  }, []);

  // ── Insert text — works in contenteditable OR any focused HTML input ─────────

  const insertText = useCallback((text: string) => {
    // If any input is focused (chip panel inputs or contenteditable), insert there
    const active = document.activeElement;
    if (active instanceof HTMLInputElement) {
      const start = active.selectionStart ?? active.value.length;
      const end   = active.selectionEnd   ?? active.value.length;
      const newVal = active.value.slice(0, start) + text + active.value.slice(end);
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(active, newVal);
      active.dispatchEvent(new Event('input', { bubbles: true }));
      active.setSelectionRange(start + text.length, start + text.length);
      return;
    }

    // Otherwise insert into contenteditable at cursor
    const div = divRef.current;
    if (!div) return;
    div.focus();
    const sel = window.getSelection();
    if (!sel) return;

    let range: Range;
    if (sel.rangeCount && div.contains(sel.getRangeAt(0).commonAncestorContainer)) {
      range = sel.getRangeAt(0);
    } else {
      range = document.createRange();
      range.selectNodeContents(div);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }

    range.deleteContents();
    const node = document.createTextNode(text);
    range.insertNode(node);
    const r = document.createRange();
    r.setStartAfter(node);
    r.collapse(true);
    sel.removeAllRanges();
    sel.addRange(r);
    emit();
  }, [emit]);

  // ── Insert chip ──────────────────────────────────────────────────────────────

  const insertChip = useCallback((
    type: 'fraction' | 'power' | 'root',
    focusTarget: 'index' | 'radicand' = 'radicand',
    variant: 'simple' | 'full' = 'simple',
  ) => {
    const div = divRef.current;
    if (!div) return;

    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || !div.contains(sel.getRangeAt(0).commonAncestorContainer)) return;

    const range = sel.getRangeAt(0);
    const id = `chip-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const span = document.createElement('span');
    span.contentEditable = 'false';
    span.dataset.chipId = id;
    span.style.cssText = 'display:inline-block;vertical-align:middle;';

    range.deleteContents();
    range.insertNode(span);

    // Place cursor in a text node after the chip (not setStartAfter the inline-block)
    const nextSib = span.nextSibling;
    let anchorNode: Node;
    if (nextSib && nextSib.nodeType === Node.TEXT_NODE) {
      anchorNode = nextSib;
    } else {
      anchorNode = document.createTextNode('\u200B');
      nextSib ? span.parentNode?.insertBefore(anchorNode, nextSib) : span.after(anchorNode);
    }
    const r = document.createRange();
    r.setStart(anchorNode, 0);
    r.collapse(true);
    sel.removeAllRanges();
    sel.addRange(r);

    chipContainersRef.current.set(id, span);

    // Chips are always locked inside the contenteditable — editing happens in the
    // panel below, which keeps all inputs outside the contenteditable DOM tree.
    const newChip: ChipState =
      type === 'fraction' ? { id, type, editing: false, data: { numerator: '', denominator: '' } } :
      type === 'power'    ? { id, type, editing: false, data: { base: '', exponent: '' } } :
                            { id, type, editing: false, focusTarget, variant, data: { radicand: '', index: '', exponent: '' } };

    updateChipsState(prev => new Map(prev).set(id, newChip));

    const editState: EditingChipState =
      type === 'fraction' ? { id, type, data: { numerator: '', denominator: '' } } :
      type === 'power'    ? { id, type, data: { base: '', exponent: '' } } :
                            { id, type, data: { radicand: '', index: '', exponent: '' }, focusTarget, variant };
    setEditingChip(editState);
  }, [updateChipsState]);

  // ── Edit panel actions ───────────────────────────────────────────────────────

  const openEditPanel = useCallback((id: string) => {
    const chip = chipsRef.current.get(id);
    if (!chip) return;
    if (chip.type === 'fraction') setEditingChip({ id, type: 'fraction', data: { ...chip.data } });
    else if (chip.type === 'power') setEditingChip({ id, type: 'power', data: { ...chip.data } });
    else if (chip.type === 'root') setEditingChip({ id, type: 'root', data: { ...chip.data }, focusTarget: chip.focusTarget, variant: chip.variant });
  }, []);

  const confirmChipEdit = useCallback(() => {
    if (!editingChip) return;
    const { id, data } = editingChip;
    updateChipsState(prev => {
      const next = new Map(prev);
      const chip = next.get(id);
      if (!chip) return prev;
      return next.set(id, { ...chip, data: data as any, editing: false });
    });
    setEditingChip(null);
    requestAnimationFrame(() => {
      restoreCursorAfterChip(id);
      emit();
    });
  }, [editingChip, emit, restoreCursorAfterChip, updateChipsState]);

  const cancelChipEdit = useCallback(() => {
    if (!editingChip) return;
    const id = editingChip.id;
    setEditingChip(null);
    // Delete the chip if it was newly inserted and has no data yet
    const chip = chipsRef.current.get(id);
    if (chip) {
      const isEmpty =
        chip.type === 'fraction' ? !chip.data.numerator && !chip.data.denominator :
        chip.type === 'power'    ? !chip.data.base && !chip.data.exponent :
                                   !chip.data.radicand;
      if (isEmpty) {
        const el = chipContainersRef.current.get(id);
        if (el?.parentNode) el.parentNode.removeChild(el);
      }
    }
    requestAnimationFrame(() => divRef.current?.focus());
  }, [editingChip]);

  const deleteChip = useCallback((id: string) => {
    const el = chipContainersRef.current.get(id);
    if (el?.parentNode) el.parentNode.removeChild(el);
    // MutationObserver handles state cleanup and emit
  }, []);

  // ── Derived style ───────────────────────────────────────────────────────────

  const hasContent = value.trim().length > 0;
  const borderColor = focused ? '#E23D28' : hasContent ? 'rgba(245,166,35,0.5)' : '#d4c8bc';
  const shadow = focused
    ? '0 0 0 3px rgba(226,61,40,0.12)'
    : hasContent ? '0 0 0 3px rgba(245,166,35,0.12)' : 'none';

  const panelLabel =
    editingChip?.type === 'fraction' ? 'Fraction' :
    editingChip?.type === 'power'    ? 'Power' :
    editingChip?.type === 'root'     ? (editingChip.variant === 'full' ? 'Root' : 'Square root') :
    '';

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column' }}>

        {/* ── Toolbar ─────────────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 5,
          padding: '8px 10px',
          background: '#faf6f1',
          borderRadius: '10px 10px 0 0',
          border: '1.5px solid #d4c8bc',
          borderBottom: 'none',
          alignItems: 'center',
        }}>
          {/* Chip buttons — disabled while a chip edit panel is open */}
          <TBtn label="a/b" title="Fraction"    onPress={() => insertChip('fraction')}                     wide disabled={!!editingChip} />
          <TBtn label="xⁿ"  title="Power"       onPress={() => insertChip('power')}                       wide disabled={!!editingChip} />
          <TBtn label="√"   title="Square root" onPress={() => insertChip('root', 'radicand', 'simple')}       disabled={!!editingChip} />
          <TBtn label="ⁿ√"  title="Nth root"    onPress={() => insertChip('root', 'index', 'full')}       wide disabled={!!editingChip} />

          <span style={{ width: 1, height: 22, background: '#e8ddd2', margin: '0 2px', flexShrink: 0 }} />

          {/* Symbol buttons — work in both contenteditable and panel inputs */}
          {PRIMARY_SYMS.map(s => (
            <TBtn key={s.label} label={s.label} title={s.title} onPress={() => insertText(s.label)} />
          ))}

          <button
            type="button"
            onMouseDown={e => { e.preventDefault(); setShowMore(v => !v); }}
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

        {/* ── More symbols ─────────────────────────────────────────────────── */}
        {showMore && (
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 5,
            padding: '7px 10px',
            background: '#faf6f1',
            border: '1.5px solid #d4c8bc',
            borderTop: '1px solid #ece4da',
            borderBottom: 'none',
          }}>
            {MORE_SYMS.map(s => (
              <TBtn key={s.label} label={s.label} title={s.title} onPress={() => insertText(s.label)} />
            ))}
          </div>
        )}

        {/* ── contenteditable input ─────────────────────────────────────────── */}
        <div style={{ position: 'relative' }}>
          <div
            ref={divRef}
            contentEditable
            suppressContentEditableWarning
            onInput={emit}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
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
              borderBottomLeftRadius: editingChip ? 0 : 10,
              borderBottomRightRadius: editingChip ? 0 : 10,
              background: '#fff',
              outline: 'none',
              boxSizing: 'border-box',
              boxShadow: shadow,
              transition: 'border-color 0.15s, box-shadow 0.15s',
              overflowY: 'auto',
              wordBreak: 'break-word',
            }}
          />
          {!value && !focused && (
            <div style={{
              position: 'absolute',
              top: 14, left: 16,
              color: '#a39485',
              fontSize: 16,
              lineHeight: 1.75,
              fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
              pointerEvents: 'none',
              userSelect: 'none',
            }}>
              {placeholder}
            </div>
          )}
        </div>

        {/* ── Chip edit panel — rendered outside the contenteditable so iOS ────
             doesn't focus inputs inside the contenteditable DOM tree, which
             causes the caret to veer off-screen on iPadOS/iOS Safari.       ── */}
        {editingChip && (() => {
          const chipId = editingChip.id;
          return (
            <div style={{
              padding: '12px 14px 14px',
              background: '#faf6f1',
              border: '1.5px solid #d4c8bc',
              borderTop: '1px solid #ece4da',
              borderBottomLeftRadius: 10,
              borderBottomRightRadius: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{
                  fontSize: 12, fontWeight: 600, color: '#8c857c', letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
                }}>
                  {panelLabel}
                </span>
                <button
                  type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={cancelChipEdit}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#a39485', fontSize: 18, lineHeight: 1, padding: '2px 4px',
                    fontFamily: 'sans-serif', WebkitTapHighlightColor: 'transparent' as any,
                  }}
                  aria-label="Close"
                >✕</button>
              </div>

              {/* Chip editing inputs */}
              <div style={{ display: 'flex', alignItems: 'center' }}>
                {editingChip.type === 'fraction' && (
                  <FractionChip
                    data={editingChip.data}
                    editing={true}
                    onChange={d => setEditingChip(prev => prev ? { ...prev, data: d } : null)}
                    onLock={confirmChipEdit}
                    onEdit={() => {}}
                  />
                )}
                {editingChip.type === 'power' && (
                  <PowerChip
                    data={editingChip.data}
                    editing={true}
                    onChange={d => setEditingChip(prev => prev ? { ...prev, data: d } : null)}
                    onLock={confirmChipEdit}
                    onEdit={() => {}}
                  />
                )}
                {editingChip.type === 'root' && (
                  <RootChip
                    data={editingChip.data}
                    editing={true}
                    focusTarget={editingChip.focusTarget}
                    variant={editingChip.variant}
                    onChange={d => setEditingChip(prev => prev ? { ...prev, data: d } : null)}
                    onLock={confirmChipEdit}
                    onEdit={() => {}}
                  />
                )}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => { setEditingChip(null); deleteChip(chipId); requestAnimationFrame(() => divRef.current?.focus()); }}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: '6px 2px',
                    color: '#E23D28', fontSize: 13, fontWeight: 500,
                    fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
                    WebkitTapHighlightColor: 'transparent' as any,
                  }}
                >
                  Delete
                </button>
                <button
                  type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={confirmChipEdit}
                  style={{
                    padding: '7px 18px',
                    borderRadius: 8,
                    border: 'none',
                    background: 'linear-gradient(135deg, #E23D28 0%, #F5A623 100%)',
                    color: '#fff',
                    fontSize: 14, fontWeight: 600,
                    fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
                    cursor: 'pointer',
                    WebkitTapHighlightColor: 'transparent' as any,
                  }}
                >
                  Done ✓
                </button>
              </div>
            </div>
          );
        })()}

      </div>

      {/* ── Chip portals — always locked (editing: false) ─────────────────────── */}
      {Array.from(chips.entries()).map(([id, chip]) => {
        const el = chipContainersRef.current.get(id);
        if (!el) return null;

        if (chip.type === 'fraction') {
          return (
            <React.Fragment key={id}>
              {createPortal(
                <FractionChip
                  data={chip.data}
                  editing={false}
                  onChange={() => {}}
                  onLock={() => {}}
                  onEdit={() => openEditPanel(id)}
                />,
                el
              )}
            </React.Fragment>
          );
        }

        if (chip.type === 'power') {
          return (
            <React.Fragment key={id}>
              {createPortal(
                <PowerChip
                  data={chip.data}
                  editing={false}
                  onChange={() => {}}
                  onLock={() => {}}
                  onEdit={() => openEditPanel(id)}
                />,
                el
              )}
            </React.Fragment>
          );
        }

        if (chip.type === 'root') {
          return (
            <React.Fragment key={id}>
              {createPortal(
                <RootChip
                  data={chip.data}
                  editing={false}
                  focusTarget={chip.focusTarget}
                  variant={chip.variant}
                  onChange={() => {}}
                  onLock={() => {}}
                  onEdit={() => openEditPanel(id)}
                />,
                el
              )}
            </React.Fragment>
          );
        }

        return null;
      })}
    </>
  );
}
