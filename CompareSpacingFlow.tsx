
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AppStep, FontState, MethodType } from './types';
import { createFontState } from './services/fontService';
import { FileUpload } from './components/FileUpload';
import { LabStyleComparisonGrid } from './components/LabStyleComparisonGrid';
import { Loader2, Activity, Home, ArrowRight, CheckCircle2 } from 'lucide-react';

export const CompareSpacingFlow: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [step, setStep] = useState<AppStep>(AppStep.UPLOAD);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  
  const [refFile, setRefFile] = useState<{ buffer: ArrayBuffer | null, name: string }>({ buffer: null, name: '' });
  const [expFile, setExpFile] = useState<{ buffer: ArrayBuffer | null, name: string }>({ buffer: null, name: '' });
  
  const [refFont, setRefFont] = useState<FontState | null>(null);
  const [expFont, setExpFont] = useState<FontState | null>(null);

  // Efeito para injetar as fontes no CSS (Pipeline Independente)
  useEffect(() => {
    if (refFont || expFont) {
      const styleId = 'compare-fonts-css';
      let styleTag = document.getElementById(styleId);
      if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = styleId;
        document.head.appendChild(styleTag);
      }
      let css = '';
      if (refFont) css += `@font-face { font-family: '${refFont.fullFontFamily}'; src: url('${refFont.url}'); }\n`;
      if (expFont) css += `@font-face { font-family: '${expFont.fullFontFamily}'; src: url('${expFont.url}'); }\n`;
      styleTag.textContent = css;
    }
  }, [refFont, expFont]);

  const handleProcess = async () => {
    if (!refFile.buffer || !expFile.buffer) return;
    setIsProcessing(true);
    setProgress(10);

    try {
      // Passo 1: Parse Referência
      setProgress(30);
      const rFont = await createFontState(refFile.buffer.slice(0), MethodType.ORIGINAL);
      rFont.fullFontFamily = `Ref-${Date.now()}`;
      
      // Passo 2: Parse Experimental
      setProgress(60);
      const eFont = await createFontState(expFile.buffer.slice(0), MethodType.TRACY);
      eFont.fullFontFamily = `Exp-${Date.now()}`;

      setProgress(90);
      setRefFont(rFont);
      setExpFont(eFont);
      
      setTimeout(() => {
        setStep(AppStep.ANALYSIS);
        setIsProcessing(false);
        setProgress(100);
      }, 500);
    } catch (err) {
      console.error("Pipeline Error:", err);
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-screen dark:bg-slate-950 bg-slate-50 dark:text-slate-200 text-slate-800 overflow-hidden relative">
      <div className="absolute inset-0 bg-grid-pattern opacity-40 pointer-events-none" />
      
      {/* INDICADOR DE PROGRESSO / OVERLAY */}
      <AnimatePresence>
        {isProcessing && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 dark:bg-slate-950/95 bg-slate-50/95 backdrop-blur-md flex items-center justify-center flex-col"
          >
            <div className="relative w-32 h-32 mb-10">
              <Loader2 className="w-full h-full text-blue-500 animate-spin opacity-20" />
              <div className="absolute inset-0 flex items-center justify-center dark:bg-slate-950 bg-slate-50 rounded-full m-4 shadow-inner border dark:border-slate-800 border-slate-200">
                <span className="text-3xl font-black text-blue-400 tabular-nums">{progress}%</span>
              </div>
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 border-2 border-dashed border-blue-500/30 rounded-full"
              />
            </div>
            <h2 className="text-3xl font-black dark:text-white text-slate-900 uppercase tracking-tighter mb-2">Sincronizando Fontes</h2>
            <div className="w-72 h-1.5 dark:bg-slate-800 bg-slate-200 rounded-full overflow-hidden shadow-inner">
              <motion.div 
                className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 shadow-[0_0_15px_rgba(37,99,235,0.5)]" 
                animate={{ width: `${progress}%` }} 
              />
            </div>
            <p className="mt-6 text-xs dark:text-slate-500 text-slate-500 uppercase tracking-widest font-black animate-pulse">Alinhamento  em andamento</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HEADER */}
      <header className="flex items-center justify-between px-6 py-4 dark:bg-slate-900/50 bg-slate-100/50 backdrop-blur border-b dark:border-slate-800 border-slate-200 shrink-0 z-10 shadow-2xl">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack} 
            className="p-2 dark:hover:bg-slate-800 hover:bg-slate-200 rounded-xl transition-all dark:text-slate-500 text-slate-500 dark:hover:text-white hover:text-slate-900 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Voltar para a Página Inicial"
            title="Voltar ao Início"
          >
            <Home className="w-5 h-5" />
          </button>
          
          <div className="h-8 w-px dark:bg-slate-800 bg-slate-200 hidden md:block" />

          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-2 rounded-xl shadow-lg">
              <Activity className="w-6 h-6 dark:text-white text-slate-900" />
            </div>
            <div>
              <h1 className="text-2xl font-black dark:text-white text-slate-900 tracking-tighter uppercase leading-none flex items-center">
                <span className="text-[#000000] dark:text-[#FFFFFF]">
                  SAAME
                </span>
                <span className="text-blue-500 font-light ml-2">Compare</span>
              </h1>
              <p className="text-[11px] dark:text-slate-500 text-slate-500 uppercase tracking-widest font-bold mt-0.5 opacity-70">Análise de resultados</p>
            </div>
          </div>
        </div>
        
        {step === AppStep.ANALYSIS && (
          <button 
            onClick={() => setStep(AppStep.UPLOAD)}
            className="text-xs font-black uppercase dark:bg-slate-800 bg-slate-200 dark:hover:bg-slate-700 hover:bg-slate-300 px-6 py-2.5 rounded-full border dark:border-slate-700 border-slate-300 transition-all dark:text-white text-slate-900 tracking-widest shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Iniciar Nova Comparação"
          >
            Nova Comparação
          </button>
        )}
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto relative flex flex-col items-center justify-start p-6 custom-scrollbar">
        {step === AppStep.UPLOAD && (
          <div className="w-full max-w-5xl space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700 my-auto">
            <div className="text-center space-y-4">
              <h2 className="text-4xl md:text-5xl font-black dark:text-white text-slate-900 tracking-tighter uppercase">Seleção de Fontes</h2>
              <div className="w-20 h-1 bg-blue-500 mx-auto rounded-full" />
              <p className="dark:text-slate-500 text-slate-500 text-lg max-w-lg mx-auto font-medium leading-relaxed">Carregue um par de fontes para comparação</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              {/* SLOT REFERÊNCIA */}
              <motion.div 
                whileHover={{ scale: 1.01, y: -2 }}
                className={`p-10 rounded-[40px] border-2 transition-all duration-500 shadow-2xl relative overflow-hidden group ${refFile.buffer ? 'bg-blue-600/5 border-blue-500/40 shadow-blue-500/5' : 'dark:bg-slate-900/50 bg-slate-100/50 border-dashed dark:border-slate-800 border-slate-200'}`}
              >
                <div className="absolute top-0 right-0 p-6 opacity-20 group-hover:opacity-40 transition-opacity">
                    <Activity className="w-12 h-12 text-blue-500" />
                </div>
                <div className="flex items-center justify-between mb-8 relative z-10">
                   <span className="text-xs font-black text-blue-400 uppercase tracking-[0.3em] bg-blue-500/10 px-4 py-1.5 rounded-full border border-blue-500/20">01. Referência</span>
                  {refFile.buffer && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                        <CheckCircle2 className="w-6 h-6 text-blue-500 drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                    </motion.div>
                  )}
                </div>
                <FileUpload onFileLoaded={(b, n) => setRefFile({ buffer: b, name: n })} compact={true} />
                {refFile.name && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    className="mt-6 flex items-center gap-3 bg-blue-500/10 p-3 rounded-2xl border border-blue-500/20"
                  >
                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                    <span className="text-[11px] dark:text-white text-slate-900 font-bold tracking-tight truncate">{refFile.name}</span>
                  </motion.div>
                )}
              </motion.div>

              {/* SLOT EXPERIMENTAL */}
              <motion.div 
                whileHover={{ scale: 1.01, y: -2 }}
                className={`p-10 rounded-[40px] border-2 transition-all duration-500 shadow-2xl relative overflow-hidden group ${expFile.buffer ? 'bg-indigo-600/5 border-indigo-500/40 shadow-indigo-500/5' : 'dark:bg-slate-900/50 bg-slate-100/50 border-dashed dark:border-slate-800 border-slate-200'}`}
              >
                <div className="absolute top-0 right-0 p-6 opacity-20 group-hover:opacity-40 transition-opacity">
                    <Activity className="w-12 h-12 text-indigo-500" />
                </div>
                <div className="flex items-center justify-between mb-8 relative z-10">
                   <span className="text-xs font-black text-indigo-400 uppercase tracking-[0.3em] bg-indigo-500/10 px-4 py-1.5 rounded-full border border-indigo-500/20">02. Experimental</span>
                  {expFile.buffer && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                         <CheckCircle2 className="w-6 h-6 text-indigo-500 drop-shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
                    </motion.div>
                  )}
                </div>
                <FileUpload onFileLoaded={(b, n) => setExpFile({ buffer: b, name: n })} compact={true} />
                {expFile.name && (
                   <motion.div 
                    initial={{ opacity: 0, y: 10 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    className="mt-6 flex items-center gap-3 bg-indigo-500/10 p-3 rounded-2xl border border-indigo-500/20"
                  >
                    <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                    <span className="text-[11px] dark:text-white text-slate-900 font-bold tracking-tight truncate">{expFile.name}</span>
                  </motion.div>
                )}
              </motion.div>
            </div>

            <div className="flex justify-center pt-8 pb-10">
              <button 
                disabled={!refFile.buffer || !expFile.buffer}
                onClick={handleProcess}
                className={`group flex items-center gap-4 px-12 py-5 rounded-2xl font-black text-xl uppercase tracking-tighter transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-blue-500/50
                  ${(refFile.buffer && expFile.buffer) 
                    ? 'bg-white text-slate-950 hover:scale-105 shadow-[0_20px_50px_rgba(255,255,255,0.1)] hover:bg-blue-50' 
                    : 'dark:bg-slate-800 bg-slate-200 text-slate-600 dark:text-slate-400 cursor-not-allowed opacity-50'}`}
                aria-label="Carregar e Comparar Fontes"
              >
                Carregando comparações <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        )}

        {step === AppStep.ANALYSIS && (
          <div className="w-full h-full p-0 md:p-6 animate-in zoom-in-95 duration-700">
            <LabStyleComparisonGrid 
              fontRef={refFont}
              fontExp={expFont}
              refName={refFile.name}
              expName={expFile.name}
            />
          </div>
        )}
      </main>
    </div>
  );
};
