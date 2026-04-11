import { useState } from 'react';

type Store =
  | 'magnetic'
  | 'electrostatic'
  | 'chemical'
  | 'kinetic'
  | 'gravitational'
  | 'elastic'
  | 'nuclear'
  | 'thermal';

const STORES: {
  id: Store;
  letter: string;
  word: string;
  name: string;
  desc: string;
  pair?: string;
  color: string;
}[] = [
  {
    id: 'magnetic',
    letter: 'M',
    word: 'MECK',
    name: 'Magnetic',
    desc: 'Energy stored in a magnetic field, such as in a bar magnet or electromagnet.',
    color: '#185FA5',
  },
  {
    id: 'electrostatic',
    letter: 'E',
    word: 'MECK',
    name: 'Electrostatic potential',
    desc: 'Energy stored in an electrostatic potential field due to the separation of electric charges.',
    pair: 'Both E stores count — whichever you thought of first, the other E is the second.',
    color: '#3B6D11',
  },
  {
    id: 'chemical',
    letter: 'C',
    word: 'MECK',
    name: 'Chemical potential',
    desc: 'Energy stored as chemical potential in bonds — food, fuel, and batteries all have chemical potential stores.',
    color: '#854F0B',
  },
  {
    id: 'kinetic',
    letter: 'K',
    word: 'MECK',
    name: 'Kinetic',
    desc: 'Energy of a moving object. The greater its mass and speed, the larger its kinetic store.',
    color: '#533AB7',
  },
  {
    id: 'gravitational',
    letter: 'G',
    word: 'GENT',
    name: 'Gravitational potential',
    desc: 'Energy stored as gravitational potential — the higher an object is above the ground, the greater its gravitational potential store.',
    color: '#0F6E56',
  },
  {
    id: 'elastic',
    letter: 'E',
    word: 'GENT',
    name: 'Elastic potential',
    desc: 'Energy stored in an elastic potential store in a stretched or compressed spring or elastic material.',
    pair: 'Both E stores count — whichever you thought of first, the other E is the second.',
    color: '#3B6D11',
  },
  {
    id: 'nuclear',
    letter: 'N',
    word: 'GENT',
    name: 'Nuclear',
    desc: 'Energy stored in the nucleus of an atom. Released in nuclear fission or fusion.',
    color: '#993C1D',
  },
  {
    id: 'thermal',
    letter: 'T',
    word: 'GENT',
    name: 'Thermal (heat)',
    desc: 'Energy stored as heat — the hotter an object, the more energy in its thermal store. Also called internal energy.',
    color: '#444441',
  },
];

const MECK = STORES.filter((s) => s.word === 'MECK');
const GENT = STORES.filter((s) => s.word === 'GENT');

export default function MeckGentToggle() {
  const [active, setActive] = useState<Set<Store>>(new Set());

  const toggle = (id: Store) => {
    setActive((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const clearAll = () => setActive(new Set());
  const on = (id: Store) => active.has(id);
  const revealed = STORES.filter((s) => on(s.id));

  return (
    <div className="rounded-xl border border-[#E7E0D6] bg-white p-6">
      <h3 className="font-serif text-xl font-semibold text-[#1C1917] mb-1">
        MECK GENT — The 8 Energy Stores
      </h3>
      <p className="text-sm text-[#78716C] mb-6">
        Click each letter to reveal the energy store it represents.
      </p>

      {/* Acronym buttons */}
      <div className="flex gap-3 justify-center mb-6 flex-wrap">
        {/* MECK */}
        {MECK.map((s) => (
          <button
            key={s.id}
            onClick={() => toggle(s.id)}
            className="w-16 h-16 rounded-xl border-2 flex flex-col items-center justify-center gap-0.5 transition-all duration-150"
            style={{
              borderColor: on(s.id) ? s.color : '#E7E0D6',
              background: on(s.id) ? `${s.color}18` : '#ffffff',
            }}
          >
            <span
              className="text-2xl font-medium leading-none"
              style={{ color: on(s.id) ? s.color : '#1C1917' }}
            >
              {s.letter}
            </span>
            {on(s.id) && (
              <span
                className="text-[10px] font-medium"
                style={{ color: s.color }}
              >
                {s.name.split(' ')[0]}
              </span>
            )}
          </button>
        ))}

        {/* Divider */}
        <div className="w-px bg-[#E7E0D6] self-stretch mx-1" />

        {/* GENT */}
        {GENT.map((s) => (
          <button
            key={s.id}
            onClick={() => toggle(s.id)}
            className="w-16 h-16 rounded-xl border-2 flex flex-col items-center justify-center gap-0.5 transition-all duration-150"
            style={{
              borderColor: on(s.id) ? s.color : '#E7E0D6',
              background: on(s.id) ? `${s.color}18` : '#ffffff',
            }}
          >
            <span
              className="text-2xl font-medium leading-none"
              style={{ color: on(s.id) ? s.color : '#1C1917' }}
            >
              {s.letter}
            </span>
            {on(s.id) && (
              <span
                className="text-[10px] font-medium"
                style={{ color: s.color }}
              >
                {s.name.split(' ')[0]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Progress */}
      <p className="text-center text-sm text-[#78716C] mb-4">
        <span className="font-medium text-[#1C1917]">{revealed.length}</span> of
        8 revealed
      </p>

      {/* Revealed store details */}
      <div className="rounded-xl border border-[#F0EAE0] bg-[#FAF7F2] p-4 min-h-[80px]">
        {revealed.length === 0 ? (
          <p className="text-sm text-[#78716C] text-center py-2">
            Click a letter above to reveal its energy store
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-[#F0EAE0]">
            {revealed.map((s) => (
              <div
                key={s.id}
                className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-base font-medium flex-shrink-0"
                  style={{ background: `${s.color}18`, color: s.color }}
                >
                  {s.letter}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#1C1917] mb-0.5">
                    {s.name}
                  </p>
                  <p className="text-sm text-[#78716C] leading-relaxed">
                    {s.desc}
                  </p>
                  {s.pair && (
                    <p className="text-xs text-[#A8A29E] mt-1 italic">
                      {s.pair}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={clearAll}
        className="mt-3 w-full px-3.5 py-2 rounded-lg border border-[#E7E0D6] bg-transparent text-xs font-medium text-[#78716C] hover:bg-[#FAF7F2] hover:text-[#1C1917] transition-all duration-150"
      >
        Reset
      </button>
    </div>
  );
}
