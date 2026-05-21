import React, { useMemo } from 'react';
import { FontState } from '../types';
import { getGlyphData, getCounterMetrics, getCounterPathData, getOpenCounterPath } from '../services/fontService';
import { useTheme } from './useTheme';

interface GlyphVisualizerProps {
  char: string;
  font: FontState | null;
  lsb: number;
  rsb: number;
  method?: 'TRACY' | 'SOUSA';
}

const SideBearingRenderer = ({ x1, x2, y1, y2, italicAngle, fill }: { x1: number, x2: number, y1: number, y2: number, italicAngle: number, fill: string }) => {
    const angleRad = (-italicAngle * Math.PI) / 180;
    const tanAngle = Math.tan(angleRad);
    
    const slantAtY1 = y1 * tanAngle;
    const slantAtY2 = y2 * tanAngle;
    
    const d = `M ${x1 + slantAtY1} ${y1} L ${x2 + slantAtY1} ${y1} L ${x2 + slantAtY2} ${y2} L ${x1 + slantAtY2} ${y2} Z`;
    
    return (
        <path 
            d={d}
            fill={fill}
            vectorEffect="non-scaling-stroke"
        />
    );
};

const CounterformRenderer = ({ counterData, counterPath, char, capHeight, xHeight }: any) => {
    if (counterPath) {
        return (
            <path 
                d={counterPath}
                fill="rgba(59, 130, 246, 0.2)"
                stroke="#60A5FA"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
            />
        );
    }
    const h = char === char.toUpperCase() ? capHeight : xHeight;
    const angleRad = (counterData.italicAngle * Math.PI) / 180;
    const slantOffset = h * Math.tan(angleRad);
    const x1 = counterData.counterX;
    const x2 = counterData.counterX + counterData.counterWidth;
    const p1 = `${x1},0`;
    const p2 = `${x2},0`;
    const p3 = `${x2 + slantOffset},${h}`;
    const p4 = `${x1 + slantOffset},${h}`;
    
    return (
        <path 
            d={`M ${p1} L ${p2} L ${p3} L ${p4} Z`}
            fill="rgba(59, 130, 246, 0.08)"
            stroke="rgba(59, 130, 246, 0.3)"
            strokeWidth="1"
            strokeDasharray="4 2"
            vectorEffect="non-scaling-stroke"
        />
    );
};

