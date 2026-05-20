import React, { useState, useMemo, useEffect } from 'react';
import { FontState } from '../types';
import { GlyphVisualizer } from './GlyphVisualizer';
import { Eye } from 'lucide-react';

export const OriginalTuner: React.FC<{ font: FontState | null }> = ({ font }) => {
    const [selectedChar, setSelectedChar] = useState<string>('H');
    const [inputChar, setInputChar] = useState<string>('H');

    // Mantenha o inputChar sincronizado se selectedChar mudar de fora (embora aqui só mude pelo input)
    useEffect(() => {
        setInputChar(selectedChar);
    }, [selectedChar]);
    
    // Calculate LSB/RSB dynamically from raw font data
    const metrics = useMemo(() => {
        if (!font || !font.fontObj) return { lsb: 0, rsb: 0 };
        const glyph = font.fontObj.charToGlyph(selectedChar);
        if (!glyph) return { lsb: 0, rsb: 0 };
        const box = glyph.getBoundingBox();
        return { 
            lsb: Math.round(box.x1), 
            rsb: Math.round(glyph.advanceWidth - box.x2) 
        };
    }, [font, selectedChar]);

    // Use consistent character list generation
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

    return (
        <div className="dark:bg-slate-900/50 bg-slate-100/50 backdrop-blur rounded-2xl p-3 md:p-8 border dark:border-slate-800 border-slate-200 h-full overflow-y-auto custom-scrollbar shadow-2xl">
            <div className="flex items-center justify-between mb-8 pb-6 border-b dark:border-slate-800 border-slate-200">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-slate-500/20 border border-slate-500/30 flex items-center justify-center">
                        <Eye className="w-5 h-5 dark:text-slate-400 text-slate-600" />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black dark:text-white text-slate-900 tracking-tighter leading-none mb-1">
                            FONTE ORIGINAL
                        </h2>
                        <p className="text-xs dark:text-slate-400 text-slate-600 uppercase font-black tracking-widest pb-[1px]">Visualização de Métricas</p>
                    </div>
                </div>
            </div>

            <div className="mb-6 p-4 rounded-xl dark:bg-slate-950/50 bg-slate-50/50 border dark:border-slate-800 border-slate-200 text-sm dark:text-slate-400 text-slate-600">
                <p><strong>Espaçamento (Side Bearings):</strong> As métricas LSB (Left Side Bearing) e RSB (Right Side Bearing) definem o espaço vazio nas laterais de cada caractere. Elas são fundamentais para garantir que o texto tenha um ritmo equilibrado e legibilidade ideal.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Visualizer Area */}
                <div className="dark:bg-slate-950/50 bg-slate-50/50 p-6 rounded-2xl border dark:border-slate-800 border-slate-200 shadow-inner min-h-[300px] flex flex-col">
                    <div className="flex items-center gap-4 mb-4 p-3 dark:bg-slate-900 bg-slate-100/50 rounded-xl border dark:border-slate-800 border-slate-200">
                        <label className="text-xs font-black uppercase tracking-widest dark:text-slate-400 text-slate-600 whitespace-nowrap">SELECIONAR GLIFO:</label>
                        <input 
                            type="text"
                            maxLength={1}
                            value={inputChar}
                            onChange={(e) => {
                                const val = e.target.value;
                                setInputChar(val);
                                // Apenas atualize a visualização se for um glifo válido
                                if (val && availableChars.includes(val)) {
                                    setSelectedChar(val);
                                }
                            }}
                            onFocus={(e) => e.target.select()}
                            className="bg-white dark:bg-slate-950 border dark:border-slate-700 border-slate-300 rounded px-3 py-1.5 text-center text-base font-bold dark:text-white text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none w-16"
                            placeholder="Ex: H"
                        />
                    </div>
                    <div className="flex-1 min-h-[250px]">
                        <GlyphVisualizer 
                            char={selectedChar} 
                            font={font} 
                            lsb={metrics.lsb} 
                            rsb={metrics.rsb} 
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t dark:border-slate-800 border-slate-200">
                        <div className="text-center p-3 rounded-xl dark:bg-slate-900 bg-slate-100 border dark:border-slate-800 border-slate-200">
                            <div className="text-xs uppercase tracking-widest dark:text-slate-500 text-slate-500 font-bold mb-1">LSB (Origin)</div>
                            <div className="text-2xl font-mono font-bold text-blue-400">{metrics.lsb}</div>
                        </div>
                        <div className="text-center p-3 rounded-xl dark:bg-slate-900 bg-slate-100 border dark:border-slate-800 border-slate-200">
                            <div className="text-xs uppercase tracking-widest dark:text-slate-500 text-slate-500 font-bold mb-1">RSB (Advance)</div>
                            <div className="text-2xl font-mono font-bold text-green-400">{metrics.rsb}</div>
                        </div>
                    </div>
                </div>

                {/* Character Grid Selector */}
                <div className="dark:bg-slate-950/50 bg-slate-50/50 p-6 rounded-2xl border dark:border-slate-800 border-slate-200 shadow-inner">
                    <label className="text-xs dark:text-slate-500 text-slate-500 font-black uppercase tracking-widest mb-4 block">Seletor de Glifos</label>
                    <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-2 h-96 overflow-y-auto custom-scrollbar p-1">
                        {availableChars.map(c => (
                            <button 
                                key={c} 
                                onClick={() => setSelectedChar(c)} 
                                className={`aspect-square flex items-center justify-center rounded-lg text-base font-bold transition-all ${
                                    selectedChar === c 
                                    ? 'bg-slate-500 dark:text-white text-slate-900 shadow-lg' 
                                    : 'dark:bg-slate-800 bg-slate-200 dark:text-slate-400 text-slate-600 dark:hover:bg-slate-700 hover:bg-slate-300'
                                }`}
                            >
                                {c}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
