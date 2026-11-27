import React, { useEffect, useState } from 'react';

export interface TopLoadingBarProps {
  isLoading: boolean;
  className?: string;
}

export const TopLoadingBar: React.FC<TopLoadingBarProps> = ({ isLoading, className = '' }) => {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;

    if (isLoading) {
      setVisible(true);
      setProgress(15);

      timer = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) return prev;
          const jump = Math.random() * 15 + 5;
          return Math.min(prev + jump, 90);
        });
      }, 200);
    } else {
      setProgress(100);
      const hideTimeout = setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 300);
      return () => clearTimeout(hideTimeout);
    }

    return () => clearInterval(timer);
  }, [isLoading]);

  if (!visible) return null;

  return (
    <div
      data-testid="top-loading-bar"
      className={`fixed top-0 left-0 right-0 z-50 h-[3px] bg-transparent overflow-hidden ${className}`}
    >
      <div
        className="h-full bg-gradient-to-r from-cyan-400 via-sky-500 to-emerald-400 transition-all duration-200 ease-out shadow-[0_0_8px_rgba(0,168,232,0.8)]"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
};
