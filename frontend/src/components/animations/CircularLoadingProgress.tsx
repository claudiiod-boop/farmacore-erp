import React from 'react';

export interface CircularLoadingProgressProps {
  progress?: number; // 0 to 100, if omitted renders indeterminate spinner
  size?: number;
  strokeWidth?: number;
  label?: string;
  sublabel?: string;
  className?: string;
}

export const CircularLoadingProgress: React.FC<CircularLoadingProgressProps> = ({
  progress,
  size = 80,
  strokeWidth = 6,
  label,
  sublabel,
  className = '',
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const isDeterminate = typeof progress === 'number' && !isNaN(progress);
  const clampedProgress = isDeterminate ? Math.min(Math.max(progress, 0), 100) : 0;
  const strokeDashoffset = circumference - (clampedProgress / 100) * circumference;

  return (
    <div
      data-testid="circular-loading-progress"
      className={`flex flex-col items-center justify-center gap-2 select-none ${className}`}
    >
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          {/* Círculo de trilho cinza */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#E2E8F0"
            strokeWidth={strokeWidth}
            fill="transparent"
          />

          {/* Círculo de progresso em gradiente */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="url(#circularGrad)"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={isDeterminate ? strokeDashoffset : circumference * 0.75}
            strokeLinecap="round"
            fill="transparent"
            className={isDeterminate ? 'transition-all duration-300 ease-out' : 'animate-spin origin-center'}
          />

          <defs>
            <linearGradient id="circularGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00A8E8" />
              <stop offset="100%" stopColor="#10B981" />
            </linearGradient>
          </defs>
        </svg>

        {/* Valor do Percentual no Centro */}
        <div className="absolute inset-0 flex flex-col items-center justify-center font-mono">
          {isDeterminate ? (
            <div className="flex items-baseline">
              <span className="text-sm font-bold text-slate-800">{Math.round(clampedProgress)}</span>
              <span className="text-[10px] font-semibold text-slate-500">%</span>
            </div>
          ) : (
            <div className="w-2.5 h-2.5 rounded-full bg-cyan-500 animate-ping" />
          )}
        </div>
      </div>

      {label && <p className="text-xs font-semibold text-slate-700 tracking-tight">{label}</p>}
      {sublabel && <p className="text-[11px] text-slate-500">{sublabel}</p>}
    </div>
  );
};
