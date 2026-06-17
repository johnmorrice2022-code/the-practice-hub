import React from 'react';

const INK = '#1C1917';
const PAPER = '#ffffff';
const FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif";
const SW = 2;

const wire = (x1: number, y1: number, x2: number, y2: number) => (
  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={INK} strokeWidth={SW} strokeLinecap="square" />
);

interface SymbolEntry {
  name: string;
  body: () => React.ReactNode;
}

const SYMBOLS: SymbolEntry[] = [
  {
    name: 'Cell',
    body: () => (
      <g>
        {wire(-20, 0, -5, 0)}
        {wire(5, 0, 20, 0)}
        <line x1={-5} y1={-15} x2={-5} y2={15} stroke={INK} strokeWidth={SW} />
        <line x1={5} y1={-8} x2={5} y2={8} stroke={INK} strokeWidth={5} />
      </g>
    ),
  },
  {
    name: 'Battery',
    body: () => (
      <g>
        {wire(-28, 0, -15, 0)}
        {wire(15, 0, 28, 0)}
        <line x1={-15} y1={-15} x2={-15} y2={15} stroke={INK} strokeWidth={SW} />
        <line x1={-7} y1={-8} x2={-7} y2={8} stroke={INK} strokeWidth={5} />
        <line x1={7} y1={-15} x2={7} y2={15} stroke={INK} strokeWidth={SW} />
        <line x1={15} y1={-8} x2={15} y2={8} stroke={INK} strokeWidth={5} />
      </g>
    ),
  },
  {
    name: 'Switch (open)',
    body: () => (
      <g>
        {wire(-24, 0, -12, 0)}
        {wire(12, 0, 24, 0)}
        <circle cx={-12} cy={0} r={3} fill={INK} />
        <circle cx={12} cy={0} r={3} fill={INK} />
        {wire(-12, 0, 10, -14)}
      </g>
    ),
  },
  {
    name: 'Switch (closed)',
    body: () => (
      <g>
        {wire(-24, 0, 24, 0)}
        <circle cx={-12} cy={0} r={3} fill={INK} />
        <circle cx={12} cy={0} r={3} fill={INK} />
      </g>
    ),
  },
  {
    name: 'Lamp',
    body: () => (
      <g>
        {wire(-24, 0, -14, 0)}
        {wire(14, 0, 24, 0)}
        <circle cx={0} cy={0} r={14} fill={PAPER} stroke={INK} strokeWidth={SW} />
        <line x1={-9.9} y1={-9.9} x2={9.9} y2={9.9} stroke={INK} strokeWidth={SW} />
        <line x1={-9.9} y1={9.9} x2={9.9} y2={-9.9} stroke={INK} strokeWidth={SW} />
      </g>
    ),
  },
  {
    name: 'Fuse',
    body: () => (
      <g>
        {wire(-24, 0, 24, 0)}
        <rect x={-18} y={-8} width={36} height={16} fill="none" stroke={INK} strokeWidth={SW} />
      </g>
    ),
  },
  {
    name: 'Resistor',
    body: () => (
      <g>
        {wire(-24, 0, -18, 0)}
        {wire(18, 0, 24, 0)}
        <rect x={-18} y={-9} width={36} height={18} fill={PAPER} stroke={INK} strokeWidth={SW} />
      </g>
    ),
  },
  {
    name: 'Variable resistor',
    body: () => (
      <g>
        {wire(-28, 0, -18, 0)}
        {wire(18, 0, 28, 0)}
        <rect x={-18} y={-9} width={36} height={18} fill={PAPER} stroke={INK} strokeWidth={SW} />
        <line x1={-23} y1={14} x2={20} y2={-14} stroke={INK} strokeWidth={SW} markerEnd="url(#grid-arr)" />
      </g>
    ),
  },
  {
    name: 'Thermistor',
    body: () => (
      <g>
        {wire(-28, 0, -18, 0)}
        {wire(18, 0, 28, 0)}
        <rect x={-18} y={-9} width={36} height={18} fill={PAPER} stroke={INK} strokeWidth={SW} />
        <path d="M -28 18 L -16 18 L 19 -14" fill="none" stroke={INK} strokeWidth={SW} />
      </g>
    ),
  },
  {
    name: 'LDR',
    body: () => (
      <g>
        {wire(-28, 0, -17, 0)}
        {wire(17, 0, 28, 0)}
        <circle cx={0} cy={0} r={17} fill={PAPER} stroke={INK} strokeWidth={SW} />
        <rect x={-11} y={-6} width={22} height={12} fill={PAPER} stroke={INK} strokeWidth={SW} />
        <line x1={-28} y1={-28} x2={-16} y2={-16} stroke={INK} strokeWidth={SW} markerEnd="url(#grid-arr)" />
        <line x1={-18} y1={-30} x2={-6} y2={-18} stroke={INK} strokeWidth={SW} markerEnd="url(#grid-arr)" />
      </g>
    ),
  },
  {
    name: 'Diode',
    body: () => (
      <g>
        {wire(-28, 0, -15, 0)}
        {wire(15, 0, 28, 0)}
        <circle cx={0} cy={0} r={15} fill={PAPER} stroke={INK} strokeWidth={SW} />
        {wire(-15, 0, -7, 0)}
        {wire(7, 0, 15, 0)}
        <path d="M -7 -7 L -7 7 L 7 0 Z" fill={INK} />
        <line x1={7} y1={-7} x2={7} y2={7} stroke={INK} strokeWidth={SW} />
      </g>
    ),
  },
  {
    name: 'LED',
    body: () => (
      <g>
        {wire(-28, 0, -15, 0)}
        {wire(15, 0, 28, 0)}
        <circle cx={0} cy={0} r={15} fill={PAPER} stroke={INK} strokeWidth={SW} />
        {wire(-15, 0, -7, 0)}
        {wire(7, 0, 15, 0)}
        <path d="M -7 -7 L -7 7 L 7 0 Z" fill={INK} />
        <line x1={7} y1={-7} x2={7} y2={7} stroke={INK} strokeWidth={SW} />
        <line x1={9} y1={-12} x2={18} y2={-22} stroke={INK} strokeWidth={SW} markerEnd="url(#grid-arr)" />
        <line x1={15} y1={-8} x2={24} y2={-18} stroke={INK} strokeWidth={SW} markerEnd="url(#grid-arr)" />
      </g>
    ),
  },
  {
    name: 'Ammeter',
    body: () => (
      <g>
        {wire(-28, 0, -14, 0)}
        {wire(14, 0, 28, 0)}
        <circle cx={0} cy={0} r={14} fill={PAPER} stroke={INK} strokeWidth={SW} />
        <text x={0} y={5} textAnchor="middle" fontFamily={FONT} fontSize={14} fontWeight={700} fill={INK}>A</text>
      </g>
    ),
  },
  {
    name: 'Voltmeter',
    body: () => (
      <g>
        {wire(-28, 0, -14, 0)}
        {wire(14, 0, 28, 0)}
        <circle cx={0} cy={0} r={14} fill={PAPER} stroke={INK} strokeWidth={SW} />
        <text x={0} y={5} textAnchor="middle" fontFamily={FONT} fontSize={14} fontWeight={700} fill={INK}>V</text>
      </g>
    ),
  },
];

