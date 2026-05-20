import React, { useMemo } from 'react';
import { MethodType, FontState } from '../types';
import { getCharMetrics } from '../services/fontService';

interface SequenceVisualizerProps {
    text: string;
    font: FontState | null;
    method: MethodType;
    targetChar: string;
    lsb: number;
    rsb: number;
}

export const SequenceVisualizer: React.FC<SequenceVisualizerProps> = ({ text, font, method, targetChar, lsb, rsb }) => {
    return useMemo(() => {
        if (!font || !font.fontObj) return null;

        const upm = font.metrics.unitsPerEm || 1000;
        
        const getGlyphData = (c: string) => {
            try {
                const g = font.fontObj!.charToGlyph(c);
                const box = g.getBoundingBox();
                const path = g.getPath(0, 0, upm);
                const m = getCharMetrics(font.fontObj!, c);
                
                const isTarget = c === targetChar;
                return { 
                    pathData: path.toPathData(2), 
                    xMin: box.x1, 
                    xMax: box.x2,
                    lsb: isTarget ? lsb : m.lsb,
                    rsb: isTarget ? rsb : m.rsb
                };
            } catch (e) { return null; }
        };

        const sequenceData = text.split('').map(getGlyphData).filter(Boolean) as any[];
        
        let curX = 0;
        const seqWithPos = sequenceData.map(data => {
            const adv = data.lsb + (data.xMax - data.xMin) + data.rsb;
            const x = curX;
            curX += adv;
            return { data, x };
        });

        const totalW = curX;
        
        const getMethodColor = (m: MethodType) => {
            switch(m) {
                case MethodType.TRACY: return '#EC4899';
                case MethodType.SOUSA: return '#22D3EE';
                case MethodType.ORIGINAL_CUSTOM: return '#60A5FA';
                default: return '#94A3B8';
            }
        };

        return (
            <svg viewBox={`0 ${-upm * 0.75} ${totalW} ${upm * 1.0}`} className="h-full w-full overflow-visible drop-shadow-lg">
                {seqWithPos.map((item, i) => (
                    <path 
                        key={i}
                        d={item.data.pathData}
                        fill={item.data.lsb === lsb && item.data.rsb === rsb ? getMethodColor(method) : '#64748b'}
                        fillOpacity={item.data.lsb === lsb && item.data.rsb === rsb ? 1 : 0.4}
                        transform={`translate(${item.x + item.data.lsb - item.data.xMin}, 0)`}
                    />
                ))}
            </svg>
        );
    }, [text, font, method, targetChar, lsb, rsb]);
};
