import { useState, useEffect, useRef, useCallback } from 'react';
import katex from 'katex';

// ═══════════════════════════════════════════════════════════════════════
// SYMBOL DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════

interface SymbolDef {
  display: string;
  insert: string;
  label: string;
  cursorOffset?: number;
  isFraction?: boolean;
}

interface SymbolGroup {
  label: string;
  isTextGroup?: boolean;
  symbols: SymbolDef[];
}

const SYMBOL_GROUPS: SymbolGroup[] = [
  {
    label: 'Common',
    symbols: [
      { display: '×', insert: ' \\times ', label: 'Multiply' },
      { display: '÷', insert: ' \\div ', label: 'Divide' },
      { display: '±', insert: ' \\pm ', label: 'Plus/minus' },
      { display: 'π', insert: '\\pi', label: 'Pi' },
      { display: '°', insert: '°', label: 'Degree' },
      { display: '∞', insert: '\\infty', label: 'Infinity' },
    ],
  },
  {
    label: 'Powers & Roots',
    symbols: [
      { display: 'x²', insert: '^{2}', label: 'Squared', cursorOffset: 0 },
      { display: 'x³', insert: '^{3}', label: 'Cubed', cursorOffset: 0 },
      { display: 'xⁿ', insert: '^{}', label: 'Power', cursorOffset: -1 },
      {
        display: '√',
        insert: '\\sqrt{}',
        label: 'Square root',
        cursorOffset: -1,
      },
      {
        display: '∛',
        insert: '\\sqrt[3]{}',
        label: 'Cube root',
        cursorOffset: -1,
      },
      {
        display: 'ⁿ√',
        insert: '\\sqrt[]{}',
        label: 'nth root',
        cursorOffset: -4,
      },
    ],
  },
  {
    label: 'Trig',
    isTextGroup: true,
    symbols: [
      { display: 'sin', insert: '\\sin()', label: 'Sine', cursorOffset: -1 },
      { display: 'cos', insert: '\\cos()', label: 'Cosine', cursorOffset: -1 },
      { display: 'tan', insert: '\\tan()', label: 'Tangent', cursorOffset: -1 },
      {
        display: 'sin⁻¹',
        insert: '\\sin^{-1}()',
        label: 'Inverse sine',
        cursorOffset: -1,
      },
      {
        display: 'cos⁻¹',
        insert: '\\cos^{-1}()',
        label: 'Inverse cosine',
        cursorOffset: -1,
      },
      {
        display: 'tan⁻¹',
        insert: '\\tan^{-1}()',
        label: 'Inverse tangent',
        cursorOffset: -1,
      },
    ],
  },
  {
    label: 'Functions',
    isTextGroup: true,
    symbols: [
      { display: 'e', insert: 'e', label: "Euler's number" },
      {
        display: 'eⁿ',
        insert: 'e^{}',
        label: 'e to the power',
        cursorOffset: -1,
      },
      {
        display: 'log',
        insert: '\\log()',
        label: 'Logarithm',
        cursorOffset: -1,
      },
      {
        display: 'ln',
        insert: '\\ln()',
        label: 'Natural log',
        cursorOffset: -1,
      },
      { display: 'Σ', insert: '\\sum', label: 'Summation' },
    ],
  },
  {
    label: 'Fractions & Sub',
    symbols: [
      {
        display: 'a/b',
        insert: '\\frac{}{}',
        label: 'Fraction',
        cursorOffset: -3,
        isFraction: true,
      },
      { display: 'xₙ', insert: '_{}', label: 'Subscript', cursorOffset: -1 },
    ],
  },
  {
    label: 'Comparison',
    symbols: [
      { display: '≤', insert: ' \\leq ', label: 'Less/equal' },
      { display: '≥', insert: ' \\geq ', label: 'Greater/equal' },
      { display: '≠', insert: ' \\neq ', label: 'Not equal' },
      { display: '≈', insert: ' \\approx ', label: 'Approximately' },
    ],
  },
  {
    label: 'Greek',
    symbols: [
      { display: 'θ', insert: '\\theta', label: 'Theta' },
      { display: 'α', insert: '\\alpha', label: 'Alpha' },
      { display: 'β', insert: '\\beta', label: 'Beta' },
      { display: 'λ', insert: '\\lambda', label: 'Lambda' },
      { display: 'Δ', insert: '\\Delta', label: 'Delta' },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════════
// PROTECTED BLOCK SYSTEM
// ═══════════════════════════════════════════════════════════════════════

interface Block {
  start: number;
  end: number;
  fullMatch: string;
  slots: { start: number; end: number }[];
}

interface BlockPattern {
  regex: RegExp;
  slotCount: number;
  dynamic?: boolean;
  prefix?: string;
  middle?: string;
  suffix?: string;
}

const BLOCK_PATTERNS: BlockPattern[] = [
  // \sin^{-1}() — inverse trig with parens
  {
    regex: /\\(sin|cos|tan)\^\{-1\}\(([^()]*)\)/g,
    slotCount: 1,
    dynamic: true,
  },
  // \frac{}{} — two slots
  {
    regex: /\\frac\{([^{}]*)\}\{([^{}]*)\}/g,
    slotCount: 2,
    prefix: '\\frac{',
    middle: '}{',
    suffix: '}',
  },
  // \sqrt[n]{} — two slots
  {
    regex: /\\sqrt\[([^\[\]]*)\]\{([^{}]*)\}/g,
    slotCount: 2,
    prefix: '\\sqrt[',
    middle: ']{',
    suffix: '}',
  },
  // \sqrt{} — one slot
  {
    regex: /\\sqrt\{([^{}]*)\}/g,
    slotCount: 1,
    prefix: '\\sqrt{',
    suffix: '}',
  },
  // \sin() \cos() \tan() \log() \ln() — one slot (parens)
  { regex: /\\(sin|cos|tan|log|ln)\(([^()]*)\)/g, slotCount: 1, dynamic: true },
  // e^{} — one slot
  { regex: /e\^\{([^{}]*)\}/g, slotCount: 1, prefix: 'e^{', suffix: '}' },
  // ^{} — one slot
  { regex: /\^\{([^{}]*)\}/g, slotCount: 1, prefix: '^{', suffix: '}' },
  // _{} — one slot
  { regex: /_\{([^{}]*)\}/g, slotCount: 1, prefix: '_{', suffix: '}' },
];

function rebuildBlocks(text: string): Block[] {
  let blocks: Block[] = [];
  for (const pat of BLOCK_PATTERNS) {
    pat.regex.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = pat.regex.exec(text)) !== null) {
      const blockStart = m.index;
      const blockEnd = m.index + m[0].length;
      const slots: { start: number; end: number }[] = [];

      if (pat.dynamic) {
        const parenOpen = m[0].lastIndexOf('(');
        const parenClose = m[0].lastIndexOf(')');
        slots.push({
          start: blockStart + parenOpen + 1,
          end: blockStart + parenClose,
        });
      } else if (pat.slotCount === 1 && pat.prefix && pat.suffix) {
        const prefixEnd = blockStart + pat.prefix.length;
        const suffixStart = blockEnd - pat.suffix.length;
        slots.push({ start: prefixEnd, end: suffixStart });
      } else if (
        pat.slotCount === 2 &&
        pat.prefix &&
        pat.middle &&
        pat.suffix
      ) {
        const slot1Start = blockStart + pat.prefix.length;
        const slot1End = slot1Start + m[1].length;
        slots.push({ start: slot1Start, end: slot1End });
        const slot2Start = slot1End + pat.middle.length;
        const slot2End = slot2Start + m[2].length;
        slots.push({ start: slot2Start, end: slot2End });
      }

      blocks.push({ start: blockStart, end: blockEnd, fullMatch: m[0], slots });
    }
  }

  blocks.sort((a, b) => a.start - b.start);
  // Remove blocks contained within larger blocks
  blocks = blocks.filter((block, i) => {
    for (let j = 0; j < blocks.length; j++) {
      if (
        i !== j &&
        block.start >= blocks[j].start &&
        block.end <= blocks[j].end &&
        block.fullMatch.length < blocks[j].fullMatch.length
      ) {
        return false;
      }
    }
    return true;
  });

  return blocks;
}

function findBlockAtCursor(blocks: Block[], pos: number): Block | null {
  for (const block of blocks) {
    if (pos >= block.start && pos <= block.end) return block;
  }
  return null;
}

function findSlotAtCursor(block: Block, pos: number): number {
  for (let i = 0; i < block.slots.length; i++) {
    if (pos >= block.slots[i].start && pos <= block.slots[i].end) return i;
  }
  return -1;
}

function isInStructuralPart(block: Block, pos: number): boolean {
  for (const slot of block.slots) {
    if (pos >= slot.start && pos <= slot.end) return false;
  }
  return true;
}

// ═══════════════════════════════════════════════════════════════════════
// KATEX PREVIEW
// ═══════════════════════════════════════════════════════════════════════

function KaTeXPreview({ text }: { text: string }) {
  const trimmed = text.trim();

  if (!trimmed) {
    return (
      <span className="text-muted-foreground/50 italic text-sm">
        Your maths will appear here as you type...
      </span>
    );
  }

  const lines = trimmed.split('\n').filter((line) => line.trim() !== '');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {lines.map((line, i) => (
        <KaTeXLine key={i} line={line} />
      ))}
    </div>
  );
}