const COLS = 4;
const CELL_W = 90;
const CELL_H = 80;
const SYMBOL_Y = -4;
const LABEL_Y = 28;

export const CircuitSymbolGrid: React.FC = () => {
  const rows = Math.ceil(SYMBOLS.length / COLS);
  const svgW = COLS * CELL_W;
  const svgH = rows * CELL_H;

  return (
    <div className="flex justify-center py-4 px-2">
      <div
        className="bg-[#FAF7F2] border border-border/40 rounded-lg p-4 w-full"
        style={{ maxWidth: 480 }}
      >
        <svg
          viewBox={`0 0 ${svgW} ${svgH}`}
          width="100%"
          style={{ display: 'block' }}
          role="img"
        >
          <title>Circuit symbols reference</title>
          <desc>
            Grid showing {SYMBOLS.length} standard AQA circuit symbols: {SYMBOLS.map(s => s.name).join(', ')}.
          </desc>
          <defs>
            <marker
              id="grid-arr"
              markerWidth="9"
              markerHeight="8"
              refX="6.5"
              refY="3"
              orient="auto"
              markerUnits="userSpaceOnUse"
            >
              <path d="M0,0 L7.5,3 L0,6 Z" fill={INK} />
            </marker>
          </defs>
          {SYMBOLS.map((sym, i) => {
            const col = i % COLS;
            const row = Math.floor(i / COLS);
            const cx = col * CELL_W + CELL_W / 2;
            const cy = row * CELL_H + CELL_H / 2;
            return (
              <g key={sym.name} transform={`translate(${cx}, ${cy})`}>
                <g transform={`translate(0, ${SYMBOL_Y})`}>
                  {sym.body()}
                </g>
                <text
                  x={0}
                  y={LABEL_Y}
                  textAnchor="middle"
                  fontFamily={FONT}
                  fontSize={9}
                  fill={INK}
                >
                  {sym.name}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};
