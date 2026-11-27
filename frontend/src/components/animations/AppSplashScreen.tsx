import React, { useEffect, useState } from 'react';
import { MagnosFarmaLogo } from '../brand/MagnosFarmaLogo';

export interface AppSplashScreenProps {
  onComplete?: () => void;
  minDurationMs?: number;
  initialStepMessage?: string;
}

export const AppSplashScreen: React.FC<AppSplashScreenProps> = ({
  onComplete,
  minDurationMs = 2800,
  initialStepMessage = 'Iniciando módulos centrais do FarmaCore ERP...',
}) => {
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState(initialStepMessage);
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    const steps = [
      { at: 15, msg: 'Iniciando módulos centrais e subsistemas...' },
      { at: 35, msg: 'Conectando ao banco de dados SQLite local...' },
      { at: 65, msg: 'Carregando catálogo mestre (40.247 produtos Magnos Farma)...' },
      { at: 85, msg: 'Sincronizando modo de estação (Servidor / Terminal)...' },
      { at: 98, msg: 'Verificando segurança e periféricos de balcão...' },
      { at: 100, msg: 'Sistema pronto para operar!' },
    ];

    let current = 0;
    const intervalTime = Math.max(10, Math.floor(minDurationMs / 100));
    const interval = setInterval(() => {
      current += 1;
      const val = Math.min(current, 100);
      setProgress(val);
      const currentStep = steps.find((s) => s.at === val);
      if (currentStep) {
        setStatusMessage(currentStep.msg);
      }
      if (val >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          setIsFadingOut(true);
          setTimeout(() => {
            if (onComplete) onComplete();
          }, 500);
        }, 350);
      }
    }, intervalTime);

    return () => clearInterval(interval);
  }, [minDurationMs, onComplete]);

  return (
    <div
      data-testid="app-splash-screen"
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0B1528] text-white transition-opacity duration-500 select-none overflow-hidden ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Luz ambiente em gradiente radial ao fundo */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(0,168,232,0.15),transparent_70%)] pointer-events-none" />

      {/* Partículas / Efeito de grade suave */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)',
          backgroundSize: '36px 36px',
        }}
      />

      <div className="relative z-10 flex flex-col items-center max-w-md w-full px-8 text-center">
        {/* Logo Pulsante com Efeito Glow */}
        <div className="relative mb-8 transform transition-transform duration-700 animate-pulse">
          <div className="absolute -inset-4 bg-gradient-to-r from-cyan-500/20 to-emerald-500/20 rounded-full blur-xl" />
          <MagnosFarmaLogo size="xl" variant="white" showSubtitle={true} />
        </div>

        {/* Contador de Porcentagem Numérico */}
        <div className="flex items-baseline justify-center gap-1 mb-3">
          <span
            data-testid="splash-percentage"
            className="text-4xl font-extrabold tracking-tight font-mono text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-emerald-400"
          >
            {progress}
          </span>
          <span className="text-xl font-bold font-mono text-cyan-400">%</span>
        </div>

        {/* Barra de Progresso com Runner Fluido */}
        <div className="w-full bg-slate-800/80 rounded-full h-2.5 p-0.5 border border-slate-700/60 shadow-inner mb-4 overflow-hidden relative">
          <div
            data-testid="splash-progress-bar"
            className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-sky-400 to-emerald-400 transition-all duration-150 ease-out shadow-[0_0_12px_rgba(0,168,232,0.6)] relative"
            style={{ width: `${progress}%` }}
          >
            {/* Brilho móvel na ponta da barra */}
            <div className="absolute right-0 top-0 bottom-0 w-2 bg-white rounded-full blur-[1px]" />
          </div>
        </div>

        {/* Mensagem de Etapa Atual */}
        <div className="h-6 flex items-center justify-center">
          <p
            data-testid="splash-status-message"
            className="text-xs font-medium text-slate-300 tracking-wide transition-all duration-300 animate-fade-in"
          >
            {statusMessage}
          </p>
        </div>

        {/* Rodapé institucional com versão e farmácia */}
        <div className="mt-12 flex items-center gap-2 text-[10px] text-slate-500 uppercase tracking-widest font-mono">
          <span>Versão 1.82.24</span>
          <span>•</span>
          <span>Magnos Farma Matriz</span>
          <span>•</span>
          <span className="text-emerald-500 font-semibold">Online</span>
        </div>
      </div>
    </div>
  );
};
