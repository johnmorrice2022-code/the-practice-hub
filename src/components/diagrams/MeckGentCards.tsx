const STORES = [
  {
    letter: 'M',
    name: 'Magnetic',
    desc: 'Energy stored in a magnetic field, such as in a bar magnet or electromagnet.',
    color: '#185FA5',
    bg: '#E6F1FB',
  },
  {
    letter: 'E',
    name: 'Electrostatic potential',
    desc: 'Energy stored due to the separation of electric charges.',
    color: '#3B6D11',
    bg: '#EAF3DE',
  },
  {
    letter: 'C',
    name: 'Chemical potential',
    desc: 'Energy stored in chemical bonds — food, fuel, and batteries all have a chemical potential store.',
    color: '#854F0B',
    bg: '#FAEEDA',
  },
  {
    letter: 'K',
    name: 'Kinetic',
    desc: 'Energy of a moving object. The greater its mass and speed, the larger its kinetic store.',
    color: '#533AB7',
    bg: '#EEEDFE',
  },
  {
    letter: 'G',
    name: 'Gravitational potential',
    desc: 'Energy stored due to an object being raised above the ground. The higher the object, the greater the store.',
    color: '#0F6E56',
    bg: '#E1F5EE',
  },
  {
    letter: 'E',
    name: 'Elastic potential',
    desc: 'Energy stored in a stretched or compressed spring or elastic material.',
    color: '#3B6D11',
    bg: '#EAF3DE',
  },
  {
    letter: 'N',
    name: 'Nuclear',
    desc: 'Energy stored in the nucleus of an atom. Released during nuclear fission or fusion.',
    color: '#993C1D',
    bg: '#FAECE7',
  },
  {
    letter: 'T',
    name: 'Thermal (heat)',
    desc: 'Energy stored as heat. The hotter an object, the more energy in its thermal store.',
    color: '#444441',
    bg: '#F1EFE8',
  },
];

export default function MeckGentCards() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {STORES.map((s, i) => (
        <div
          key={i}
          className="flex items-start gap-3 rounded-xl p-4"
          style={{ background: s.bg }}
        >
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center text-base font-medium flex-shrink-0"
            style={{ background: `${s.color}22`, color: s.color }}
          >
            {s.letter}
          </div>
          <div className="flex-1 min-w-0">
            <p
              className="text-sm font-medium mb-0.5"
              style={{ color: s.color }}
            >
              {s.name}
            </p>
            <p className="text-sm leading-relaxed" style={{ color: '#44403C' }}>
              {s.desc}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
