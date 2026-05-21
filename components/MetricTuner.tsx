
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { TracySettings, FontState } from '../types';
import { Settings2, RotateCcw, Sparkles, Edit2, Layers } from 'lucide-react';
import { GlyphVisualizer } from './GlyphVisualizer';
import { calculateHarmonicSpacing, getCharMetrics, getCounterMetrics, getTargetSBPercentage } from '../services/fontService';
import { TheoreticalTooltip } from './TheoreticalTooltip';
import { useDebounce } from './useDebounce';

// --- NEW COMPONENT: MetricExplanationPanel ---
// Display theoretical data for master characters
interface MetricExplanationPanelProps {
    char: string;
    font: FontState | null;
}

const MetricExplanationPanel: React.FC<MetricExplanationPanelProps> = ({ char, font }) => {
    const counterData = useMemo(() => {
        if (!font || !font.fontObj) return null;
        return getCounterMetrics(font.fontObj, char);
    }, [font, char]);

    if (!counterData) return null;

    const counterWidth = counterData.counterWidth;
    
    // Didactic Explanation Logic
    const getExplanation = () => {
        // Masters
        if (char === 'H') return "Mestre. Este glifo define a referência para hastes verticais. O espaçamento é baseado na metade da sua contraforma (x/2) em ambos os lados.";
        if (char === 'O') return "Mestre. Glifos curvos precisam de menos espaço visual (SB) que retilíneos, para não parecerem flutuar. Baseia-se na compensação de volume das curvas.";
        if (char === 'n') return "Mestre das minúsculas. Define a referência para hastes retas à esquerda e arcos à direita, equilibrando o ritmo do texto.";
        if (char === 'o') return "Mestre das curvas minúsculas. Segue a lógica compensatória do 'O' maiúsculo para manter o ritmo entre letras curvas.";
        
        // Uppercase
        if (['B'].includes(char)) return "Herdou a haste reta do 'H' no lado esquerdo. O lado direito é mais aberto para balancear o volume visual com a estrutura da letra.";
        if (['C'].includes(char)) return "Herdou o espaçamento do 'O' devido sua forma circular aberta, garantindo o ritmo com glifos adjacentes.";
        if (['D'].includes(char)) return "Combina a lateral reta do 'H' à esquerda com a curva compensada do 'O' à direita.";
        if (['E', 'F'].includes(char)) return "Herdou a lateral reta do 'H' à esquerda. O lado direito é ajustado para ser mais aberto.";
        if (['G'].includes(char)) return "Herdou o espaçamento do 'O' como ponto de partida para a compensação visual de curvas.";
        if (['P'].includes(char)) return "Herdou a haste reta do 'H' à esquerda; o lado direito é mais aberto e compacto.";
        if (['R'].includes(char)) return "Herdou a haste reta do 'H' à esquerda; a perna final é tratada com menos espaço.";
        if (['A', 'V', 'W', 'Y'].includes(char)) return "Espaçamento mínimo. Estas formas angulares criam muito espaço aberto naturalmente, exigindo aproximação.";
        if (['M', 'N'].includes(char)) return "Baseado na haste do 'H', mas com compensações para harmonizar com o ritmo vertical.";
        
        // Lowercase
        if (['b'].includes(char)) return "Possui haste reta do 'n' (lado esquerdo). O corpo circular é herdado da lógica do 'o'.";
        if (['c', 'e'].includes(char)) return "Herdou o espaçamento do 'o', utilizando o SB reduzido de formas arredondadas.";
        if (['d'].includes(char)) return "A curva arredondada (esquerda) herda do 'o', enquanto a haste reta (direita) herda do 'n'.";
        if (['p', 'q'].includes(char)) return "A curva herda do 'o' e a haste reta herda do 'n'.";
        if (['h', 'k', 'l', 'm', 'r', 'u'].includes(char)) return "Herdou o espaçamento do 'n' pela lateral reta. O arco/diagonais são ajustados a partir do ritmo dele.";
        if (['v', 'w', 'y'].includes(char)) return "Espaçamento mínimo. As diagonais criam espaços abertos que permitem esta proximidade.";

        return "Este glifo não possui um mestre direto claro na regra Tracy padrão. Ajuste os Side Bearings focando no equilíbrio do espaço branco visual entre ele e seus vizinhos.";
    }

    return (
        <div className="bg-slate-100/80 dark:bg-slate-950/40 border border-slate-200 dark:border-white/10 p-4 rounded-xl mt-4 text-left">
            <div className="flex items-center gap-5 justify-center mb-3">
                <div className="flex flex-col items-center">
                    <div className="bg-blue-500/20 text-blue-600 dark:text-blue-400 text-[10px] font-black px-1.5 py-0.5 rounded uppercase tracking-[0.2em] mb-1">Standard</div>
                    <span className="text-xl font-black dark:text-white text-slate-950 leading-none">{char}</span>
                </div>
                <div className="w-px h-6 bg-slate-200 dark:bg-white/10" />
                <div className="flex flex-col">
                    <span className="text-[11px] dark:text-slate-400 text-slate-600 uppercase font-bold tracking-widest leading-none mb-1">Contraforma (x)</span>
                    <span className="text-xl font-black dark:text-white text-slate-950 leading-none">{Math.round(counterWidth)} <span className="text-[11px] dark:text-slate-500 text-slate-400 font-normal">unid.</span></span>
                </div>
            </div>
            <p className="text-xs dark:text-slate-400 text-slate-800 font-medium italic border-t border-slate-200 dark:border-white/5 pt-2 leading-relaxed text-center">
                {getExplanation()}
            </p>
        </div>
    );
};

