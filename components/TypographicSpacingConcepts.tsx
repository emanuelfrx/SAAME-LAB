import React from 'react';
import { Layout, Maximize2, Zap, Circle } from 'lucide-react';
import { motion } from 'motion/react';

const SideBearingsVisual: React.FC = () => (
  <div className="w-full dark:bg-slate-950/40 bg-slate-50/40 rounded-xl p-8 flex flex-col items-center justify-center gap-6 min-h-[220px] overflow-hidden border dark:border-slate-800/50 border-slate-200/50">
    <div className="relative flex items-end">
      <motion.div 
        animate={{ width: [50, 25, 75, 50], opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="h-32 bg-blue-500/20 border-x border-blue-500/40 flex items-center justify-center relative group"
      >
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-6 text-xs font-black text-blue-400">LSB</div>
      </motion.div>

      <div className="h-32 w-16 bg-white flex items-center justify-center relative z-10 shadow-2xl">
        <span className="text-7xl font-serif font-black text-slate-900 select-none">H</span>
      </div>

      <motion.div 
        animate={{ width: [50, 75, 25, 50], opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="h-32 bg-blue-500/20 border-r border-blue-500/40 flex items-center justify-center relative group"
      >
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-6 text-xs font-black text-blue-400">RSB</div>
      </motion.div>
    </div>
    <div className="mt-4 px-4 py-1.5 bg-blue-500/10 rounded border border-blue-500/20 text-xs font-black text-blue-400 uppercase tracking-[0.2em]">
      Margens Dinâmicas de Segurança
    </div>
  </div>
);

const VisualRhythmVisual: React.FC = () => (
  <div className="w-full dark:bg-slate-950/40 bg-slate-50/40 rounded-xl p-8 flex flex-col items-center justify-center gap-8 min-h-[220px] overflow-hidden border dark:border-slate-800/50 border-slate-200/50">
    <div className="flex items-end gap-4 scale-110">
      <div className="flex items-end dark:bg-slate-900/50 bg-slate-100/50 p-2 rounded border dark:border-slate-800 border-slate-200 shadow-xl">
        <div className="h-20 w-8 bg-yellow-500/10 border-l border-yellow-500/30" />
        <div className="h-20 w-12 bg-slate-200 flex items-center justify-center text-4xl font-serif font-black text-slate-900">H</div>
        <div className="h-20 w-8 bg-yellow-500/10 border-r border-yellow-500/30" />
      </div>
      
      <div className="flex items-end dark:bg-slate-900/50 bg-slate-100/50 p-2 rounded border dark:border-slate-800 border-slate-200 shadow-xl">
        <motion.div 
          animate={{ width: [16, 8, 16] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="h-20 bg-yellow-400/40 border-l border-yellow-400/60" 
        />
        <div className="h-20 w-14 bg-slate-400 flex items-center justify-center text-4xl font-serif font-black text-slate-900 rounded-full">O</div>
        <motion.div 
          animate={{ width: [16, 8, 16] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="h-20 bg-yellow-400/40 border-r border-yellow-400/60" 
        />
      </div>
    </div>
    <p className="text-[11px] font-black text-yellow-500 uppercase tracking-[0.3em] italic">
      Equilíbrio Óptico: Curvas exigem menos espaço
    </p>
  </div>
);

const AdvanceWidthVisual: React.FC = () => (
  <div className="w-full dark:bg-slate-950/40 bg-slate-50/40 rounded-xl p-8 flex flex-col items-center justify-center gap-8 min-h-[220px] overflow-hidden border dark:border-slate-800/50 border-slate-200/50">
    <div className="relative scale-110">
      <div className="flex items-end">
        <div className="h-24 w-6 bg-green-500/10 border-l border-green-500/30" />
        <div className="h-24 w-16 bg-white flex items-center justify-center text-6xl font-serif font-black text-slate-900">n</div>
        <div className="h-24 w-10 bg-green-500/10 border-r border-green-500/30" />
      </div>
      <motion.div 
        animate={{ scaleX: [0, 1], opacity: [0, 1, 1, 0] }}
        transition={{ duration: 4, repeat: Infinity, times: [0, 0.4, 0.8, 1] }}
        className="absolute -bottom-8 left-0 right-0 h-2 bg-green-500 shadow-[0_0_20px_rgba(34,197,94,0.5)] origin-left rounded-full"
      >
        <div className="absolute left-0 -top-2 w-[3px] h-6 bg-green-400 rounded-full" />
        <div className="absolute right-0 -top-2 w-[3px] h-6 bg-green-400 rounded-full" />
      </motion.div>
    </div>
    <div className="mt-6 text-base font-mono text-green-400 flex items-center gap-4">
      <span className="font-black text-[11px] text-green-500 bg-green-500/15 px-3 py-1 rounded-md">ADVANCE WIDTH</span>
      <span className="font-bold tracking-tight">Σ LSB + BODY + RSB</span>
    </div>
  </div>
);

const NegativeSpaceVisual: React.FC = () => (
  <div className="w-full dark:bg-slate-950/40 bg-slate-50/40 rounded-xl p-8 flex flex-col items-center justify-center gap-8 min-h-[220px] overflow-hidden border dark:border-slate-800/50 border-slate-200/50">
    <div className="relative scale-110">
      <span className="text-9xl font-serif font-black dark:text-slate-200 text-slate-800 drop-shadow-[0_30px_60px_rgba(0,0,0,0.6)]">B</span>
      <motion.div 
        animate={{ opacity: [0.2, 0.7, 0.2], scale: [0.8, 1.1, 0.8] }}
        transition={{ duration: 3, repeat: Infinity }}
        className="absolute top-[22%] left-[38%] w-8 h-8 bg-purple-500/50 rounded-full blur-xl"
      />
      <motion.div 
        animate={{ opacity: [0.2, 0.7, 0.2], scale: [0.8, 1.1, 0.8] }}
        transition={{ duration: 3, repeat: Infinity, delay: 1.5 }}
        className="absolute bottom-[22%] left-[38%] w-10 h-10 bg-purple-500/50 rounded-full blur-xl"
      />
    </div>
    <div className="bg-purple-500/15 px-5 py-1.5 rounded-lg border border-purple-500/30 flex items-center gap-3">
      <Circle className="w-4 h-4 text-purple-400 fill-purple-400/20" />
      <span className="text-[11px] font-black text-purple-400 uppercase tracking-[0.25em]">Gestão de Contraformas</span>
    </div>
  </div>
);

const FontComparisonVisual: React.FC = () => {
  const [isCustom, setIsCustom] = React.useState(false);

  return (
    <div className="w-full dark:bg-slate-950/40 bg-slate-50/40 rounded-xl p-6 flex flex-col items-center justify-center gap-6 min-h-[220px] overflow-hidden border dark:border-slate-800/50 border-slate-200/50 relative">
      <button
        onClick={() => setIsCustom(!isCustom)}
        className="absolute top-4 right-4 px-4 py-2 dark:bg-slate-800/80 bg-slate-200/80 dark:hover:bg-slate-700 hover:bg-slate-300 text-xs font-black uppercase tracking-[0.2em] text-cyan-600 dark:text-cyan-400 rounded-full transition-all duration-300 border dark:border-slate-600 border-slate-300 shadow-[0_0_10px_rgba(34,211,238,0.1)] z-20"
      >
        {isCustom ? 'Métrica Original' : 'Aplicar Ajuste Sistemático'}
      </button>

      <div className="relative w-full flex items-center justify-center h-32">
        {/* Fonte Padrão - Desalinhada */}
        <motion.div
          initial={false}
          animate={{ opacity: isCustom ? 0 : 1, scale: isCustom ? 0.95 : 1, filter: isCustom ? 'blur(4px)' : 'blur(0px)' }}
          transition={{ duration: 0.4, ease: "easeInOut" }}
          className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
        >
          <div className="flex gap-4 text-5xl font-serif dark:text-slate-400 text-slate-600 select-none">
            <span>T</span><span className="ml-2">y</span><span>p</span><span className="ml-3">e</span>
          </div>
          <span className="mt-4 text-[11px] text-red-500 uppercase tracking-widest font-mono font-black">Métricas Mecânicas e Irregulares</span>
        </motion.div>

        {/* Fonte Customizada - Ajuste Óptico Ativo */}
        <motion.div
          initial={false}
          animate={{ opacity: isCustom ? 1 : 0, scale: isCustom ? 1 : 1.05, filter: isCustom ? 'blur(4px)' : 'blur(0px)' }}
          transition={{ duration: 0.4, ease: "easeInOut" }}
          className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
        >
          <div className="flex text-5xl font-serif font-black dark:text-slate-100 text-slate-900 tracking-tight drop-shadow-[0_0_25px_rgba(34,211,238,0.25)] select-none">
            Type
          </div>
          <span className="mt-4 text-[11px] text-cyan-600 dark:text-cyan-400 uppercase tracking-widest font-mono font-black drop-shadow-[0_0_8px_rgba(34,211,238,0.3)]">
            Ritmo Óptico Sistemático Estabelecido
          </span>
        </motion.div>
      </div>
    </div>
  );
};

export const TypographicSpacingConcepts: React.FC = () => {
  return (
    <div className="space-y-8 pb-20">
      <div className="grid grid-cols-1 gap-8">
        {/* Side Bearings */}
        <section className="dark:bg-slate-900/20 bg-slate-100/20 p-10 rounded-3xl border dark:border-slate-800/50 border-slate-200/50 hover:border-blue-500/20 transition-all duration-500">
          <div className="flex flex-col gap-10">
            <div className="space-y-6">
              <div className="flex items-center gap-4 text-blue-400">
                <Layout className="w-6 h-6" />
                <h4 className="text-2xl font-black uppercase tracking-[0.25em] italic">Side Bearings</h4>
              </div>
              <p className="dark:text-slate-300 text-slate-700 text-lg leading-relaxed font-medium">
                São as margens laterais invisíveis que protegem cada glifo. O <strong>LSB</strong> (Left Side Bearing) define o espaço à esquerda e o <strong>RSB</strong> (Right Side Bearing) à direita. Elas funcionam como amortecedores que impedem que as letras colidam, estabelecendo a "zona de conforto" visual de cada caractere.
              </p>
            </div>
            <SideBearingsVisual />
          </div>
        </section>

        {/* Ritmo Visual */}
        <section className="dark:bg-slate-900/20 bg-slate-100/20 p-10 rounded-3xl border dark:border-slate-800/50 border-slate-200/50 hover:border-yellow-500/20 transition-all duration-500">
          <div className="flex flex-col gap-10">
            <div className="space-y-6">
              <div className="flex items-center gap-4 text-yellow-500">
                <Zap className="w-6 h-6" />
                <h4 className="text-2xl font-black uppercase tracking-[0.25em] italic">Ritmo Visual</h4>
              </div>
              <p className="dark:text-slate-300 text-slate-700 text-lg leading-relaxed font-medium">
                Tipografia é ritmo. Letras com formas retas (como o 'H') precisam de mais espaço lateral, pois suas paredes são sólidas. Formas circulares (como o 'O') precisam de menos espaço, pois o branco "vaza" pelas curvas, enganando o olho. O objetivo é criar um fluxo uniforme onde nenhuma letra pareça "saltar" ou estar isolada.
              </p>
            </div>
            <VisualRhythmVisual />
          </div>
        </section>

        {/* Advance Width */}
        <section className="dark:bg-slate-900/20 bg-slate-100/20 p-10 rounded-3xl border dark:border-slate-800/50 border-slate-200/50 hover:border-green-500/20 transition-all duration-500">
          <div className="flex flex-col gap-10">
            <div className="space-y-6">
              <div className="flex items-center gap-4 text-green-500">
                <Maximize2 className="w-6 h-6" />
                <h4 className="text-2xl font-black uppercase tracking-[0.25em] italic">Advance Width</h4>
              </div>
              <p className="dark:text-slate-300 text-slate-700 text-lg leading-relaxed font-medium">
                É a medida pragmática da fonte. Representa a largura total que o caractere ocupa na linha horizontal (LSB + Largura do Desenho + RSB). Quando você digita uma letra, é o Advance Width que diz ao computador exatamente onde a próxima letra deve começar a ser desenhada.
              </p>
            </div>
            <AdvanceWidthVisual />
          </div>
        </section>

        {/* Contraformas */}
        <section className="dark:bg-slate-900/20 bg-slate-100/20 p-10 rounded-3xl border dark:border-slate-800/50 border-slate-200/50 hover:border-purple-500/20 transition-all duration-500">
          <div className="flex flex-col gap-10">
            <div className="space-y-6">
              <div className="flex items-center gap-4 text-purple-400">
                <Circle className="w-6 h-6" />
                <h4 className="text-2xl font-black uppercase tracking-[0.25em] italic">Contraforma</h4>
              </div>
              <p className="dark:text-slate-300 text-slate-700 text-lg leading-relaxed font-medium">
                O espaço interno de letras como 'B', 'P' ou 'O'. O bom fitting exige que o volume de branco das contraformas esteja em sintonia com o volume de branco dos side bearings. Se o interior for muito aberto e o exterior muito apertado, a letra parecerá "estourar" na página.
              </p>
            </div>
            <NegativeSpaceVisual />
          </div>
        </section>

        {/* Comparação Prática (Ajustada) */}
        <section className="dark:bg-slate-900/20 bg-slate-100/20 p-10 rounded-3xl border dark:border-slate-800/50 border-slate-200/50 hover:border-cyan-500/20 transition-all duration-500">
          <div className="flex flex-col gap-10">
            <div className="space-y-6">
              <div className="flex items-center gap-4 text-cyan-400">
                <Layout className="w-6 h-6" />
                <h4 className="text-2xl font-black uppercase tracking-[0.25em] italic">Original vs. Ajustada</h4>
              </div>
              <p className="dark:text-slate-300 text-slate-700 text-lg leading-relaxed font-medium">
                Demonstração prática do impacto de um método sistemático de espaçamento. O ajuste óptico estabiliza a palavra eliminando buracos visuais e tensões desnecessárias entre os glifos.
              </p>
            </div>
            <FontComparisonVisual />
          </div>
        </section>
      </div>
    </div>
  );
};