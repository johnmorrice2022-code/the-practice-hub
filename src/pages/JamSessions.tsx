import { Navbar } from '@/components/Navbar';
import { useState } from 'react';

type Row = { month: string; focus: string; topics: string };
type Track = { title: string; sub: string; rows: Row[] };
type Tracks = { [key: string]: Track };

const tracks: Tracks = {
  fm: {
    title: 'GCSE Maths Foundation — 6 live sessions per month',
    sub: 'Monday (free, public) · Wednesday (members) · follows the school year',
    rows: [
      {
        month: 'September',
        focus: 'Number Fluency',
        topics:
          'Fractions, decimals, percentages, negative numbers, rounding, estimation, standard form',
      },
      {
        month: 'October',
        focus: 'Algebra Foundations',
        topics:
          'Simplifying, substitution, expanding brackets, solving equations, inequalities, sequences',
      },
      {
        month: 'November',
        focus: 'Graphs & Coordinates',
        topics:
          'Straight-line graphs, real-life graphs, conversion graphs, distance-time graphs, quadratic graphs',
      },
      {
        month: 'December',
        focus: 'Ratio, Proportion & Percentages',
        topics:
          'Ratio, recipes, best buys, percentage change, reverse percentages, speed, density, pressure',
      },
      {
        month: 'January',
        focus: 'Geometry & Measures',
        topics:
          'Angles, perimeter, area, volume, circles, transformations, constructions, Pythagoras and trigonometry',
      },
      {
        month: 'February',
        focus: 'Statistics, Probability & Exam Practice',
        topics:
          'Averages, charts, scatter graphs, frequency tables, probability, mixed GCSE-style questions',
      },
      {
        month: 'March',
        focus: 'Paper 1 Revision: Number & Algebra',
        topics:
          'Non-calculator fluency, fractions and percentages, solving equations, sequences, straight-line and quadratic graphs — exam-style questions',
      },
      {
        month: 'April',
        focus: 'Paper 2 & 3 Revision: Ratio, Geometry & Statistics',
        topics:
          'Ratio and proportion, percentage problems, area, volume, angles, transformations, averages, charts and probability — exam-style questions',
      },
      {
        month: 'May',
        focus: 'Final Exam Practice & Technique',
        topics:
          'Mixed-topic past paper questions, common exam mistakes, command words, time management and checking for accuracy',
      },
    ],
  },
  hm: {
    title: 'GCSE Maths Higher — 6 live sessions per month',
    sub: 'Monday (free, public) · Wednesday (members) · follows the school year',
    rows: [
      {
        month: 'September',
        focus: 'Algebra & Manipulation',
        topics:
          'Expanding, factorising, rearranging formulae, algebraic fractions, surds, indices',
      },
      {
        month: 'October',
        focus: 'Equations, Inequalities & Functions',
        topics:
          'Linear/quadratic equations, simultaneous equations, inequalities, iteration, functions',
      },
      {
        month: 'November',
        focus: 'Graphs & Rates of Change',
        topics:
          'Straight-line graphs, quadratic/cubic/reciprocal graphs, gradients, tangents, areas under graphs',
      },
      {
        month: 'December',
        focus: 'Ratio, Proportion & Compound Measures',
        topics:
          'Direct/inverse proportion, percentages, growth and decay, speed, density, pressure',
      },
      {
        month: 'January',
        focus: 'Geometry, Trigonometry & Circle Theorems',
        topics:
          'Pythagoras, trigonometry, bearings, similarity, vectors, circle theorems',
      },
      {
        month: 'February',
        focus: 'Higher Problem-Solving & Exam Technique',
        topics:
          'Multi-topic exam questions, proof, interpreting mark schemes, avoiding common errors',
      },
      {
        month: 'March',
        focus: 'Paper 1 Revision: Algebra & Functions',
        topics:
          'Expanding, factorising, solving equations and inequalities, simultaneous equations, sequences, functions, straight-line and curved graphs — exam-style questions',
      },
      {
        month: 'April',
        focus: 'Paper 2 & 3 Revision: Ratio, Geometry & Trigonometry',
        topics:
          'Direct and inverse proportion, growth and decay, Pythagoras, trigonometry, vectors, circle theorems, similarity — exam-style questions',
      },
      {
        month: 'May',
        focus: 'Final Exam Practice & Technique',
        topics:
          'Mixed-topic past paper questions, multi-step problem solving, proof, common exam mistakes and time management',
      },
    ],
  },
  fp: {
    title: 'GCSE Physics Foundation — 6 live sessions per month',
    sub: 'Monday (free, public) · Thursday (members) · follows the school year',
    rows: [
      {
        month: 'September',
        focus: 'Energy',
        topics:
          'Energy stores, transfers, efficiency, power, specific heat capacity',
      },
      {
        month: 'October',
        focus: 'Electricity',
        topics:
          'Circuits, current, potential difference, resistance, domestic electricity',
      },
      {
        month: 'November',
        focus: 'Particle Model & Matter',
        topics:
          'Density, states of matter, internal energy, specific latent heat, gas pressure',
      },
      {
        month: 'December',
        focus: 'Atomic Structure & Radioactivity',
        topics:
          'Atoms, isotopes, radiation types, half-life, contamination and irradiation',
      },
      {
        month: 'January',
        focus: 'Forces & Motion',
        topics:
          "Speed, acceleration, Newton's laws, stopping distances, momentum",
      },
      {
        month: 'February',
        focus: 'Waves, Magnetism & Exam Practice',
        topics:
          'Wave properties, EM spectrum, lenses, magnets, electromagnets, mixed exam questions',
      },
      {
        month: 'March',
        focus: 'Paper 1 Revision: Energy, Electricity & Particle Model',
        topics:
          'Energy transfers and efficiency, circuits and resistance, density and states of matter, atomic structure and radioactivity — exam-style questions',
      },
      {
        month: 'April',
        focus: 'Paper 2 Revision: Forces, Waves & Magnetism',
        topics:
          "Speed, acceleration and Newton's laws, wave properties and the electromagnetic spectrum, magnets and electromagnets — exam-style questions",
      },
      {
        month: 'May',
        focus: 'Final Exam Practice & Technique',
        topics:
          'Mixed-topic past paper questions, required practicals, calculation technique, command words and time management',
      },
    ],
  },
  hp: {
    title: 'GCSE Physics Higher — 6 live sessions per month',
    sub: 'Monday (free, public) · Thursday (members) · follows the school year',
    rows: [
      {
        month: 'September',
        focus: 'Energy & Calculations',
        topics:
          'Energy transfers, efficiency, power, SHC, latent heat, multi-step equation work',
      },
      {
        month: 'October',
        focus: 'Electricity & Circuits',
        topics:
          'Series and parallel circuits, resistance, I–V graphs, power, mains electricity',
      },
      {
        month: 'November',
        focus: 'Forces & Motion',
        topics:
          "Acceleration, resultant forces, Newton's laws, momentum, terminal velocity",
      },
      {
        month: 'December',
        focus: 'Waves & Electromagnetism',
        topics:
          'Wave behaviour, EM spectrum, refraction, lenses, motors, generators, transformers',
      },
      {
        month: 'January',
        focus: 'Particle Model, Atomic Structure & Space',
        topics:
          'Density, pressure, radioactivity, half-life, nuclear equations, space physics where relevant',
      },
      {
        month: 'February',
        focus: 'Required Practicals & Exam Technique',
        topics:
          'Graphs, variables, uncertainty, extended responses, calculation questions, mixed exam practice',
      },
      {
        month: 'March',
        focus: 'Paper 1 Revision: Energy, Electricity & Particle Model',
        topics:
          'Energy calculations, series and parallel circuits, density and pressure, radioactivity and nuclear equations — exam-style questions',
      },
      {
        month: 'April',
        focus: 'Paper 2 Revision: Forces, Waves & Electromagnetism',
        topics:
          'Forces, momentum and motion graphs, wave behaviour and refraction, motors, generators and transformers — exam-style questions',
      },
      {
        month: 'May',
        focus: 'Final Exam Practice & Technique',
        topics:
          'Mixed-topic past paper questions, required practicals, extended response questions, command words and time management',
      },
    ],
  },
};