// --- NEW COMPONENT: LiveTestWord ---
// Renders text that updates metrics visually via CSS margins instantly, 
// compensating for the delay in font file regeneration.
interface LiveTestWordProps {
  word: string;
  fontFamily: string;
  font: FontState | null;
  settings: TracySettings;
  targetChar?: string;
}

const LiveTestWord: React.FC<LiveTestWordProps> = React.memo(({ word, fontFamily, font, settings, targetChar }) => {
    const chars = word.split('');
    const upm = font?.metrics.unitsPerEm || 1000;
    
    // Scale factor to convert font units to CSS 'em'
    // 1em in CSS = fontSize. The metrics are in UPM.
    // So shift in em = value / UPM.
    
    return (
        <div 
            className="text-3xl md:text-4xl text-center mb-1 tracking-normal transition-colors break-all whitespace-nowrap" 
            style={{ fontFamily: `'${fontFamily}'` }}
        >
            {chars.map((char, i) => {
                // 1. Get the CURRENT metric being rendered by the font file (Base Truth)
                const baseMetrics = (font && font.fontObj) ? getCharMetrics(font.fontObj, char) : { lsb: 0, rsb: 0 };
                
                // 2. Get the TARGET metric from local sliders (Live Truth)
                let targetLsb = baseMetrics.lsb;
                let targetRsb = baseMetrics.rsb;

                // Resolve Target: Check Overrides first, then Masters
                if (settings.overrides[char]) {
                    if (settings.overrides[char].lsb !== null) targetLsb = settings.overrides[char].lsb!;
                    if (settings.overrides[char].rsb !== null) targetRsb = settings.overrides[char].rsb!;
                } else if (['H', 'O', 'n', 'o'].includes(char)) {
                    // If it's a master char, use the master setting
                    const master = settings[char as keyof Pick<TracySettings, 'H'|'O'|'n'|'o'>];
                    targetLsb = master.lsb;
                    targetRsb = master.rsb;
                }
                
                // 3. Calculate Delta (The difference between what user wants and what font currently shows)
                const deltaL = targetLsb - baseMetrics.lsb;
                const deltaR = targetRsb - baseMetrics.rsb;

                // 4. Apply CSS Compensation
                // We use margin to simulate the sidebearing change
                const style = {
                    marginLeft: `${deltaL / upm}em`,
                    marginRight: `${deltaR / upm}em`,
                    display: 'inline-block' // Required for margins to work on span
                };

                const isTarget = char === targetChar;
                return (
                    <span 
                        key={i} 
                        style={style}
                        className="text-black dark:text-white font-normal relative z-10"
                    >
                        {char}
                    </span>
                );
            })}
        </div>
    );
});

interface TunerBlockProps {
  char: keyof TracySettings;
  title: string;
  testWords: string[];
  settings: TracySettings;
  onUpdate: (char: keyof TracySettings, side: 'lsb' | 'rsb' | 'both', val: number) => void;
  font: FontState | null;
  fontFamily: string;
  onAuto?: (char: string) => void;
  symmetrical?: boolean;
}

