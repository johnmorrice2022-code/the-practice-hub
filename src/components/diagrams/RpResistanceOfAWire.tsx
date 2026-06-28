import React from 'react';

const INK = '#1C1917';
const MUTED = '#78716c';
const SURFACE = '#ffffff';
const SURFACE2 = '#f5f5f4';
const BORDER = '#a8a29e';
const FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif";

export interface RpResistanceOfAWireParams {}

export const RpResistanceOfAWire: React.FC<{
  params: RpResistanceOfAWireParams;
  mode?: 'question' | 'feedback';
}> = () => {
  return (
    <svg
      width="100%"
      viewBox="0 0 680 392"
      role="img"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>Circuit diagram for investigating the resistance of a wire</title>
      <desc>
        A cell, switch and ammeter connected in series with a length of
        resistance wire taped along a metre ruler. The wire is connected to
        the circuit by two crocodile clips, and a voltmeter is connected in
        parallel across the wire.
      </desc>

      {/* Cell */}
      <line x1={140} y1={90} x2={140} y2={160} stroke={INK} strokeWidth={1.5} strokeLinecap="round" />
      <line x1={126} y1={160} x2={154} y2={160} stroke={INK} strokeWidth={1.5} />
      <line x1={133} y1={170} x2={147} y2={170} stroke={INK} strokeWidth={4} />
      <line x1={140} y1={170} x2={140} y2={240} stroke={INK} strokeWidth={1.5} strokeLinecap="round" />

      {/* Switch */}
      <line x1={140} y1={90} x2={190} y2={90} stroke={INK} strokeWidth={1.5} strokeLinecap="round" />
      <circle cx={190} cy={90} r={2.5} fill={INK} />
      <line x1={190} y1={90} x2={228} y2={77} stroke={INK} strokeWidth={1.5} strokeLinecap="round" />
      <circle cx={240} cy={90} r={2.5} fill={INK} />
      <line x1={240} y1={90} x2={372} y2={90} stroke={INK} strokeWidth={1.5} strokeLinecap="round" />

      {/* Ammeter */}
      <circle cx={390} cy={90} r={18} fill={SURFACE2} stroke={INK} strokeWidth={1.5} />
      <text
        x={390}
        y={90}
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily={FONT}
        fontSize={14}
        fontWeight={500}
        fill={INK}
      >
        A
      </text>
      <line x1={408} y1={90} x2={540} y2={90} stroke={INK} strokeWidth={1.5} strokeLinecap="round" />

      {/* Right vertical + resistance wire + left vertical */}
      <line x1={540} y1={90} x2={540} y2={240} stroke={INK} strokeWidth={1.5} strokeLinecap="round" />
      <line x1={540} y1={240} x2={480} y2={240} stroke={INK} strokeWidth={1.5} strokeLinecap="round" />
      <line x1={480} y1={240} x2={200} y2={240} stroke="#D85A30" strokeWidth={3} strokeLinecap="round" />
      <line x1={200} y1={240} x2={140} y2={240} stroke={INK} strokeWidth={1.5} strokeLinecap="round" />

      {/* Crocodile clips */}
      <polygon points="193,231 207,231 200,242" fill={MUTED} />
      <polygon points="473,231 487,231 480,242" fill={MUTED} />

      {/* Metre ruler */}
      <rect x={210} y={250} width={260} height={18} rx={2} fill={SURFACE} stroke={BORDER} strokeWidth={0.5} />
      {[236, 262, 288, 314, 340, 366, 392, 418, 444].map((x) => (
        <line key={x} x1={x} y1={250} x2={x} y2={255} stroke={MUTED} strokeWidth={0.5} />
      ))}

      {/* Voltmeter leads */}
      <polyline points="200,240 200,315 322,315" fill="none" stroke={INK} strokeWidth={1.5} strokeLinecap="round" />
      <polyline points="480,240 480,315 358,315" fill="none" stroke={INK} strokeWidth={1.5} strokeLinecap="round" />

      {/* Voltmeter */}
      <circle cx={340} cy={315} r={18} fill={SURFACE2} stroke={INK} strokeWidth={1.5} />
      <text
        x={340}
        y={315}
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily={FONT}
        fontSize={14}
        fontWeight={500}
        fill={INK}
      >
        V
      </text>

      {/* Labels */}
      <line x1={170} y1={164} x2={156} y2={162} stroke={MUTED} strokeWidth={0.5} strokeDasharray="2 2" />
      <text x={174} y={164} textAnchor="start" dominantBaseline="central" fontFamily={FONT} fontSize={14} fill={INK}>
        Cell
      </text>

      <line x1={220} y1={64} x2={226} y2={77} stroke={MUTED} strokeWidth={0.5} strokeDasharray="2 2" />
      <text x={218} y={56} textAnchor="middle" fontFamily={FONT} fontSize={14} fill={INK}>
        Switch
      </text>

      <line x1={390} y1={60} x2={390} y2={71} stroke={MUTED} strokeWidth={0.5} strokeDasharray="2 2" />
      <text x={390} y={52} textAnchor="middle" fontFamily={FONT} fontSize={14} fill={INK}>
        Ammeter
      </text>

      <text x={340} y={214} textAnchor="middle" fontFamily={FONT} fontSize={14} fill={INK}>
        Resistance wire (length l)
      </text>

      <line x1={172} y1={210} x2={198} y2={237} stroke={MUTED} strokeWidth={0.5} strokeDasharray="2 2" />
      <text x={150} y={204} textAnchor="middle" fontFamily={FONT} fontSize={14} fill={INK}>
        Crocodile clips
      </text>

      <text x={340} y={288} textAnchor="middle" fontFamily={FONT} fontSize={14} fill={INK}>
        Metre ruler
      </text>

      <text x={340} y={353} textAnchor="middle" fontFamily={FONT} fontSize={14} fill={INK}>
        Voltmeter
      </text>
    </svg>
  );
};
