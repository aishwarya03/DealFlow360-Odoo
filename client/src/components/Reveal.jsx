import { useReveal } from '../hooks/useReveal';
import { cn } from '../lib/cn';

/** Wrap any section/tile in this for a one-time fade+rise as it enters the viewport. */
const Reveal = ({ children, className = '', delay = 0 }) => {
  const [ref, visible] = useReveal();

  return (
    <div
      ref={ref}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      className={cn(
        'transition-all duration-700 ease-out',
        visible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0',
        className
      )}
    >
      {children}
    </div>
  );
};

export default Reveal;