const TunerBlock: React.FC<TunerBlockProps> = React.memo(({ char, title, testWords, settings, onUpdate, font, fontFamily, onAuto, symmetrical = false }) => {
  // Explicitly access LSB and RSB from the settings object to ensure inputs reflect state
  const currentLsb = (settings[char] as any).lsb;
  const currentRsb = (settings[char] as any).rsb;

  const [isEditing, setIsEditing] = useState(false);

  // React state for custom words of each block, loaded/saved in localStorage if needed
  const [localWords, setLocalWords] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(`saame_tracy_${char}_words`);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return testWords;
  });

  const handleWordsChange = (newWords: string[]) => {
    setLocalWords(newWords);
    try {
      localStorage.setItem(`saame_tracy_${char}_words`, JSON.stringify(newWords));
    } catch (e) {
      console.error(e);
    }
  };

    return (
        <div className="dark:bg-slate-900/40 bg-slate-100/40 p-3 md:p-5 rounded-2xl border-l-4 border-blue-500/50 border dark:border-slate-800 border-slate-200 shadow-lg transition-transform hover:translate-x-1">                
            <div className="flex justify-between items-center mb-3 md:mb-6">
                <div className="flex flex-col">
                    <h3 className="font-black text-blue-400 text-xs md:text-sm uppercase tracking-[0.2em]">{title}</h3>
                    <div className="h-0.5 w-8 bg-blue-500/30 mt-1 rounded-full" />
                </div>
                         {onAuto && (
                             <button 
                                onClick={() => onAuto(char as string)} 
                                className="text-xs font-bold uppercase tracking-widest bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 px-3 py-1.5 rounded-lg flex items-center gap-1.5 border border-blue-500/20 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
                                title="Harmonizar com base no peso e forma"
                                aria-label={`Harmonizar ${title} automaticamente`}
                             >
                                 <Sparkles className="w-3 h-3" /> Auto
                             </button>
                         )}
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-6 order-2 lg:order-1">
                    <div className="space-y-4">
                        {symmetrical ? (
                            /* Symmetrical Control (Standard H) */
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="text-sm text-blue-400 font-bold">
                                        Side Bearings (x/2)
                                        <TheoreticalTooltip content="Segundo Walter Tracy, para glifos retos (como o 'H'), os side bearings ideais (SB) são definidos como a metade da largura da contraforma interna (x). Assim, SB = x / 2." />
                                    </label>
                                    <input 
                                        type="number"
                                        value={currentLsb}
                                        onChange={(e) => onUpdate(char, 'both', Number(e.target.value))}
                                        className="w-24 dark:bg-gray-900 bg-white border dark:border-slate-700 border-slate-300 rounded px-2 py-1 h-10 text-right text-xl font-bold text-blue-600 dark:text-blue-400 focus:border-blue-500 outline-none focus:ring-1 focus:ring-blue-500"
                                        aria-label={`Valor numérico para Side bearings ${title}`}
                                    />
                                </div>
                                <input 
                                    type="range" min="-50" max="300" value={currentLsb} 
                                    onChange={(e) => onUpdate(char, 'both', Number(e.target.value))}
                                    className="w-full accent-blue-500 h-1.5 dark:bg-gray-700 bg-gray-300 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900"
                                    aria-label={`Slider para Side bearings ${title}`}
                                />
                                <p className="text-[11px] dark:text-slate-400 text-slate-600 mt-2 italic">Ajuste baseado na contraforma (x): SB ideal = x/2 em ambos os lados.</p>
                            </div>
                        ) : (
                            <>
                                {/* LSB Control */}
                                <div>
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="text-sm text-blue-400 font-bold">
                                            Lado da Haste (x/2)
                                            <TheoreticalTooltip content="No 'n', o lado esquerdo (haste reta) herda a lógica do 'H'. O espaço ideal é a metade da largura interna entre as hastes (x/2)." />
                                        </label>
                                        <input 
                                            type="number"
                                            value={currentLsb}
                                            onChange={(e) => onUpdate(char, 'lsb', Number(e.target.value))}
                                            className="w-24 dark:bg-gray-900 bg-white border dark:border-slate-700 border-slate-300 rounded px-2 py-1 h-10 text-right text-xl font-bold text-blue-600 dark:text-blue-400 focus:border-blue-500 outline-none focus:ring-1 focus:ring-blue-500"
                                            aria-label={`Valor numérico para Side Bearing Esquerdo ${title}`}
                                        />
                                    </div>
                                    <input 
                                        type="range" min="-50" max="300" value={currentLsb} 
                                        onChange={(e) => onUpdate(char, 'lsb', Number(e.target.value))}
                                        className="w-full accent-blue-500 h-1.5 dark:bg-gray-700 bg-gray-300 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900"
                                        aria-label={`Slider para Side Bearing Esquerdo ${title}`}
                                    />
                                </div>

                                {/* RSB Control */}
                                <div>
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="text-sm text-green-400 font-bold">
                                            Lado do Arco (&lt; x/2)
                                            <TheoreticalTooltip content="O lado do arco (direito) recebe um pouco menos de espaço que o lado da haste (geralmente 90% de x/2) devido à sua forma arredondada que 'projeta' mais branco para fora." />
                                        </label>
                                        <input 
                                            type="number"
                                            value={currentRsb}
                                            onChange={(e) => onUpdate(char, 'rsb', Number(e.target.value))}
                                            className="w-24 dark:bg-gray-900 bg-white border dark:border-slate-700 border-slate-300 rounded px-2 py-1 h-10 text-right text-xl font-bold text-green-600 dark:text-green-400 focus:border-green-500 outline-none focus:ring-1 focus:ring-green-500"
                                            aria-label={`Valor numérico para Side Bearing Direito ${title}`}
                                        />
                                    </div>
                                    <input 
                                        type="range" min="-50" max="300" value={currentRsb} 
                                        onChange={(e) => onUpdate(char, 'rsb', Number(e.target.value))}
                                        className="w-full accent-green-500 h-1.5 dark:bg-gray-700 bg-gray-300 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-slate-900"
                                        aria-label={`Slider para Side Bearing Direito ${title}`}
                                    />
                                    <p className="text-[11px] dark:text-slate-400 text-slate-600 mt-2 italic">À direita, o espaço é ligeiramente reduzido para compensar a curvatura do arco.</p>
                                </div>
                            </>
                        )}
                    </div>
                
                {/* Text Preview (Live) editable */}
                <div className="bg-white dark:bg-slate-950 border border-slate-150 dark:border-slate-800 shadow-md shadow-slate-100/80 dark:shadow-[0_10px_30px_rgba(0,0,0,0.6)] rounded-2xl p-4 md:p-5 mt-2 overflow-hidden flex flex-col justify-center min-h-[110px]">
                    {isEditing ? (
                        <div className="flex flex-col items-center justify-center w-full py-2" onClick={(e) => e.stopPropagation()}>
                            <input 
                                type="text"
                                value={localWords.join(', ')}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    const wordsList = val.split(',').map(s => s.trim()).filter(Boolean);
                                    handleWordsChange(wordsList);
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        setIsEditing(false);
                                    }
                                }}
                                onBlur={() => setIsEditing(false)}
                                autoFocus
                                className="text-center bg-transparent border-none outline-none font-mono text-base text-slate-800 dark:text-slate-200 border-b border-dashed border-blue-500/50 py-1 w-full max-w-xs focus:ring-0"
                                placeholder="Ex: HHHH, HHOHH"
                            />
                            <p className="text-[10px] text-blue-500 mt-2 font-mono uppercase tracking-widest font-black animate-pulse">Enter para salvar</p>
                        </div>
                    ) : (
                        <div 
                            className="text-center py-1 cursor-pointer transition-all hover:bg-slate-50 dark:hover:bg-slate-900/30 rounded-xl relative group/preview min-h-[44px] flex flex-col justify-center items-center"
                            onClick={() => setIsEditing(true)}
                            title="Clique para editar sequência"
                        >
                            <div className="w-full">
                                {localWords.map((w, index) => (
                                    <LiveTestWord key={index} word={w} fontFamily={fontFamily} font={font} settings={settings} targetChar={char as string} />
                                ))}
                            </div>
                            <div className="absolute top-1 right-1 opacity-0 group-hover/preview:opacity-100 transition-opacity bg-blue-500/10 text-blue-400 p-1 rounded">
                                <Edit2 className="w-3 h-3" />
                            </div>
                        </div>
                    )}
                </div>

                {/* Explanation Panel */}
                <MetricExplanationPanel char={char as string} font={font} />
            </div>

            {/* Visualizer */}
            <div className="h-40 md:h-64 lg:h-auto order-1 lg:order-2 min-h-[200px] md:min-h-[250px]">
                <GlyphVisualizer 
                    char={char as string} 
                    font={font} 
                    lsb={currentLsb} 
                    rsb={currentRsb} 
                    method="TRACY"
                />
            </div>
          </div>
        </div>
    );
  });

