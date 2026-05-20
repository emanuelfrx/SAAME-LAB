
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Info } from 'lucide-react';

interface TheoreticalTooltipProps {
  content: string;
  side?: 'top' | 'bottom';
}

export const TheoreticalTooltip: React.FC<TheoreticalTooltipProps> = ({ content, side = 'top' }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const containerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (isVisible && containerRef.current && tooltipRef.current) {
      const rect = tooltipRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const padding = 16;
      
      let leftOffset = 0;
      
      if (rect.right > viewportWidth - padding) {
        leftOffset = - (rect.right - (viewportWidth - padding));
      } else if (rect.left < padding) {
        leftOffset = padding - rect.left;
      }
      
      if (leftOffset !== 0) {
        setTooltipStyle({ transform: `translateX(calc(-50% + ${leftOffset}px))` });
      } else {
        setTooltipStyle({});
      }
    }
  }, [isVisible]);

  return (
    <span className="relative inline-block ml-1.5 align-middle group" ref={containerRef}>
      <span
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onClick={(e) => {
          e.stopPropagation();
          setIsVisible(!isVisible);
        }}
        className="p-0.5 dark:text-slate-500 text-slate-500 hover:text-blue-400 transition-colors cursor-help inline-flex"
      >
        <Info className="w-3.5 h-3.5" />
      </span>

      <AnimatePresence>
        {isVisible && (
          <motion.span
            ref={tooltipRef}
            initial={{ opacity: 0, scale: 0.95, y: side === 'top' ? 10 : -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: side === 'top' ? 10 : -10 }}
            style={tooltipStyle}
            className={`absolute z-[100] left-1/2 -translate-x-1/2 ${
              side === 'top' ? 'top-full mt-2' : 'bottom-full mb-3'
            } w-[min(280px,85vw)] p-4 dark:bg-slate-950 bg-slate-50 border dark:border-slate-700 border-slate-300 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] pointer-events-auto`}
          >
            <span className="text-xs font-black uppercase tracking-[0.15em] text-blue-400 mb-2 block border-b dark:border-slate-800 border-slate-200 pb-2 flex items-center justify-between">
              Fundamento Tipográfico
              <span 
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsVisible(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.stopPropagation();
                    setIsVisible(false);
                  }
                }}
                className="p-1 dark:hover:bg-slate-800 hover:bg-slate-200 rounded-lg transition-colors border border-transparent dark:hover:border-slate-700 hover:border-slate-300 cursor-pointer"
              >
                <Info className="w-2.5 h-2.5 opacity-40" />
              </span>
            </span>
            <span className="text-[11px] leading-relaxed dark:text-slate-200 text-slate-800 font-medium block whitespace-normal">
              {content}
            </span>
            <span className={`absolute ${
              side === 'top' ? 'bottom-full mb-[-6px]' : 'top-full mt-[-6px]'
            } left-1/2 -translate-x-1/2 w-3 h-3 dark:bg-slate-950 bg-slate-50 border-l border-t dark:border-slate-700 border-slate-300 rotate-45 pointer-events-none`} 
            style={{ 
              marginLeft: tooltipStyle.transform ? `calc(${tooltipStyle.transform.split(' + ')[1].replace('px))', '')} * -1)` : undefined 
            }}
            />
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
};
