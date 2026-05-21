
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useTheme } from './useTheme';
import { TracySettings, FontState, MethodType } from '../types';
import { Layers, Type, AlignJustify, Download, BarChart2, Columns, ArrowUpDown, FileText, Loader2, Search, X, Edit2 } from 'lucide-react';
import { calculateAverageSB, downloadFont, getCharMetrics, generateFontFaceCSS } from '../services/fontService';
import { motion, AnimatePresence } from 'motion/react';
import { SpacingDiagram } from './SpacingDiagram';
import { SousaAnalysisView } from './SousaAnalysisView';
import { GlyphVisualizer } from './GlyphVisualizer';
import { SequenceVisualizer } from './SequenceVisualizer';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

import { useDebounce } from './useDebounce';

// --- NEW COMPONENT: Skeleton Screen for loading/processing states ---
const AnalysisSkeleton = () => (
    <div className="w-full animate-pulse space-y-8 p-4 md:p-8">
        <div className="flex justify-between items-center bg-slate-100 dark:bg-slate-800/50 h-16 rounded-2xl mb-8" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-4">
                <div className="h-4 bg-slate-100 dark:bg-slate-800/50 rounded w-1/4" />
                <div className="h-64 bg-slate-100 dark:bg-slate-800/20 rounded-2xl" />
            </div>
            <div className="space-y-4">
                <div className="h-4 bg-slate-100 dark:bg-slate-800/50 rounded w-1/4" />
                <div className="h-64 bg-slate-100 dark:bg-slate-800/20 rounded-2xl" />
            </div>
        </div>
        <div className="space-y-4">
            <div className="h-4 bg-slate-100 dark:bg-slate-800/50 rounded w-1/4" />
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
                {[...Array(12)].map((_, i) => (
                    <div key={i} className="h-16 bg-slate-100 dark:bg-slate-800/30 rounded-xl" />
                ))}
            </div>
        </div>
    </div>
);

interface AnalysisCanvasProps {
  fonts: Record<string, FontState | null>;
  isCompareMode?: boolean;
  customLabels?: {
      original: string;
      tracy: string;
  };
  onUpdateGlyph?: (method: MethodType, char: string, lsb: number | null, rsb: number | null) => void;
}

const PARAGRAPH_TEXT = "Hook, a do. Joe, succor asclepias cod efferent. Fans rolls, oceania leets boise sentimentalisation, geologian pedicels, plowtail, dip em kinins tetracerous, non a revisal, at. Clamer goon, downstrokes imputative blip ballonne, yakin ouenite, he. Em arapunga, oat, a feud. Palaeoclimatologist, a ten noncrucial a to, rauli, a sirky, coy, if, pour my xmas. Hew, wisher seventy. Conducts, ya note, algic. Iricism, mil, swob groundling, koruny, hi lode, overwoman, shrive. Educate am fractocumulus, they tempt. Us goloe, offic, wammus, luminescing. Wow, relighted. Veracious glacon, seed, dram bat oral sgabellos noviceship, age neo cant bethorn, cirri nondepressed laserdisks, mom owl, fall. Multicordate, is, splint chremzel a he, kodak, acre, yokel, pope kong. A mojarra, savant, dredges, squattest ye. Plonked algologist, sip citrin. us gimp, woke, congressing.";

const RemainingGlyphItem = React.memo(({ g, font, borderColor, onClick }: { g: any, font: any, borderColor: string, onClick?: (char: string, lsb: number, rsb: number) => void }) => (
    <div 
        key={g.unicode} 
        onClick={() => onClick?.(g.char, g.lsb, g.rsb)}
        className={`dark:bg-gray-800/30 bg-gray-200/30 rounded h-16 p-1 flex items-center border ${borderColor} dark:hover:bg-gray-800 hover:bg-gray-200 transition-colors cursor-pointer`}
    >
        <div className="flex-1 flex flex-col items-center justify-center h-full border-r dark:border-gray-700/30 border-gray-300/30">
            <span className="text-[11px] dark:text-gray-500 text-gray-500 font-bold mb-0.5 leading-none">L</span>
            <span className="text-[11px] dark:text-gray-300 text-gray-700 font-mono leading-none">{g.lsb}</span>
        </div>
        <div 
            className="w-10 text-2xl dark:text-white text-slate-900 text-center flex items-center justify-center leading-none pb-1"
            style={{ fontFamily: `'${font.fullFontFamily}'` }}
        >
            {/* Special visualization for Space */}
            {g.char === ' ' ? <span className="text-xs dark:text-gray-500 text-gray-500 font-mono">SPACE</span> : g.char}
        </div>
        <div className="flex-1 flex flex-col items-center justify-center h-full border-l dark:border-gray-700/30 border-gray-300/30">
            <span className="text-[11px] dark:text-gray-500 text-gray-500 font-bold mb-0.5 leading-none">R</span>
            <span className="text-[11px] dark:text-gray-300 text-gray-700 font-mono leading-none">{g.rsb}</span>
        </div>
    </div>
));

// --- NEW COMPONENT: Displays metrics for glyphs NOT in the standard topology (Numbers, Punctuation, etc.) ---
const RemainingGlyphsView = React.memo(({ font, method, searchQuery = '', onGlyphClick }: { font: FontState | null, method: MethodType, searchQuery?: string, onGlyphClick?: (char: string, lsb: number, rsb: number) => void }) => {
    const [displayLimit, setDisplayLimit] = useState(60);
    
    // Reset limit when searchQuery changes
    useEffect(() => {
        setDisplayLimit(60);
    }, [searchQuery]);

    const glyphs = useMemo(() => {
        if (!font || !font.fontObj) return [];
        
        const standardChars = new Set([
            ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(''),
            ..."abcdefghijklmnopqrstuvwxyz".split('')
        ]);
        
        const found: Array<{ char: string, lsb: number, rsb: number, unicode: number }> = [];
        
        const numGlyphs = font.fontObj.glyphs.length;
        // Optimization: Use a smaller subset for standard analysis unless searching
        // Or if searching, still iterate but maybe we can optimize the lookup
        for (let i = 0; i < numGlyphs; i++) {
            const glyph = font.fontObj.glyphs.get(i);
            if (glyph.unicode) {
                try {
                    const char = String.fromCodePoint(glyph.unicode);
                    if (!standardChars.has(char)) {
                        if (char.trim() !== '' || char === ' ') {
                            // Only calculate metrics for what we might actually show
                            // but we need them for filtering? No, metrics aren't for filtering.
                            // However, we need them for the display.
                            found.push({ char, lsb: 0, rsb: 0, unicode: glyph.unicode });
                        }
                    }
                } catch (e) {}
            }
        }
        
        // Filter by searchQuery
        const filtered = searchQuery 
            ? found.filter(g => 
                g.char.toLowerCase().includes(searchQuery.toLowerCase()) || 
                g.unicode.toString(16).toLowerCase().includes(searchQuery.toLowerCase())
              )
            : found;

        return filtered.sort((a, b) => a.unicode - b.unicode);
    }, [font?.fontObj, searchQuery]);

    if (!font || !font.fontObj || glyphs.length === 0) return null;

    const visibleGlyphs = glyphs.slice(0, displayLimit).map(g => {
        // Calculate metrics only for visible subset
        const { lsb, rsb } = getCharMetrics(font.fontObj!, g.char);
        return { ...g, lsb, rsb };
    });

    const getStyles = () => {
        switch(method) {
            case MethodType.TRACY: return { color: 'text-pink-400', border: 'border-pink-500/20' };
            case MethodType.SOUSA: return { color: 'text-cyan-400', border: 'border-cyan-500/20' };
            case MethodType.ORIGINAL_CUSTOM: return { color: 'text-blue-400', border: 'border-blue-500/20' };
            default: return { color: 'dark:text-slate-400 text-slate-600', border: 'border-slate-500/20' };
        }
    };

    const styles = getStyles();
    const methodColor = styles.color;
    const borderColor = styles.border;

    return (
        <div className="mt-8 pt-6 border-t dark:border-gray-800 border-gray-200">
             <h4 className={`text-sm font-black uppercase mb-4 tracking-widest flex items-center gap-2 ${methodColor}`}>
                 {glyphs.length} Glifos Complementares
                 {searchQuery && <span className="text-[10px] opacity-60 font-mono">(Filtro Ativo)</span>}
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6 gap-3">
                {visibleGlyphs.map(g => (
                    <RemainingGlyphItem key={g.unicode} g={g} font={font} borderColor={borderColor} onClick={onGlyphClick} />
                ))}
            </div>
            {glyphs.length > displayLimit && (
                <div className="mt-6 flex justify-center">
                    <button 
                        onClick={() => setDisplayLimit(prev => prev + 120)}
                        className="px-6 py-2 rounded-full border dark:border-gray-700 border-gray-300 dark:text-gray-400 text-gray-600 text-xs font-bold uppercase tracking-wider hover:bg-gray-800 hover:text-white transition-all"
                    >
                        Carregar mais {Math.min(120, glyphs.length - displayLimit)} glifos...
                    </button>
                </div>
            )}
        </div>
    );
});