interface MetricTunerProps {
  settings: TracySettings;
  onSettingsChange: (newSettings: TracySettings) => void;
  fontFamily: string;
  font: FontState | null;
}

export const MetricTuner: React.FC<MetricTunerProps> = ({ settings, onSettingsChange, fontFamily, font }) => {
  const [localSettings, setLocalSettings] = useState<TracySettings>(settings);
  const [overrideChar, setOverrideChar] = useState<string>('B');
  const [inputOverrideChar, setInputOverrideChar] = useState<string>('B');

  // Debounce settings before passing them up to the parent
  const debouncedLocalSettings = useDebounce(localSettings, 400);

  useEffect(() => {
    setInputOverrideChar(overrideChar);
  }, [overrideChar]);

  useEffect(() => {
    // If external settings change (e.g., loaded from somewhere), sync local state
    // But don't do this if local changes are already in progress
    if (JSON.stringify(settings) !== JSON.stringify(localSettings)) {
        setLocalSettings(settings);
    }
  }, [settings]);

  // When debounced settings change, trigger the expensive external update
  useEffect(() => {
    onSettingsChange(debouncedLocalSettings);
  }, [debouncedLocalSettings]);

  const handleChange = (char: keyof TracySettings, side: 'lsb' | 'rsb' | 'both', val: number) => {
    const newSettings = {
      ...localSettings,
      [char]: side === 'both' ? { lsb: val, rsb: val } : {
        ...localSettings[char],
        [side]: val
      }
    };
    setLocalSettings(newSettings);
  };

  const handleAutoCalc = (char: string) => {
      if (!font || !font.fontObj) return;
      
      const harmonicSpacing = calculateHarmonicSpacing(font.fontObj, char);
      
      const newSettings = {
          ...localSettings,
          [char]: {
              lsb: harmonicSpacing,
              rsb: char === 'n' ? Math.round(harmonicSpacing * 0.9) : harmonicSpacing 
          }
      };
      setLocalSettings(newSettings);
  };

  // --- Dynamic Character List Generation ---
  // Extracts all available unicode glyphs from the font to populate the selector
  const availableChars = useMemo(() => {
    if (!font || !font.fontObj) {
        // Fallback default list
        return "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789".split('');
    }

    const uniqueChars = new Set<string>();
    
    // 1. Add Priority Characters (ASCII)
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789".split('').forEach(c => uniqueChars.add(c));

    // 2. Scan font for all other unicodes
    const numGlyphs = font.fontObj.glyphs.length;
    for (let i = 0; i < numGlyphs; i++) {
        const glyph = font.fontObj.glyphs.get(i);
        if (glyph.unicode) {
            try {
                const char = String.fromCodePoint(glyph.unicode);
                // Exclude control characters and empty strings
                if (char && char.trim() !== '') {
                    uniqueChars.add(char);
                }
            } catch (e) {
                // Ignore invalid codepoints
            }
        }
    }

    return Array.from(uniqueChars);
  }, [font]);

  // --- Override Logic ---
  
  // Get the CURRENT metrics for the override char from the font object itself (Fallback/Background truth)
  const currentOverrideMetrics = useMemo(() => {
      if (!font || !font.fontObj) return { lsb: 0, rsb: 0 };
      const glyph = font.fontObj.charToGlyph(overrideChar);
      if (!glyph) return { lsb: 0, rsb: 0 };
      
      const box = glyph.getBoundingBox();
      const lsb = box.x1;
      const rsb = glyph.advanceWidth - box.x2;
      return { lsb: Math.round(lsb), rsb: Math.round(rsb) };
  }, [font, overrideChar]);

  const hasOverride = useMemo(() => {
      return !!localSettings.overrides[overrideChar];
  }, [localSettings.overrides, overrideChar]);

  // CRITICAL FIX: Determines the value to display in the UI.
  // 1. If an override exists in local state, use it (Instant feedback).
  // 2. If not, fallback to the calculated metric from the font (Derived).
  // This solves the "stuck slider" issue caused by useMemo conflict.
  const displayLsb = localSettings.overrides[overrideChar]?.lsb ?? currentOverrideMetrics.lsb;
  const displayRsb = localSettings.overrides[overrideChar]?.rsb ?? currentOverrideMetrics.rsb;

  const updateOverride = (side: 'lsb' | 'rsb', val: number) => {
      const current = localSettings.overrides[overrideChar] || { lsb: null, rsb: null }; // Null means use rule
      
      // When we update one side, we must ensure the OTHER side is set to a concrete value
      // otherwise it might flip back to null/derived behavior unpredictably if we only store partial state.
      const safeLsb = current.lsb !== null ? current.lsb : currentOverrideMetrics.lsb;
      const safeRsb = current.rsb !== null ? current.rsb : currentOverrideMetrics.rsb;

      const newOverride = {
          lsb: side === 'lsb' ? val : safeLsb,
          rsb: side === 'rsb' ? val : safeRsb
      };

      const newSettings = {
          ...localSettings,
          overrides: {
              ...localSettings.overrides,
              [overrideChar]: newOverride
          }
      };
      setLocalSettings(newSettings);
      // Let debounce propagate
  };

  const resetOverride = () => {
      const newOverrides = { ...localSettings.overrides };
      delete newOverrides[overrideChar];
      const newSettings = {
          ...localSettings,
          overrides: newOverrides
      };
      setLocalSettings(newSettings);
      // Let debounce propagate
  };

  // Generate test context for overrides
  const overrideContext = useMemo(() => {
     // Check if char is generally uppercase or lowercase to decide context
     const isUpper = overrideChar.toUpperCase() === overrideChar && overrideChar.toLowerCase() !== overrideChar;
     // Numbers and Symbols default to uppercase context (HHO..) usually looks better for alignment check
     if (isUpper || !overrideChar.match(/[a-z]/)) {
         return [`HH${overrideChar}HH`, `OO${overrideChar}OO`];
     } else {
         return [`nn${overrideChar}nn`, `oo${overrideChar}oo`];
     }
  }, [overrideChar]);

  // Transient override text state
  const [overrideWordsState, setOverrideWordsState] = useState<Record<string, string[]>>({});

  // Reset custom words to force fallback to standard dynamic template on selection change
  useEffect(() => {
      setOverrideWordsState({});
  }, [overrideChar]);

  const [isOverrideEditing, setIsOverrideEditing] = useState(false);

  const currentOverrideWords = overrideWordsState[overrideChar] || overrideContext;

  const handleOverrideWordsChange = (words: string[]) => {
      setOverrideWordsState({ [overrideChar]: words });
  };

  return (
    <div className="dark:bg-slate-900/50 bg-slate-100/50 backdrop-blur rounded-2xl p-3 md:p-8 border dark:border-slate-800 border-slate-200 h-full overflow-y-auto overflow-x-visible custom-scrollbar shadow-2xl">
      <div className="flex items-center justify-between mb-4 md:mb-8 pb-3 md:pb-6 border-b dark:border-slate-800 border-slate-200 z-10 -mx-2 px-4">
        <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
                <Settings2 className="w-5 h-5 text-blue-400" />
            </div>
            <div>
                <h2 className="text-2xl md:text-3xl font-black dark:text-white text-slate-900 tracking-tighter leading-none mb-1">
                    MÉTODO TRACY
                </h2>
                <div className="flex items-center gap-2">
                    <p className="text-xs text-blue-400 uppercase font-black tracking-widest pb-[1px]">Walter Tracy (1914–1995)</p>
                    <TheoreticalTooltip content="Walter Tracy propõe que o ritmo tipográfico é uma relação direta entre o espaço interno (contraforma) e o espaço externo (side bearings)." />
                </div>
            </div>
        </div>
      </div>

      <div className="space-y-8 pb-10">
        <div className="space-y-6">
            <TunerBlock 
                char="H" 
                title="Ajuste de Hastes (Maiúsculas)" 
                testWords={['HHHH']} 
                settings={localSettings} 
                onUpdate={handleChange} 
                font={font} 
                fontFamily={fontFamily}
                onAuto={handleAutoCalc}
                symmetrical={true}
            />
            <TunerBlock 
                char="O" 
                title="Ajuste Circular (Maiúsculas)" 
                testWords={['HHOHH', 'HHOOHH']} 
                settings={localSettings} 
                onUpdate={handleChange} 
                font={font} 
                fontFamily={fontFamily}
                onAuto={handleAutoCalc}
                symmetrical={true}
            />
            <TunerBlock 
                char="n" 
                title="Ajuste de Hastes (Minúsculas)" 
                testWords={['nnnn']} 
                settings={localSettings} 
                onUpdate={handleChange} 
                font={font} 
                fontFamily={fontFamily}
                onAuto={handleAutoCalc}
            />
            <TunerBlock 
                char="o" 
                title="Ajuste Circular (Minúsculas)" 
                testWords={['nnonn', 'nnonon', 'nnoonn']} 
                settings={localSettings} 
                onUpdate={handleChange} 
                font={font} 
                fontFamily={fontFamily}
                onAuto={handleAutoCalc}
                symmetrical={true}
            />
        </div>

        {/* Detailed Propagation Tuning */}
        <div className="mt-12 border-t dark:border-slate-800 border-slate-200 pt-10">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
                <div>
                    <h3 className="text-xl font-black dark:text-white text-slate-900 flex items-center gap-2 tracking-tight">
                        Ajustes de Exceção
                    </h3>
                    <p className="text-xs dark:text-slate-500 text-slate-500 uppercase tracking-widest font-bold mt-1">Sobrescreva as regras para glifos específicos (H3/H5)</p>
                </div>
            </div>
            
            <div className="dark:bg-slate-900/40 bg-slate-100/40 p-6 rounded-2xl border dark:border-slate-800 border-slate-200 shadow-xl">
                 {/* Selector */}
                 <div className="flex flex-col md:flex-row md:items-center gap-6 mb-8 dark:bg-slate-950/50 bg-slate-50/50 p-6 rounded-2xl border dark:border-slate-800/50 border-slate-200/50">
                     <div className="flex-1">
                         <label className="text-xs dark:text-slate-500 text-slate-500 font-black uppercase tracking-widest mb-2 block">Seletor de Glifo de Referência</label>
                         <select 
                            value={overrideChar}
                            onChange={(e) => setOverrideChar(e.target.value)}
                            className="w-full dark:bg-slate-900 bg-slate-100 border dark:border-slate-700 border-slate-300 rounded-xl px-4 py-3 dark:text-white text-slate-900 font-mono text-base shadow-inner focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 outline-none transition-all"
                         >
                             {availableChars.map(c => (
                                 <option key={c} value={c}>
                                     {c} (U+{c.codePointAt(0)?.toString(16).toUpperCase().padStart(4, '0')})
                                 </option>
                             ))}
                         </select>
                     </div>
                     
                     <div className="text-base dark:text-slate-400 text-slate-600 flex flex-col justify-end">
                         <div className="flex items-center gap-3 dark:bg-slate-900 bg-slate-100 p-3 rounded-xl border dark:border-slate-800 border-slate-200">
                             <span className="text-xs font-black uppercase tracking-widest opacity-60">Status</span>
                             {hasOverride ? (
                                 <motion.span initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="text-yellow-400 font-black px-3 py-1 bg-yellow-400/10 rounded-lg border border-yellow-400/20 text-xs uppercase tracking-widest">Sobrescrito</motion.span>
                             ) : (
                                 <span className="text-blue-400 font-black px-3 py-1 bg-blue-500/10 rounded-lg border border-blue-500/20 text-xs uppercase tracking-widest">Por Regra</span>
                             )}
                         </div>

                         {hasOverride && (
                             <button 
                               onClick={resetOverride} 
                               className="text-xs text-red-400 hover:text-red-300 font-black uppercase tracking-widest flex items-center gap-1.5 mt-3 justify-end transition-colors focus:outline-none focus:underline focus:ring-1 focus:ring-red-500 rounded"
                               aria-label="Restaurar métricas originais"
                             >
                                 <RotateCcw className="w-3 h-3" /> Restaurar Original
                             </button>
                         )}
                     </div>
                 </div>

                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                    <div className="space-y-6 order-2 lg:order-1">
                        <div className="space-y-4">
                            {/* Override LSB */}
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="text-sm dark:text-slate-400 text-slate-600">Side Bearing Esquerdo</label>
                                    <input 
                                        type="number"
                                        value={displayLsb}
                                        onChange={(e) => updateOverride('lsb', Number(e.target.value))}
                                        className={`w-24 dark:bg-gray-900 bg-white border rounded px-2 py-1 h-10 text-right text-sm font-bold outline-none transition-all focus:ring-1 focus:ring-blue-500 ${hasOverride ? 'border-yellow-600 text-yellow-700 dark:text-yellow-400 shadow-[0_0_10px_rgba(234,179,8,0.1)]' : 'dark:border-slate-700 border-slate-350 text-blue-600 dark:text-blue-400'}`}
                                        aria-label="Sobrescrever Side Bearing Esquerdo"
                                    />
                                </div>
                                <input 
                                    type="range" min="-50" max="300" value={displayLsb}
                                    onChange={(e) => updateOverride('lsb', Number(e.target.value))}
                                    className="w-full accent-blue-500 h-1.5 dark:bg-slate-800 bg-slate-200 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900"
                                    aria-label="Slider Sobrescrever Side Bearing Esquerdo"
                                />
                            </div>

                             {/* Override RSB */}
                             <div>
                                 <div className="flex justify-between items-center mb-1">
                                    <label className="text-sm dark:text-slate-400 text-slate-600">Side Bearing Direito</label>
                                    <input 
                                        type="number"
                                        value={displayRsb}
                                        onChange={(e) => updateOverride('rsb', Number(e.target.value))}
                                        className={`w-24 dark:bg-gray-900 bg-white border rounded px-2 py-1 h-10 text-right text-sm font-bold outline-none transition-all focus:ring-1 focus:ring-green-500 ${hasOverride ? 'border-yellow-600 text-yellow-700 dark:text-yellow-400 shadow-[0_0_10px_rgba(234,179,8,0.1)]' : 'dark:border-slate-700 border-slate-350 text-green-600 dark:text-green-400'}`}
                                        aria-label="Sobrescrever Side Bearing Direito"
                                    />
                                </div>
                                <input 
                                    type="range" min="-50" max="300" value={displayRsb}
                                    onChange={(e) => updateOverride('rsb', Number(e.target.value))}
                                    className="w-full accent-green-500 h-1.5 dark:bg-slate-800 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                                />
                            </div>
                        </div>

                        {/* Text Preview (Live) editable */}
                        <div className="bg-white dark:bg-slate-950 border border-slate-150 dark:border-slate-800 shadow-md shadow-slate-100/80 dark:shadow-[0_10px_30px_rgba(0,0,0,0.6)] rounded-2xl p-4 md:p-5 mt-2 overflow-hidden flex flex-col justify-center min-h-[110px]">
                            {isOverrideEditing ? (
                                <div className="flex flex-col items-center justify-center w-full py-2" onClick={(e) => e.stopPropagation()}>
                                    <input 
                                        type="text"
                                        value={currentOverrideWords.join(', ')}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            const wordsList = val.split(',').map(s => s.trim()).filter(Boolean);
                                            handleOverrideWordsChange(wordsList);
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                setIsOverrideEditing(false);
                                            }
                                        }}
                                        onBlur={() => setIsOverrideEditing(false)}
                                        autoFocus
                                        className="text-center bg-transparent border-none outline-none font-mono text-base text-slate-800 dark:text-slate-200 border-b border-dashed border-blue-500/50 py-1 w-full max-w-xs focus:ring-0"
                                        placeholder="Ex: nnBnn, ooBoo"
                                    />
                                    <p className="text-[10px] text-blue-500 mt-2 font-mono uppercase tracking-widest font-black animate-pulse">Enter para salvar</p>
                                </div>
                            ) : (
                                <div 
                                    className="text-center py-1 cursor-pointer transition-all hover:bg-slate-50 dark:hover:bg-slate-900/30 rounded-xl relative group/preview min-h-[44px] flex flex-col justify-center items-center"
                                    onClick={() => setIsOverrideEditing(true)}
                                    title="Clique para editar sequência"
                                >
                                    <div className="w-full">
                                        {currentOverrideWords.map((w, index) => (
                                            <LiveTestWord key={index} word={w} fontFamily={fontFamily} font={font} settings={localSettings} targetChar={overrideChar} />
                                        ))}
                                    </div>
                                    <div className="absolute top-1 right-1 opacity-0 group-hover/preview:opacity-100 transition-opacity bg-blue-500/10 text-blue-400 p-1 rounded">
                                        <Edit2 className="w-3 h-3" />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    
                    {/* Visualizer */}
                    <div className="h-40 md:h-64 lg:h-auto order-1 lg:order-2 flex flex-col min-h-[200px] md:min-h-[250px] dark:bg-slate-900 bg-white rounded-3xl border dark:border-slate-800 border-slate-200 overflow-hidden shadow-sm p-4 relative">
                        <div className="flex items-center justify-between mb-4 z-10 w-full px-2">
                            <h3 className="text-xs font-black dark:text-slate-400 text-slate-600 uppercase tracking-widest flex items-center gap-2">
                                <Layers className="w-3.5 h-3.5" /> ANÁLISE GEOMÉTRICA
                            </h3>
                            <div className="flex items-center gap-2">
                                <label className="text-[11px] font-black uppercase tracking-widest dark:text-slate-400 text-slate-600 whitespace-nowrap">SELECIONAR GLIFO:</label>
                                <input 
                                    type="text"
                                    maxLength={1}
                                    value={inputOverrideChar}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setInputOverrideChar(val);
                                        if (val && availableChars.includes(val)) {
                                            setOverrideChar(val);
                                        }
                                    }}
                                    onFocus={(e) => e.target.select()}
                                    className="bg-slate-100 dark:bg-slate-950 border dark:border-slate-700 border-slate-300 rounded px-2 py-1 text-center text-sm font-bold dark:text-white text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none w-12 shadow-sm"
                                />
                            </div>
                        </div>
                        <div className="flex-1 w-full relative">
                            <GlyphVisualizer 
                                char={overrideChar} 
                                font={font} 
                                lsb={displayLsb} 
                                rsb={displayRsb} 
                                method="TRACY"
                            />
                        </div>
                    </div>
                 </div>
            </div>
        </div>
      </div>
    </div>
  );
};
