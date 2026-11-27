import React from 'react';

export interface TableSkeletonLoaderProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export const TableSkeletonLoader: React.FC<TableSkeletonLoaderProps> = ({
  rows = 5,
  columns = 6,
  className = '',
}) => {
  return (
    <div
      data-testid="table-skeleton-loader"
      className={`w-full divide-y divide-slate-100 overflow-hidden ${className}`}
    >
      {Array.from({ length: rows }).map((_, rIdx) => (
        <div key={rIdx} className="flex items-center gap-4 px-4 py-3 animate-pulse">
          {Array.from({ length: columns }).map((_, cIdx) => (
            <div
              key={cIdx}
              className="h-4 bg-slate-200 rounded"
              style={{
                width: cIdx === 0 ? '60px' : cIdx === 1 ? '35%' : `${Math.floor(Math.random() * 20 + 10)}%`,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
};