export const AnalysisCanvas: React.FC<AnalysisCanvasProps> = ({ fonts, isCompareMode = false, customLabels, onUpdateGlyph }) => {
  const { isDark } = useTheme();

  // Ensure we have at least one font loaded to display analysis
  const hasFonts = Object.values(fonts).some(f => !!f && !!f.fontObj);
  if (!hasFonts) return <AnalysisSkeleton />;

  const [testText, setTestText] = useState(PARAGRAPH_TEXT);
  const [analysisPreset, setAnalysisPreset] = useState<'paragraph' | 'words-overlay' | 'custom'>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('saame_analysis_preset') : null;
    if (saved && ['paragraph', 'words-overlay', 'custom'].includes(saved)) {
      return saved as any;
    }
    return 'paragraph';
  });

  React.useEffect(() => {
    localStorage.setItem('saame_analysis_preset', analysisPreset);
  }, [analysisPreset]);

  const [fontSize, setFontSize] = useState(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('saame_font_size') : null;
    return saved ? Number(saved) : 18;
  });
  const debouncedFontSize = useDebounce(fontSize, 300);

  React.useEffect(() => {
    localStorage.setItem('saame_font_size', fontSize.toString());
  }, [fontSize]);

  const [lineHeight, setLineHeight] = useState(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('saame_line_height') : null;
    return saved ? Number(saved) : 1.5;
  });
  const debouncedLineHeight = useDebounce(lineHeight, 300);

  React.useEffect(() => {
    localStorage.setItem('saame_line_height', lineHeight.toString());
  }, [lineHeight]);
  const [viewMode, setViewMode] = useState<'stack' | 'overlay' | 'metrics' | 'side-by-side'>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('saame_view_mode') : null;
    if (saved && ['stack', 'overlay', 'metrics', 'side-by-side'].includes(saved)) {
      return saved as any;
    }
    return 'side-by-side';
  });

  React.useEffect(() => {
    localStorage.setItem('saame_view_mode', viewMode);
  }, [viewMode]);
  const [selectedDiagramMethod, setSelectedDiagramMethod] = useState<MethodType>(MethodType.TRACY);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Memoize search query update for performance
  const handleSearchChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  }, []);

  const [selectedAdjustment, setSelectedAdjustment] = useState<{
    char: string,
    method: MethodType,
    lsb: number,
    rsb: number
  } | null>(null);

  const toggleAdjustment = React.useCallback((char: string, lsb: number, rsb: number, method: MethodType) => {
      setSelectedAdjustment({ char, method, lsb, rsb });
  }, []);
  const [modalTestText, setModalTestText] = useState<string>('');
  const [isModalEditing, setIsModalEditing] = useState(false);
  const [activeMethods, setActiveMethods] = useState<MethodType[]>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('saame_comparison_methods') : null;
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return [
      MethodType.ORIGINAL,
      MethodType.ORIGINAL_CUSTOM,
      MethodType.TRACY,
      MethodType.SOUSA
    ];
  });

  React.useEffect(() => {
    localStorage.setItem('saame_comparison_methods', JSON.stringify(activeMethods));
  }, [activeMethods]);

  const toggleMethod = (method: MethodType) => {
    setActiveMethods(prev => {
        if (prev.includes(method)) {
            if (prev.length === 1) return prev; // Keep at least one
            return prev.filter(m => m !== method);
        }
        return [...prev, method].sort((a, b) => {
            const order = [MethodType.ORIGINAL, MethodType.ORIGINAL_CUSTOM, MethodType.TRACY, MethodType.SOUSA];
            return order.indexOf(a) - order.indexOf(b);
        });
    });
  };

  // Reset modal state on character change
  React.useEffect(() => {
    if (selectedAdjustment) {
      const isUpper = selectedAdjustment.char === selectedAdjustment.char.toUpperCase() && selectedAdjustment.char !== selectedAdjustment.char.toLowerCase();
      setModalTestText(isUpper ? `HH${selectedAdjustment.char}HH, OO${selectedAdjustment.char}OO` : `nn${selectedAdjustment.char}nn, oo${selectedAdjustment.char}oo`);
      setIsModalEditing(false);
    }
  }, [selectedAdjustment?.char]);

  const exportRef = useRef<HTMLDivElement>(null);
  
  const originalFont = fonts[MethodType.ORIGINAL];
  const tracyFont = fonts[MethodType.TRACY];
  const sousaFont = fonts[MethodType.SOUSA];

  // Logic to determine labels based on mode and props
  const labelOriginal = isCompareMode 
    ? (customLabels?.original || 'Referência Original') 
    : (originalFont?.fullFontFamily || 'Original');
    
  const labelTracy = isCompareMode 
    ? (customLabels?.tracy || 'Espécime Ajustado') 
    : "Método Walter Tracy";

  const handleExport = (type: MethodType) => {
      const fontState = fonts[type];
      if (fontState?.fontObj) {
          downloadFont(fontState.fontObj, type);
      }
  };

  const avgSBs = useMemo(() => {
    const results: Record<string, number> = {};
    Object.entries(fonts).forEach(([type, f]) => {
        if (f?.fontObj) results[type] = calculateAverageSB(f.fontObj);
    });
    return results;
  }, [fonts]);

  const getAvgSB = (type: MethodType) => {
      return avgSBs[type] || 0;
  };

  const setPreset = (text: string, size: number, presetType: 'paragraph' | 'words-overlay') => {
      setTestText(text);
      setFontSize(size);
      setAnalysisPreset(presetType);
  };

  // --- PRECISE METRIC CALCULATIONS ---
  const cachedMetrics = useMemo(() => {
      // Default fallback
      const empty = { 
          grid: '', 
          gridLight: '',
          lhPx: fontSize * lineHeight, 
          refBaseline: 0, 
          expCorrectionY: 0 
      };

      if (!originalFont?.metrics) return empty;

      // 1. Constants
      const LH_RATIO = lineHeight;
      const lhPx = fontSize * LH_RATIO;
      
      // 2. Reference Metrics (The Source of Truth for the Grid)
      const refM = originalFont.metrics;
      // Safeguard against invalid UPM
      const safeRefUPM = refM.unitsPerEm || 1000; 
      const refScale = fontSize / safeRefUPM;
      
      const refContentH = (refM.ascender + Math.abs(refM.descender)) * refScale;
      const refLeading = lhPx - refContentH;
      const refBaselineY = (refLeading / 2) + (refM.ascender * refScale);

      // Grid Coordinates (Aligned to Reference)
      const gridY = {
          asc: refBaselineY - (refM.ascender * refScale),
          cap: refBaselineY - (refM.capHeight * refScale),
          x: refBaselineY - (refM.xHeight * refScale),
          base: refBaselineY,
          desc: refBaselineY + (Math.abs(refM.descender) * refScale) // Positive direction downwards
      };

      // 3. Experimental Metrics (For alignment correction)
      let expCorrectionY = 0;
      if (tracyFont?.metrics) {
          const expM = tracyFont.metrics;
          const safeExpUPM = expM.unitsPerEm || 1000;
          const expScale = fontSize / safeExpUPM;
          
          const expNaturalBaselineY = ( (lhPx - (expM.ascender + Math.abs(expM.descender)) * expScale) / 2) + (expM.ascender * expScale);
          
          expCorrectionY = refBaselineY - expNaturalBaselineY;
      }

      // Helper to generate SVG string (DRY)
      const generateSVG = (isLightMode: boolean) => {
          const colors = isLightMode ? {
               asc: '#d97706', // Darker Yellow
               cap: '#15803d', // Darker Green
               x: '#1d4ed8',   // Darker Blue
               base: '#000000', // BLACK Baseline
               desc: '#b91c1c', // Darker Red
               lbl: '#4b5563', // Gray 600
               refLine: 'rgba(0,0,0,0.3)'
          } : {
               asc: '#EAB308',
               cap: '#22C55E',
               x: '#3B82F6',
               base: '#FFFFFF',
               desc: '#EF4444',
               lbl: 'rgba(255, 255, 255, 0.4)',
               refLine: 'rgba(255, 255, 255, 0.2)'
          };

          if (isCompareMode) {
            return `
                <svg width="100%" height="${lhPx}" xmlns="http://www.w3.org/2000/svg" shape-rendering="geometricPrecision">
                    <style>
                        .line { stroke-width: 0.5px; vector-effect: non-scaling-stroke; stroke-dasharray: 4 2; opacity: 0.5; }
                        .base { stroke-width: 0.8px; stroke-dasharray: none; opacity: 0.7; }
                    </style>
                    <line x1="0" y1="${gridY.asc}" x2="100%" y2="${gridY.asc}" class="line" stroke="${colors.asc}" />
                    <line x1="0" y1="${gridY.cap}" x2="100%" y2="${gridY.cap}" class="line" stroke="${colors.cap}" />
                    <line x1="0" y1="${gridY.x}" x2="100%" y2="${gridY.x}" class="line" stroke="${colors.x}" />
                    <line x1="0" y1="${gridY.base}" x2="100%" y2="${gridY.base}" class="base" stroke="${colors.base}" />
                    <line x1="0" y1="${gridY.desc}" x2="100%" y2="${gridY.desc}" class="line" stroke="${colors.desc}" />
                </svg>
            `;
          } else {
             return `
                <svg width="100%" height="${lhPx}" xmlns="http://www.w3.org/2000/svg" shape-rendering="geometricPrecision">
                    <defs>
                        <style>
                            .txt { font-family: 'Fira Code', monospace; font-size: 8px; font-weight: 500; }
                            .line { stroke-width: 0.5px; vector-effect: non-scaling-stroke; }
                            .ref { stroke: ${colors.refLine}; stroke-dasharray: 2 2; }
                            .lbl { fill: ${colors.lbl}; }
                            .base { stroke: ${isLightMode ? 'rgba(8, 145, 178, 1)' : 'rgba(6, 182, 212, 0.7)'}; stroke-width: 0.8px; } 
                        </style>
                    </defs>
                    <line x1="0" y1="${gridY.asc}" x2="100%" y2="${gridY.asc}" class="line ref" />
                    <text x="4" y="${gridY.asc + 8}" class="txt lbl">ASC</text>

                    <line x1="0" y1="${gridY.cap}" x2="100%" y2="${gridY.cap}" class="line ref" />
                    <text x="28" y="${gridY.cap + 8}" class="txt lbl">CAP</text>

                    <line x1="0" y1="${gridY.x}" x2="100%" y2="${gridY.x}" class="line ref" />
                    <text x="4" y="${gridY.x - 3}" class="txt lbl">x-Height</text>

                    <line x1="0" y1="${gridY.base}" x2="100%" y2="${gridY.base}" class="line base" />
                    <text x="4" y="${gridY.base - 3}" class="txt lbl" style="fill: ${isLightMode ? 'rgba(8, 145, 178, 1)' : 'rgba(6, 182, 212, 0.8)'}">BASE</text>

                    <line x1="0" y1="${gridY.desc}" x2="100%" y2="${gridY.desc}" class="line ref" />
                    <text x="4" y="${gridY.desc - 3}" class="txt lbl">DESC</text>
                </svg>
            `;
          }
      };

      const svgDark = generateSVG(false);
      const svgLight = generateSVG(true);

      return {
          grid: isDark ? `url("data:image/svg+xml;utf8,${encodeURIComponent(svgDark.replace(/\s+/g, ' ').trim())}")` : `url("data:image/svg+xml;utf8,${encodeURIComponent(svgLight.replace(/\s+/g, ' ').trim())}")`,
          gridLight: `url("data:image/svg+xml;utf8,${encodeURIComponent(svgLight.replace(/\s+/g, ' ').trim())}")`,
          lhPx,
          refBaseline: refBaselineY,
          expCorrectionY
      };
  }, [originalFont?.metrics, tracyFont?.metrics, fontSize, lineHeight, isDark, isCompareMode]);

  const { grid, gridLight, expCorrectionY } = cachedMetrics;

  const fontFacesCSS = useMemo(() => {
    return Object.values(fonts)
        .filter((f): f is FontState => !!f)
        .map(f => generateFontFaceCSS(f))
        .join('\n');
  }, [fonts]);

  const handlePdfExport = async () => {
    if (!exportRef.current) return;
    setIsExportingPdf(true);

    try {
        // 1. Capture the DOM element with WHITE background enforcement
        // IMPORTANT: We use windowWidth to ensure we capture wide layouts, but windowHeight is null to capture full scroll height
        const canvas = await html2canvas(exportRef.current, {
            scale: 2, // Good balance between quality and file size
            useCORS: true,
            backgroundColor: '#ffffff', // FORCE WHITE BACKGROUND
            logging: false,
            // Ensure we capture everything
            windowWidth: exportRef.current.scrollWidth + 50,
            height: null, // Auto height
            onclone: (clonedDoc) => {
                const element = clonedDoc.querySelector('[data-export-target="true"]') as HTMLElement;
                if (element) {
                    // --- FORCE LIGHT MODE STYLES FOR EXPORT ---
                    element.style.backgroundColor = '#ffffff';
                    element.style.color = '#000000';
                    element.style.height = 'auto'; // FORCE FULL HEIGHT
                    element.style.overflow = 'visible'; // SHOW ALL TEXT
                    element.style.maxHeight = 'none';

                    // --- OVERLAY MODE SPECIFIC FIXES ---
                    // Since Overlay mode uses absolute positioning, the parent height is 0. 
                    // We must calculate the content height to force the canvas to grow.
                    if (viewMode === 'overlay') {
                        const refTextP = element.querySelector('.overlay-reference-text p') as HTMLElement;
                        if (refTextP) {
                            // A safer bet in clones is to set the parent height to the scrollHeight of the text content
                            element.style.height = `${refTextP.scrollHeight + 200}px`;
                        }
                    }

                    // For both modes: Expand the grid and inner containers
                    element.classList.remove('h-full');
                    element.style.height = 'auto';
                    const children = element.querySelectorAll('.overflow-y-auto');
                    children.forEach((child) => {
                        (child as HTMLElement).style.overflow = 'visible';
                        (child as HTMLElement).style.height = 'auto';
                        (child as HTMLElement).style.maxHeight = 'none';
                    });
                    
                    // Specific Handling for Side-by-Side Text Colors
                    const textElements = element.querySelectorAll('p, h4, span, div');
                    textElements.forEach((el) => {
                         const style = window.getComputedStyle(el);
                         // If it's a grid overlay div (has background image), swap to Light Grid
                         if ((el as HTMLElement).style.backgroundImage && (el as HTMLElement).style.backgroundImage.includes('data:image/svg')) {
                             (el as HTMLElement).style.backgroundImage = gridLight;
                             return;
                         }

                         // If text is white/gray (light), force it to black/dark gray
                         const color = style.color;
                         if (color.startsWith('rgb(2') || color === 'white' || color.includes('255, 255') || color.includes('209, 213')) {
                             (el as HTMLElement).style.color = '#111827'; // gray-900
                         }
                    });

                    // Remove borders or make them light gray
                    const bordered = element.querySelectorAll('.border-gray-800, .border-gray-700, .bg-gray-900');
                    bordered.forEach(el => {
                        el.classList.remove('dark:bg-gray-900 bg-gray-100', 'dark:bg-gray-800 bg-gray-200', 'dark:bg-gray-950 bg-gray-50');
                        el.classList.add('bg-white');
                        (el as HTMLElement).style.borderColor = '#e5e7eb'; // gray-200
                        (el as HTMLElement).style.backgroundColor = '#ffffff';
                    });

                    // --- OVERLAY SPECIFIC STYLE ADJUSTMENTS ---
                    if (viewMode === 'overlay') {
                        const overlayTextElements = element.querySelectorAll('p');
                        overlayTextElements.forEach(p => {
                            if (p.closest('.overlay-reference-text')) {
                                // Reference as Solid Fill for PDF
                                p.style.color = 'rgba(0, 0, 0, 0.1)';
                                p.style.webkitTextStroke = 'none';
                            } else {
                                // Adjusted methods keep their colored outlines
                                // We don't want the general black text logic to kill their outlines
                                p.style.color = 'transparent';
                            }
                        });
                    }
                    
                    // Re-position Legend for Print (Bottom of the content, not fixed to screen)
                    const legend = element.querySelector('.overlay-legend') as HTMLElement;
                    if (legend) {
                        legend.style.position = 'absolute';
                        legend.style.bottom = '10px';
                        legend.style.right = '10px';
                        legend.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
                        legend.style.borderColor = '#e5e7eb';
                        legend.style.color = '#000';
                        legend.style.boxShadow = 'none';
                        // Fix legend text colors
                        legend.querySelectorAll('.text-gray-300').forEach(el => (el as HTMLElement).style.color = '#000');
                        legend.querySelectorAll('.text-gray-400').forEach(el => (el as HTMLElement).style.color = '#4b5563');
                    }
                    
                    // Hide export buttons in the clone
                    const ignoreBtns = clonedDoc.querySelectorAll('button');
                    ignoreBtns.forEach(btn => btn.style.display = 'none');
                }
            }
        });

        // 2. Initialize PDF (Landscape A4)
        const pdf = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: 'a4'
        });

        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 10;
        const headerHeight = 40;

        // 3. Detailed Header Info (White bg, Black text for PDF cleanliness)
        pdf.setFillColor(255, 255, 255); 
        pdf.rect(0, 0, pageWidth, headerHeight, 'F');

        pdf.setTextColor(0, 0, 0); // Black text
        pdf.setFontSize(14);
        pdf.setFont("helvetica", "bold");
        pdf.text("Relatório SAAME Typography Lab", margin, 10);
        
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(60, 60, 60); 
        const dateStr = new Date().toLocaleString();
        
        // Metadata Column 1
        pdf.text(`Data: ${dateStr}`, margin, 16);
        pdf.text(`Modo de Visualização: ${viewMode === 'side-by-side' ? 'Comparação Lado a Lado' : 'Sobreposição (Overlay)'}`, margin, 21);
        
        // Metadata Column 2 (Parameters)
        const col2X = margin + 80;
        pdf.text(`Tamanho da Fonte: ${fontSize}px`, col2X, 16);
        pdf.text(`Entrelinha: ${lineHeight}em`, col2X, 21);
        
        // Metadata Column 3 (Legend)
        const col3X = margin + 140;
        pdf.setFont("helvetica", "bold");
        pdf.text("LEGENDA:", col3X, 16);
        pdf.setFont("helvetica", "normal");
        
        if (viewMode === 'overlay') {
            // Reference (Original)
            pdf.setFillColor(150, 150, 150); // Grey box for ref
            pdf.rect(col3X, 18, 3, 3, 'F');
            pdf.text(`Original: ${labelOriginal.substring(0, 20)}`, col3X + 5, 21);
            
            if (isCompareMode) {
                // Compare Mode: Reference vs Experimental
                pdf.setDrawColor(6, 182, 212); // Cyan Stroke (Contrast)
                pdf.setLineWidth(0.5);
                pdf.rect(col3X, 23, 3, 3, 'S');
                pdf.text(`Experimental: ${labelTracy.substring(0, 20)}`, col3X + 5, 26);
            } else {
                // Lab Mode: Original (Grey), Tracy (Pink), Sousa (Cyan)
                
                // Tracy
                pdf.setDrawColor(236, 72, 153); // Pink Stroke
                pdf.setLineWidth(0.5);
                pdf.rect(col3X, 23, 3, 3, 'S');
                pdf.text(`Tracy: Método Walter Tracy`, col3X + 5, 26);
 
                // Sousa
                pdf.setDrawColor(6, 182, 212); // Cyan Stroke
                pdf.setLineWidth(0.5);
                pdf.rect(col3X, 28, 3, 3, 'S');
                pdf.text(`Sousa: Método Miguel Sousa`, col3X + 5, 31);
            }
 
        } else {
             // Side-by-Side
             if (isCompareMode) {
                 pdf.text(`Coluna 1: ${labelOriginal.substring(0, 20)}`, col3X, 21);
                 pdf.text(`Coluna 2: ${labelTracy.substring(0, 20)}`, col3X, 26);
             } else {
                 pdf.text(`Col 1: Original (${labelOriginal.substring(0, 15)})`, col3X, 21);
                 pdf.text(`Col 2: Original Custom`, col3X, 26);
                 pdf.text(`Col 3: Método Walter Tracy`, col3X, 31);
                 pdf.text(`Col 4: Método Miguel Sousa`, col3X, 36);
             }
        }

        // 4. Add Image with Multi-Page Logic
        const imgData = canvas.toDataURL('image/png');
        const imgProps = pdf.getImageProperties(imgData);
        
        const availableWidth = pageWidth - (margin * 2);
        // Calculate the height the full image would take on the PDF
        const fullImgHeightOnPdf = (imgProps.height * availableWidth) / imgProps.width;
        
        let heightLeft = fullImgHeightOnPdf;
        let position = headerHeight; // Start after header
        let pageImgY = 0; // Where in the source image we are slicing from (conceptually)

        // First Page
        // If image fits on one page (minus header and footer margin)
        if (fullImgHeightOnPdf <= (pageHeight - headerHeight - margin)) {
             pdf.addImage(imgData, 'PNG', margin, position, availableWidth, fullImgHeightOnPdf);
        } else {
             // Multi-page loop
             // We add the image, but shifted up for subsequent pages
             // Note: jsPDF addImage supports simple placement. For splitting a long canvas cleanly across pages without slicing manually, 
             // the standard trick is to add the same image with a negative Y offset on subsequent pages, masked by the page boundaries.
             
             let yOffset = headerHeight;
             
             while (heightLeft > 0) {
                 pdf.addImage(imgData, 'PNG', margin, yOffset, availableWidth, fullImgHeightOnPdf);
                 
                 heightLeft -= (pageHeight - (yOffset === headerHeight ? headerHeight : margin) - margin); // Subtract visible area
                 yOffset -= (pageHeight - margin * 2); // Shift up for next page
                 
                 if (heightLeft > 0) {
                     pdf.addPage();
                     // No header on subsequent pages, just top margin
                     yOffset = margin - (fullImgHeightOnPdf - heightLeft); 
                     // Actually, a simpler approach for the offset in the loop:
                     // Just use the standard negative offset technique.
                 }
             }
        }
        
        // Save
        pdf.save(`SAAME_Analysis_${viewMode}_${Date.now()}.pdf`);

    } catch (error) {
        console.error("PDF Generation failed:", error);
        alert("Failed to generate PDF. Check console for details.");
    } finally {
        setIsExportingPdf(false);
    }
  };

  const ComparativeMetricsView = React.memo(({ category }: { category: 'Uppercase' | 'Lowercase' }) => {
      const allChars = category === 'Uppercase' ? "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split('') : "abcdefghijklmnopqrstuvwxyz".split('');
      
      const chars = useMemo(() => {
          if (!searchQuery) return allChars;
          return allChars.filter(c => c.toLowerCase().includes(searchQuery.toLowerCase()));
      }, [allChars, searchQuery]);

      if (!originalFont?.fontObj || !tracyFont?.fontObj) return null;
      if (chars.length === 0) return null;

      return (
          <div className="mb-8">
              <h4 className="text-base font-bold uppercase mb-4 tracking-wider dark:text-gray-400 text-gray-600 border-b dark:border-gray-800 border-gray-200 pb-2">
                  {category === 'Uppercase' ? 'Maiúsculas' : 'Minúsculas'} - Comparação
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                  {chars.map(char => {
                      const m1 = getCharMetrics(originalFont.fontObj!, char);
                      const m2 = getCharMetrics(tracyFont.fontObj!, char);
                      
                      const diffL = m2.lsb - m1.lsb;
                      const diffR = m2.rsb - m1.rsb;
                      
                      const hasChange = diffL !== 0 || diffR !== 0;

                      return (
                          <div key={char} className={`dark:bg-gray-800/40 bg-gray-200/40 rounded p-3 border ${hasChange ? 'border-cyan-500/30 bg-cyan-900/5' : 'dark:border-gray-700/50 border-gray-300/50'} flex flex-col gap-2 group dark:hover:bg-gray-800 hover:bg-gray-200 transition-colors`}>
                              {/* Header */}
                              <div className="flex justify-between items-end border-b dark:border-gray-700/50 border-gray-300/50 pb-2">
                                  <span className="text-4xl leading-none dark:text-white text-slate-900" style={{ fontFamily: tracyFont.fullFontFamily }}>{char}</span>
                                  <span className="text-xs text-gray-600 dark:text-gray-500 font-mono">{char.charCodeAt(0)}</span>
                              </div>

                              {/* LSB Block */}
                              <div className="flex justify-between items-center text-sm">
                                  <span className="dark:text-gray-500 text-gray-500 font-bold text-xs w-8">LSB</span>
                                  <div className="flex-1 flex justify-between items-center">
                                      <span className="dark:text-gray-500 text-gray-500 text-xs">{m1.lsb}</span>
                                      <span className="text-gray-600 dark:text-gray-500 text-xs">→</span>
                                      <span className={`font-mono font-medium ${diffL !== 0 ? 'text-cyan-400' : 'dark:text-gray-400 text-gray-600'}`}>
                                          {m2.lsb}
                                      </span>
                                  </div>
                              </div>

                              {/* RSB Block */}
                              <div className="flex justify-between items-center text-sm">
                                  <span className="dark:text-gray-500 text-gray-500 font-bold text-xs w-8">RSB</span>
                                  <div className="flex-1 flex justify-between items-center">
                                      <span className="dark:text-gray-500 text-gray-500 text-xs">{m1.rsb}</span>
                                      <span className="text-gray-600 dark:text-gray-500 text-xs">→</span>
                                      <span className={`font-mono font-medium ${diffR !== 0 ? 'text-cyan-400' : 'dark:text-gray-400 text-gray-600'}`}>
                                          {m2.rsb}
                                      </span>
                                  </div>
                              </div>
                          </div>
                      )
                  })}
              </div>
          </div>
      );
  });

  const ExtendedComparativeView = React.memo(() => {
        const [displayLimit, setDisplayLimit] = useState(60);

        // Reset limit on search change
        useEffect(() => {
            setDisplayLimit(60);
        }, [searchQuery]);

        if (!originalFont?.fontObj || !tracyFont?.fontObj) return null;

        const glyphs = useMemo(() => {
            const standardChars = new Set([
                ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(''),
                ..."abcdefghijklmnopqrstuvwxyz".split('')
            ]);
            
            const found: Array<{ char: string, unicode: number }> = [];
            const numGlyphs = tracyFont.fontObj.glyphs.length;
            
            for (let i = 0; i < numGlyphs; i++) {
                const glyph = tracyFont.fontObj.glyphs.get(i);
                if (glyph.unicode) {
                    try {
                        const char = String.fromCodePoint(glyph.unicode);
                        if (!standardChars.has(char)) {
                            if (char.trim() !== '' || char === ' ') {
                                found.push({ char, unicode: glyph.unicode });
                            }
                        }
                    } catch (e) {}
                }
            }
            
            // Filter by searchQuery
            const filtered = searchQuery 
                ? found.filter(g => 
                    g.char.toLowerCase().includes(searchQuery.toLowerCase()) || 
                    g.unicode.toString(16).toLowerCase().includes(searchQuery.toLowerCase())
                  )
                : found;

            return filtered.sort((a, b) => a.unicode - b.unicode);
        }, [tracyFont, searchQuery]);

        if (glyphs.length === 0) return null;

        const visibleGlyphs = glyphs.slice(0, displayLimit);

        return (
            <div className="mb-8 mt-12 pt-8 border-t dark:border-gray-800 border-gray-200">
                <h4 className="text-base font-bold uppercase mb-4 tracking-wider dark:text-gray-400 text-gray-600 border-b dark:border-gray-800 border-gray-200 pb-2">
                    Comparação de Glifos Complementares ({glyphs.length})
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                    {visibleGlyphs.map(g => {
                        const m1 = getCharMetrics(originalFont.fontObj!, g.char);
                        const m2 = getCharMetrics(tracyFont.fontObj!, g.char);
                        
                        const diffL = m2.lsb - m1.lsb;
                        const diffR = m2.rsb - m1.rsb;
                        const hasChange = diffL !== 0 || diffR !== 0;

                        return (
                            <div key={g.unicode} className={`dark:bg-gray-800/40 bg-gray-200/40 rounded p-3 border ${hasChange ? 'border-cyan-500/30 bg-cyan-900/5' : 'dark:border-gray-700/50 border-gray-300/50'} flex flex-col gap-2 group dark:hover:bg-gray-800 hover:bg-gray-200 transition-colors`}>
                                {/* Header */}
                                <div className="flex justify-between items-end border-b dark:border-gray-700/50 border-gray-300/50 pb-2">
                                    <span className="text-3xl leading-none dark:text-white text-slate-900 w-full text-center" style={{ fontFamily: tracyFont.fullFontFamily }}>
                                        {/* Visualize Space */}
                                        {g.char === ' ' ? <span className="text-sm dark:text-gray-500 text-gray-500 font-mono tracking-widest">[ESPAÇO]</span> : g.char}
                                    </span>
                                </div>
                                <div className="text-[11px] text-gray-600 dark:text-gray-500 font-mono text-center mb-1">{g.unicode} (U+{g.unicode.toString(16).toUpperCase()})</div>

                                {/* LSB Block */}
                                <div className="flex justify-between items-center text-sm">
                                    <span className="dark:text-gray-500 text-gray-500 font-bold text-xs w-6">L</span>
                                    <div className="flex-1 flex justify-between items-center pl-2">
                                        <span className="dark:text-gray-500 text-gray-500 text-xs">{m1.lsb}</span>
                                        <span className="text-gray-600 dark:text-gray-500 text-xs">→</span>
                                        <span className={`font-mono font-medium ${diffL !== 0 ? 'text-cyan-400' : 'dark:text-gray-400 text-gray-600'}`}>
                                            {m2.lsb}
                                        </span>
                                    </div>
                                </div>

                                {/* RSB Block */}
                                <div className="flex justify-between items-center text-sm">
                                    <span className="dark:text-gray-500 text-gray-500 font-bold text-xs w-6">R</span>
                                    <div className="flex-1 flex justify-between items-center pl-2">
                                        <span className="dark:text-gray-500 text-gray-500 text-xs">{m1.rsb}</span>
                                        <span className="text-gray-600 dark:text-gray-500 text-xs">→</span>
                                        <span className={`font-mono font-medium ${diffR !== 0 ? 'text-cyan-400' : 'dark:text-gray-400 text-gray-600'}`}>
                                            {m2.rsb}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
                {glyphs.length > displayLimit && (
                    <div className="mt-8 flex justify-center">
                        <button 
                            onClick={() => setDisplayLimit(prev => prev + 60)}
                            className="px-8 py-3 rounded-xl border dark:border-gray-700 border-gray-300 dark:text-gray-400 text-gray-600 text-sm font-bold uppercase hover:bg-gray-800 hover:text-white transition-all shadow-lg"
                        >
                            Ver mais {glyphs.length - displayLimit} glifos complementares
                        </button>
                    </div>
                )}
            </div>
        );
  });

  return (
    <div className="flex flex-col h-full dark:bg-gray-900 bg-gray-100 rounded-lg overflow-hidden border dark:border-gray-700 border-gray-300 shadow-xl">
       {/* Inject Local Styles to enforce precision within this canvas context */}
       <style>
            {fontFacesCSS}
       </style>

      {/* Toolbar */}
      <div className="dark:bg-gray-800 bg-gray-200 p-2 md:p-3 flex flex-col xl:flex-row gap-2 md:gap-4 border-b dark:border-gray-700 border-gray-300">
        <div className="flex flex-wrap items-center gap-2 md:gap-4 w-full xl:w-auto justify-between xl:justify-start">
            <div className="flex items-center gap-2 px-2 dark:bg-gray-700/50 bg-gray-300/50 rounded p-1 flex-1 sm:flex-none justify-center">
                <Type className="w-4 h-4 dark:text-gray-400 text-gray-600" />
                <input 
                    type="number" 
                    value={fontSize} 
                    onChange={(e) => setFontSize(Number(e.target.value))}
                    className="w-12 md:w-16 dark:bg-gray-700 bg-gray-300 border dark:border-gray-600 border-gray-400 rounded px-1 text-base text-center dark:text-white text-slate-900"
                />
                <span className="text-sm dark:text-gray-400 text-gray-600 hidden sm:inline">px</span>
            </div>
            
            {/* Line Height Control */}
            <div className="flex items-center gap-2 px-2 dark:bg-gray-700/50 bg-gray-300/50 rounded p-1 flex-1 sm:flex-none justify-center">
                <ArrowUpDown className="w-3 md:w-4 h-3 md:h-4 dark:text-gray-400 text-gray-600" />
                <input 
                    type="number"
                    step="0.1" 
                    min="0.8"
                    max="3.0"
                    value={lineHeight} 
                    onChange={(e) => setLineHeight(Number(e.target.value))}
                    className="w-12 md:w-16 dark:bg-gray-700 bg-gray-300 border dark:border-gray-600 border-gray-400 rounded px-1 text-base text-center dark:text-white text-slate-900"
                />
                <span className="text-xs dark:text-gray-400 text-gray-600 hidden sm:inline">em</span>
            </div>

            <div className="flex gap-1 dark:bg-gray-700/50 bg-gray-300/50 rounded p-1 shadow-inner">
                 <button 
                    onClick={() => setViewMode('side-by-side')}
                    className={`p-2 rounded-md transition-all ${viewMode === 'side-by-side' ? 'bg-indigo-600 text-white shadow-lg scale-105 z-10' : 'dark:text-gray-500 text-gray-500 opacity-60 hover:opacity-100 dark:hover:bg-gray-600 hover:bg-gray-400'}`}
                    title="Lado a Lado"
                 >
                    <Columns className="w-4 h-4" />
                 </button>
                 {!isCompareMode && (
                 <button 
                    onClick={() => setViewMode('stack')}
                    className={`p-2 rounded-md transition-all ${viewMode === 'stack' ? 'bg-indigo-600 text-white shadow-lg scale-105 z-10' : 'dark:text-gray-500 text-gray-500 opacity-60 hover:opacity-100 dark:hover:bg-gray-600 hover:bg-gray-400'}`}
                    title="Texto Corrido (Blocos)"
                 >
                    <AlignJustify className="w-4 h-4" />
                 </button>
                 )}
                 <button 
                    onClick={() => setViewMode('overlay')}
                    className={`p-2 rounded-md transition-all ${viewMode === 'overlay' ? 'bg-indigo-600 text-white shadow-lg scale-105 z-10' : 'dark:text-gray-500 text-gray-500 opacity-60 hover:opacity-100 dark:hover:bg-gray-600 hover:bg-gray-400'}`}
                    title="Visualização Overlay"
                 >
                    <Layers className="w-4 h-4" />
                 </button>
                 <button 
                    onClick={() => setViewMode('metrics')}
                    className={`p-2 rounded-md transition-all ${viewMode === 'metrics' ? 'bg-indigo-600 text-white shadow-lg scale-105 z-10' : 'dark:text-gray-500 text-gray-500 opacity-60 hover:opacity-100 dark:hover:bg-gray-600 hover:bg-gray-400'}`}
                    title="Dados de Métricas"
                 >
                    <BarChart2 className="w-4 h-4" />
                 </button>
            </div>

            {/* Method Selectors */}
            <div className="flex flex-wrap gap-1 dark:bg-gray-700/50 bg-gray-300/50 rounded p-1 ml-auto lg:ml-0 shadow-inner">
                <span className="text-[10px] font-black dark:text-gray-500 text-gray-500 uppercase px-2 flex items-center">Comparar:</span>
                {[
                    { type: MethodType.ORIGINAL, label: 'Orig' },
                    { type: MethodType.ORIGINAL_CUSTOM, label: 'Cust' },
                    { type: MethodType.TRACY, label: 'Tracy' },
                    { type: MethodType.SOUSA, label: 'Sousa' }
                ].map((m) => (
                    <button 
                        key={m.type}
                        onClick={() => toggleMethod(m.type)}
                        className={`px-3 py-1 text-xs font-black rounded-md transition-all ${activeMethods.includes(m.type) ? 'bg-indigo-600 text-white shadow-md scale-105 z-10' : 'dark:text-gray-500 text-gray-500 opacity-60 hover:opacity-100 dark:hover:bg-gray-600 hover:bg-gray-400'}`}
                    >
                        {m.label}
                    </button>
                ))}
            </div>

            {/* UPDATED: PDF Export Button for Side-by-Side and Overlay */}
            {(viewMode === 'overlay' || viewMode === 'side-by-side') && (
                <button
                    onClick={handlePdfExport}
                    disabled={isExportingPdf}
                    className="flex items-center gap-2 px-3 py-1.5 dark:bg-gray-700/50 bg-gray-300/50 dark:hover:bg-gray-600 hover:bg-gray-400 dark:text-white text-slate-900 rounded text-sm font-bold transition-colors border dark:border-gray-600 border-gray-400 flex-1 sm:flex-none justify-center"
                    title="Exportar PDF"
                >
                    {isExportingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4 text-red-400" />}
                    <span className="inline">PDF</span>
                </button>
            )}

        </div>

            <div className="flex-1 flex flex-col sm:flex-row gap-2">
            <textarea 
                value={testText} 
                onChange={(e) => {
                    setTestText(e.target.value);
                    setAnalysisPreset('custom');
                }}
                className="flex-[2] dark:bg-gray-700 bg-gray-300 border dark:border-gray-600 border-gray-400 rounded px-4 py-3 text-lg dark:text-gray-200 text-gray-800 font-sans min-w-0 resize-none h-24 sm:h-20 leading-tight"
                placeholder="Texto..."
            />
            <div className="flex sm:flex-col gap-1 justify-center">
                 <button 
                    onClick={() => setPreset(PARAGRAPH_TEXT, 18, 'paragraph')} 
                    className={`text-sm md:text-base px-4 md:px-6 py-2.5 md:py-3 rounded whitespace-nowrap w-full flex-1 sm:flex-none font-bold transition-all border ${
                        analysisPreset === 'paragraph' 
                        ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-900/20 scale-[1.02] opacity-100' 
                        : 'dark:bg-blue-900/10 bg-blue-100/50 dark:text-blue-400/60 text-blue-600/50 border-blue-800/20 opacity-60 hover:opacity-80'
                    }`}
                 >
                    Parágrafo
                 </button>
                 <button 
                    onClick={() => { 
                        setTestText("HHOOHOH\nnnoonon\nminimum\nOverwoman\ngroundling\nPalaeoclimatologist"); 
                        setFontSize(80); 
                        setViewMode('overlay'); 
                        setAnalysisPreset('words-overlay');
                    }} 
                    className={`text-sm md:text-base px-4 md:px-6 py-2.5 md:py-3 rounded whitespace-nowrap w-full flex-1 sm:flex-none font-bold transition-all border ${
                        analysisPreset === 'words-overlay' 
                        ? 'bg-purple-600 text-white border-purple-500 shadow-lg shadow-purple-900/20 scale-[1.02] opacity-100' 
                        : 'dark:bg-purple-900/10 bg-purple-100/50 dark:text-purple-400/60 text-purple-600/50 border-purple-800/20 opacity-60 hover:opacity-80'
                    }`}
                 >
                    Palavras Overlay
                 </button>
            </div>
        </div>
      </div>

      {/* Canvas Area */}
      <div className="flex-1 overflow-auto dark:bg-gray-950 bg-gray-50 relative">
        
        {viewMode === 'side-by-side' && (
             <div 
                ref={exportRef} 
                data-export-target="true"
                className={`grid ${
                    activeMethods.length === 1 ? 'grid-cols-1' : 
                    activeMethods.length === 2 ? 'grid-cols-1 md:grid-cols-2' : 
                    activeMethods.length === 3 ? 'grid-cols-1 md:grid-cols-3' : 
                    'grid-cols-1 md:grid-cols-4'
                } gap-0 h-full divide-y md:divide-y-0 md:divide-x divide-gray-800 dark:bg-gray-950 bg-gray-50 overflow-visible`}
             >
                {/* 1. Original */}
                {activeMethods.includes(MethodType.ORIGINAL) && (
                <div className="flex flex-col h-full dark:bg-gray-900/30 bg-gray-100/30 order-1 overflow-visible">
                     <div className="p-3 border-b dark:border-gray-800 border-gray-200 dark:bg-gray-900 bg-gray-100 flex justify-between items-center sticky top-0 z-10" data-html2canvas-ignore>
                         <h4 className="text-sm font-bold uppercase tracking-widest dark:text-gray-400 text-gray-600 truncate max-w-[200px]" title={labelOriginal}>
                            {labelOriginal}
                         </h4>
                         <button onClick={() => handleExport(MethodType.ORIGINAL)} className="text-base dark:hover:text-white hover:text-slate-900 flex gap-2.5 items-center dark:bg-gray-800 bg-gray-200 dark:hover:bg-gray-700 hover:bg-gray-300 px-4 py-2.5 rounded-md border dark:border-gray-700 border-gray-300 transition-colors dark:text-gray-300 text-gray-700 shadow-sm font-semibold" data-html2canvas-ignore><Download className="w-5 h-5"/> OTF</button>
                     </div>
                     <div className="p-6 md:p-8 flex-1 overflow-visible flex items-start justify-start">
                        <p style={{ fontFamily: originalFont?.fullFontFamily || 'serif', fontSize: `${fontSize}px`, lineHeight: lineHeight }} className="dark:text-gray-300 text-gray-700 whitespace-pre-wrap break-words text-left w-full h-auto">
                            {testText}
                        </p>
                     </div>
                </div>
                )}

                {/* 1.5 Original Custom */}
                {activeMethods.includes(MethodType.ORIGINAL_CUSTOM) && (
                    <div className="flex flex-col h-full order-2 overflow-visible">
                         <div className="p-3 border-b dark:border-gray-800 border-gray-200 dark:bg-gray-900 bg-gray-100 flex justify-between items-center sticky top-0 z-10" data-html2canvas-ignore>
                             <h4 className="text-sm font-bold uppercase tracking-widest dark:text-slate-400 text-slate-600">Original Custom</h4>
                             <button onClick={() => handleExport(MethodType.ORIGINAL_CUSTOM)} className="text-base dark:text-slate-400 text-slate-600 dark:hover:text-white hover:text-slate-900 flex gap-2.5 items-center dark:bg-gray-800 bg-gray-200 dark:hover:bg-gray-700 hover:bg-gray-300 px-4 py-2.5 rounded-md border dark:border-gray-700 border-gray-300 transition-colors shadow-sm font-semibold" data-html2canvas-ignore><Download className="w-5 h-5"/> OTF</button>
                         </div>
                         <div className="p-6 md:p-8 flex-1 overflow-visible flex items-start justify-start">
                            <p style={{ fontFamily: fonts[MethodType.ORIGINAL_CUSTOM]?.fullFontFamily || 'serif', fontSize: `${fontSize}px`, lineHeight: lineHeight }} className="dark:text-gray-200 text-gray-800 whitespace-pre-wrap break-words text-left w-full h-auto">
                                {testText}
                            </p>
                         </div>
                    </div>
                )}

                {/* 2. Adjusted / Tracy */}
                {activeMethods.includes(MethodType.TRACY) && (
                <div className={`flex flex-col h-full order-3 overflow-visible ${activeMethods.length === 1 ? 'dark:bg-gray-900/40 bg-gray-100/40' : ''}`}>
                     <div className="p-3 border-b dark:border-gray-800 border-gray-200 dark:bg-gray-900 bg-gray-100 flex justify-between items-center sticky top-0 z-10" data-html2canvas-ignore>
                         <h4 className={`text-sm font-bold uppercase tracking-widest ${isCompareMode ? 'text-cyan-400' : 'text-pink-400'} truncate max-w-[200px]`} title={labelTracy}>
                            {labelTracy}
                         </h4>
                         <button onClick={() => handleExport(MethodType.TRACY)} className={`text-base dark:hover:text-white hover:text-slate-900 flex gap-2.5 items-center dark:bg-gray-800 bg-gray-200 dark:hover:bg-gray-700 hover:bg-gray-300 px-4 py-2.5 rounded-md border dark:border-gray-700 border-gray-300 transition-colors shadow-sm font-semibold ${isCompareMode ? 'dark:text-cyan-300 text-cyan-700 dark:hover:text-cyan-100 hover:text-cyan-900' : 'dark:text-pink-300 text-pink-700 dark:hover:text-pink-100 hover:text-pink-900'}`} data-html2canvas-ignore><Download className="w-5 h-5"/> OTF</button>
                     </div>
                     <div className="p-6 md:p-8 flex-1 overflow-visible flex items-start justify-start">
                        <p style={{ fontFamily: tracyFont?.fullFontFamily || 'serif', fontSize: `${fontSize}px`, lineHeight: lineHeight }} className="dark:text-white text-slate-900 whitespace-pre-wrap break-words text-left w-full h-auto">
                            {testText}
                        </p>
                     </div>
                </div>
                )}

                {/* 3. Sousa */}
                {activeMethods.includes(MethodType.SOUSA) && (
                <div className="flex flex-col h-full order-4 overflow-visible">
                     <div className="p-3 border-b dark:border-gray-800 border-gray-200 dark:bg-gray-900 bg-gray-100 flex justify-between items-center sticky top-0 z-10" data-html2canvas-ignore>
                         <h4 className="text-sm font-bold uppercase tracking-widest text-cyan-400 truncate max-w-[200px]">Método Miguel Sousa</h4>
                         <button onClick={() => handleExport(MethodType.SOUSA)} className="text-base dark:text-cyan-400 text-cyan-600 dark:hover:text-white hover:text-slate-900 flex gap-2.5 items-center dark:bg-gray-800 bg-gray-200 dark:hover:bg-gray-700 hover:bg-gray-300 px-4 py-2.5 rounded-md border dark:border-gray-700 border-gray-300 transition-colors shadow-sm font-semibold" data-html2canvas-ignore><Download className="w-5 h-5"/> OTF</button>
                     </div>
                     <div className="p-6 md:p-8 flex-1 overflow-visible flex items-start justify-start">
                        <p style={{ fontFamily: sousaFont?.fullFontFamily || 'serif', fontSize: `${fontSize}px`, lineHeight: lineHeight }} className="dark:text-white text-slate-900 whitespace-pre-wrap break-words text-left w-full h-auto">
                            {testText}
                        </p>
                     </div>
                </div>
                )}
             </div>
        )}

        {viewMode === 'stack' && (
             <div className="flex flex-col divide-y divide-gray-800 max-w-5xl mx-auto p-4 md:p-12 gap-12 overflow-visible">
                {activeMethods.includes(MethodType.ORIGINAL) && (
                <div>
                     <h4 className="text-sm font-bold uppercase tracking-widest dark:text-gray-500 text-gray-500 mb-4">{labelOriginal}</h4>
                     <p style={{ fontFamily: originalFont?.fullFontFamily || 'serif', fontSize: `${fontSize}px`, lineHeight: lineHeight }} className="dark:text-gray-400 text-gray-600 whitespace-pre-wrap mb-4 text-left">
                        {testText}
                    </p>
                    <button onClick={() => handleExport(MethodType.ORIGINAL)} className="text-sm dark:text-gray-500 text-gray-500 dark:hover:text-white hover:text-slate-900 flex gap-2 items-center dark:bg-gray-800 bg-gray-200 px-3 py-1.5 rounded"><Download className="w-3 h-3"/> Download ORIGINAL</button>
                </div>
                )}
                
                {activeMethods.includes(MethodType.ORIGINAL_CUSTOM) && (
                <div className="pt-12">
                     <h4 className="text-sm font-bold uppercase tracking-widest dark:text-slate-500 text-slate-500 mb-4">Original Custom</h4>
                     <p style={{ fontFamily: fonts[MethodType.ORIGINAL_CUSTOM]?.fullFontFamily || 'serif', fontSize: `${fontSize}px`, lineHeight: lineHeight }} className="dark:text-slate-300 text-slate-700 whitespace-pre-wrap mb-4 text-left">
                        {testText}
                    </p>
                    <button onClick={() => handleExport(MethodType.ORIGINAL_CUSTOM)} className="text-sm dark:text-slate-500 text-slate-500 dark:hover:text-white hover:text-slate-900 flex gap-2 items-center dark:bg-gray-800 bg-gray-200 px-3 py-1.5 rounded"><Download className="w-3 h-3"/> Download ORIGINAL_CUSTOM</button>
                </div>
                )}
                
                {activeMethods.includes(MethodType.TRACY) && (
                <div className="pt-12">
                    <h4 className="text-sm font-bold uppercase tracking-widest text-pink-500 mb-4">{labelTracy}</h4>
                    <p style={{ fontFamily: tracyFont?.fullFontFamily || 'serif', fontSize: `${fontSize}px`, lineHeight: lineHeight }} className="dark:text-white text-slate-900 whitespace-pre-wrap mb-4 text-left">
                        {testText}
                    </p>
                    <button onClick={() => handleExport(MethodType.TRACY)} className="text-sm dark:text-pink-500 text-pink-600 dark:hover:text-white hover:text-slate-900 flex gap-2 items-center dark:bg-gray-800 bg-gray-200 px-3 py-1.5 rounded"><Download className="w-3 h-3"/> Download TRACY</button>
                </div>
                )}
                
                {activeMethods.includes(MethodType.SOUSA) && (
                <div className="pt-12">
                    <h4 className="text-sm font-bold uppercase tracking-widest text-cyan-500 mb-4">Método Miguel Sousa</h4>
                    <p style={{ fontFamily: sousaFont?.fullFontFamily || 'serif', fontSize: `${fontSize}px`, lineHeight: lineHeight }} className="dark:text-white text-slate-900 whitespace-pre-wrap mb-4 text-left">
                        {testText}
                    </p>
                    <button onClick={() => handleExport(MethodType.SOUSA)} className="text-sm dark:text-cyan-500 text-cyan-600 dark:hover:text-white hover:text-slate-900 flex gap-2 items-center dark:bg-gray-800 bg-gray-200 px-3 py-1.5 rounded"><Download className="w-3 h-3"/> Download SOUSA</button>
                </div>
                )}
             </div>
        )}

        {viewMode === 'overlay' && (
             <div 
                ref={exportRef} 
                data-export-target="true"
                className="h-full relative overflow-hidden flex flex-col items-center justify-center dark:bg-gray-950 bg-gray-50 p-8"
             >
                <div className="absolute top-4 left-4 flex gap-4" data-html2canvas-ignore>
                     <div className="flex items-center gap-2 px-3 py-1 dark:bg-gray-900 bg-gray-100 border dark:border-gray-800 border-gray-200 rounded">
                        <div className="w-3 h-3 bg-gray-500"></div>
                        <span className="text-xs dark:text-gray-400 text-gray-600 font-bold uppercase tracking-wider">{labelOriginal}</span>
                     </div>
                     <div className="flex items-center gap-2 px-3 py-1 dark:bg-gray-900 bg-gray-100 border dark:border-gray-800 border-gray-200 rounded">
                        <div className={`w-3 h-3 ${isCompareMode ? 'bg-cyan-500' : 'bg-pink-500'}`}></div>
                        <span className="text-xs dark:text-gray-400 text-gray-600 font-bold uppercase tracking-wider">{labelTracy}</span>
                     </div>
                     {!isCompareMode && (
                     <div className="flex items-center gap-2 px-3 py-1 dark:bg-gray-900 bg-gray-100 border dark:border-gray-800 border-gray-200 rounded">
                        <div className="w-3 h-3 bg-cyan-500"></div>
                        <span className="text-xs dark:text-gray-400 text-gray-600 font-bold uppercase tracking-wider">Sousa</span>
                     </div>
                     )}
                </div>

                {/* Legend Overlay */}
                <div className="overlay-legend absolute bottom-6 right-6 p-4 dark:bg-gray-900/60 bg-gray-100/60 backdrop-blur-md rounded-xl border dark:border-gray-800 border-gray-200 shadow-2xl flex flex-col gap-3 min-w-[180px] z-[50]" data-html2canvas-ignore>
                    <h5 className="text-[11px] font-black uppercase tracking-[0.2em] dark:text-gray-500 text-gray-500 border-b dark:border-gray-800 border-gray-200 pb-2 mb-1">Métricas em Tempo Real</h5>
                    <div className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-sm dark:bg-white/10 bg-black/10"></div>
                        <span className="text-xs dark:text-gray-300 text-gray-700 font-bold">Ref. Preenchida (Massa)</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className={`w-2.5 h-2.5 rounded-sm border ${isCompareMode ? 'border-cyan-400' : 'border-pink-500'}`}></div>
                        <span className="text-xs dark:text-gray-300 text-gray-700 font-bold">Ajuste Contorno (Tracy)</span>
                    </div>
                    {!isCompareMode && (
                    <div className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-sm border border-cyan-400"></div>
                        <span className="text-xs dark:text-gray-300 text-gray-700 font-bold">Miguel Sousa Path</span>
                    </div>
                    )}
                </div>

                <div 
                    className="relative w-full overflow-y-auto max-h-[85vh] scrollbar-hide px-4"
                    style={{ 
                        lineHeight: `${debouncedFontSize * debouncedLineHeight}px`,
                        backgroundImage: viewMode === 'overlay' ? 'none' : `var(--bg-grid-svg, ${grid})`,
                        backgroundSize: `100% ${debouncedFontSize * debouncedLineHeight}px`,
                        backgroundAttachment: 'local'
                    }}
                >
                    {/* 1. Reference (Original) */}
                    <div className="overlay-reference-text">
                        <p 
                            style={{ 
                                fontFamily: originalFont?.fullFontFamily || 'serif', 
                                fontSize: `${debouncedFontSize}px`,
                                color: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
                                WebkitTextStroke: 'none',
                                transition: 'all 0.3s ease'
                            }} 
                            className="whitespace-pre-wrap break-words text-center"
                        >
                            {testText}
                        </p>
                    </div>
                    
                    {/* 2. Experimental (Tracy) */}
                    <div className="absolute inset-0 pointer-events-none px-4">
                        <p 
                            style={{ 
                                fontFamily: tracyFont?.fullFontFamily || 'serif', 
                                fontSize: `${debouncedFontSize}px`,
                                color: 'transparent',
                                WebkitTextStroke: `1px ${isCompareMode ? (isDark ? '#06B6D4' : '#0891B2') : (isDark ? '#EC4899' : '#DB2777')}`,
                                transform: `translateY(${expCorrectionY}px)`,
                                transition: 'all 0.3s ease'
                            }} 
                            className="whitespace-pre-wrap break-words text-center"
                        >
                            {testText}
                        </p>
                    </div>

                    {/* 3. Experimental (Sousa) - Hidden in Compare */}
                    {!isCompareMode && (
                    <div className="absolute inset-0 pointer-events-none px-4">
                        <p 
                            style={{ 
                                fontFamily: sousaFont?.fullFontFamily || 'serif', 
                                fontSize: `${debouncedFontSize}px`,
                                color: 'transparent',
                                WebkitTextStroke: `1px ${isDark ? '#06B6D4' : '#0891B2'}`,
                                transform: `translateY(${expCorrectionY}px)`,
                                transition: 'all 0.3s ease'
                            }} 
                            className="whitespace-pre-wrap break-words text-center"
                        >
                            {testText}
                        </p>
                    </div>
                    )}
                </div>
             </div>
        )}

        {viewMode === 'metrics' && (
             <div className="p-4 md:p-8 max-w-7xl mx-auto">
                 <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                    <div className="flex flex-col gap-1">
                        <h3 className="text-2xl font-bold flex gap-2 items-center dark:text-white text-slate-900">
                            <BarChart2 className="text-blue-400" /> Diagrama de Espaçamentos
                        </h3>
                        <p className="text-xs dark:text-slate-500 text-slate-500 uppercase font-black tracking-widest pl-7">Análise Técnica e Sistematização</p>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
                        {/* Method Selector Tabs */}
                        {!isCompareMode && (
                        <div className="flex dark:bg-slate-950 bg-slate-50 p-1 rounded-xl border dark:border-slate-800 border-slate-200 w-full sm:w-auto">
                            {(['ORIGINAL', 'ORIGINAL_CUSTOM', 'TRACY', 'SOUSA'] as MethodType[]).map((m) => (
                                <button
                                    key={m}
                                    onClick={() => setSelectedDiagramMethod(m)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                                        selectedDiagramMethod === m 
                                            ? 'dark:bg-slate-800 bg-slate-200 dark:text-white text-slate-900 shadow-sm' 
                                            : 'dark:text-slate-500 text-slate-500 dark:hover:text-slate-300 hover:text-slate-700'
                                    }`}
                                >
                                    {m === 'ORIGINAL' ? 'Original' : m === 'ORIGINAL_CUSTOM' ? 'Customizada' : m === 'TRACY' ? 'Tracy' : 'Sousa'}
                                </button>
                            ))}
                        </div>
                        )}

                        <div className="relative w-full md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 dark:text-gray-500 text-gray-500" />
                            <input 
                                type="text"
                                placeholder="Pesquisar glifo..."
                                value={searchQuery}
                                onChange={handleSearchChange}
                                className="w-full dark:bg-gray-800 bg-gray-200 border dark:border-gray-700 border-gray-300 rounded-lg pl-10 pr-4 py-2 text-base dark:text-white text-slate-900 focus:border-blue-500 outline-none transition-all"
                            />
                            {searchQuery && (
                                <button 
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 dark:hover:bg-gray-700 hover:bg-gray-300 rounded"
                                >
                                    <X className="w-3 h-3 dark:text-gray-400 text-gray-600" />
                                </button>
                            )}
                        </div>
                    </div>
                 </div>
                 
                 {isCompareMode ? (
                     <>
                        {/* Comparative Stats Summary */}
                        <div className="space-y-8 dark:bg-gray-800/50 bg-gray-200/50 p-6 rounded-xl border dark:border-gray-700 border-gray-300 mb-8">
                             <div className="flex flex-col md:flex-row gap-8 justify-between">
                                 <div className="flex-1">
                                     <h4 className="font-bold dark:text-gray-300 text-gray-700 mb-4">{labelOriginal}</h4>
                                     <div className="flex justify-between text-base mb-2 dark:text-gray-400 text-gray-600">
                                         <span>Global Average Spacing</span>
                                         <span>{getAvgSB(MethodType.ORIGINAL)} units</span>
                                     </div>
                                 </div>
                                 <div className="w-px dark:bg-gray-700 bg-gray-300 hidden md:block"></div>
                                 <div className="flex-1">
                                     <h4 className="font-bold text-cyan-400 mb-4">{labelTracy}</h4>
                                     <div className="flex justify-between text-base mb-2 text-cyan-300">
                                         <span>Global Average Spacing</span>
                                         <span>{getAvgSB(MethodType.TRACY)} units</span>
                                     </div>
                                 </div>
                             </div>
                        </div>
                        
                        {/* Detailed Character Cards */}
                        <ComparativeMetricsView category="Lowercase" />
                        <ComparativeMetricsView category="Uppercase" />
                        
                        {/* NEW: Full Extended Character Set Comparison */}
                        <ExtendedComparativeView />
                     </>
                 ) : (
                      <div className="space-y-12">
                          <div className="dark:bg-slate-900/40 bg-slate-100/40 p-2 md:p-8 rounded-[2rem] border dark:border-slate-800/50 border-slate-200/50">
                              <div className="flex flex-col gap-8">
                                  {/* Selection Content Dynamic Rendering */}
                                  {(selectedDiagramMethod === MethodType.ORIGINAL || 
                                     selectedDiagramMethod === MethodType.ORIGINAL_CUSTOM || 
                                     selectedDiagramMethod === MethodType.TRACY) && (
                                       <div className="space-y-8">
                                          <SpacingDiagram 
                                              font={fonts[selectedDiagramMethod]} 
                                              method={selectedDiagramMethod as MethodType} 
                                              category="Lowercase" 
                                              searchQuery={searchQuery}
                                              onGlyphClick={selectedDiagramMethod !== MethodType.ORIGINAL ? (char, lsb, rsb) => toggleAdjustment(char, lsb, rsb, selectedDiagramMethod as MethodType) : undefined}
                                          />
                                          <SpacingDiagram 
                                              font={fonts[selectedDiagramMethod]} 
                                              method={selectedDiagramMethod as MethodType} 
                                              category="Uppercase" 
                                              searchQuery={searchQuery}
                                              onGlyphClick={selectedDiagramMethod !== MethodType.ORIGINAL ? (char, lsb, rsb) => toggleAdjustment(char, lsb, rsb, selectedDiagramMethod as MethodType) : undefined}
                                          />
                                          <RemainingGlyphsView 
                                              font={fonts[selectedDiagramMethod]} 
                                              method={selectedDiagramMethod as MethodType} 
                                              searchQuery={searchQuery}
                                              onGlyphClick={selectedDiagramMethod !== MethodType.ORIGINAL ? (char, lsb, rsb) => toggleAdjustment(char, lsb, rsb, selectedDiagramMethod as MethodType) : undefined}
                                          />
                                      </div>
                                  )}

                                  {selectedDiagramMethod === MethodType.SOUSA && (
                                      <div className="space-y-8">
                                          <SousaAnalysisView 
                                              font={sousaFont} 
                                              category="Lowercase" 
                                              searchQuery={searchQuery}
                                              setSearchQuery={setSearchQuery}
                                              onGlyphClick={(char, lsb, rsb) => toggleAdjustment(char, lsb, rsb, MethodType.SOUSA)}
                                          />
                                          <SousaAnalysisView 
                                              font={sousaFont} 
                                              category="Uppercase" 
                                              searchQuery={searchQuery}
                                              setSearchQuery={setSearchQuery}
                                              onGlyphClick={(char, lsb, rsb) => toggleAdjustment(char, lsb, rsb, MethodType.SOUSA)}
                                          />
                                          <RemainingGlyphsView 
                                              font={sousaFont} 
                                              method={MethodType.SOUSA} 
                                              searchQuery={searchQuery}
                                              onGlyphClick={(char, lsb, rsb) => toggleAdjustment(char, lsb, rsb, MethodType.SOUSA)}
                                          />
                                      </div>
                                  )}
                              </div>
                          </div>
                      </div>
                 )}
             </div>
        )}

        {/* Individual Adjustment Modal */}
        <AnimatePresence>
            {selectedAdjustment && (
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[110] dark:bg-slate-950/90 bg-slate-50/90 backdrop-blur-md flex items-center justify-center p-4 lg:p-8"
                >
                    <motion.div 
                        initial={{ scale: 0.95, y: 30, opacity: 0 }}
                        animate={{ scale: 1, y: 0, opacity: 1 }}
                        exit={{ scale: 0.95, y: 30, opacity: 0 }}
                        className="dark:bg-slate-900 bg-slate-100 border dark:border-slate-800 border-slate-200 rounded-[2.5rem] w-full max-w-6xl overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.6)] flex flex-col h-[95vh] md:h-auto md:max-h-[90vh]"
                    >
                        {/* Header Modal */}
                        <div className="flex justify-between items-start mb-4 shrink-0 p-6 px-10">
                            <div>
                               <h2 className="text-2xl font-black dark:text-white text-slate-900 uppercase tracking-tighter">AJUSTE FINO DE GLIFO</h2>
                               <div className="mt-1 flex items-center gap-3 text-sm dark:text-slate-400 text-slate-600 font-bold uppercase tracking-widest">
                                    SELETOR DE GLIFO: 
                                    <div className="px-3 py-1 rounded-full border dark:border-blue-500/30 border-blue-500/30 bg-white dark:bg-slate-900 text-blue-500 flex items-center justify-center min-w-[32px] shadow-sm">
                                        {selectedAdjustment.char}
                                    </div>
                               </div>
                            </div>
                            <div className="flex items-center gap-2">
                               <div className="hidden sm:flex items-center gap-2 bg-white dark:bg-slate-900 border dark:border-slate-800 border-slate-200 px-3 py-1.5 rounded-full shadow-sm">
                                   <span className="text-[11px] uppercase font-black dark:text-slate-500 text-slate-600">STATUS</span>
                                   <span className="text-[11px] uppercase font-black px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-600 dark:text-blue-400">INDIVIDUAL</span>
                               </div>
                                <button onClick={() => setSelectedAdjustment(null)} className="p-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 rounded-lg transition-all shadow-sm">
                                    <X className="w-4 h-4 dark:text-slate-400 text-slate-600" />
                                </button>
                                <button onClick={() => setSelectedAdjustment(null)} className="ml-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all shadow-sm text-sm font-bold uppercase">
                                    CONFIRMAR
                                </button>
                             </div>
                        </div>

                        {/* Body Modal */}
                        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-4 flex-1 min-h-0 p-4 lg:p-10">
                            {/* Left Col: Preview + Sliders */}
                            <div className="flex flex-col gap-4 overflow-y-auto custom-scrollbar p-1">
                                <div className="bg-white dark:bg-slate-950 border border-slate-150 dark:border-slate-800 shadow-md rounded-2xl p-4 flex flex-col justify-center min-h-[110px]">
                                    {isModalEditing ? (
                                        <div className="flex flex-col items-center justify-center w-full py-2" onClick={(e) => e.stopPropagation()}>
                                            <input 
                                                type="text"
                                                value={modalTestText}
                                                onChange={(e) => setModalTestText(e.target.value)}
                                                onKeyDown={(e) => { if (e.key === 'Enter') setIsModalEditing(false); }}
                                                onBlur={() => setIsModalEditing(false)}
                                                autoFocus
                                                className="text-center bg-transparent border-none outline-none font-mono text-base text-slate-800 dark:text-slate-200 border-b border-dashed border-pink-500/50 py-1 w-full max-w-xs focus:ring-0"
                                            />
                                            <p className="text-[10px] text-pink-500 mt-2 font-mono uppercase tracking-widest font-black animate-pulse">Enter para salvar</p>
                                        </div>
                                    ) : (
                                        <div 
                                            className="text-center py-2 cursor-pointer transition-all hover:bg-slate-50 dark:hover:bg-slate-900/30 rounded-xl relative group/preview min-h-[44px] flex flex-col justify-center items-center"
                                            onClick={() => setIsModalEditing(true)}
                                            title="Clique para editar sequência"
                                        >
                                            <div className="text-3xl font-mono text-slate-800 dark:text-slate-200">
                                                {modalTestText}
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
                                         <label className="text-xs font-black dark:text-slate-400 text-slate-600 uppercase tracking-widest">SIDE BEARING ESQUERDO</label>
                                         <span className="px-3 py-1 bg-white dark:bg-slate-800 border dark:border-slate-700 border-slate-200 rounded-lg text-blue-500 font-bold text-sm shadow-sm">{selectedAdjustment.lsb}</span>
                                     </div>
                                     <input 
                                         type="range" min="-500" max="1500" value={selectedAdjustment.lsb}
                                         onChange={(e) => {
                                             const val = Number(e.target.value);
                                             setSelectedAdjustment({ ...selectedAdjustment, lsb: val });
                                             onUpdateGlyph?.(selectedAdjustment.method, selectedAdjustment.char, val, null);
                                         }}
                                         className="w-full accent-blue-500 h-1.5 dark:bg-slate-700 bg-slate-200 rounded-lg appearance-none cursor-pointer outline-none"
                                     />
                                </div>
    
                                {/* RSB Slider */}
                                <div className="dark:bg-slate-900/50 bg-slate-50 p-4 rounded-2xl border dark:border-slate-800 border-slate-200 shadow-inner">
                                     <div className="flex justify-between items-center mb-3">
                                         <label className="text-xs font-black dark:text-slate-400 text-slate-600 uppercase tracking-widest">SIDE BEARING DIREITO</label>
                                         <span className="px-3 py-1 bg-white dark:bg-slate-800 border dark:border-slate-700 border-slate-200 rounded-lg text-emerald-500 font-bold text-sm shadow-sm">{selectedAdjustment.rsb}</span>
                                     </div>
                                     <input 
                                         type="range" min="-500" max="1500" value={selectedAdjustment.rsb}
                                         onChange={(e) => {
                                             const val = Number(e.target.value);
                                             setSelectedAdjustment({ ...selectedAdjustment, rsb: val });
                                             onUpdateGlyph?.(selectedAdjustment.method, selectedAdjustment.char, null, val);
                                         }}
                                         className="w-full accent-emerald-500 h-1.5 dark:bg-slate-700 bg-emerald-200 rounded-lg appearance-none cursor-pointer outline-none"
                                     />
                                </div>
                            </div>
                            
                            {/* Right Col: Visualizer */}
                            <div className="flex flex-col min-h-0">
                                <h3 className="text-xs font-black dark:text-slate-400 text-slate-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                                    <Layers className="w-3.5 h-3.5" /> ANÁLISE GEOMÉTRICA
                                </h3>
                                <div className="flex-1 dark:bg-slate-900 bg-white rounded-3xl border dark:border-slate-800 border-slate-200 overflow-hidden min-h-[250px] shadow-sm flex flex-col p-4">
                                    <div className="flex-1 border dark:border-slate-800 border-slate-100 rounded-2xl overflow-hidden shadow-inner">
                                        <SequenceVisualizer 
                                            text={modalTestText}
                                            font={fonts[selectedAdjustment.method]} 
                                            method={selectedAdjustment.method}
                                            targetChar={selectedAdjustment.char}
                                            lsb={selectedAdjustment.lsb} 
                                            rsb={selectedAdjustment.rsb} 
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
      </div>
    </div>
  );
};
