
import React, { useCallback, useState } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';

interface FileUploadProps {
  onFileLoaded: (buffer: ArrayBuffer, fileName: string) => void;
  compact?: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileLoaded, compact = false }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileSelected, setFileSelected] = useState<string | null>(null);

  const processFile = (file: File) => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (extension !== 'otf' && extension !== 'ttf') {
      setError('Formato inválido. Use arquivos .otf ou .ttf');
      setFileSelected(null);
      return;
    }

    setError(null);
    setFileSelected(file.name);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        onFileLoaded(e.target.result as ArrayBuffer, file.name);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) processFile(file);
  }, [onFileLoaded]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  return (
    <div 
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative flex flex-col items-center justify-center ${compact ? 'h-auto py-8' : 'min-h-[300px] h-[40vh] md:h-[50vh]'} border-2 border-dashed transition-all duration-300 rounded-3xl ${
        isDragging 
          ? 'border-blue-500 bg-blue-500/10 scale-[1.02] shadow-[0_0_30px_rgba(59,130,246,0.1)]' 
          : error 
          ? 'border-red-500/50 bg-red-500/5' 
          : 'dark:border-slate-800 border-slate-200 dark:bg-slate-900/40 bg-slate-100/40 dark:hover:bg-slate-900/60 hover:bg-slate-100/60 dark:hover:border-slate-700 hover:border-slate-300'
      }`}
    >
      <div className={`text-center ${compact ? 'p-4' : 'p-8'} flex flex-col items-center`}>
        <div className={`transition-all duration-500 rounded-2xl inline-flex p-4 mb-6 ${
          error ? 'bg-red-500/10 text-red-400' : 
          fileSelected ? 'bg-green-500/10 text-green-400' :
          'dark:bg-slate-800 bg-slate-200 text-blue-400'
        }`}>
          {error ? <AlertCircle className="w-8 h-8" /> : 
           fileSelected ? <CheckCircle2 className="w-8 h-8 animate-bounce" /> :
           <Upload className="w-8 h-8" />}
        </div>
        
        <h3 className="text-2xl font-black dark:text-white text-slate-900 mb-2 tracking-tight">
          {fileSelected ? 'Fonte Carregada!' : 'Importar Fontes'}
        </h3>
        
        <p className="dark:text-slate-500 text-slate-500 mb-8 max-w-xs text-base font-medium leading-relaxed">
          {error ? error : 
           fileSelected ? `Pronto para processar: ${fileSelected}` :
           'Arraste o arquivo ou clique para selecionar. Formatos .otf e .ttf suportados.'}
        </p>
        
        {!fileSelected && (
          <label 
            className="cursor-pointer bg-blue-600 hover:bg-blue-500 text-white font-black py-3 px-10 rounded-xl transition-all shadow-xl shadow-blue-600/20 text-base uppercase tracking-widest transform hover:scale-105 active:scale-95 focus-within:ring-4 focus-within:ring-blue-500/50 outline-none"
            title="Selecionar arquivo de fonte"
          >
            <span>Selecionar Arquivo</span>
            <input 
              type="file" 
              accept=".otf,.ttf" 
              className="sr-only" 
              onChange={handleFileChange}
              aria-label="Selecionar arquivo de fonte (.otf ou .ttf)"
            />
          </label>
        )}

        {fileSelected && !error && (
          <div className="flex items-center gap-2 text-xs text-green-400 font-bold uppercase tracking-widest bg-green-400/5 px-4 py-2 rounded-full border border-green-400/10">
            Arquivo validado com sucesso
          </div>
        )}
      </div>
    </div>
  );
};