const tabList = [
  { id: 'fm', label: 'Foundation Maths' },
  { id: 'hm', label: 'Higher Maths' },
  { id: 'fp', label: 'Foundation Physics' },
  { id: 'hp', label: 'Higher Physics' },
];

const JamSessions = () => {
  const [active, setActive] = useState('fm');
  const track = tracks[active];

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-5xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold">
          Jam <span className="text-accent-amber">Sessions</span>
        </h1>
        <p className="mt-2 text-muted-foreground max-w-2xl">
          Every week The Hub Jam runs live 60-minute GCSE Maths and Physics
          sessions — free on Mondays, members sessions on Wednesdays and
          Thursdays. Sessions follow the school year from September, building
          topic coverage through to February before switching to focused exam
          revision from March to May.
        </p>

        <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span className="mt-0.5">ℹ</span>
          <span>
            The Jam Sessions curriculum is reviewed and updated regularly.
            Session topics and the cycle structure are subject to change.
            Livestreams run during UK school term times.
          </span>
        </div>

        <div className="mt-8 flex flex-wrap gap-2">
          {tabList.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActive(tab.id)}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors border ${
                active === tab.id
                  ? 'bg-accent-amber text-white border-accent-amber'
                  : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mt-6">
          <p className="text-base font-medium">{track.title}</p>
          <p className="text-sm text-muted-foreground mt-1 mb-6">{track.sub}</p>

          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground w-32">
                    Month
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground w-56">
                    Monthly focus
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Example topics
                  </th>
                </tr>
              </thead>
              <tbody>
                {track.rows.map((row, i) => (
                  <tr
                    key={i}
                    className={`border-b border-border last:border-0 ${i % 2 === 0 ? 'bg-background' : 'bg-muted/20'}`}
                  >
                    <td className="px-4 py-3 font-medium">{row.month}</td>
                    <td className="px-4 py-3">{row.focus}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {row.topics}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-10 rounded-lg border border-border bg-muted/30 px-6 py-5">
          <p className="font-medium">How it works</p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>
              <span className="font-medium text-foreground">Monday</span> — free
              public session, alternating Higher and Foundation each week. Maths
              6PM, Physics 7:30PM.
            </li>
            <li>
              <span className="font-medium text-foreground">Wednesday</span> —
              members session, Foundation Maths (6PM) followed by Higher Maths
              (7:30PM)
            </li>
            <li>
              <span className="font-medium text-foreground">Thursday</span> —
              members session, Foundation Physics (6PM) followed by Higher
              Physics (7:30PM)
            </li>
            <li className="pt-1">
              All sessions are taught to the same standard. The curriculum
              builds new topic coverage from September to February, then moves
              into focused exam revision from March to May.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default JamSessions;
