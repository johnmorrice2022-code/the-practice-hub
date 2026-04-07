import { useState } from 'react';

type Part =
  | 'radius'
  | 'diameter'
  | 'tangent'
  | 'chord'
  | 'arc'
  | 'sector'
  | 'segment';

const PARTS: { id: Part; label: string; color: string }[] = [
  { id: 'radius', label: 'Radius', color: '#2563EB' },
  { id: 'diameter', label: 'Diameter', color: '#DC2626' },
  { id: 'tangent', label: 'Tangent', color: '#16A34A' },
  { id: 'chord', label: 'Chord', color: '#9333EA' },
  { id: 'arc', label: 'Arc', color: '#EA580C' },
  { id: 'sector', label: 'Sector', color: '#0891B2' },
  { id: 'segment', label: 'Segment', color: '#BE185D' },
];

export default function CirclePartsToggle() {
  const [active, setActive] = useState<Set<Part>>(new Set());

  const toggle = (part: Part) => {
    setActive((prev) => {
      const next = new Set(prev);
      next.has(part) ? next.delete(part) : next.add(part);
      return next;
    });
  };

  const clearAll = () => setActive(new Set());

  const on = (part: Part) => active.has(part);

  return (
    <div className="rounded-xl border border-[#E7E0D6] bg-white p-6">
      <h3 className="font-serif text-xl font-semibold text-[#1C1917] mb-1">
        Parts of a Circle
      </h3>
      <p className="text-sm text-[#78716C] mb-6">
        Toggle each button to show or hide that part of the circle.
      </p>

      <div className="flex flex-col sm:flex-row gap-6 items-center">
        {/* SVG Diagram */}
        <div className="flex-shrink-0 rounded-xl border border-[#F0EAE0] bg-[#FAF7F2] p-4">
          <svg
            viewBox="0 0 260 260"
            width="220"
            height="220"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Base circle — always visible */}
            <circle
              cx="130"
              cy="130"
              r="100"
              fill="none"
              stroke="#1C1917"
              strokeWidth="2"
            />
            <circle cx="130" cy="130" r="3.5" fill="#1C1917" />

            {/* RADIUS — blue, angle 50° */}
            <line
              x1="130"
              y1="130"
              x2="194.3"
              y2="53.4"
              stroke="#2563EB"
              strokeWidth="2.5"
              strokeLinecap="round"
              style={{
                opacity: on('radius') ? 1 : 0,
                transition: 'opacity 0.2s ease',
              }}
            />

            {/* DIAMETER — red, horizontal */}
            <line
              x1="30"
              y1="130"
              x2="230"
              y2="130"
              stroke="#DC2626"
              strokeWidth="2.5"
              strokeLinecap="round"
              style={{
                opacity: on('diameter') ? 1 : 0,
                transition: 'opacity 0.2s ease',
              }}
            />

            {/* TANGENT — green, at point (194.3, 53.4), perpendicular to radius at 50° */}
            <line
              x1="139.1"
              y1="7.1"
              x2="249.5"
              y2="99.7"
              stroke="#16A34A"
              strokeWidth="2.5"
              strokeLinecap="round"
              style={{
                opacity: on('tangent') ? 1 : 0,
                transition: 'opacity 0.2s ease',
              }}
            />
            <circle
              cx="194.3"
              cy="53.4"
              r="3.5"
              fill="#16A34A"
              style={{
                opacity: on('tangent') ? 1 : 0,
                transition: 'opacity 0.2s ease',
              }}
            />

            {/* CHORD — purple, vertical-ish, well away from diameter */}
            <line
              x1="72.6"
              y1="48.1"
              x2="72.6"
              y2="211.9"
              stroke="#9333EA"
              strokeWidth="2.5"
              strokeLinecap="round"
              style={{
                opacity: on('chord') ? 1 : 0,
                transition: 'opacity 0.2s ease',
              }}
            />

            {/* ARC — orange, from 30° to 110° */}
            <path
              d="M 216.6,80 A 100,100 0 0,0 95.8,36"
              fill="none"
              stroke="#EA580C"
              strokeWidth="3.5"
              strokeLinecap="round"
              style={{
                opacity: on('arc') ? 1 : 0,
                transition: 'opacity 0.2s ease',
              }}
            />

            {/* SECTOR — cyan, 200° to 290° */}
            <path
              d="M 130,130 L 36,164.2 A 100,100 0 0,0 164.2,224 Z"
              fill="#0891B2"
              fillOpacity={0.3}
              stroke="#0891B2"
              strokeWidth="2"
              style={{
                opacity: on('sector') ? 1 : 0,
                transition: 'opacity 0.2s ease',
              }}
            />

            {/* SEGMENT — pink, chord from 210° to 330° */}
            <path
              d="M 43.4,180 A 100,100 0 0,0 216.6,180 Z"
              fill="#BE185D"
              fillOpacity={0.3}
              stroke="#BE185D"
              strokeWidth="2"
              style={{
                opacity: on('segment') ? 1 : 0,
                transition: 'opacity 0.2s ease',
              }}
            />
          </svg>
        </div>

        {/* Toggle buttons */}
        <div className="flex flex-col gap-2.5 flex-1 w-full sm:w-auto">
          {PARTS.map(({ id, label, color }) => {
            const isActive = on(id);
            return (
              <button
                key={id}
                onClick={() => toggle(id)}
                className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg border-2 text-sm font-medium transition-all duration-150 text-left w-full"
                style={{
                  borderColor: isActive ? color : '#E7E0D6',
                  color: isActive ? '#1C1917' : '#78716C',
                  background: '#ffffff',
                }}
              >
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0 transition-opacity duration-150"
                  style={{ background: color, opacity: isActive ? 1 : 0.35 }}
                />
                {label}
              </button>
            );
          })}

          <button
            onClick={clearAll}
            className="mt-1 px-3.5 py-2 rounded-lg border border-[#E7E0D6] bg-transparent text-xs font-medium text-[#78716C] hover:bg-[#FAF7F2] hover:text-[#1C1917] transition-all duration-150"
          >
            Clear all
          </button>
        </div>
      </div>
    </div>
  );
}
