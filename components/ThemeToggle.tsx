import React, { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

export const ThemeToggle: React.FC = () => {
    const [isDark, setIsDark] = useState(false);

    useEffect(() => {
        // Inicializa o state baseado na classe atual
        setIsDark(document.documentElement.classList.contains('dark'));
    }, []);

    const toggleTheme = () => {
        if (isDark) {
            document.documentElement.classList.remove('dark');
            setIsDark(false);
        } else {
            document.documentElement.classList.add('dark');
            setIsDark(true);
        }
    };

    return (
        <button 
            onClick={toggleTheme}
            className="fixed bottom-6 right-6 z-[9999] p-3 rounded-full dark:bg-slate-800 bg-white border dark:border-slate-700 border-slate-300 shadow-xl hover:scale-110 transition-transform focus:outline-none"
            title={isDark ? "Mudar para Modo Claro" : "Mudar para Modo Escuro"}
            aria-label={isDark ? "Mudar para Modo Claro" : "Mudar para Modo Escuro"}
        >
            {isDark ? (
                <Sun className="w-5 h-5 text-yellow-500" />
            ) : (
                <Moon className="w-5 h-5 text-indigo-500" />
            )}
        </button>
    );
};
