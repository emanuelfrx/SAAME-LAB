
import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SousaSettings, SousaGroups, FontState } from '../types';
import { generateAdhesionText, getCharMetrics } from '../services/fontService';
import { Settings2, RotateCcw, ChevronDown, ChevronUp, Layers, Edit2 } from 'lucide-react';
import { GlyphVisualizer } from './GlyphVisualizer';
import { TheoreticalTooltip } from './TheoreticalTooltip';
import { useDebounce } from './useDebounce';

interface SousaTunerProps {
  settings: SousaSettings;
  onSettingsChange: (newSettings: SousaSettings) => void;
  fontFamily: string;
  font: FontState | null;
}

// --- NEW COMPONENT: LiveTestWord for Sousa ---
// Handles CSS Margin compensation for immediate feedback
interface LiveTestWordProps {
  word: string;
  fontFamily: string;
  font: FontState | null;
  settings: SousaSettings;
  targetChar?: string;
}

const LiveTestWord: React.FC<LiveTestWordProps> = React.memo(({ word, fontFamily, font, settings, targetChar }) => {
    const chars = word.split('');
    const upm = font?.metrics.unitsPerEm || 1000;
    
    return (
        <div 
            className="text-3xl md:text-4xl tracking-normal transition-colors text-center mb-1 break-all whitespace-nowrap" 
            style={{ fontFamily: `'${fontFamily}'` }}
        >
            {chars.map((char, i) => {
                // 1. Get Base Truth (Current Font File)
                const baseMetrics = (font && font.fontObj) ? getCharMetrics(font.fontObj, char) : { lsb: 0, rsb: 0 };
                
                // 2. Get Live Truth (Local Settings)
                let targetLsb = baseMetrics.lsb;
                let targetRsb = baseMetrics.rsb;

                // Priority: Overrides > Masters
                if (settings.overrides[char]) {
                     targetLsb = settings.overrides[char].lsb;
                     targetRsb = settings.overrides[char].rsb;
                } else if (['n', 'o', 'H', 'O'].includes(char)) {
                    const master = settings[char as keyof Pick<SousaSettings, 'n'|'o'|'H'|'O'>];
                    targetLsb = master.lsb;
                    targetRsb = master.rsb;
                }
                
                // 3. Diff
                const deltaL = targetLsb - baseMetrics.lsb;
                const deltaR = targetRsb - baseMetrics.rsb;

                // 4. CSS Compensation
                const style = {
                    marginLeft: `${deltaL / upm}em`,
                    marginRight: `${deltaR / upm}em`,
                    display: 'inline-block'
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

// Reusable Block Component similar to MetricTuner's TunerBlock
interface SousaBlockProps {
    char: 'n' | 'o' | 'H' | 'O';
    title: string;
    contextWords: string[];
    settings: SousaSettings;
    onUpdate: (char: 'n' | 'o' | 'H' | 'O', side: 'lsb' | 'rsb', val: number) => void;
    font: FontState | null;
    fontFamily: string;
}

const SousaMasterBlock: React.FC<SousaBlockProps> = React.memo(({ char, title, contextWords, settings, onUpdate, font, fontFamily }) => {
    // Explicitly access LSB and RSB from settings to ensure binding to state
    const currentLsb = settings[char].lsb;
    const currentRsb = settings[char].rsb;

    const [isEditing, setIsEditing] = useState(false);

    // React state for custom words of each block, loaded/saved in localStorage if needed
    const [localWords, setLocalWords] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem(`saame_sousa_${char}_words`);
            if (saved) return JSON.parse(saved);
        } catch (e) {
            console.error(e);
        }
        return contextWords;
    });

    const handleWordsChange = (newWords: string[]) => {
        setLocalWords(newWords);
        try {
            localStorage.setItem(`saame_sousa_${char}_words`, JSON.stringify(newWords));
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <section className="dark:bg-slate-900/40 bg-slate-100/40 p-3 md:p-5 rounded-2xl border-l-4 border-indigo-500/50 border dark:border-slate-800 border-slate-200 shadow-lg transition-transform hover:translate-x-1">
            <div className="flex justify-between items-center mb-3 md:mb-6">
                <div className="flex flex-col">
                    <h3 className="font-black text-indigo-400 text-xs md:text-sm uppercase tracking-[0.2em]">{title}</h3>
                    <div className="h-0.5 w-8 bg-indigo-500/30 mt-1 rounded-full" />
                </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
            <div className="space-y-6 order-2 lg:order-1">
                    <div className="space-y-4">
                        {/* LSB Control */}
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="text-xs md:text-sm dark:text-slate-400 text-slate-600">
                                    Side Bearing Esquerdo
                                    <span className="hidden md:inline">
                                        <TheoreticalTooltip content="Espaço lateral esquerdo. Controla a distância em relação ao caractere anterior." />
                                    </span>
                                </label>
                                <input 
                                    type="number"
                                    value={currentLsb}
                                    onChange={(e) => onUpdate(char, 'lsb', Number(e.target.value))}
                                    className="w-24 dark:bg-gray-900 bg-white border dark:border-slate-700 border-slate-350 rounded px-2 py-1 h-10 text-right text-xl font-bold text-blue-600 dark:text-blue-400 focus:border-blue-500 outline-none focus:ring-1 focus:ring-blue-500"
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
                                <label className="text-xs md:text-sm dark:text-slate-400 text-slate-600">
                                    Side Bearing Direita
                                    <span className="hidden md:inline">
                                        <TheoreticalTooltip content="Espaço lateral direito. Garante o equilíbrio rítmico no fluxo de leitura contínua." />
                                    </span>
                                </label>
                                <input 
                                    type="number"
                                    value={currentRsb}
                                    onChange={(e) => onUpdate(char, 'rsb', Number(e.target.value))}
                                    className="w-24 dark:bg-gray-900 bg-white border dark:border-slate-700 border-slate-350 rounded px-2 py-1 h-10 text-right text-xl font-bold text-green-600 dark:text-green-400 focus:border-green-500 outline-none focus:ring-1 focus:ring-green-500"
                                    aria-label={`Valor numérico para Side Bearing Direito ${title}`}
                                />
                            </div>
                            <input 
                                type="range" min="-50" max="300" value={currentRsb} 
                                onChange={(e) => onUpdate(char, 'rsb', Number(e.target.value))}
                                className="w-full accent-green-500 h-1.5 dark:bg-gray-700 bg-gray-300 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-slate-900"
                                aria-label={`Slider para Side Bearing Direito ${title}`}
                            />
                        </div>
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
                                className="text-center bg-transparent border-none outline-none font-mono text-base text-slate-800 dark:text-slate-200 border-b border-dashed border-indigo-500/50 py-1 w-full max-w-xs focus:ring-0"
                                placeholder="Ex: nnnn, nonn"
                            />
                            <p className="text-[10px] text-indigo-500 mt-2 font-mono uppercase tracking-widest font-black animate-pulse">Enter para salvar</p>
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
                            <div className="absolute top-1 right-1 opacity-0 group-hover/preview:opacity-100 transition-opacity bg-indigo-500/10 text-indigo-400 p-1 rounded">
                                <Edit2 className="w-3 h-3" />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Visualizer */}
            <div className="h-40 md:h-64 lg:h-auto order-1 lg:order-2 min-h-[200px] md:min-h-[250px]">
                <GlyphVisualizer 
                    char={char} 
                    font={font} 
                    lsb={settings[char].lsb} 
                    rsb={settings[char].rsb} 
                    method="SOUSA"
                />
            </div>
            </div>
        </section>
    );
});

export const SousaTuner: React.FC<SousaTunerProps> = ({ settings, onSettingsChange, fontFamily, font }) => {
  // CRITICAL FIX: Local state ensures sliders don't stick due to parent re-render latency
  const [localSettings, setLocalSettings] = useState<SousaSettings>(settings);
  const [showGroups, setShowGroups] = useState(false);
  const [overrideChar, setOverrideChar] = useState<string>('a');
  const [inputOverrideChar, setInputOverrideChar] = useState<string>('a');

  // Debounce settings before passing them up
  const debouncedLocalSettings = useDebounce(localSettings, 400);

  // Sync input local state
  useEffect(() => {
    setInputOverrideChar(overrideChar);
  }, [overrideChar]);

  // Sync prop changes to local state
  useEffect(() => {
    if (JSON.stringify(settings) !== JSON.stringify(localSettings)) {
        setLocalSettings(settings);
    }
  }, [settings]);

  // Propagate debounced changes
  useEffect(() => {
    onSettingsChange(debouncedLocalSettings);
  }, [debouncedLocalSettings]);

  // --- Handlers ---

  const handleGroupChange = (groupKey: keyof SousaGroups, value: string) => {
    const chars = value.split('').filter(c => c.trim() !== '');
    const uniqueChars = Array.from(new Set(chars));
    const newSettings = {
        ...localSettings,
        groups: {
            ...localSettings.groups,
            [groupKey]: uniqueChars
        }
    };
    setLocalSettings(newSettings);
  };

  const handleMasterChange = (char: 'n'|'o'|'H'|'O', side: 'lsb'|'rsb', val: number) => {
      const newSettings = {
          ...localSettings,
          [char]: { ...localSettings[char], [side]: val }
      };
      setLocalSettings(newSettings);
  };

  // --- Dynamic Character List Generation ---
  const availableChars = useMemo(() => {
    if (!font || !font.fontObj) {
        return "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789".split('');
    }
    const uniqueChars = new Set<string>();
    // Priority chars
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz".split('').forEach(c => uniqueChars.add(c));
    
    // Scan font
    const numGlyphs = font.fontObj.glyphs.length;
    for (let i = 0; i < numGlyphs; i++) {
        const glyph = font.fontObj.glyphs.get(i);
        if (glyph.unicode) {
            try {
                const char = String.fromCodePoint(glyph.unicode);
                if (char && char.trim() !== '') uniqueChars.add(char);
            } catch (e) {}
        }
    }
    return Array.from(uniqueChars);
  }, [font]);

  // --- Detailed Tuning Logic ---

  const getCharGroupStatus = (char: string) => {
      const g = localSettings.groups;
      if (g.group1.includes(char)) return "Grupo 1 (Relacional)";
      if (g.group2.includes(char)) return "Grupo 2 (Semi)";
      if (g.group3.includes(char)) return "Grupo 3 (Visual)";
      if (g.upperGroup1.includes(char)) return "Grupo Superior 1 (Relacional)";
      if (g.upperGroup2.includes(char)) return "Grupo Superior 2 (Semi)";
      if (g.upperGroup3.includes(char)) return "Grupo Superior 3 (Visual)";
      return "Sem Grupo (Ajuste Visual)";
  };

  const getCurrentMetric = (side: 'lsb' | 'rsb') => {
     // 1. Explicit Override in local state?
     if (localSettings.overrides[overrideChar] && localSettings.overrides[overrideChar][side] !== undefined && localSettings.overrides[overrideChar][side] !== null) {
         return localSettings.overrides[overrideChar][side]!;
     }
     
     // 2. Fallback: Read actual metric from processed font
     if (font && font.fontObj) {
         const glyph = font.fontObj.charToGlyph(overrideChar);
         if (glyph) {
             const box = glyph.getBoundingBox();
             if (side === 'lsb') return Math.round(box.x1);
             if (side === 'rsb') return Math.round(glyph.advanceWidth - box.x2);
         }
     }
     return 0;
  };

  const hasOverride = useMemo(() => {
      return !!localSettings.overrides[overrideChar];
  }, [localSettings.overrides, overrideChar]);

  const updateOverride = (side: 'lsb' | 'rsb', val: number) => {
      const current = localSettings.overrides[overrideChar] || { lsb: null, rsb: null };
      
      // If setting one side, ensure the other side preserves its current state (derived or overridden)
      let otherSideVal = side === 'lsb' ? current.rsb : current.lsb;
      if (otherSideVal === null) {
          otherSideVal = getCurrentMetric(side === 'lsb' ? 'rsb' : 'lsb');
      }

      const newOverride = {
          lsb: side === 'lsb' ? val : otherSideVal,
          rsb: side === 'rsb' ? val : otherSideVal
      };

      const newSettings = {
          ...localSettings,
          overrides: {
              ...localSettings.overrides,
              [overrideChar]: newOverride
          }
      };
      setLocalSettings(newSettings);
  };

  const resetOverride = () => {
      const newOverrides = { ...localSettings.overrides };
      delete newOverrides[overrideChar];
      const newSettings = { ...localSettings, overrides: newOverrides };
      setLocalSettings(newSettings);
  };

  // Generate test context based on char case and group
  const overrideContext = useMemo(() => {
     const isUpper = overrideChar.toUpperCase() === overrideChar && overrideChar.toLowerCase() !== overrideChar;
     const group = isUpper ? localSettings.groups.upperGroup1 : localSettings.groups.group1;
     return [generateAdhesionText(overrideChar, group)];
  }, [overrideChar, localSettings.groups]);

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

  // Derived values for inputs come from local state logic now
  const currentLsb = getCurrentMetric('lsb');
  const currentRsb = getCurrentMetric('rsb');

  return (
    <div className="dark:bg-slate-900/50 bg-slate-100/50 backdrop-blur rounded-2xl p-3 md:p-8 border dark:border-slate-800 border-slate-200 h-full overflow-y-auto overflow-x-visible custom-scrollbar shadow-2xl">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-4 md:mb-8 pb-3 md:pb-6 border-b dark:border-slate-800 border-slate-200 z-10 -mx-2 px-4">
        <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
                <Settings2 className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
                <h2 className="text-2xl md:text-3xl font-black dark:text-white text-slate-900 tracking-tighter leading-none mb-1">
                    MÉTODO SOUSA
                </h2>
                <div className="flex items-center gap-2">
                    <p className="text-xs text-indigo-400 uppercase font-black tracking-widest pb-[1px]">Miguel Sousa & Fernando Mello</p>
                    <TheoreticalTooltip content="Desenvolvido por Miguel Sousa, este método organiza os glifos em três grupos por semelhança formal. Ele utiliza a herança de mestres (como 'l' e 'o') mas mantém a flexibilidade para o ajuste visual onde a forma é única." />
                </div>
            </div>
        </div>
      </div>

      <div className="space-y-8 pb-10">

        {/* --- 1. Topology Configuration (Collapsible) --- */}
        <div className="dark:bg-gray-900/30 bg-gray-100/30 border dark:border-gray-700 border-gray-300 rounded-lg overflow-hidden">
            <button 
                onClick={() => setShowGroups(!showGroups)}
                className="w-full flex items-center justify-between p-4 dark:bg-gray-800 bg-gray-200 dark:hover:bg-gray-700 hover:bg-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-inset"
                aria-expanded={showGroups}
                aria-controls="groups-configuration"
            >
                <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-green-500" />
                    <span className="font-semibold dark:text-gray-200 text-gray-800 text-sm md:text-base">
                        Configuração de Grupos (Miguel Sousa)
                        <span className="hidden md:inline">
                            <TheoreticalTooltip content="As letras são agrupadas por relações de herança e necessidade de ajuste visual. O Grupo 1 é puramente relacional, o Grupo 2 é híbrido e o Grupo 3 é totalmente visual." />
                        </span>
                    </span>
                </div>
                {showGroups ? <ChevronUp className="w-4 h-4 dark:text-gray-400 text-gray-600"/> : <ChevronDown className="w-4 h-4 dark:text-gray-400 text-gray-600"/>}
            </button>
            
            {showGroups && (
                <div id="groups-configuration" className="p-4 space-y-6 border-t dark:border-gray-700 border-gray-300 animate-in slide-in-from-top-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Lowercase Groups */}
                        <div className="space-y-3">
                            <h4 className="text-sm font-bold dark:text-gray-400 text-gray-600 uppercase tracking-wider border-b dark:border-gray-700 border-gray-300 pb-1">Minúsculas (Miguel Sousa)</h4>
                            <div>
                                <label className="block text-xs font-semibold text-blue-400 mb-1">1º Grupo (Relações de Herança: b, d, q...)</label>
                                <textarea 
                                    className="w-full dark:bg-gray-900 bg-gray-100 border dark:border-gray-600 border-gray-400 rounded p-2 dark:text-white text-slate-900 font-mono text-sm h-16 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                                    value={localSettings.groups.group1.join('')}
                                    onChange={(e) => handleGroupChange('group1', e.target.value)}
                                    aria-label="Caracteres do 1º Grupo de Minúsculas"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-green-400 mb-1">2º Grupo (Híbrido: r, f, t...)</label>
                                <textarea 
                                    className="w-full dark:bg-gray-900 bg-gray-100 border dark:border-gray-600 border-gray-400 rounded p-2 dark:text-white text-slate-900 font-mono text-sm h-16 focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none"
                                    value={localSettings.groups.group2.join('')}
                                    onChange={(e) => handleGroupChange('group2', e.target.value)}
                                    aria-label="Caracteres do 2º Grupo de Minúsculas"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold dark:text-gray-400 text-gray-600 mb-1">3º Grupo (Visual: s, x, z...)</label>
                                <textarea 
                                    className="w-full dark:bg-gray-900 bg-gray-100 border dark:border-gray-600 border-gray-400 rounded p-2 dark:text-white text-slate-900 font-mono text-sm h-16 focus:border-gray-500 focus:ring-1 focus:ring-gray-500 outline-none"
                                    value={localSettings.groups.group3.join('')}
                                    onChange={(e) => handleGroupChange('group3', e.target.value)}
                                    aria-label="Caracteres do 3º Grupo de Minúsculas"
                                />
                            </div>
                        </div>

                        {/* Uppercase Groups */}
                        <div className="space-y-3">
                            <h4 className="text-sm font-bold dark:text-gray-400 text-gray-600 uppercase tracking-wider border-b dark:border-gray-700 border-gray-300 pb-1">Maiúsculas (Fernando Mello)</h4>
                            <div>
                                <label className="block text-xs font-semibold text-blue-400 mb-1">1º Grupo (B D E F H I N O Q)</label>
                                <textarea 
                                    className="w-full dark:bg-gray-900 bg-gray-100 border dark:border-gray-600 border-gray-400 rounded p-2 dark:text-white text-slate-900 font-mono text-sm h-16"
                                    value={localSettings.groups.upperGroup1.join('')}
                                    onChange={(e) => handleGroupChange('upperGroup1', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-green-400 mb-1">2º Grupo (C G J K L P R)</label>
                                <textarea 
                                    className="w-full dark:bg-gray-900 bg-gray-100 border dark:border-gray-600 border-gray-400 rounded p-2 dark:text-white text-slate-900 font-mono text-sm h-16"
                                    value={localSettings.groups.upperGroup2.join('')}
                                    onChange={(e) => handleGroupChange('upperGroup2', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold dark:text-gray-400 text-gray-600 mb-1">3º Grupo (A M S T U V W X Y Z)</label>
                                <textarea 
                                    className="w-full dark:bg-gray-900 bg-gray-100 border dark:border-gray-600 border-gray-400 rounded p-2 dark:text-white text-slate-900 font-mono text-sm h-16"
                                    value={localSettings.groups.upperGroup3.join('')}
                                    onChange={(e) => handleGroupChange('upperGroup3', e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>

        {/* --- 2. Master Tuning --- */}
        <div className="space-y-6">
            <SousaMasterBlock 
                char="n" title="n (Mestre de Hastes - Minúsculas)" 
                contextWords={['nnnn', 'nonn']}
                settings={localSettings} onUpdate={handleMasterChange} font={font} fontFamily={fontFamily}
            />
            <SousaMasterBlock 
                char="o" title="o (Mestre de Curvas - Minúsculas)" 
                contextWords={['nnonn', 'oooo']}
                settings={localSettings} onUpdate={handleMasterChange} font={font} fontFamily={fontFamily}
            />
            <SousaMasterBlock 
                char="H" title="H (Mestre de Hastes - Maiúsculas)" 
                contextWords={['HHHH', 'HHOHH']}
                settings={localSettings} onUpdate={handleMasterChange} font={font} fontFamily={fontFamily}
            />
            <SousaMasterBlock 
                char="O" title="O (Mestre de Curvas - Maiúsculas)" 
                contextWords={['HHOHH', 'OOOO']}
                settings={localSettings} onUpdate={handleMasterChange} font={font} fontFamily={fontFamily}
            />
        </div>

        {/* --- 3. Detailed Tuning --- */}
        <div className="mt-12 border-t dark:border-slate-800 border-slate-200 pt-10">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
                <div>
                    <h3 className="text-xl font-black dark:text-white text-slate-900 flex items-center gap-2 tracking-tight">
                        Ajustes de Exceção
                    </h3>
                    <p className="text-xs dark:text-slate-500 text-slate-500 uppercase tracking-widest font-bold mt-1">Sobrescreva as regras por glifo (H3)</p>
                </div>
            </div>

            <div className="dark:bg-slate-900/40 bg-slate-100/40 p-6 rounded-2xl border dark:border-slate-800 border-slate-200 shadow-xl">
                 {/* Selector */}
                 <div className="flex flex-col md:flex-row md:items-center gap-6 mb-8 dark:bg-slate-950/50 bg-slate-50/50 p-6 rounded-2xl border dark:border-slate-800/50 border-slate-200/50">
                     <div className="flex-1">
                         <label className="text-xs dark:text-slate-500 text-slate-500 font-black uppercase tracking-widest mb-2 block">Seletor de Glifo</label>
                         <select 
                            value={overrideChar}
                            onChange={(e) => setOverrideChar(e.target.value)}
                            className="w-full dark:bg-slate-900 bg-slate-100 border dark:border-slate-700 border-slate-300 rounded-xl px-4 py-3 dark:text-white text-slate-900 font-mono text-base shadow-inner focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 outline-none transition-all"
                            aria-label="Escolher caracter para ajustar exceção"
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
                             <span className="text-xs font-black uppercase tracking-widest opacity-60">Origem</span>
                             {hasOverride ? (
                                 <motion.span initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="text-yellow-400 font-black px-3 py-1 bg-yellow-400/10 rounded-lg border border-yellow-400/20 text-xs uppercase tracking-widest">Sobrescrito</motion.span>
                             ) : (
                                 <span className="text-indigo-400 font-black px-3 py-1 bg-indigo-500/10 rounded-lg border border-indigo-500/20 text-xs uppercase tracking-widest">
                                     {getCharGroupStatus(overrideChar)}
                                 </span>
                             )}
                         </div>

                         {hasOverride && (
                             <button onClick={resetOverride} className="text-xs text-red-400 hover:text-red-300 font-black uppercase tracking-widest flex items-center gap-1.5 mt-3 justify-end transition-colors focus:outline-none focus:underline focus:ring-1 focus:ring-red-500 rounded" aria-label="Remover ajustes personalizados e restaurar métricas originais">
                                 <RotateCcw className="w-3 h-3" /> Restaurar Espaçamento
                             </button>
                         )}
                     </div>
                 </div>

                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-6 order-2 lg:order-1">
                        <div className="space-y-4">
                            {/* Override LSB */}
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="text-sm dark:text-slate-400 text-slate-600">Side Bearing Esquerdo</label>
                                    <input 
                                        type="number"
                                        value={currentLsb}
                                        onChange={(e) => updateOverride('lsb', Number(e.target.value))}
                                        className={`w-24 dark:bg-gray-900 bg-white border rounded px-2 py-1 h-10 text-right text-sm font-bold outline-none transition-all focus:ring-1 focus:ring-blue-500 ${hasOverride ? 'border-yellow-600 text-yellow-700 dark:text-yellow-400 shadow-[0_0_10px_rgba(234,179,8,0.1)]' : 'dark:border-slate-700 border-slate-350 text-blue-600 dark:text-blue-400'}`}
                                        aria-label="Sobrescrever Side Bearing Esquerdo"
                                    />
                                </div>
                                <input 
                                    type="range" min="-50" max="300" value={currentLsb}
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
                                        value={currentRsb}
                                        onChange={(e) => updateOverride('rsb', Number(e.target.value))}
                                        className={`w-24 dark:bg-gray-900 bg-white border rounded px-2 py-1 h-10 text-right text-sm font-bold outline-none transition-all focus:ring-1 focus:ring-green-500 ${hasOverride ? 'border-yellow-600 text-yellow-700 dark:text-yellow-400 shadow-[0_0_10px_rgba(234,179,8,0.1)]' : 'dark:border-slate-700 border-slate-350 text-green-600 dark:text-green-400'}`}
                                        aria-label="Sobrescrever Side Bearing Direito"
                                    />
                                </div>
                                <input 
                                    type="range" min="-50" max="300" value={currentRsb}
                                    onChange={(e) => updateOverride('rsb', Number(e.target.value))}
                                    className="w-full accent-green-500 h-1.5 dark:bg-slate-800 bg-slate-200 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-slate-900"
                                    aria-label="Slider Sobrescrever Side Bearing Direito"
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
                                        className="text-center bg-transparent border-none outline-none font-mono text-base text-slate-800 dark:text-slate-200 border-b border-dashed border-indigo-500/50 py-1 w-full max-w-xs focus:ring-0"
                                        placeholder="Ex: nnBnn, ooBoo"
                                    />
                                    <p className="text-[10px] text-indigo-500 mt-2 font-mono uppercase tracking-widest font-black animate-pulse">Enter para salvar</p>
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
                                    <div className="absolute top-1 right-1 opacity-0 group-hover/preview:opacity-100 transition-opacity bg-indigo-500/10 text-indigo-400 p-1 rounded">
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
                                    className="bg-slate-100 dark:bg-slate-950 border dark:border-slate-700 border-slate-300 rounded px-2 py-1 text-center text-sm font-bold dark:text-white text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none w-12 shadow-sm"
                                />
                            </div>
                        </div>
                        <div className="flex-1 w-full relative">
                            <GlyphVisualizer 
                                char={overrideChar} 
                                font={font} 
                                lsb={currentLsb} 
                                rsb={currentRsb} 
                                method="SOUSA"
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
