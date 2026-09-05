import { useEffect, useRef, useState } from 'react';

import { LogoMark } from './Logo';
import { cn } from '../lib/cn';

/*
 * Regular-pentagon vertex positions (percent, top vertex first, clockwise).
 * Hardcoded rather than computed with trig at render time — five fixed points,
 * no reason to recalculate them every frame.
 */
const NODE_POSITIONS = [
  { x: 50, y: 8 },
  { x: 89.9, y: 37 },
  { x: 74.7, y: 84 },
  { x: 25.3, y: 84 },
  { x: 10.1, y: 37 },
];

const ADVANCE_MS = 2600;

/**
 * The product's own loop, animated: one node highlighted at a time, advancing
 * clockwise on a timer, clickable to jump. The caption below is driven by the
 * same activeIndex, so the two always agree.
 */
const LifecycleRing = ({ stages, className = '' }) => {
  const [active, setActive] = useState(0);
  const timerRef = useRef(null);

  const restart = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setActive((i) => (i + 1) % stages.length);
    }, ADVANCE_MS);
  };

  useEffect(() => {
    restart();
    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stages.length]);

  const current = stages[active];

  return (
    <div className={cn('flex flex-col items-center', className)}>
      <div className="relative size-[clamp(220px,42vw,300px)]">
        <div className="absolute inset-4 rounded-full border-2 border-dashed border-slate-200" />

        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex size-20 items-center justify-center rounded-full bg-brand-50 sm:size-24">
            <LogoMark className="size-8 text-brand-600 sm:size-9" />
          </div>
        </div>

        {stages.map((stage, index) => {
          const isActive = index === active;
          const Icon = stage.icon;

          return (
            <button
              key={stage.label}
              type="button"
              onClick={() => {
                setActive(index);
                restart();
              }}
              aria-label={stage.label}
              aria-current={isActive}
              title={stage.label}
              style={{
                left: `${NODE_POSITIONS[index].x}%`,
                top: `${NODE_POSITIONS[index].y}%`,
              }}
              className={cn(
                'absolute flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full transition-all duration-500 sm:size-12',
                isActive
                  ? 'scale-110 bg-brand-600 text-white ring-4 ring-brand-100'
                  : 'bg-white text-slate-400 ring-1 ring-slate-200 hover:text-slate-600'
              )}
            >
              <Icon className="size-5" aria-hidden="true" />
            </button>
          );
        })}
      </div>

      <div className="mt-8 min-h-16 max-w-md text-center" aria-live="polite">
        <p className="text-xs font-medium tracking-wide text-brand-600 uppercase">
          {active + 1} / {stages.length} · {current.label}
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
          {current.caption}
        </p>
      </div>
    </div>
  );
};

export default LifecycleRing;