function KaTeXLine({ line }: { line: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    try {
      ref.current.innerHTML = katex.renderToString(line.trim(), {
        displayMode: true,
        throwOnError: false,
      });
    } catch {
      ref.current.textContent = line;
    }
  }, [line]);

  return <div ref={ref} style={{ minHeight: 24, lineHeight: 1.6 }} />;
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════

interface MathInputToolbarProps {
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  value: string;
  onChange: (value: string) => void;
}

export function MathInputToolbar({
  textareaRef,
  value,
  onChange,
}: MathInputToolbarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [previewOn, setPreviewOn] = useState(true);

  // ── Insert symbol ──
  const insertSymbol = useCallback(
    (sym: SymbolDef) => {
      const ta = textareaRef.current;
      if (!ta) return;

      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const before = value.substring(0, start);
      const after = value.substring(end);
      const selected = value.substring(start, end);

      let newVal: string;
      let cursorPos: number;

      if (selected && sym.insert.includes('{}')) {
        const ins = sym.insert.replace('{}', `{${selected}}`);
        newVal = before + ins + after;
        cursorPos = sym.isFraction
          ? before.length + ins.length - 1
          : before.length + ins.length;
      } else if (selected && sym.insert.includes('()')) {
        const ins = sym.insert.replace('()', `(${selected})`);
        newVal = before + ins + after;
        cursorPos = before.length + ins.length;
      } else {
        newVal = before + sym.insert + after;
        cursorPos =
          sym.cursorOffset !== undefined
            ? before.length + sym.insert.length + sym.cursorOffset
            : before.length + sym.insert.length;
      }

      onChange(newVal);
      requestAnimationFrame(() => {
        ta.focus();
        ta.setSelectionRange(cursorPos, cursorPos);
      });
    },
    [value, onChange, textareaRef]
  );

  // ── Protected block keyboard handler ──
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;

    function handleKeyDown(e: KeyboardEvent) {
      const text = ta!.value;
      const pos = ta!.selectionStart;
      const selEnd = ta!.selectionEnd;
      const hasSelection = pos !== selEnd;
      const blocks = rebuildBlocks(text);

      // ── BACKSPACE ──
      if (e.key === 'Backspace' && !hasSelection) {
        const charBefore = pos - 1;
        if (charBefore < 0) return;

        const blockAtCursor = findBlockAtCursor(blocks, pos);
        const blockBefore = findBlockAtCursor(blocks, charBefore);

        if (blockAtCursor) {
          const slotIdx = findSlotAtCursor(blockAtCursor, pos);
          if (slotIdx >= 0) {
            const slot = blockAtCursor.slots[slotIdx];
            if (pos === slot.start && slot.start === slot.end) {
              const allEmpty = blockAtCursor.slots.every(
                (s) => s.start === s.end
              );
              if (allEmpty) {
                e.preventDefault();
                deleteBlock(blockAtCursor);
                return;
              }
              e.preventDefault();
              if (slotIdx > 0) {
                ta!.setSelectionRange(
                  blockAtCursor.slots[slotIdx - 1].end,
                  blockAtCursor.slots[slotIdx - 1].end
                );
              } else {
                ta!.setSelectionRange(blockAtCursor.start, blockAtCursor.start);
              }
              return;
            }
          }
        }

        if (blockAtCursor && isInStructuralPart(blockAtCursor, pos)) {
          e.preventDefault();
          deleteBlock(blockAtCursor);
          return;
        }

        if (
          !blockAtCursor &&
          blockBefore &&
          charBefore === blockBefore.end - 1
        ) {
          e.preventDefault();
          deleteBlock(blockBefore);
          return;
        }

        if (blockBefore && isInStructuralPart(blockBefore, charBefore)) {
          e.preventDefault();
          deleteBlock(blockBefore);
          return;
        }
        return;
      }

      // ── DELETE ──
      if (e.key === 'Delete' && !hasSelection) {
        if (pos >= text.length) return;

        const blockAtCursor = findBlockAtCursor(blocks, pos);
        const blockAfter = findBlockAtCursor(blocks, pos + 1);

        if (blockAtCursor && isInStructuralPart(blockAtCursor, pos)) {
          e.preventDefault();
          deleteBlock(blockAtCursor);
          return;
        }

        if (blockAfter && isInStructuralPart(blockAfter, pos)) {
          e.preventDefault();
          deleteBlock(blockAfter);
          return;
        }

        if (blockAtCursor) {
          const slotIdx = findSlotAtCursor(blockAtCursor, pos);
          if (slotIdx >= 0 && pos === blockAtCursor.slots[slotIdx].end) {
            e.preventDefault();
            if (slotIdx < blockAtCursor.slots.length - 1) {
              ta!.setSelectionRange(
                blockAtCursor.slots[slotIdx + 1].start,
                blockAtCursor.slots[slotIdx + 1].start
              );
            } else {
              ta!.setSelectionRange(blockAtCursor.end, blockAtCursor.end);
            }
            return;
          }
        }
        return;
      }

      // ── ARROW LEFT ──
      if (e.key === 'ArrowLeft' && !hasSelection && !e.shiftKey) {
        const charBefore = pos - 1;
        if (charBefore < 0) return;

        const blockBefore = findBlockAtCursor(blocks, charBefore);
        if (blockBefore && isInStructuralPart(blockBefore, charBefore)) {
          e.preventDefault();
          let targetPos = blockBefore.start;
          for (let i = blockBefore.slots.length - 1; i >= 0; i--) {
            if (blockBefore.slots[i].end <= charBefore) {
              targetPos = blockBefore.slots[i].end;
              break;
            }
          }
          ta!.setSelectionRange(targetPos, targetPos);
          return;
        }
      }

      // ── ARROW RIGHT ──
      if (e.key === 'ArrowRight' && !hasSelection && !e.shiftKey) {
        if (pos >= text.length) return;

        const blockAt = findBlockAtCursor(blocks, pos);
        if (blockAt) {
          const slotIdx = findSlotAtCursor(blockAt, pos);
          if (slotIdx >= 0 && pos === blockAt.slots[slotIdx].end) {
            e.preventDefault();
            if (slotIdx < blockAt.slots.length - 1) {
              ta!.setSelectionRange(
                blockAt.slots[slotIdx + 1].start,
                blockAt.slots[slotIdx + 1].start
              );
            } else {
              ta!.setSelectionRange(blockAt.end, blockAt.end);
            }
            return;
          }
        }

        const blockAfter = findBlockAtCursor(blocks, pos + 1);
        if (blockAfter && isInStructuralPart(blockAfter, pos + 1)) {
          e.preventDefault();
          if (blockAfter.slots.length > 0) {
            ta!.setSelectionRange(
              blockAfter.slots[0].start,
              blockAfter.slots[0].start
            );
          } else {
            ta!.setSelectionRange(blockAfter.end, blockAfter.end);
          }
          return;
        }
      }

      // ── TAB ──
      if (e.key === 'Tab') {
        const blockAt = findBlockAtCursor(blocks, pos);
        if (blockAt && blockAt.slots.length > 1) {
          e.preventDefault();
          const slotIdx = findSlotAtCursor(blockAt, pos);
          if (slotIdx >= 0) {
            const nextSlot = e.shiftKey
              ? slotIdx > 0
                ? slotIdx - 1
                : blockAt.slots.length - 1
              : slotIdx < blockAt.slots.length - 1
                ? slotIdx + 1
                : 0;
            const target = blockAt.slots[nextSlot];
            ta!.setSelectionRange(target.start, target.end);
          }
          return;
        }
      }
    }

    function deleteBlock(block: Block) {
      const text = ta!.value;
      const newVal = text.substring(0, block.start) + text.substring(block.end);
      // We need to update via the onChange prop
      onChange(newVal);
      requestAnimationFrame(() => {
        ta!.setSelectionRange(block.start, block.start);
      });
    }

    ta.addEventListener('keydown', handleKeyDown);
    return () => ta.removeEventListener('keydown', handleKeyDown);
  }, [textareaRef, value, onChange]);

  const hasContent = value.trim().length > 0;

  return (
    <div className="math-input-toolbar">
      {/* Toolbar row */}
      <div className="flex items-center justify-between mb-2">
        {/* fx button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="math-toolbar-trigger"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            borderRadius: 8,
            border: isOpen ? '1.5px solid #E23D28' : '1.5px solid #d4c8bc',
            background: isOpen
              ? 'linear-gradient(135deg, rgba(226,61,40,0.08) 0%, rgba(245,166,35,0.08) 100%)'
              : '#fff',
            color: isOpen ? '#E23D28' : '#6b5e52',
            fontSize: 14,
            fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: isOpen
              ? '0 0 0 3px rgba(226,61,40,0.1)'
              : '0 1px 2px rgba(0,0,0,0.06)',
          }}
          title="Insert maths symbols"
        >
          <span style={{ fontSize: 16, fontStyle: 'italic', fontWeight: 600 }}>
            f<span style={{ fontSize: 11, verticalAlign: 'sub' }}>x</span>
          </span>
          <span style={{ fontSize: 12 }}>Maths</span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            style={{
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease',
            }}
          >
            <path
              d="M2.5 4.5L6 8L9.5 4.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {/* Preview toggle */}
        <button
          onClick={() => setPreviewOn(!previewOn)}
          style={{
            fontSize: 12,
            color: previewOn ? '#E23D28' : '#a39485',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M1 7s2.5-4 6-4 6 4 6 4-2.5 4-6 4-6-4-6-4z"
              stroke="currentColor"
              strokeWidth="1.2"
            />
            {previewOn ? (
              <circle
                cx="7"
                cy="7"
                r="2"
                stroke="currentColor"
                strokeWidth="1.2"
              />
            ) : (
              <line
                x1="2"
                y1="12"
                x2="12"
                y2="2"
                stroke="currentColor"
                strokeWidth="1.2"
              />
            )}
          </svg>
          {previewOn ? 'Preview on' : 'Preview off'}
        </button>
      </div>

      {/* Inline symbol panel */}
      <div
        style={{
          overflow: 'hidden',
          maxHeight: isOpen ? 800 : 0,
          opacity: isOpen ? 1 : 0,
          transition:
            'max-height 0.3s ease, opacity 0.2s ease, margin 0.3s ease',
          marginBottom: isOpen ? 10 : 0,
          background: '#faf6f1',
          borderRadius: 10,
          border: isOpen ? '1px solid #e8ddd2' : '1px solid transparent',
        }}
      >
        <div style={{ padding: '12px 14px' }}>
          {SYMBOL_GROUPS.map((group) => (
            <div key={group.label} style={{ marginBottom: 10 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: '#a39485',
                  textTransform: 'uppercase',
                  letterSpacing: '0.8px',
                  marginBottom: 5,
                  paddingLeft: 2,
                  fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
                }}
              >
                {group.label}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {group.symbols.map((sym) => (
                  <button
                    key={sym.label}
                    onClick={() => insertSymbol(sym)}
                    title={sym.label}
                    style={{
                      minWidth: 44,
                      height: 40,
                      padding: '4px 10px',
                      borderRadius: 8,
                      border: '1px solid #e8ddd2',
                      background: '#fff',
                      color: '#3d3530',
                      fontSize: group.isTextGroup ? 13 : 18,
                      fontWeight: group.isTextGroup ? 600 : 400,
                      fontFamily:
                        "'Helvetica Neue', Helvetica, Arial, sans-serif",
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.15s ease',
                      WebkitTapHighlightColor: 'transparent',
                    }}
                    onMouseEnter={(e) => {
                      Object.assign(e.currentTarget.style, {
                        background:
                          'linear-gradient(135deg, rgba(226,61,40,0.1) 0%, rgba(245,166,35,0.1) 100%)',
                        borderColor: '#E23D28',
                        color: '#E23D28',
                        transform: 'translateY(-1px)',
                        boxShadow: '0 2px 8px rgba(226,61,40,0.15)',
                      });
                    }}
                    onMouseLeave={(e) => {
                      Object.assign(e.currentTarget.style, {
                        background: '#fff',
                        borderColor: '#e8ddd2',
                        color: '#3d3530',
                        transform: 'translateY(0)',
                        boxShadow: 'none',
                      });
                    }}
                  >
                    {sym.display}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* KaTeX preview panel — shown below the textarea (rendered by parent) */}
      {previewOn && (
        <div
          style={{
            padding: '14px 16px',
            borderRadius: '0 0 10px 10px',
            background: hasContent ? '#fff' : '#fefcfa',
            border: hasContent
              ? '2px solid rgba(245,166,35,0.5)'
              : '1.5px solid #e0d6cb',
            borderTop: 'none',
            boxShadow: hasContent ? '0 0 0 3px rgba(245,166,35,0.12)' : 'none',
            minHeight: 48,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            transition: 'all 0.2s ease',
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: hasContent ? '#E23D28' : '#b5a99a',
              textTransform: 'uppercase',
              letterSpacing: '0.8px',
              flexShrink: 0,
              padding: '3px 8px',
              borderRadius: 4,
              background: hasContent
                ? 'linear-gradient(135deg, rgba(226,61,40,0.08) 0%, rgba(245,166,35,0.08) 100%)'
                : 'transparent',
            }}
          >
            Preview
          </span>
          <div
            style={{
              flex: 1,
              fontSize: 18,
              color: '#3d3530',
              overflow: 'hidden',
            }}
          >
            <KaTeXPreview text={value} />
          </div>
        </div>
      )}

      {/* Hint for empty state */}
      {!hasContent && (
        <p
          className="text-muted-foreground/50"
          style={{ fontSize: 12, marginTop: 10, lineHeight: 1.5 }}
        >
          <strong style={{ color: '#a39485' }}>Tip:</strong> Use the{' '}
          <em style={{ fontStyle: 'italic' }}>f</em>
          <sub style={{ fontSize: 10 }}>x</sub> button for maths symbols, or
          just type your answer normally — both ways work fine.
        </p>
      )}
    </div>
  );
}