export const GlyphVisualizer: React.FC<GlyphVisualizerProps> = React.memo(({ char, font, lsb, rsb, method = 'TRACY' }) => {
  const { isDark } = useTheme();
  const glyphData = useMemo(() => {
    if (!font || !font.fontObj) return null;
    return getGlyphData(font.fontObj, char);
  }, [font?.fontObj, char]);

  const counterData = useMemo(() => {
    if (!font || !font.fontObj || method === 'SOUSA') return null;
    const masters = ['H', 'O', 'n', 'o'];
    if (!masters.includes(char)) return null;
    return getCounterMetrics(font.fontObj, char);
  }, [font?.fontObj, char, method]);

  const counterPath = useMemo(() => {
    if (!font || !font.fontObj || method === 'SOUSA') return null;
    if (['H', 'n'].includes(char)) {
      return getOpenCounterPath(font.fontObj, char);
    }
    return getCounterPathData(font.fontObj, char);
  }, [font?.fontObj, char, method]);

  if (!glyphData) return <div className="dark:bg-gray-900 bg-gray-100 rounded h-full flex items-center justify-center text-gray-600 text-sm font-mono">Sem Dados</div>;

  const { xMin, xMax, glyphYMax, pathData } = glyphData;
  const metrics = font?.metrics;
  const upm = metrics?.unitsPerEm || 1000;
  const ascender = metrics?.ascender || 800;
  const descender = metrics?.descender || -200;
  const capHeight = metrics?.capHeight || 700;
  const xHeight = metrics?.xHeight || 500;
  
  const inkWidth = xMax - xMin;
  const inkCenter = (xMin + xMax) / 2;

  // CORREÇÃO: Pegando o ângulo de inclinação
  const italicAngle = font?.fontObj.tables.post?.italicAngle || 0;
  const slantRad = (-italicAngle * Math.PI) / 180;
  const tanSlant = Math.tan(slantRad);

  // CORREÇÃO: Projetar os extremos do glifo para a Baseline (y=0)
  // Em itálicas, o xMin costuma ficar na base (y=0) e o xMax no topo (y=glyphYMax)
  const inkStartBaseline = xMin; 
  const inkEndBaseline = xMax - ((glyphYMax || capHeight) * tanSlant);

  // CORREÇÃO: Definindo as linhas de Origem e Avanço baseadas na Baseline
  const originLineX = inkStartBaseline - lsb;
  const advanceLineX = inkEndBaseline + rsb;

  const centerAnchorX = inkCenter;
  const viewScale = 1.6; 
  const viewWidth = upm * viewScale; 
  const viewHeight = (ascender - descender) * 1.5;
  const vbMinX = centerAnchorX - (viewWidth / 2);
  const vbMinY = -ascender - (viewHeight * 0.2); 
  const gridSize = 100;

  return (
    <div className="bg-white dark:bg-slate-950 border border-slate-150 dark:border-slate-800 shadow-md shadow-slate-100/80 dark:shadow-[0_10px_30px_rgba(0,0,0,0.6)] rounded-2xl overflow-hidden flex flex-col items-center justify-center relative select-none h-full w-full">
       
       <div className="absolute top-4 left-6 flex flex-col gap-1 z-10 pointer-events-none">
            <div className="dark:bg-slate-900/80 bg-slate-100/80 backdrop-blur-sm border dark:border-slate-700/50 border-slate-300/50 px-3 py-1.5 rounded-xl text-xs font-mono shadow-2xl">
               <span className="dark:text-slate-500 text-slate-500 uppercase font-black tracking-tighter mr-2">UPM:</span> 
               <span className="dark:text-slate-100 text-slate-900 font-bold">{upm}</span>
            </div>
       </div>

       <div className="absolute top-4 right-6 flex flex-col gap-1 z-10 pointer-events-none text-right">
            <div className="dark:bg-slate-900/80 bg-slate-100/80 backdrop-blur-sm border dark:border-slate-700/50 border-slate-300/50 px-4 py-1.5 rounded-xl text-xs font-mono shadow-2xl flex gap-4">
               <span className="uppercase dark:text-slate-500 text-slate-500 font-black tracking-tighter">LSB: <span className="text-blue-500 dark:text-blue-400 font-bold ml-1">{lsb}</span></span>
               <span className="uppercase dark:text-slate-500 text-slate-500 font-black tracking-tighter">RSB: <span className="text-emerald-500 dark:text-emerald-400 font-bold ml-1">{rsb}</span></span>
               <span className="uppercase dark:text-slate-500 text-slate-500 font-black tracking-tighter">AW: <span className="dark:text-slate-100 text-slate-900 font-bold ml-1">{Math.round(advanceLineX - originLineX)}</span></span>
            </div>
       </div>

       <svg 
         width="100%" 
         height="100%"
         viewBox={`${vbMinX} ${vbMinY} ${viewWidth} ${viewHeight}`}
         className="w-full h-full"
         preserveAspectRatio="xMidYMid meet"
       >
         <defs>
            <pattern id="grid" width={gridSize} height={gridSize} patternUnits="userSpaceOnUse" x="0" y="0">
                <path d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`} fill="none" stroke={isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.05)"} strokeWidth="1" vectorEffect="non-scaling-stroke"/>
            </pattern>
            <marker id="arrow-blue" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto" markerUnits="strokeWidth">
               <path d="M0,0 L0,6 L6,3 z" fill="#3B82F6" />
            </marker>
            <marker id="arrow-cyan" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto" markerUnits="strokeWidth">
               <path d="M0,0 L0,6 L6,3 z" fill="#06B6D4" />
            </marker>
         </defs>

         <g transform="scale(1,-1)">
            <rect x={vbMinX - 2000} y={-4000} width={viewWidth + 4000} height={8000} fill="url(#grid)" />

            <line x1={vbMinX - 2000} y1="0" x2={vbMinX + viewWidth + 2000} y2="0" stroke={isDark ? "#4B5563" : "#94A3B8"} strokeWidth="2" vectorEffect="non-scaling-stroke" /> 
            <line x1={vbMinX - 2000} y1={ascender} x2={vbMinX + viewWidth + 2000} y2={ascender} stroke={isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)"} strokeDasharray="4 2" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            <line x1={vbMinX - 2000} y1={capHeight} x2={vbMinX + viewWidth + 2000} y2={capHeight} stroke={isDark ? "rgba(34, 197, 94, 0.2)" : "rgba(22, 163, 74, 0.3)"} strokeDasharray="2 2" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            <line x1={vbMinX - 2000} y1={descender} x2={vbMinX + viewWidth + 2000} y2={descender} stroke={isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)"} strokeDasharray="4 2" strokeWidth="1" vectorEffect="non-scaling-stroke" />

            {/* CORREÇÃO: Blocos de Side Bearing alinhados perfeitamente à Baseline */}
            <SideBearingRenderer 
                x1={originLineX}
                x2={inkStartBaseline}
                y1={descender}
                y2={ascender}
                italicAngle={italicAngle}
                fill={lsb >= 0 ? "rgba(59, 130, 246, 0.15)" : "rgba(239, 68, 68, 0.15)"}
            />

            <SideBearingRenderer 
                x1={inkEndBaseline}
                x2={advanceLineX}
                y1={descender}
                y2={ascender}
                italicAngle={italicAngle}
                fill={rsb >= 0 ? "rgba(52, 211, 153, 0.15)" : "rgba(239, 68, 68, 0.15)"}
            />

            {/* Removed CounterformRenderer as per request */}

            <g transform="scale(1,-1)">
                <path d={pathData} fill={isDark ? "white" : "black"} fillOpacity="0.95" />
                <rect 
                    x={xMin} y={descender} width={inkWidth} height={ascender - descender}
                    fill="none" stroke={isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)"} strokeDasharray="2 2" strokeWidth="0.5" vectorEffect="non-scaling-stroke"
                />
            </g>

            {/* CORREÇÃO: Linhas Guias de Limite LSB e RSB com inclinação correspondente ao ângulo */}
            <line 
                x1={originLineX + ((descender - 200) * tanSlant)} y1={descender - 200} 
                x2={originLineX + ((ascender + 200) * tanSlant)} y2={ascender + 200} 
                stroke="#60A5FA" strokeWidth="1.5" vectorEffect="non-scaling-stroke" 
            />
            <line 
                x1={advanceLineX + ((descender - 200) * tanSlant)} y1={descender - 200} 
                x2={advanceLineX + ((ascender + 200) * tanSlant)} y2={ascender + 200} 
                stroke="#34D399" strokeWidth="1.5" vectorEffect="non-scaling-stroke" 
            />

            {/* CORREÇÃO: Setas horizontais acompanhando a inclinação na altura do Ascender */}
            <line 
                x1={originLineX + ((ascender + 50) * tanSlant)} 
                y1={ascender + 50} 
                x2={inkStartBaseline + ((ascender + 50) * tanSlant)} 
                y2={ascender + 50} 
                stroke="#3B82F6" strokeWidth="1.5" markerEnd="url(#arrow-blue)" vectorEffect="non-scaling-stroke" 
            />
            
            <line 
                x1={inkEndBaseline + ((ascender + 50) * tanSlant)} 
                y1={ascender + 50} 
                x2={advanceLineX + ((ascender + 50) * tanSlant)} 
                y2={ascender + 50} 
                stroke="#10B981" strokeWidth="1.5" markerEnd="url(#arrow-blue)" vectorEffect="non-scaling-stroke" 
            />

            {/* Labels acompanhando as linhas base */}
            <g transform="scale(1, -1)">
                <text x={originLineX + (-10 * tanSlant) + 15} y={-40} className="text-xs fill-blue-500/60 font-black font-mono uppercase tracking-[0.2em]" style={{fontSize: '18px'}}>Origin</text>
                <text x={advanceLineX + (-10 * tanSlant) + 15} y={-40} className="text-xs fill-emerald-500/60 font-black font-mono uppercase tracking-[0.2em]" style={{fontSize: '18px'}}>Advance</text>
            </g>
         </g>
       </svg>

    </div>
  );
});