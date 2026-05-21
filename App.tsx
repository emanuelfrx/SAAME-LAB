
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  AppStep, 
  FontState, 
  MethodType, 
  DEFAULT_TRACY_SETTINGS, 
  TracySettings,
  DEFAULT_SOUSA_SETTINGS,
  SousaSettings,
  OriginalCustomSettings,
  DEFAULT_ORIGINAL_CUSTOM_SETTINGS
} from './types';
import { 
  createFontState, 
  cleanMetrics, 
  applyTracyMethod, 
  applySousaMethod, 
  applyOriginalCustomMethod,
  createFontUrl, 
  parseFont,
  prepareFontForExport,
  calculateHarmonicSpacing,
  getCharMetrics,
  MetricsCache
} from './services/fontService';
import { FileUpload } from './components/FileUpload';
import { MetricTuner } from './components/MetricTuner';
import { SousaTuner } from './components/SousaTuner';
import { OriginalTuner } from './components/OriginalTuner';
import { OriginalCustomTuner } from './components/OriginalCustomTuner';
import { TheoreticalTooltip } from './components/TheoreticalTooltip';
import { AnalysisCanvas } from './components/AnalysisCanvas';
import { MethodVisualizer } from './components/MethodVisualizer';
// Added 'Home' to the imports from lucide-react
import { ArrowRight, Activity, Type, MousePointerClick, RefreshCcw, Loader2, PlayCircle, Columns, Home, CheckCircle2, HelpCircle, X, Target, Zap, Layout, Settings2, Layers } from 'lucide-react';
import { CompareSpacingFlow } from './CompareSpacingFlow';

