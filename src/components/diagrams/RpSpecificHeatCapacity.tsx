import React from 'react';

const INK = '#1C1917';
const MUTED = '#78716c';
const SURFACE = '#ffffff';
const BORDER = '#a8a29e';
const FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif";

export interface RpSpecificHeatCapacityParams {
  showInsulation?: boolean;
}

export const RpSpecificHeatCapacity: React.FC<{
  params: RpSpecificHeatCapacityParams;
  mode?: 'question' | 'feedback';
}> = ({ params }) => {
  const showInsulation = params.showInsulation ?? true;

  return (
    <svg
      width="100%"
      viewBox="0 0 680 388"
      role="img"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>Apparatus for determining the specific heat capacity of a metal block</title>
      <desc>
        An insulated metal block standing on a heat-proof mat, with an
        immersion heater in one hole and a thermometer in the other. The
        heater is connected through a joulemeter to a low-voltage power supply.
      </desc>

      {/* Insulation (dashed outline) — hidden when showInsulation is false */}
      {showInsulation && (
        <rect
          x={286}
          y={172}
          width={198}
          height={164}
          rx={10}
          fill="none"
          stroke={MUTED}
          strokeWidth={1}
          strokeDasharray="5 5"
        />
      )}

      {/* Metal block */}
      <rect x={300} y={180} width={170} height={150} rx={6} fill="#D3D1C7" stroke="#5F5E5A" strokeWidth={1} />

      {/* Heat-proof mat */}
      <rect x={288} y={336} width={194} height={8} rx={2} fill="#B4B2A9" stroke="#5F5E5A" strokeWidth={0.5} />

      {/* Immersion heater — shaft */}
      <rect x={347} y={180} width={14} height={100} fill="#9c9a92" stroke="#5F5E5A" strokeWidth={0.5} />
      {/* Immersion heater — top cap */}
      <rect x={345} y={150} width={18} height={32} rx={2} fill="#888780" stroke="#5F5E5A" strokeWidth={0.5} />
      {/* Immersion heater — heating element lines */}
      <path d="M345 283 H363 M345 289 H363 M345 295 H363" stroke="#5F5E5A" strokeWidth={1.5} fill="none" strokeLinecap="round" />

      {/* Thermometer — tube */}
      <rect x={410} y={120} width={10} height={190} rx={4} fill="#F1EFE8" stroke="#5F5E5A" strokeWidth={0.8} />
      {/* Thermometer — mercury column */}
      <rect x={413} y={210} width={4} height={98} fill="#E24B4A" />
      {/* Thermometer — bulb */}
      <circle cx={415} cy={310} r={8} fill="#E24B4A" stroke="#5F5E5A" strokeWidth={0.5} />

      {/* Power supply box */}
      <rect x={70} y={190} width={90} height={66} rx={6} fill={SURFACE} stroke={INK} strokeWidth={1} />
      <text x={115} y={218} textAnchor="middle" fontFamily={FONT} fontSize={14} fill={INK}>
        Power supply
      </text>
      <text x={115} y={236} textAnchor="middle" fontFamily={FONT} fontSize={12} fill={MUTED}>
        low voltage
      </text>

      {/* Joulemeter box */}
      <rect x={150} y={100} width={80} height={30} rx={6} fill={SURFACE} stroke={INK} strokeWidth={1} />
      <text x={190} y={115} textAnchor="middle" dominantBaseline="central" fontFamily={FONT} fontSize={14} fill={INK}>
        Joulemeter
      </text>

      {/* Wiring: power supply → joulemeter → heater (two leads) */}
      <polyline points="115,190 115,115 150,115" fill="none" stroke={INK} strokeWidth={1.5} strokeLinecap="round" />
      <polyline points="230,115 354,115 354,150" fill="none" stroke={INK} strokeWidth={1.5} strokeLinecap="round" />
      <polyline points="356,150 356,145 140,145 140,190" fill="none" stroke={INK} strokeWidth={1.5} strokeLinecap="round" />

      {/* Labels */}
      <line x1={232} y1={288} x2={350} y2={276} stroke={MUTED} strokeWidth={0.5} strokeDasharray="2 2" />
      <text x={228} y={290} textAnchor="end" dominantBaseline="central" fontFamily={FONT} fontSize={14} fill={INK}>
        Immersion heater
      </text>

      <line x1={438} y1={128} x2={419} y2={135} stroke={MUTED} strokeWidth={0.5} strokeDasharray="2 2" />
      <text x={442} y={128} textAnchor="start" dominantBaseline="central" fontFamily={FONT} fontSize={14} fill={INK}>
        Thermometer
      </text>

      {showInsulation && (
        <>
          <line x1={498} y1={210} x2={484} y2={210} stroke={MUTED} strokeWidth={0.5} strokeDasharray="2 2" />
          <text x={502} y={210} textAnchor="start" dominantBaseline="central" fontFamily={FONT} fontSize={14} fill={INK}>
            Insulation
          </text>
        </>
      )}

      <line x1={498} y1={290} x2={470} y2={290} stroke={MUTED} strokeWidth={0.5} strokeDasharray="2 2" />
      <text x={502} y={290} textAnchor="start" dominantBaseline="central" fontFamily={FONT} fontSize={14} fill={INK}>
        Metal block
      </text>

      <line x1={385} y1={356} x2={385} y2={344} stroke={MUTED} strokeWidth={0.5} strokeDasharray="2 2" />
      <text x={385} y={368} textAnchor="middle" fontFamily={FONT} fontSize={14} fill={INK}>
        Heat-proof mat
      </text>
    </svg>
  );
};
