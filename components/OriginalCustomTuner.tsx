import React, { useState, useMemo, useEffect } from 'react';
import { FontState, OriginalCustomSettings } from '../types';
import { GlyphVisualizer } from './GlyphVisualizer';
import { RotateCcw, Eye, Layers, X, Edit2 } from 'lucide-react';

export const OriginalCustomTuner: React.FC<{ 
    font: FontState | null, 
    originalFont: FontState | null,
    settings: OriginalCustomSettings, 
    onSettingsChange: (s: OriginalCustomSettings) => void 
}> = ({ font, originalFont, settings, onSettingsChange }) => {
    const [selectedChar, setSelectedChar] = useState<string>('H');
    const [inputChar, setInputChar] = useState<string>('H');
    const [inputEditingChar, setInputEditingChar] = useState<string>('');

    const [editingChar, setEditingChar] = useState<string | null>(null);
    const [isModalEditing, setIsModalEditing] = useState(false);

    useEffect(() => {
        setInputChar(selectedChar);
    }, [selectedChar]);

    useEffect(() => {
        if (editingChar) {
            setInputEditingChar(editingChar);
        }
    }, [editingChar]);

    // Resolve displayed character: either editing one, or just selected one in grid
    const targetChar = editingChar || selectedChar;

    const [modalTestText, setModalTestText] = useState<string>('');

    // Dynamically calculate and set default sequence for the current glyph on selection, preventing leak
    useEffect(() => {
        const isUpper = targetChar === targetChar.toUpperCase() && targetChar !== targetChar.toLowerCase();
        const defaultSeq = isUpper 
            ? `HH${targetChar}HH, OO${targetChar}OO` 
            : `nn${targetChar}nn, oo${targetChar}oo`;
        setModalTestText(defaultSeq);
        setIsModalEditing(false);
    }, [targetChar]);

    const handleModalTestTextChange = (val: string) => {
        setModalTestText(val);
    };

    const originalMetrics = useMemo(() => {
        if (!originalFont || !originalFont.fontObj) return { lsb: 0, rsb: 0 };
        const glyph = originalFont.fontObj.charToGlyph(targetChar);
        if (!glyph) return { lsb: 0, rsb: 0 };
        const box = glyph.getBoundingBox();
        return {
            lsb: Math.round(box.x1),
            rsb: Math.round(glyph.advanceWidth - box.x2)
        };
    }, [originalFont, targetChar]);

    const liveFontMetrics = useMemo(() => {
        if (!font || !font.fontObj) return { lsb: 0, rsb: 0 };
        const glyph = font.fontObj.charToGlyph(targetChar);
        if (!glyph) return { lsb: 0, rsb: 0 };
        const box = glyph.getBoundingBox();
        return {
            lsb: Math.round(box.x1),
            rsb: Math.round(glyph.advanceWidth - box.x2)
        };
    }, [font, targetChar]);

    const metrics = useMemo(() => {
        if (settings.overrides[targetChar]) {
            return settings.overrides[targetChar];
        }
        return originalMetrics;
    }, [targetChar, settings.overrides, originalMetrics]);

    const availableChars = useMemo(() => {
        if (!font || !font.fontObj) return "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789".split('');
        const chars = new Set<string>();
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789".split('').forEach(c => chars.add(c));
        const numGlyphs = font.fontObj.glyphs.length;
        for (let i = 0; i < numGlyphs; i++) {
            const glyph = font.fontObj.glyphs.get(i);
            if (glyph.unicode) {
                const char = String.fromCodePoint(glyph.unicode);
                if (char && char.trim() !== '') chars.add(char);
            }
        }
        return Array.from(chars);
    }, [font]);

    const handleMetricChange = (side: 'lsb'|'rsb', value: number) => {
        const newOverrides = { ...settings.overrides };
        const currentOverride = {
            ...metrics,
            [side]: value
        };
        newOverrides[targetChar] = currentOverride;
        onSettingsChange({ ...settings, overrides: newOverrides });
    };

    const resetOverride = () => {
        const newOverrides = { ...settings.overrides };
        delete newOverrides[targetChar];
        onSettingsChange({ ...settings, overrides: newOverrides });
    };

    const hasOverride = !!settings.overrides[targetChar];

    return (
        <div className="dark:bg-slate-900/50 bg-slate-100/50 backdrop-blur rounded-2xl p-4 md:p-6 border dark:border-slate-800 border-slate-200 h-full overflow-y-auto custom-scrollbar shadow-2xl relative">
            
            {/* OVERLAY MODAL FOR INDIVIDUAL ADJUSTMENT */}
            {editingChar && (
                <div className="absolute inset-0 z-50 dark:bg-slate-50 border dark:border-slate-800 bg-slate-50 border-slate-200 flex flex-col p-4 md:p-6 rounded-2xl overflow-y-auto custom-scrollbar shadow-2xl overflow-x-hidden" style={{backgroundColor: 'rgb(241 245 249)'}}>
                    <div className="absolute inset-0 bg-slate-100 dark:bg-slate-950 -z-10" />
                    
                    {/* Header Modal */}
                    <div className="flex justify-between items-start mb-4 shrink-0">
                        <div>
                           <h2 className="text-2xl font-black dark:text-white text-slate-900 uppercase tracking-tighter">AJUSTE FINO DE GLIFO</h2>
                           <div className="mt-1 flex items-center gap-3 text-base dark:text-slate-400 text-slate-600 font-bold uppercase tracking-widest">
                                SELETOR DE GLIFO: 
                                <div className="px-3 py-1 rounded-full border dark:border-blue-500/30 border-blue-500/30 bg-white dark:bg-slate-900 text-blue-500 flex items-center justify-center min-w-[32px] shadow-sm">
                                    {editingChar}
                                </div>
                           </div>
                        </div>
                        <div className="flex items-center gap-2">
                           <div className="hidden sm:flex items-center gap-2 bg-white dark:bg-slate-900 border dark:border-slate-800 border-slate-200 px-3 py-1.5 rounded-full shadow-sm">
                               <span className="text-[11px] uppercase font-black dark:text-slate-500 text-slate-600">STATUS</span>
                               <span className={`text-[11px] uppercase font-black px-2 py-0.5 rounded-md ${hasOverride ? 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400' : 'bg-blue-500/20 text-blue-600 dark:text-blue-400'}`}>
                                   {hasOverride ? 'MODIFICADO' : 'INDIVIDUAL'}
                               </span>
                           </div>
                           <button onClick={() => setEditingChar(null)} className="p-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 rounded-lg transition-all shadow-sm">
                               <X className="w-4 h-4 dark:text-slate-400 text-slate-600" />
                           </button>
                        </div>
                    </div>

                    {/* Body Modal */}
                    <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-4 flex-1 min-h-0">
                        {/* Left Col: Preview + Sliders */}
                        <div className="flex flex-col gap-4 overflow-y-auto custom-scrollbar p-1">
                            {/* Live Preview editable */}
                            <div className="bg-white dark:bg-slate-950 border border-slate-150 dark:border-slate-800 shadow-md shadow-slate-100/80 dark:shadow-[0_10px_30px_rgba(0,0,0,0.6)] rounded-2xl p-4 md:p-5 flex flex-col justify-center min-h-[110px]">
                                {isModalEditing ? (
                                    <div className="flex flex-col items-center justify-center w-full py-2" onClick={(e) => e.stopPropagation()}>
                                        <input 
                                            type="text"
                                            value={modalTestText}
                                            onChange={(e) => handleModalTestTextChange(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    setIsModalEditing(false);
                                                }
                                            }}
                                            onBlur={() => setIsModalEditing(false)}
                                            autoFocus
                                            className="text-center bg-transparent border-none outline-none font-mono text-base text-slate-800 dark:text-slate-200 border-b border-dashed border-pink-500/50 py-1 w-full max-w-xs focus:ring-0"
                                            placeholder="Ex: nnXnn, ooXoo"
                                        />
                                        <p className="text-[10px] text-pink-500 mt-2 font-mono uppercase tracking-widest font-black animate-pulse">Enter para salvar</p>
                                    </div>
                                ) : (
                                    <div 
                                        className="text-center py-2 cursor-pointer transition-all hover:bg-slate-50 dark:hover:bg-slate-900/30 rounded-xl relative group/preview min-h-[44px] flex flex-col justify-center items-center"
                                        onClick={() => setIsModalEditing(true)}
                                        title="Clique para editar sequência"
                                    >
                                        <div className="w-full">
                                            {modalTestText.split(',').map(s => s.trim()).filter(Boolean).map((word, wordIdx) => {
                                                const chars = word.split('');
                                                return (
                                                    <div 
                                                        key={wordIdx}
                                                        className="text-3xl md:text-4xl tracking-normal text-center break-all whitespace-nowrap mb-1" 
                                                        style={{ fontFamily: `'${font?.fullFontFamily || font?.metrics?.fontFamily}'` }}
                                                    >
                                                        {chars.map((char, charIdx) => {
                                                            const isTarget = char === editingChar || char === 'X';
                                                            const displayText = isTarget ? editingChar : char;
                                                            const style = isTarget ? {
                                                                marginLeft: `${(metrics.lsb - liveFontMetrics.lsb)/(font?.metrics?.unitsPerEm || 1000)}em`,
                                                                marginRight: `${(metrics.rsb - liveFontMetrics.rsb)/(font?.metrics?.unitsPerEm || 1000)}em`,
                                                                display: 'inline-block'
                                                            } : {
                                                                display: 'inline-block'
                                                            };
                                                            return (
                                                                <span 
                                                                    key={charIdx} 
                                                                    style={style}
                                                                    className="text-black dark:text-white font-normal relative z-10"
                                                                >
                                                                    {displayText}
                                                                </span>
                                                            );
                                                        })}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <div className="absolute top-1 right-1 opacity-0 group-hover/preview:opacity-100 transition-opacity bg-pink-500/10 text-pink-400 p-1 rounded">
                                            <Edit2 className="w-3 h-3" />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* LSB Slider */}
                            <div className="dark:bg-slate-900/50 bg-slate-50 p-4 rounded-2xl border dark:border-slate-800 border-slate-200 shadow-inner">
                                 <div className="flex justify-between items-center mb-3">
                                     <label className="text-sm font-black dark:text-slate-400 text-slate-600 uppercase tracking-widest">SIDE BEARING ESQUERDO</label>
                                     <span className="px-3 py-1 bg-white dark:bg-slate-800 border dark:border-slate-700 border-slate-200 rounded-lg text-blue-500 font-bold text-base shadow-sm">{metrics.lsb}</span>
                                 </div>
                                 <input 
                                     type="range" min="-500" max="1500" value={metrics.lsb}
                                     onChange={(e) => handleMetricChange('lsb', parseInt(e.target.value))}
                                     className="w-full accent-blue-500 h-1.5 dark:bg-slate-700 bg-slate-200 rounded-lg appearance-none cursor-pointer outline-none"
                                 />
                            </div>

                            {/* RSB Slider */}
                            <div className="dark:bg-slate-900/50 bg-slate-50 p-4 rounded-2xl border dark:border-slate-800 border-slate-200 shadow-inner">
                                 <div className="flex justify-between items-center mb-3">
                                     <label className="text-sm font-black dark:text-slate-400 text-slate-600 uppercase tracking-widest">SIDE BEARING DIREITO</label>
                                     <span className="px-3 py-1 bg-white dark:bg-slate-800 border dark:border-slate-700 border-slate-200 rounded-lg text-emerald-500 font-bold text-base shadow-sm">{metrics.rsb}</span>
                                 </div>
                                 <input 
                                     type="range" min="-500" max="1500" value={metrics.rsb}
                                     onChange={(e) => handleMetricChange('rsb', parseInt(e.target.value))}
                                     className="w-full accent-emerald-500 h-1.5 dark:bg-slate-700 bg-emerald-200 rounded-lg appearance-none cursor-pointer outline-none"
                                 />
                            </div>

                            {hasOverride && (
                                <button onClick={resetOverride} className="flex items-center justify-center gap-2 text-sm text-red-500 bg-red-500/10 hover:bg-red-500/20 rounded-xl dark:text-red-400 font-black uppercase tracking-widest py-3 transition-colors focus:outline-none border border-red-500/20">
                                    <RotateCcw className="w-3.5 h-3.5" /> Restaurar Métricas
                                </button>
                            )}
                        </div>
                        
                        {/* Right Col: Visualizer */}
                        <div className="flex flex-col min-h-0">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-sm font-black dark:text-slate-400 text-slate-600 uppercase tracking-widest flex items-center gap-2">
                                    <Layers className="w-3.5 h-3.5" /> ANÁLISE GEOMÉTRICA
                                </h3>
                                <div className="flex items-center gap-2">
                                    <label className="text-[11px] font-black uppercase tracking-widest dark:text-slate-400 text-slate-600 whitespace-nowrap">GLIFO:</label>
                                    <input 
                                        type="text"
                                        maxLength={1}
                                        value={inputEditingChar}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setInputEditingChar(val);
                                            if (val && availableChars.includes(val)) {
                                                setEditingChar(val);
                                                setSelectedChar(val);
                                            }
                                        }}
                                        onFocus={(e) => e.target.select()}
                                        className="bg-white dark:bg-slate-950 border dark:border-slate-700 border-slate-300 rounded px-2 py-1 text-center text-sm font-bold dark:text-white text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none w-12 shadow-sm"
                                    />
                                </div>
                            </div>
                            <div className="flex-1 dark:bg-slate-900 bg-white rounded-3xl border dark:border-slate-800 border-slate-200 overflow-hidden min-h-[250px] shadow-sm flex flex-col p-4">
                                <div className="flex-1 border dark:border-slate-800 border-slate-100 rounded-2xl overflow-hidden shadow-inner">
                                    <GlyphVisualizer 
                                        char={editingChar} 
                                        font={font} 
                                        lsb={metrics.lsb} 
                                        rsb={metrics.rsb} 
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}


            {/* MAIN VIEW - Identical to OriginalTuner */}
            <div className={`flex flex-col h-full ${editingChar ? 'hidden' : ''}`}>
                <div className="flex items-center justify-between mb-4 pb-4 border-b dark:border-slate-800 border-slate-200 shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-lg bg-slate-500/20 border border-slate-500/30 flex items-center justify-center relative">
                            <Eye className="w-4 h-4 dark:text-slate-400 text-slate-600" />
                            <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-yellow-500 rounded-full border-2 dark:border-slate-900 border-slate-100" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black dark:text-white text-slate-900 tracking-tighter leading-none mb-0.5">
                                ORIGINAL CUSTOMIZADA
                            </h2>
                            <p className="text-xs dark:text-slate-400 text-slate-600 uppercase font-black tracking-widest pb-[1px]">Visualização e Edição de Métricas</p>
                        </div>
                    </div>
                </div>

                <div className="mb-4 p-4 rounded-xl dark:bg-slate-950/50 bg-slate-50/50 border dark:border-slate-800 border-slate-200 text-sm dark:text-slate-400 text-slate-600 shrink-0">
                    <p><strong>Espaçamento Customizado:</strong> Selecione um glifo na grade abaixo para realizar ajustes precisos em seus Side Bearings (LSB/RSB).</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">
                    {/* Visualizer Area */}
                    <div className="dark:bg-slate-950/50 bg-slate-50/50 p-4 rounded-2xl border dark:border-slate-800 border-slate-200 shadow-inner flex flex-col pt-4">
                        <div className="flex items-center justify-between gap-4 mb-4 p-3 dark:bg-slate-900 bg-slate-100/50 rounded-xl border dark:border-slate-800 border-slate-200">
                            <label className="text-xs font-black uppercase tracking-widest dark:text-slate-400 text-slate-600 whitespace-nowrap">SELECIONAR GLIFO:</label>
                            <input 
                                type="text"
                                maxLength={1}
                                value={inputChar}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setInputChar(val);
                                    if (val && availableChars.includes(val)) {
                                        setSelectedChar(val);
                                    }
                                }}
                                onFocus={(e) => e.target.select()}
                                className="bg-white dark:bg-slate-950 border dark:border-slate-700 border-slate-300 rounded px-3 py-1.5 text-center text-base font-bold dark:text-white text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none w-16"
                                placeholder="Ex: H"
                            />
                        </div>
                        <div className="flex-1 min-h-[200px] bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-800 border-slate-200 shadow-sm overflow-hidden mb-4">
                            <GlyphVisualizer 
                                char={selectedChar} 
                                font={font} 
                                lsb={metrics.lsb} 
                                rsb={metrics.rsb} 
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4 mt-auto">
                            <div className="text-center p-3 rounded-xl dark:bg-slate-900 bg-white border dark:border-slate-800 border-slate-200 shadow-sm relative overflow-hidden">
                                <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500/20" />
                                <div className="text-sm uppercase tracking-widest dark:text-slate-500 text-slate-500 font-black mb-1">LSB</div>
                                <div className="text-2xl font-mono font-bold text-blue-500">{metrics.lsb}</div>
                            </div>
                            <div className="text-center p-3 rounded-xl dark:bg-slate-900 bg-white border dark:border-slate-800 border-slate-200 shadow-sm relative overflow-hidden">
                                <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500/20" />
                                <div className="text-sm uppercase tracking-widest dark:text-slate-500 text-slate-500 font-black mb-1">RSB</div>
                                <div className="text-2xl font-mono font-bold text-emerald-500">{metrics.rsb}</div>
                            </div>
                        </div>
                    </div>

                    {/* Character Grid Selector */}
                    <div className="dark:bg-slate-950/50 bg-slate-50/50 p-4 lg:p-6 rounded-2xl border dark:border-slate-800 border-slate-200 shadow-inner flex flex-col min-h-0">
                        <label className="text-xs dark:text-slate-500 text-slate-600 font-black uppercase tracking-widest mb-4 block">Seletor de Glifos</label>
                        <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-8 lg:grid-cols-6 xl:grid-cols-8 gap-2 h-full overflow-y-auto custom-scrollbar p-1">
                            {availableChars.map(c => {
                                const isModified = !!settings.overrides[c];
                                return (
                                    <button 
                                        key={c} 
                                        onClick={() => {
                                            setSelectedChar(c);
                                            setEditingChar(c);
                                        }} 
                                        className={`w-full aspect-square flex items-center justify-center rounded-lg text-lg font-bold transition-all relative ${
                                            selectedChar === c && !editingChar
                                            ? 'bg-slate-600 dark:bg-slate-500 text-white shadow-lg transform scale-105 z-10' 
                                            : 'dark:bg-slate-800 bg-slate-200 dark:text-slate-400 text-slate-700 dark:hover:bg-slate-700 hover:bg-slate-300'
                                        }`}
                                    >
                                        {c}
                                        {isModified && (
                                            <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-yellow-500 shadow-sm" />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};