const App: React.FC = () => {
  // Novo estado de navegação de alto nível para suportar o novo modo sem quebrar o antigo
  const [appMode, setAppMode] = useState<'START' | 'LAB' | 'COMPARE_SPACING'>('START');

  const [step, setStep] = useState<AppStep>(AppStep.UPLOAD);
  const [isProcessing, setIsProcessing] = useState(false);
  const [liveUpdateStatus, setLiveUpdateStatus] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState({ progress: 0, status: 'Iniciando...', title: 'Iniciando' });
  const [fontBuffer, setFontBuffer] = useState<ArrayBuffer | null>(null);
  const [fontName, setFontName] = useState<string>('');
  
  // Shared worker for background commits (Shadow Metrics)
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    // Initialize shared worker
    const worker = new Worker(new URL('./services/fontWorker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;

    worker.onmessage = async (e) => {
        if (e.data.action === 'APPLY_METHOD_SUCCESS') {
            const { buffer, familyName, method } = e.data;
            const fontObj = await parseFont(buffer);
            const blob = new Blob([buffer], { type: 'font/opentype' });
            const url = URL.createObjectURL(blob);

            setFonts(prev => {
                const methodKey = method === 'TRACY' ? MethodType.TRACY : 
                                 method === 'SOUSA' ? MethodType.SOUSA : 
                                 MethodType.ORIGINAL_CUSTOM;
                
                // Revoke old URL if it was a live update
                if (prev[methodKey]?.url && prev[methodKey]?.fullFontFamily.includes('Live')) {
                    URL.revokeObjectURL(prev[methodKey]!.url);
                }

                return {
                    ...prev,
                    [methodKey]: {
                        ...prev[methodKey]!,
                        fontObj,
                        url,
                        fullFontFamily: familyName
                    }
                };
            });
            setLiveUpdateStatus(null);
        } else if (e.data.action === 'ERROR') {
            console.error("Worker error:", e.data.error);
            setLiveUpdateStatus(null);
        }
    };

    return () => {
        worker.terminate();
    };
  }, []);

  // Font States
  const [fonts, setFonts] = useState<Record<string, FontState | null>>({
    [MethodType.ORIGINAL]: null,
    [MethodType.ORIGINAL_CUSTOM]: null,
    [MethodType.TRACY]: null,
    [MethodType.SOUSA]: null,
  });

  const [tracySettings, setTracySettings] = useState<TracySettings>(DEFAULT_TRACY_SETTINGS);
  const [sousaSettings, setSousaSettings] = useState<SousaSettings>(DEFAULT_SOUSA_SETTINGS);
  const [originalCustomSettings, setOriginalCustomSettings] = useState<OriginalCustomSettings>(DEFAULT_ORIGINAL_CUSTOM_SETTINGS);
  const [tuningTab, setTuningTab] = useState<'TRACY' | 'SOUSA' | 'ORIGINAL' | 'ORIGINAL_CUSTOM'>('ORIGINAL');
  const [prepMobileView, setPrepMobileView] = useState<'TUNER' | 'TUTORIAL'>('TUNER');
  const [showHelp, setShowHelp] = useState(false);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);

  // Responsive state listener
  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Load CSS for fonts
  useEffect(() => {
    // Inject @font-face rules dynamically
    const styleId = 'saame-font-faces';
    let styleTag = document.getElementById(styleId);
    if (!styleTag) {
      styleTag = document.createElement('style');
      styleTag.id = styleId;
      document.head.appendChild(styleTag);
    }

    let css = '';
    // Use the dynamic fullFontFamily name for accurate rendering updates
    if (fonts[MethodType.ORIGINAL]) css += `@font-face { font-family: '${fonts[MethodType.ORIGINAL]!.fullFontFamily}'; src: url('${fonts[MethodType.ORIGINAL]!.url}'); }\n`;
    if (fonts[MethodType.ORIGINAL_CUSTOM]) css += `@font-face { font-family: '${fonts[MethodType.ORIGINAL_CUSTOM]!.fullFontFamily}'; src: url('${fonts[MethodType.ORIGINAL_CUSTOM]!.url}'); }\n`;
    if (fonts[MethodType.TRACY]) css += `@font-face { font-family: '${fonts[MethodType.TRACY]!.fullFontFamily}'; src: url('${fonts[MethodType.TRACY]!.url}'); }\n`;
    if (fonts[MethodType.SOUSA]) css += `@font-face { font-family: '${fonts[MethodType.SOUSA]!.fullFontFamily}'; src: url('${fonts[MethodType.SOUSA]!.url}'); }\n`;
    
    styleTag.textContent = css;
  }, [fonts]);

  const handleFileLoaded = async (buffer: ArrayBuffer, name: string) => {
    setIsProcessing(true);
    setProcessingStatus({ progress: 0, status: 'Iniciando importação...', title: 'Importando Fonte' });
    setFontBuffer(buffer);
    setFontName(name);

    if (workerRef.current) {
        workerRef.current.postMessage({
            action: 'INITIAL_PARSE',
            buffer: buffer.slice(0)
        });
    }

    try {
        // 1. Store Original immediately (minimal processing)
        const originalState = await createFontState(buffer.slice(0), MethodType.ORIGINAL);
        // Parse separately to get a distinct Font object instance
        const originalCustomState = await createFontState(buffer.slice(0), MethodType.ORIGINAL_CUSTOM);
        
        let initialTracy = tracySettings;
        let initialSousa = sousaSettings;

        // Auto-calculate base harmonic spacing
        if (originalState.fontObj) {
            const fontObj = originalState.fontObj;
            const harmonicH = calculateHarmonicSpacing(fontObj, 'H');
            const harmonicO = calculateHarmonicSpacing(fontObj, 'O');
            const harmonicN = calculateHarmonicSpacing(fontObj, 'n');
            const harmonicOo = calculateHarmonicSpacing(fontObj, 'o');
            
            initialTracy = {
                ...tracySettings,
                H: { lsb: harmonicH, rsb: harmonicH },
                O: { lsb: harmonicO, rsb: harmonicO },
                n: { lsb: harmonicN, rsb: Math.round(harmonicN * 0.9) },
                o: { lsb: harmonicOo, rsb: harmonicOo },
            };
            
            initialSousa = {
                ...sousaSettings,
                H: { lsb: harmonicH, rsb: harmonicH },
                O: { lsb: harmonicO, rsb: harmonicO },
                n: { lsb: harmonicN, rsb: Math.round(harmonicN * 0.9) },
                o: { lsb: harmonicOo, rsb: harmonicOo },
            };
            
            setTracySettings(initialTracy);
            setSousaSettings(initialSousa);
        }

        // 2. Offload complex processing to Worker
        const worker = new Worker(new URL('./services/fontWorker.ts', import.meta.url), { type: 'module' });
        
        worker.postMessage({
            action: 'PROCESS_ALL',
            buffer: buffer.slice(0),
            tracySettings: initialTracy,
            sousaSettings: initialSousa,
            context: 'IMPORT'
        });

        worker.onmessage = async (e) => {
            if (e.data.action === 'PROGRESS') {
                setProcessingStatus(prev => ({ ...prev, progress: e.data.progress, status: e.data.status }));
            } else if (e.data.action === 'PROCESS_SUCCESS') {
                const { metrics, tracy, sousa } = e.data;
                
                // Populate MetricsCache with pre-calculated counter metrics from worker
                if (metrics.counterMap) {
                    Object.entries(metrics.counterMap).forEach(([char, val]) => {
                        MetricsCache.set(tracy.family, char, 'counter_metrics', val);
                        MetricsCache.set(sousa.family, char, 'counter_metrics', val);
                        if (originalState?.fullFontFamily) {
                            MetricsCache.set(originalState.fullFontFamily, char, 'counter_metrics', val);
                        }
                    });
                }
                
                // Convert buffers back to URLs
                const tracyBlob = new Blob([tracy.buffer], { type: 'font/opentype' });
                const sousaBlob = new Blob([sousa.buffer], { type: 'font/opentype' });
                
                const tracyFont = await parseFont(tracy.buffer);
                const sousaFont = await parseFont(sousa.buffer);

                const tracyState: FontState = {
                    type: MethodType.TRACY,
                    fontObj: tracyFont,
                    url: URL.createObjectURL(tracyBlob),
                    fullFontFamily: tracy.family,
                    metrics: metrics
                };

                const sousaState: FontState = {
                    type: MethodType.SOUSA,
                    fontObj: sousaFont,
                    url: URL.createObjectURL(sousaBlob),
                    fullFontFamily: sousa.family,
                    metrics: metrics
                };

                setFonts({
                    [MethodType.ORIGINAL]: originalState,
                    [MethodType.ORIGINAL_CUSTOM]: originalCustomState,
                    [MethodType.TRACY]: tracyState,
                    [MethodType.SOUSA]: sousaState
                });

                setTuningTab('ORIGINAL');
                setStep(AppStep.PREPARATION);
                setShowHelp(true);
                setIsProcessing(false);
                worker.terminate();
            } else if (e.data.action === 'ERROR') {
                console.error("Worker error:", e.data.error);
                setIsProcessing(false);
                worker.terminate();
            }
        };

        worker.onerror = (err) => {
            console.error("Worker fatal error:", err);
            setIsProcessing(false);
            worker.terminate();
        };

    } catch (error) {
        console.error("Processing failed:", error);
        setIsProcessing(false);
    }
  };

  const handleProcess = async () => {
    if (!fontBuffer) return;
    setIsProcessing(true);
    setProcessingStatus({ progress: 0, status: 'Iniciando cálculos...', title: 'Processando Espaçamento' });
    
    try {
        const worker = new Worker(new URL('./services/fontWorker.ts', import.meta.url), { type: 'module' });
        
        worker.postMessage({
            action: 'PROCESS_ALL',
            buffer: fontBuffer.slice(0),
            tracySettings,
            sousaSettings,
            context: 'PROCESS'
        });

        worker.onmessage = async (e) => {
            if (e.data.action === 'PROGRESS') {
                setProcessingStatus(prev => ({ ...prev, progress: e.data.progress, status: e.data.status }));
            } else if (e.data.action === 'PROCESS_SUCCESS') {
                const { metrics, tracy, sousa } = e.data;
                
                // Populate MetricsCache with pre-calculated counter metrics from worker
                if (metrics.counterMap) {
                    Object.entries(metrics.counterMap).forEach(([char, val]) => {
                        MetricsCache.set(tracy.family, char, 'counter_metrics', val);
                        MetricsCache.set(sousa.family, char, 'counter_metrics', val);
                        if (fonts[MethodType.ORIGINAL]?.fullFontFamily) {
                            MetricsCache.set(fonts[MethodType.ORIGINAL]!.fullFontFamily, char, 'counter_metrics', val);
                        }
                    });
                }
                
                const tracyBlob = new Blob([tracy.buffer], { type: 'font/opentype' });
                const sousaBlob = new Blob([sousa.buffer], { type: 'font/opentype' });
                
                const tracyFont = await parseFont(tracy.buffer);
                const sousaFont = await parseFont(sousa.buffer);

                const newTracyState: FontState = {
                    type: MethodType.TRACY,
                    fontObj: tracyFont,
                    url: URL.createObjectURL(tracyBlob),
                    fullFontFamily: tracy.family,
                    metrics: metrics
                };

                const newSousaState: FontState = {
                    type: MethodType.SOUSA,
                    fontObj: sousaFont,
                    url: URL.createObjectURL(sousaBlob),
                    fullFontFamily: sousa.family,
                    metrics: metrics
                };

                setFonts(prev => ({
                    ...prev,
                    [MethodType.TRACY]: newTracyState,
                    [MethodType.SOUSA]: newSousaState
                }));

                setStep(AppStep.ANALYSIS);
                setIsProcessing(false);
                worker.terminate();
            } else {
                setIsProcessing(false);
                worker.terminate();
            }
        };
    } catch (e) {
        console.error(e);
        setIsProcessing(false);
    }
  };

  const handleUpdateIndividualGlyph = (method: MethodType, char: string, lsb: number | null, rsb: number | null) => {
    if (method === MethodType.TRACY) {
      setTracySettings(prev => ({
        ...prev,
        overrides: {
          ...prev.overrides,
          [char]: { 
            lsb: lsb !== null ? lsb : (prev.overrides[char]?.lsb ?? null),
            rsb: rsb !== null ? rsb : (prev.overrides[char]?.rsb ?? null)
          }
        }
      }));
    } else if (method === MethodType.SOUSA) {
      setSousaSettings(prev => ({
        ...prev,
        overrides: {
          ...prev.overrides,
          [char]: { 
            lsb: lsb !== null ? lsb : (prev.overrides[char]?.lsb ?? 0),
            rsb: rsb !== null ? rsb : (prev.overrides[char]?.rsb ?? 0)
          }
        }
      }));
    } else if (method === MethodType.ORIGINAL_CUSTOM) {
      setOriginalCustomSettings(prev => {
        const currentOverride = prev.overrides[char];
        let startL = 0;
        let startR = 0;
        if (!currentOverride && fonts[MethodType.ORIGINAL]?.fontObj) {
            const m = getCharMetrics(fonts[MethodType.ORIGINAL]?.fontObj, char);
            startL = m.lsb;
            startR = m.rsb;
        } else if (currentOverride) {
            startL = currentOverride.lsb;
            startR = currentOverride.rsb;
        }
        return {
            ...prev,
            overrides: {
                ...prev.overrides,
                [char]: { 
                    lsb: lsb !== null ? lsb : startL, 
                    rsb: rsb !== null ? rsb : startR
                }
            }
        };
      });
    }
  };

  // Debounced Tuner Update for Tracy (Worker-assisted Shadow Metrics)
  useEffect(() => {
    if (fontBuffer && (step === AppStep.PREPARATION || step === AppStep.ANALYSIS)) {
        const updateTuner = () => {
            if (workerRef.current) {
                setLiveUpdateStatus('Atualizando (Tracy)...');
                workerRef.current.postMessage({
                    action: 'APPLY_METHOD',
                    method: 'TRACY',
                    settings: tracySettings
                });
            }
        };
        const timer = setTimeout(updateTuner, 400); 
        return () => { clearTimeout(timer); };
    }
  }, [tracySettings, step, tuningTab, fontBuffer]);

  // Debounced Tuner Update for Sousa (Worker-assisted Shadow Metrics)
  useEffect(() => {
    if (fontBuffer && (step === AppStep.PREPARATION || step === AppStep.ANALYSIS)) {
        const updateTuner = () => {
            if (workerRef.current) {
                setLiveUpdateStatus('Atualizando (Sousa)...');
                workerRef.current.postMessage({
                    action: 'APPLY_METHOD',
                    method: 'SOUSA',
                    settings: sousaSettings
                });
            }
        };
        const timer = setTimeout(updateTuner, 400); 
        return () => { clearTimeout(timer); };
    }
  }, [sousaSettings, step, tuningTab, fontBuffer]);

  // Debounced Tuner Update for Original Custom (Worker-assisted Shadow Metrics)
  useEffect(() => {
    if (fontBuffer && (step === AppStep.PREPARATION || step === AppStep.ANALYSIS)) {
        const updateTuner = () => {
            if (workerRef.current) {
                setLiveUpdateStatus('Atualizando (Custom)...');
                workerRef.current.postMessage({
                    action: 'APPLY_METHOD',
                    method: 'ORIGINAL_CUSTOM',
                    settings: originalCustomSettings
                });
            }
        };
        const timer = setTimeout(updateTuner, 400); 
        return () => { clearTimeout(timer); };
    }
  }, [originalCustomSettings, step, tuningTab, fontBuffer]);

  // NOVO: Renderização condicional da Tela Inicial
  if (appMode === 'START') {
    return (
      <div className="flex flex-col h-screen dark:bg-slate-950 bg-slate-50 dark:text-slate-200 text-slate-800 items-center lg:justify-center p-6 relative overflow-y-auto custom-scrollbar font-sans">
        {/* Background Decor */}
        <div className="absolute inset-0 bg-grid-pattern opacity-40 pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-600/10 blur-[150px] rounded-full pointer-events-none" />
            <div className="text-center mb-16 relative">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0, rotate: -10 }}
            animate={{ 
              scale: 1, 
              opacity: 1, 
              rotate: 0,
              y: [0, -10, 0]
            }}
            transition={{ 
              duration: 0.8,
              y: { duration: 4, repeat: Infinity, ease: "easeInOut" }
            }}
            className="bg-gradient-to-br from-blue-500 to-indigo-600 p-6 rounded-3xl inline-block mb-10 shadow-2xl shadow-blue-500/20"
          >
            <Activity className="w-16 h-16 dark:text-white text-slate-900" />
          </motion.div>
            <motion.h1 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-6xl md:text-7xl font-black dark:text-white text-slate-900 mb-6 flex items-center justify-center tracking-tighter"
          >
            <span
              className="text-[#000000] dark:text-[#FFFFFF]"
            >
              SAAME
            </span>
            <span className="text-blue-500 font-light ml-4">Lab</span>
          </motion.h1>
          <motion.p 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="dark:text-slate-400 text-slate-600 max-w-lg mx-auto text-xl md:text-2xl font-medium leading-relaxed"
          >
            Sistema de Aplicação e Análise de Metodos de Espaçamento
          </motion.p>
        </div>
        
        <motion.div 
          initial="hidden"
          animate="show"
          variants={{
            hidden: { opacity: 0 },
            show: {
              opacity: 1,
              transition: {
                staggerChildren: 0.15,
                delayChildren: 0.4
              }
            }
          }}
          className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl relative"
        >
          <motion.button 
            variants={{
              hidden: { y: 30, opacity: 0 },
              show: { y: 0, opacity: 1 }
            }}
            whileHover={{ y: -8, scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setAppMode('LAB')}
            className="flex flex-col items-center p-10 dark:bg-slate-900/60 bg-slate-100/60 backdrop-blur-md border dark:border-slate-800 border-slate-200 rounded-3xl hover:border-blue-500/50 transition-all group shadow-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset"
            aria-label="Abrir Laboratório de Espaçamento"
          >
            <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6 border border-blue-500/20 group-hover:bg-blue-500/20 transition-colors shadow-[0_0_20px_rgba(59,130,246,0.1)]">
              <PlayCircle className="w-10 h-10 text-blue-500" />
            </div>
            <h3 className="text-3xl font-black dark:text-white text-slate-900 mb-3">Laboratório de Espaçamento</h3>
            <p className="dark:text-slate-500 text-slate-500 text-base text-center font-medium">Ajuste e processe fontes individuais usando métodos históricos e matemáticos.</p>
          </motion.button>
 
          <motion.button 
            variants={{
              hidden: { y: 30, opacity: 0 },
              show: { y: 0, opacity: 1 }
            }}
            whileHover={{ y: -8, scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setAppMode('COMPARE_SPACING')}
            className="flex flex-col items-center p-10 dark:bg-slate-900/60 bg-slate-100/60 backdrop-blur-md border dark:border-slate-800 border-slate-200 rounded-3xl hover:border-indigo-500/50 transition-all group shadow-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-inset"
            aria-label="Abrir Fluxo de Comparação"
          >
             <div className="w-16 h-16 bg-indigo-500/10 rounded-2xl flex items-center justify-center mb-6 border border-indigo-500/20 group-hover:bg-indigo-500/20 transition-colors shadow-[0_0_20px_rgba(99,102,241,0.1)]">
              <Columns className="w-10 h-10 text-indigo-500" />
            </div>
            <h3 className="text-3xl font-black dark:text-white text-slate-900 mb-3">Fluxo de Comparação</h3>
            <p className="dark:text-slate-500 text-slate-500 text-base text-center font-medium">Analise métricas entre duas fontes tipográficas de forma independente.</p>
          </motion.button>
        </motion.div>
        
        <motion.div 
          initial="hidden"
          animate="show"
          variants={{
            hidden: { opacity: 0 },
            show: {
              opacity: 1,
              transition: {
                staggerChildren: 0.1,
                delayChildren: 0.8
              }
            }
          }}
          className="mt-16 w-full max-w-4xl dark:bg-slate-900/40 bg-slate-100/40 backdrop-blur-sm border dark:border-slate-800/50 border-slate-200/50 rounded-3xl p-8"
        >
          <h4 className="text-sm uppercase tracking-[0.3em] text-blue-500 font-black mb-8 text-center">Como Funciona o SAAME</h4>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <motion.div variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }} className="flex flex-col items-center text-center">
              <div className="w-10 h-10 rounded-full dark:bg-slate-800 bg-slate-200 flex items-center justify-center mb-3 text-blue-400 border dark:border-slate-700 border-slate-300 font-bold text-sm ring-4 ring-blue-500/5">1</div>
              <h5 className="dark:text-white text-slate-900 font-bold text-sm mb-2">Upload da Fonte</h5>
              <p className="dark:text-slate-500 text-slate-500 text-xs leading-relaxed">Carregue arquivos .otf ou .ttf para iniciar o processamento.</p>
            </motion.div>
            <motion.div variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }} className="flex flex-col items-center text-center">
              <div className="w-10 h-10 rounded-full dark:bg-slate-800 bg-slate-200 flex items-center justify-center mb-3 text-blue-400 border dark:border-slate-700 border-slate-300 font-bold text-sm ring-4 ring-blue-500/5">2</div>
              <h5 className="dark:text-white text-slate-900 font-bold text-sm mb-2">Ajuste de Métricas</h5>
              <p className="dark:text-slate-500 text-slate-500 text-xs leading-relaxed">Utilize Tracy ou Sousa para definir side-bearings rítmicos.</p>
            </motion.div>
            <motion.div variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }} className="flex flex-col items-center text-center">
              <div className="w-10 h-10 rounded-full dark:bg-slate-800 bg-slate-200 flex items-center justify-center mb-3 text-blue-400 border dark:border-slate-700 border-slate-300 font-bold text-sm ring-4 ring-blue-500/5">3</div>
              <h5 className="dark:text-white text-slate-900 font-bold text-sm mb-2">Análise Visual</h5>
              <p className="dark:text-slate-500 text-slate-500 text-xs leading-relaxed">Compare as fontes em tempo real com diagramas de espaçamento.</p>
            </motion.div>
            <motion.div variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }} className="flex flex-col items-center text-center">
              <div className="w-10 h-10 rounded-full dark:bg-slate-800 bg-slate-200 flex items-center justify-center mb-3 text-blue-400 border dark:border-slate-700 border-slate-300 font-bold text-sm ring-4 ring-blue-500/5">4</div>
              <h5 className="dark:text-white text-slate-900 font-bold text-sm mb-2">Validação Final</h5>
              <p className="dark:text-slate-500 text-slate-500 text-xs leading-relaxed">Verifique o ritmo em blocos de texto e refine glifos individuais.</p>
            </motion.div>
          </div>
        </motion.div>

        {/* Novo Glossário de Ícones */}
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2 }}
            className="mt-8 grid grid-cols-2 md:grid-cols-5 gap-4 dark:bg-slate-900/30 bg-slate-100/30 p-4 rounded-2xl border dark:border-slate-800/40 border-slate-200/40"
        >
            <div className="flex items-center gap-2 px-3">
                <PlayCircle className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-[11px] uppercase tracking-wider dark:text-slate-400 text-slate-600 font-bold">Laboratório</span>
            </div>
            <div className="flex items-center gap-2 px-3 border-l dark:border-slate-800/50 border-slate-200/50">
                <Columns className="w-3.5 h-3.5 text-indigo-500" />
                <span className="text-[11px] uppercase tracking-wider dark:text-slate-400 text-slate-600 font-bold">Comparação</span>
            </div>
            <div className="flex items-center gap-2 px-3 border-l dark:border-slate-800/50 border-slate-200/50">
                <Activity className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-[11px] uppercase tracking-wider dark:text-slate-400 text-slate-600 font-bold">Métricas</span>
            </div>
            <div className="flex items-center gap-2 px-3 border-l dark:border-slate-800/50 border-slate-200/50">
                <MousePointerClick className="w-3.5 h-3.5 text-green-400" />
                <span className="text-[11px] uppercase tracking-wider dark:text-slate-400 text-slate-600 font-bold">Análise</span>
            </div>
            <div className="flex items-center gap-2 px-3 border-l dark:border-slate-800/50 border-slate-200/50">
                <HelpCircle className="w-3.5 h-3.5 dark:text-slate-400 text-slate-600" />
                <span className="text-[11px] uppercase tracking-wider dark:text-slate-400 text-slate-600 font-bold">Ajuda</span>
            </div>
        </motion.div>

        <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5 }}
            className="mt-16 flex flex-col items-center gap-4 pb-12"
        >
            <div className="h-px w-24 dark:bg-slate-800 bg-slate-200" />
            <p className="text-sm uppercase tracking-[0.4em] dark:text-slate-500 text-slate-500 font-bold">Desenvolvido para fins acadêmicos</p>
        </motion.div>
      </div>
    );
  }

  // NOVO: Renderização do novo fluxo COMPARE_SPACING
  if (appMode === 'COMPARE_SPACING') {
    return <CompareSpacingFlow onBack={() => setAppMode('START')} />;
  }

  // O RESTO DO COMPONENTE PERMANECE ABSOLUTAMENTE IGUAL (Fluxo LAB original)
  return (
    <div className="flex flex-col h-screen dark:bg-slate-950 bg-slate-50 dark:text-slate-200 text-slate-800 font-sans relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute inset-0 bg-grid-pattern opacity-40 pointer-events-none" />
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-600/5 blur-[120px] rounded-full pointer-events-none" />
      
      {/* Loading Overlay */}
      <AnimatePresence>
        {isProcessing && (
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-[100] dark:bg-slate-950/80 bg-slate-50/80 backdrop-blur-md flex items-center justify-center flex-col"
            >
                <div className="relative">
                    <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
                    <motion.div 
                        animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="absolute inset-0 bg-blue-500 blur-xl rounded-full -z-10"
                    />
                </div>
                <h3 className="dark:text-white text-slate-900 text-xl font-semibold mt-6 tracking-wide">{processingStatus.title}</h3>
                <p className="text-blue-400 font-medium mt-2 tracking-widest uppercase text-xs">{processingStatus.status}</p>
                <div className="w-64 h-2 dark:bg-slate-800 bg-slate-200 rounded-full mt-4 overflow-hidden shadow-inner flex relative">
                    <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${processingStatus.progress}%` }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                        className="h-full bg-blue-500 relative flex items-center justify-end"
                    >
                        <motion.div 
                            animate={{ x: [-200, 200] }}
                            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent w-[200%]"
                        />
                    </motion.div>
                </div>
                <p className="dark:text-slate-400 text-slate-600 mt-2 text-sm font-mono">{processingStatus.progress}%</p>
            </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="flex flex-col md:flex-row items-center justify-between px-6 py-4 dark:bg-slate-900/50 bg-slate-100/50 backdrop-blur-md border-b dark:border-slate-800/80 border-slate-200/80 gap-4 sticky top-0 z-50">
        <div className="flex items-center gap-4 w-full md:w-auto">
          {/* Adicionado botão Home para o fluxo Lab */}
          <button 
            onClick={() => setAppMode('START')} 
            className="p-2 dark:hover:bg-slate-800 hover:bg-slate-200 rounded-lg dark:text-slate-500 text-slate-500 dark:hover:text-white hover:text-slate-900 transition-all transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500"
            title="Voltar ao Início"
            aria-label="Ir para a Página Inicial"
          >
            <Home className="w-5 h-5" />
          </button>
          
          <div className="h-8 w-px dark:bg-slate-800 bg-slate-200 hidden md:block" />

          <div className="flex items-center gap-3 group">
            <div className={`p-2 rounded-xl shadow-lg transition-all duration-500 ${step === AppStep.UPLOAD ? 'bg-gradient-to-br from-blue-500 to-indigo-600 shadow-blue-500/20' : tuningTab === 'TRACY' ? 'bg-blue-600 shadow-blue-500/40 rotate-3' : 'bg-indigo-600 shadow-indigo-500/40 -rotate-3'}`}>
              <Activity className="w-6 h-6 dark:text-white text-slate-900" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight dark:text-white text-slate-900 flex items-center">
                <span className="text-[#000000] dark:text-[#FFFFFF]">
                  SAAME
                </span>
                <span className={`font-light ml-2 transition-colors duration-500 ${tuningTab === 'TRACY' ? 'text-blue-500' : 'text-indigo-400'}`}>Lab</span>
              </h1>
              <p className="hidden md:block text-[11px] dark:text-slate-500 text-slate-500 uppercase tracking-[0.2em] font-medium">Ambiente de Experimentação Tipográfica</p>
            </div>
          </div>
        </div>
        
        {/* Progress Stepper Improved (H1 & H4) */}
        <div className="flex items-center gap-2 md:gap-4 text-sm font-bold uppercase tracking-[0.2em] w-full md:w-auto justify-center md:justify-end">
            <div className={`flex items-center gap-3 transition-all duration-500 ${step === AppStep.UPLOAD ? 'text-blue-400' : fonts[MethodType.ORIGINAL] ? 'text-green-500' : 'text-slate-600 dark:text-slate-400'}`}>
                <span className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${
                  step === AppStep.UPLOAD ? 'border-blue-500 bg-blue-500/10 shadow-[0_0_15px_rgba(59,130,246,0.3)] dark:text-white text-slate-900' : 
                  fonts[MethodType.ORIGINAL] ? 'border-green-500 bg-green-500/20 text-green-500 shadow-[0_0_15px_rgba(34,197,94,0.2)]' : 'dark:border-slate-800 border-slate-200'
                }`}>
                  {fonts[MethodType.ORIGINAL] && step !== AppStep.UPLOAD ? <CheckCircle2 className="w-4 h-4" /> : '01'}
                </span>
                <div className="hidden lg:flex flex-col">
                    <span className="leading-none">Fonte</span>
                    <span className="text-[7px] dark:text-slate-500 text-slate-500 tracking-normal font-normal mt-1 italic opacity-60">Upload</span>
                </div>
            </div>
            
            <div className={`w-6 md:w-8 h-0.5 rounded-full ${step !== AppStep.UPLOAD ? 'bg-blue-500/50' : 'dark:bg-slate-800 bg-slate-200'}`} />
            
            <div className={`flex items-center gap-3 transition-all duration-500 ${step === AppStep.PREPARATION ? 'text-blue-400' : step === AppStep.ANALYSIS ? 'text-green-500' : 'text-slate-600 dark:text-slate-400'}`}>
                <span className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${
                  step === AppStep.PREPARATION ? 'border-blue-500 bg-blue-500/10 shadow-[0_0_15px_rgba(59,130,246,0.3)] dark:text-white text-slate-900' : 
                  step === AppStep.ANALYSIS ? 'border-green-500 bg-green-500/20 text-green-500 shadow-[0_0_15px_rgba(34,197,94,0.2)]' : 'dark:border-slate-800 border-slate-200'
                }`}>
                  {step === AppStep.ANALYSIS ? <CheckCircle2 className="w-4 h-4" /> : '02'}
                </span>
                <div className="hidden lg:flex flex-col">
                    <span className="leading-none">Métricas</span>
                    <span className="text-[7px] dark:text-slate-500 text-slate-500 tracking-normal font-normal mt-1 italic opacity-60">Ajuste</span>
                </div>
            </div>
            
            <div className={`w-6 md:w-8 h-0.5 rounded-full ${step === AppStep.ANALYSIS ? 'bg-blue-500/50' : 'dark:bg-slate-800 bg-slate-200'}`} />
            
             <div className={`flex items-center gap-3 transition-all duration-500 ${step === AppStep.ANALYSIS ? 'text-blue-400' : 'text-slate-600 dark:text-slate-400'}`}>
                <span className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${step === AppStep.ANALYSIS ? 'border-blue-500 bg-blue-500/10 shadow-[0_0_15px_rgba(59,130,246,0.3)] dark:text-white text-slate-900' : 'dark:border-slate-800 border-slate-200'}`}>03</span>
                <div className="hidden lg:flex flex-col">
                    <span className="leading-none">Análise</span>
                    <span className="text-[7px] dark:text-slate-500 text-slate-500 tracking-normal font-normal mt-1 italic opacity-60">Resultados</span>
                </div>
            </div>

            <div className="h-8 w-px dark:bg-slate-800 bg-slate-200 mx-2 hidden md:block" />

            <button 
              onClick={() => setShowHelp(true)}
              className="p-2 hover:bg-blue-500/10 rounded-lg dark:text-slate-500 text-slate-500 hover:text-blue-400 transition-all group focus:outline-none focus:ring-2 focus:ring-blue-500"
              title="Guia de Ajuda"
              aria-label="Abrir Guia de Ajuda"
            >
              <HelpCircle className="w-5 h-5 group-hover:scale-110 transition-transform" />
            </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto lg:overflow-hidden p-2 md:p-6 custom-scrollbar">
        
        {/* Help Modal (H10) */}
        <AnimatePresence>
          {showHelp && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[200] dark:bg-slate-950/90 bg-slate-50/90 backdrop-blur-xl flex items-center justify-center p-4"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="dark:bg-slate-900 bg-slate-100 border dark:border-slate-800 border-slate-200 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl"
              >
                <div className="flex items-center justify-between p-6 border-b dark:border-slate-800 border-slate-200 dark:bg-slate-900/50 bg-slate-100/50">
                  <div className="flex items-center gap-3 text-blue-400">
                    <Zap className="w-6 h-6" />
                    <h2 className="text-2xl font-black uppercase tracking-tight dark:text-white text-slate-900">Guia de Navegação SAAME</h2>
                  </div>
                  <button 
                    onClick={() => setShowHelp(false)} 
                    className="p-2 dark:hover:bg-slate-800 hover:bg-slate-200 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                    aria-label="Fechar Guia de Ajuda"
                  >
                    <X className="w-6 h-6 dark:text-slate-400 text-slate-600 dark:hover:text-white hover:text-slate-900" />
                  </button>
                </div>
                <div className="p-8 space-y-12 max-h-[70vh] overflow-y-auto custom-scrollbar">
                  {/* Grid of Areas */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <section className="dark:bg-slate-950/40 bg-slate-50/40 p-6 rounded-3xl border dark:border-slate-800/50 border-slate-200/50 flex flex-col gap-5 hover:border-blue-500/30 transition-colors">
                      <div className="flex items-center gap-3">
                         <div className="w-10 h-10 rounded-2xl bg-blue-500/20 flex items-center justify-center text-blue-400">
                           <Activity className="w-5 h-5" />
                         </div>
                         <h3 className="dark:text-white text-slate-900 font-black text-base uppercase tracking-widest">Ajustador de Métricas</h3>
                      </div>
                      
                      {/* Animated Metaphor for Sliders */}
                      <div className="h-24 dark:bg-slate-900/50 bg-slate-100/50 rounded-xl border dark:border-slate-800/30 border-slate-200/30 flex flex-col justify-center gap-3 px-6 overflow-hidden">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="flex items-center gap-3">
                            <div className="h-1 flex-1 dark:bg-slate-800 bg-slate-200 rounded-full relative">
                              <motion.div 
                                animate={{ left: i % 2 === 0 ? ['10%', '60%', '10%'] : ['70%', '20%', '70%'] }}
                                transition={{ duration: 3 + i, repeat: Infinity, ease: "easeInOut" }}
                                className="absolute -top-1 w-3 h-3 bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]" 
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      <p className="dark:text-slate-400 text-slate-600 text-sm leading-relaxed">
                        Controle o espaçamento usando métodos como <span className="text-blue-400 font-bold">Tracy</span> e <span className="text-indigo-400 font-bold">Sousa</span>. Altere valores globais ou por grupos de glifos no painel lateral.
                      </p>
                    </section>

                    <section className="dark:bg-slate-950/40 bg-slate-50/40 p-6 rounded-3xl border dark:border-slate-800/50 border-slate-200/50 flex flex-col gap-5 hover:border-green-500/30 transition-colors">
                      <div className="flex items-center gap-3">
                         <div className="w-10 h-10 rounded-2xl bg-green-500/20 flex items-center justify-center text-green-400">
                           <Zap className="w-5 h-5" />
                         </div>
                         <h3 className="dark:text-white text-slate-900 font-black text-base uppercase tracking-widest">Processamento</h3>
                      </div>

                      {/* Animated Metaphor for Processing/Validation */}
                      <div className="h-24 dark:bg-slate-900/50 bg-slate-100/50 rounded-xl border dark:border-slate-800/30 border-slate-200/30 flex items-center justify-center gap-4 overflow-hidden">
                        <motion.div 
                          animate={{ rotate: 360 }}
                          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                          className="w-8 h-8 rounded-full border-2 border-dashed border-green-500/40 flex items-center justify-center"
                        >
                          <RefreshCcw className="w-4 h-4 text-green-500/60" />
                        </motion.div>
                        <div className="flex flex-col gap-1">
                          <motion.div 
                            animate={{ opacity: [0.3, 1, 0.3] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="h-1.5 w-16 bg-green-500/20 rounded-full" 
                          />
                          <motion.div 
                            animate={{ opacity: [0.3, 1, 0.3] }}
                            transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
                            className="h-1.5 w-12 bg-green-500/20 rounded-full" 
                          />
                        </div>
                        <motion.div
                          animate={{ scale: [0.8, 1, 0.8], opacity: [0.5, 1, 0.5] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                        >
                          <CheckCircle2 className="w-6 h-6 text-green-500" />
                        </motion.div>
                      </div>

                      <p className="dark:text-slate-400 text-slate-600 text-sm leading-relaxed">
                        O sistema analisa a fonte automaticamente para identificar contraformas e sugerir métricas baseadas no design original.
                      </p>
                    </section>

                    <section className="dark:bg-slate-950/40 bg-slate-50/40 p-6 rounded-3xl border dark:border-slate-800/50 border-slate-200/50 flex flex-col gap-5 hover:border-indigo-500/30 transition-colors">
                      <div className="flex items-center gap-3">
                         <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                           <Target className="w-5 h-5" />
                         </div>
                         <h3 className="dark:text-white text-slate-900 font-black text-base uppercase tracking-widest">Tutoriais Visuais</h3>
                      </div>

                      {/* Visual Metaphor for Tutorial */}
                      <div className="h-24 dark:bg-slate-900/50 bg-slate-100/50 rounded-xl border dark:border-slate-800/30 border-slate-200/30 flex items-center justify-center gap-3 overflow-hidden">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="w-14 h-16 dark:bg-slate-800/50 bg-slate-200/50 rounded-lg border dark:border-slate-700/50 border-slate-300/50 flex flex-col gap-2 p-2">
                             <div className="h-1 w-full dark:bg-slate-700 bg-slate-300 rounded-full" />
                             <div className="h-1 w-2/3 dark:bg-slate-700 bg-slate-300 rounded-full" />
                             <div className="mt-auto h-6 w-full dark:bg-slate-950/40 bg-slate-50/40 rounded flex items-center justify-center">
                                <Activity className="w-3 h-3 dark:text-slate-500 text-slate-500" />
                             </div>
                          </div>
                        ))}
                      </div>

                      <p className="dark:text-slate-400 text-slate-600 text-sm leading-relaxed">
                        Entenda o embasamento teórico de cada método. Acompanhe diagramas interativos que explicam conceitos de ritmo e espaçamento sistemático.
                      </p>
                    </section>

                    <section className="dark:bg-slate-950/40 bg-slate-50/40 p-6 rounded-3xl border dark:border-slate-800/50 border-slate-200/50 flex flex-col gap-5 hover:border-cyan-500/30 transition-colors">
                      <div className="flex items-center gap-3">
                         <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 flex items-center justify-center text-cyan-400">
                           <Type className="w-5 h-5" />
                         </div>
                         <h3 className="dark:text-white text-slate-900 font-black text-base uppercase tracking-widest">Visualização</h3>
                      </div>

                      {/* Visual Metaphor for Preview */}
                      <div className="h-24 dark:bg-slate-900/50 bg-slate-100/50 rounded-xl border dark:border-slate-800/30 border-slate-200/30 flex items-center justify-center overflow-hidden">
                        <div className="text-3xl font-serif dark:text-white text-slate-900 opacity-40 flex items-baseline gap-1">
                          <span>A</span>
                          <motion.span 
                            animate={{ x: [-2, 4, -2] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="text-cyan-400"
                          >V</motion.span>
                          <span>W</span>
                        </div>
                      </div>

                      <p className="dark:text-slate-400 text-slate-600 text-sm leading-relaxed">
                        Teste sua fonte com textos reais em tempo real. Alterne entre fundo claro/escuro e veja o comportamento do "cinza tipográfico".
                      </p>
                    </section>
                  </div>

                  <section className="bg-blue-500/5 p-6 rounded-2xl border border-blue-500/20">
                    <h4 className="text-blue-300 font-bold text-base mb-2 italic flex items-center gap-2">
                      <HelpCircle className="w-4 h-4" /> Fluxo Sugerido
                    </h4>
                    <p className="dark:text-slate-400 text-slate-600 text-sm leading-relaxed">
                      Comece ajustando os <span className="dark:text-white text-slate-900">Caracteres Mestre</span> no método Tracy, valide o resultado nos <span className="dark:text-white text-slate-900">Grupos de Afinidade</span> do método Sousa e finalize com o teste de leitura na área de <span className="dark:text-white text-slate-900">Pré-visualização</span>.
                    </p>
                  </section>
                </div>
                <div className="p-6 border-t dark:border-slate-800 border-slate-200 dark:bg-slate-900/50 bg-slate-100/50 flex justify-end">
                  <button 
                    onClick={() => setShowHelp(false)} 
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all text-base uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 focus:ring-offset-slate-900"
                  >
                    Entendido
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {step === AppStep.UPLOAD && (
            <div className="max-w-2xl mx-auto pt-8 md:pt-12 px-4 pb-20">
                <FileUpload onFileLoaded={handleFileLoaded} />
                <div className="mt-8 text-center dark:text-gray-500 text-gray-500 text-base max-w-lg mx-auto leading-relaxed">
                    Carregue um arquivo .otf ou .ttf. O sistema gerará automaticamente uma cópia limpa (métricas zeradas) e uma cópia de referência Original para comparação rítmica.
                </div>
            </div>
        )}

        {step === AppStep.PREPARATION && (
            <div className="flex flex-col lg:grid lg:grid-cols-12 gap-6 h-full lg:overflow-hidden relative px-1 pb-10 lg:pb-0">
                {/* Mobile View Switcher - Improved visibility */}
                <div className="lg:hidden flex sticky top-0 z-[60] dark:bg-slate-950/80 bg-slate-50/80 backdrop-blur-md border-b dark:border-slate-800 border-slate-200 p-2 mb-2 -mx-1">
                    <button 
                        onClick={() => setPrepMobileView('TUNER')}
                        className={`flex-1 py-3 px-4 rounded-xl text-base font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${prepMobileView === 'TUNER' ? 'bg-blue-600 dark:text-white text-slate-900 shadow-lg shadow-blue-500/30' : 'dark:text-slate-500 text-slate-500 dark:hover:text-slate-300 hover:text-slate-700'}`}
                        aria-pressed={prepMobileView === 'TUNER'}
                    >
                        <RefreshCcw className="w-4 h-4" /> Ajustes
                    </button>
                    <button 
                        onClick={() => setPrepMobileView('TUTORIAL')}
                        className={`flex-1 py-3 px-4 rounded-xl text-base font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${prepMobileView === 'TUTORIAL' ? 'bg-indigo-600 dark:text-white text-slate-900 shadow-lg shadow-indigo-500/30' : 'dark:text-slate-500 text-slate-500 dark:hover:text-slate-300 hover:text-slate-700'}`}
                        aria-pressed={prepMobileView === 'TUTORIAL'}
                    >
                        <Target className="w-4 h-4" /> Tutorial
                    </button>
                </div>

                {/* Tuning Panel */}
                {(prepMobileView === 'TUNER' || isDesktop) && (
                    <motion.div 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="lg:col-span-8 h-fit lg:h-full flex flex-col order-1 overflow-y-auto lg:overflow-hidden custom-scrollbar"
                    >
                        <div className="flex gap-2 mb-4 dark:bg-slate-900/90 bg-slate-100/90 backdrop-blur p-2 rounded-2xl border dark:border-slate-800 border-slate-200 w-full sm:w-fit self-center lg:self-start z-20 shadow-2xl">
                        <button 
                            onClick={() => setTuningTab('ORIGINAL')}
                            className={`flex-1 sm:flex-none px-6 py-3 rounded-xl text-base font-black uppercase tracking-widest transition-all focus:outline-none focus:ring-2 focus:ring-slate-500 relative flex items-center gap-2 ${tuningTab === 'ORIGINAL' ? 'bg-slate-600 text-white shadow-lg shadow-slate-600/40' : 'dark:text-slate-400 text-slate-600 dark:hover:text-white hover:text-slate-900 hover:bg-black/5 dark:hover:bg-white/5'}`}
                            role="tab"
                            aria-selected={tuningTab === 'ORIGINAL'}
                        >
                            {tuningTab === 'ORIGINAL' && <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                            Fonte Original
                        </button>
                        <button 
                            onClick={() => setTuningTab('ORIGINAL_CUSTOM')}
                            className={`flex-1 sm:flex-none px-6 py-3 rounded-xl text-base font-black uppercase tracking-widest transition-all focus:outline-none focus:ring-2 focus:ring-slate-500 relative flex items-center gap-2 ${tuningTab === 'ORIGINAL_CUSTOM' ? 'bg-slate-600 text-white shadow-lg shadow-slate-600/40' : 'dark:text-slate-400 text-slate-600 dark:hover:text-white hover:text-slate-900 hover:bg-black/5 dark:hover:bg-white/5'}`}
                            role="tab"
                            aria-selected={tuningTab === 'ORIGINAL_CUSTOM'}
                        >
                            {tuningTab === 'ORIGINAL_CUSTOM' && <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                            Original Customizada
                        </button>
                        <button 
                            onClick={() => setTuningTab('TRACY')}
                            className={`flex-1 sm:flex-none px-6 py-3 rounded-xl text-base font-black uppercase tracking-widest transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 relative flex items-center gap-2 ${tuningTab === 'TRACY' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/40' : 'dark:text-slate-400 text-slate-600 dark:hover:text-white hover:text-slate-900 hover:bg-black/5 dark:hover:bg-white/5'}`}
                            role="tab"
                            aria-selected={tuningTab === 'TRACY'}
                        >
                            {tuningTab === 'TRACY' && <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                            Método Tracy
                        </button>
                        <button 
                            onClick={() => setTuningTab('SOUSA')}
                            className={`flex-1 sm:flex-none px-6 py-3 rounded-xl text-base font-black uppercase tracking-widest transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 relative flex items-center gap-2 ${tuningTab === 'SOUSA' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/40' : 'dark:text-slate-400 text-slate-600 dark:hover:text-white hover:text-slate-900 hover:bg-black/5 dark:hover:bg-white/5'}`}
                            role="tab"
                            aria-selected={tuningTab === 'SOUSA'}
                        >
                            {tuningTab === 'SOUSA' && <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                            Método Sousa
                        </button>
                    </div>

                    <div className={`flex-1 min-h-[600px] lg:min-h-0 dark:bg-slate-900/30 bg-slate-100/30 rounded-2xl border transition-all duration-500 ${tuningTab === 'TRACY' ? 'border-blue-500/30 shadow-[0_0_40px_rgba(59,130,246,0.05)]' : tuningTab === 'SOUSA' ? 'border-indigo-500/30 shadow-[0_0_40px_rgba(99,102,241,0.05)]' : 'border-slate-500/30 shadow-[0_0_40px_rgba(100,116,139,0.05)]'} shadow-inner overflow-hidden flex flex-col relative`}>
                        {liveUpdateStatus && (
                            <div className={`absolute top-4 right-4 z-50 ${tuningTab === 'TRACY' ? 'bg-blue-600/90' : tuningTab === 'SOUSA' ? 'bg-indigo-600/90' : 'bg-slate-600/90'} text-white text-xs uppercase font-bold tracking-widest px-3 py-1.5 rounded-full flex items-center gap-2 shadow-lg backdrop-blur-md animate-pulse`}>
                                <Loader2 className="w-3 h-3 animate-spin mx-auto" />
                                {liveUpdateStatus}
                            </div>
                        )}
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            {tuningTab === 'TRACY' ? (
                                <MetricTuner 
                                    settings={tracySettings} 
                                    onSettingsChange={setTracySettings}
                                    fontFamily={fonts[MethodType.TRACY]?.fullFontFamily || 'sans-serif'}
                                    font={fonts[MethodType.TRACY]}
                                />
                            ) : tuningTab === 'SOUSA' ? (
                                <SousaTuner 
                                    settings={sousaSettings}
                                    onSettingsChange={setSousaSettings}
                                    fontFamily={fonts[MethodType.SOUSA]?.fullFontFamily || 'sans-serif'}
                                    font={fonts[MethodType.SOUSA]}
                                />
                            ) : tuningTab === 'ORIGINAL' ? (
                                <OriginalTuner 
                                    font={fonts[MethodType.ORIGINAL]}
                                />
                            ) : (
                                <OriginalCustomTuner 
                                    font={fonts[MethodType.ORIGINAL_CUSTOM]}
                                    originalFont={fonts[MethodType.ORIGINAL]}
                                    tracyFont={fonts[MethodType.TRACY]}
                                    sousaFont={fonts[MethodType.SOUSA]}
                                    settings={originalCustomSettings}
                                    onSettingsChange={setOriginalCustomSettings}
                                />
                            )}
                        </div>
                        
                        {/* Mobile Action buttons in Tuner Panel */}
                        <div className="lg:hidden p-4 dark:bg-slate-900/90 bg-slate-100/90 backdrop-blur-md border-t dark:border-slate-800 border-slate-200">
                             <div className="flex flex-col gap-3 w-full">
                                <button 
                                    onClick={handleProcess}
                                    className="px-10 py-4 rounded-2xl bg-white text-slate-950 font-black shadow-2xl flex items-center justify-center gap-3 w-full transform hover:scale-[1.02] active:scale-[0.98] transition-all text-base uppercase tracking-tighter hover:bg-blue-50 focus:outline-none focus:ring-4 focus:ring-blue-500/50"
                                >
                                    Processar e Validar <ArrowRight className="w-5 h-5" />
                                </button>
                                <button 
                                    onClick={() => setStep(AppStep.UPLOAD)}
                                    className="px-8 py-3 rounded-2xl border dark:border-slate-800 border-slate-200 dark:hover:bg-slate-800/50 hover:bg-slate-200/50 transition-all dark:text-slate-500 text-slate-500 font-bold text-xs uppercase tracking-widest dark:hover:text-slate-300 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-700"
                                >
                                    Trocar Arquivo
                                </button>
                            </div>
                        </div>
                    </div>
                </motion.div>
                )}

                {/* Info Panel */}
                {(prepMobileView === 'TUTORIAL' || isDesktop) && (
                    <motion.div 
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="lg:col-span-4 h-fit lg:h-full order-2 lg:overflow-hidden flex flex-col"
                    >
                        <div className="dark:bg-slate-900/60 bg-slate-100/60 backdrop-blur-sm flex-1 rounded-3xl border dark:border-slate-800 border-slate-200 flex flex-col overflow-hidden shadow-2xl relative group min-h-[600px] lg:min-h-0">
                        <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                        
                        <div className="flex-1 overflow-y-auto custom-scrollbar pt-6 px-6 md:px-8">
                            <div className="flex flex-col items-center">
                                {/* Refined compact font info - Hidden on small screens to maximize adjustment space */}
                                <div className="hidden lg:flex items-center gap-3 dark:bg-slate-950/40 bg-slate-50/40 p-3 rounded-xl mb-4 border dark:border-slate-800/30 border-slate-200/30 w-full group/info">
                                    <div className="dark:bg-slate-950 bg-slate-50 p-2 rounded-lg shadow-inner border dark:border-slate-800/50 border-slate-200/50 group-hover/info:border-blue-500/30 transition-colors">
                                        <Type className="w-5 h-5 text-blue-500/80" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5 mb-0.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-sm" />
                                            <h4 className="text-[11px] font-black dark:text-slate-500 text-slate-500 uppercase tracking-[0.2em]">{fontName}</h4>
                                        </div>
                                        <h3 className="text-sm font-bold dark:text-slate-300 text-slate-700 truncate tracking-tight">Análise Ativa</h3>
                                    </div>
                                </div>
                                
                                <div className="w-full flex-1">
                                    <MethodVisualizer method={tuningTab} font={fonts[tuningTab as MethodType.TRACY | MethodType.SOUSA]} />
                                </div>

                                <div className="hidden lg:block dark:bg-slate-950/40 bg-slate-50/40 rounded-2xl p-6 border dark:border-slate-800/60 border-slate-200/60 my-8 text-left group-hover:border-blue-500/30 transition-colors w-full">
                                    <h4 className="text-xs font-black text-blue-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                        <Target className="w-3.5 h-3.5" />
                                        Fundamentos Teóricos
                                    </h4>
                                    <div className="dark:text-slate-300 text-slate-700 text-sm md:text-base leading-relaxed font-medium">
                                        {tuningTab === 'TRACY' ? (
                                            <div className="space-y-4">
                                                <p>
                                                    Walter Tracy propõe que o <span className="dark:text-white text-slate-900 font-bold"> ritmo tipográfico</span> é uma relação direta entre o espaço interno e as margens externas.
                                                </p>
                                                <div className="dark:bg-slate-900/50 bg-slate-100/50 p-4 rounded-xl border dark:border-slate-800 border-slate-200 space-y-2">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-blue-400 font-black text-[11px] uppercase tracking-wider">Haste Reta</span>
                                                        <span className="dark:text-slate-500 text-slate-500 text-[10px] font-mono">FIXO</span>
                                                    </div>
                                                    <p className="text-xs dark:text-slate-400 text-slate-600 leading-tight">Glifos como H e n recebem a carga metrológica primária, servindo como modelo para o resto da fonte.</p>
                                                </div>
                                            </div>
                                        ) : tuningTab === 'SOUSA' ? (
                                            <div className="space-y-4">
                                                <p>
                                                    O método de Miguel Sousa organiza o espaçamento em <span className="dark:text-white text-slate-900 font-bold">três grandes grupos</span> baseados na semelhança de forma e relações de herança entre os glifos.
                                                </p>
                                                <div className="dark:bg-slate-900/50 bg-slate-100/50 p-4 rounded-xl border dark:border-slate-800 border-slate-200 space-y-2">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-indigo-400 font-black text-[11px] uppercase tracking-wider">Semelhança de Forma</span>
                                                        <span className="dark:text-slate-500 text-slate-500 text-[10px] font-mono">REFERÊNCIA</span>
                                                    </div>
                                                    <p className="text-xs dark:text-slate-400 text-slate-600 leading-tight">O sistema utiliza relações onde hastes herdam de 'l' e curvas de 'o', permitindo ajustes visuais precisos onde a geometria falha.</p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-4">
                                                <p>
                                                    A <span className="dark:text-white text-slate-900 font-bold">métrica original</span> representa o desenho pretendido pelo autor. Analisar esses valores é essencial para entender as decisões estéticas iniciais.
                                                </p>
                                                <div className="dark:bg-slate-900/50 bg-slate-100/50 p-4 rounded-xl border dark:border-slate-800 border-slate-200 space-y-2">
                                                    <div className="flex justify-between items-center">
                                                        <span className="dark:text-slate-400 text-slate-600 font-black text-[11px] uppercase tracking-wider">Métrica de Fábrica</span>
                                                        <span className="dark:text-slate-500 text-slate-500 text-[10px] font-mono">BASELINE</span>
                                                    </div>
                                                    <p className="text-xs dark:text-slate-400 text-slate-600 leading-tight">Observe como o designer original equilibrou as massas pretas e brancas antes de aplicar métodos sistemáticos.</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Sticky Action Footer in Info Panel */}
                        <div className="p-6 dark:bg-slate-900/90 bg-slate-100/90 backdrop-blur-md border-t dark:border-slate-800 border-slate-200 mt-auto">
                            <div className="flex flex-col gap-3 w-full">
                                <button 
                                    onClick={handleProcess}
                                    className="px-10 py-4 rounded-2xl bg-white text-slate-950 font-black shadow-2xl flex items-center justify-center gap-3 w-full transform hover:scale-[1.02] active:scale-[0.98] transition-all text-base uppercase tracking-tighter hover:bg-blue-50 shadow-blue-500/10 focus:outline-none focus:ring-4 focus:ring-blue-500/50"
                                >
                                    Processar e Validar Fontes <ArrowRight className="w-5 h-5" />
                                </button>
                                <button 
                                    onClick={() => setStep(AppStep.UPLOAD)}
                                    className="px-8 py-3 rounded-2xl border dark:border-slate-800 border-slate-200 dark:hover:bg-slate-800/50 hover:bg-slate-200/50 transition-all dark:text-slate-500 text-slate-500 font-bold text-xs uppercase tracking-widest dark:hover:text-slate-300 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-700"
                                >
                                    Trocar Arquivo Fonte
                                </button>
                            </div>
                        </div>
                    </div>
                </motion.div>
                )}
            </div>
        )}

        {step === AppStep.ANALYSIS && (
            <div className="h-fit lg:h-full flex flex-col min-h-[800px] lg:min-h-0">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2">
                    <h2 className="text-xl md:text-2xl font-black dark:text-white text-slate-900 flex items-center gap-2 uppercase tracking-tighter">
                        <MousePointerClick className="w-6 h-6 text-blue-500" />
                        Análise Comparativa
                    </h2>
                    <button 
                        onClick={() => setStep(AppStep.PREPARATION)}
                        className="flex items-center justify-center gap-2 px-6 py-3 bg-white hover:bg-blue-50 text-slate-950 rounded-xl transition-all shadow-xl border border-slate-200 group active:scale-95 w-full sm:w-auto font-black uppercase tracking-widest text-xs"
                    >
                        <Settings2 className="w-4 h-4 group-hover:rotate-90 transition-all duration-500 text-blue-600" /> 
                        Ajustar Configurações
                    </button>
                </div>
                <div className="flex-1 min-h-0 min-h-[600px] lg:min-h-0">
                    <AnalysisCanvas 
                      fonts={fonts} 
                      onUpdateGlyph={handleUpdateIndividualGlyph} 
                    />
                </div>
            </div>
        )}

      </main>
    </div>
  );
};

export default App;
