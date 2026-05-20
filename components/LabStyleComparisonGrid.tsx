
import React from 'react';
import { FontState, MethodType } from '../types';
import { AnalysisCanvas } from './AnalysisCanvas';

interface LabStyleComparisonGridProps {
  fontRef: FontState | null;
  fontExp: FontState | null;
  refName?: string;
  expName?: string;
}

export const LabStyleComparisonGrid: React.FC<LabStyleComparisonGridProps> = ({
  fontRef,
  fontExp,
  refName,
  expName
}) => {
  // Font mapping for AnalysisCanvas:
  // MethodType.ORIGINAL -> Original Reference
  // MethodType.TRACY -> Adjusted Specimen (Experimental)
  // MethodType.SOUSA -> Ignored in Compare mode
  const fontsMap = {
    [MethodType.ORIGINAL]: fontRef,
    [MethodType.TRACY]: fontExp,
    [MethodType.SOUSA]: null,
  };

  return (
    <div className="h-full bg-white dark:bg-[#0d1117] border dark:border-gray-800 border-gray-200 rounded-lg overflow-hidden shadow-2xl">
        <AnalysisCanvas 
            fonts={fontsMap} 
            isCompareMode={true} 
            customLabels={{
                original: refName || 'Referência',
                tracy: expName || 'Experimental'
            }}
        />
    </div>
  );
};
