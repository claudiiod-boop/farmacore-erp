import React from 'react';

export interface MagnosFarmaLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'full' | 'icon' | 'white';
  showSubtitle?: boolean;
  className?: string;
}

export const MagnosFarmaLogo: React.FC<MagnosFarmaLogoProps> = ({
  size = 'md',
  variant = 'full',
  showSubtitle = true,
  className = '',
}) => {
  const sizeMap = {
    sm: { icon: 32, textTitle: 'text-base', textSub: 'text-[9px]', spacing: 'gap-2' },
    md: { icon: 42, textTitle: 'text-xl', textSub: 'text-[11px]', spacing: 'gap-3' },
    lg: { icon: 56, textTitle: 'text-2xl', textSub: 'text-xs', spacing: 'gap-3.5' },
    xl: { icon: 72, textTitle: 'text-3xl', textSub: 'text-sm', spacing: 'gap-4' },
  };

  const { icon: iconSize, textTitle, textSub, spacing } = sizeMap[size];
  const isWhite = variant === 'white';

  return (
    <div className={`flex items-center ${spacing} select-none ${className}`} data-testid="magnos-farma-logo">
      {/* Emblema Vetorial: Cruz Farmacêutica Moderna com Folha Biológica e Núcleo Dinâmico */}
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="flex-shrink-0 drop-shadow-sm transition-transform duration-300 hover:scale-105"
      >
        <defs>
          <linearGradient id="mfGradPrimary" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00A8E8" />
            <stop offset="50%" stopColor="#0284C7" />
            <stop offset="100%" stopColor="#0F2042" />
          </linearGradient>

          <linearGradient id="mfGradEmerald" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#10B981" />
            <stop offset="100%" stopColor="#34D399" />
          </linearGradient>

          <linearGradient id="mfGradGlow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#10B981" stopOpacity="0.8" />
          </linearGradient>

          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Fundo suave circular para contraste */}
        <circle cx="50" cy="50" r="48" fill={isWhite ? 'rgba(255,255,255,0.08)' : 'rgba(0,168,232,0.06)'} />

        {/* Cruz Farmacêutica Arredondada - Braço Horizontal */}
        <rect
          x="12"
          y="34"
          width="76"
          height="32"
          rx="16"
          fill={isWhite ? 'url(#mfGradGlow)' : 'url(#mfGradPrimary)'}
        />

        {/* Cruz Farmacêutica Arredondada - Braço Vertical */}
        <rect
          x="34"
          y="12"
          width="32"
          height="76"
          rx="16"
          fill={isWhite ? 'url(#mfGradGlow)' : 'url(#mfGradPrimary)'}
        />

        {/* Núcleo Central: Folha e Dinâmica de Saúde Integrada */}
        <path
          d="M 50 24 C 64 24 74 38 74 52 C 74 68 58 76 50 76 C 42 76 26 68 26 52 C 26 38 36 24 50 24 Z"
          fill="url(#mfGradEmerald)"
          opacity="0.95"
        />

        {/* Nervura da Folha / Símbolo de Tecnologia da Saúde */}
        <path
          d="M 50 30 Q 52 48 62 60 M 50 44 Q 44 50 40 56"
          stroke="#FFFFFF"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Ponto de Precisão / Conexão Farmacêutica */}
        <circle cx="50" cy="38" r="4" fill="#FFFFFF" filter="url(#glow)" />
      </svg>

      {/* Tipografia da Marca */}
      {variant !== 'icon' && (
        <div className="flex flex-col leading-none">
          <div className="flex items-center gap-1.5">
            <span
              className={`font-semibold tracking-wider ${textTitle} ${
                isWhite ? 'text-white' : 'text-slate-800'
              }`}
            >
              MAGNOS
            </span>
            <span
              className={`font-black tracking-tight ${textTitle} ${
                isWhite ? 'text-cyan-400' : 'text-cyan-600'
              }`}
            >
              FARMA
            </span>
          </div>

          {showSubtitle && (
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className={`font-bold tracking-widest uppercase ${textSub} ${
                  isWhite ? 'text-emerald-400' : 'text-emerald-600'
                }`}
              >
                FARMACORE
              </span>
              <span className={`text-[10px] ${isWhite ? 'text-slate-400' : 'text-slate-400'}`}>•</span>
              <span
                className={`font-medium tracking-wide uppercase ${textSub} ${
                  isWhite ? 'text-slate-300' : 'text-slate-500'
                }`}
              >
                ERP & PDV
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
