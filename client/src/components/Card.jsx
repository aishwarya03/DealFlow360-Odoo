import { cn } from '../lib/cn';

/* Borders over shadows — the system leans on outlines, not elevation. */
const Card = ({ children, className = '', ...props }) => {
  return (
    <div
      className={cn('rounded-lg border border-slate-200 bg-white p-6', className)}
      {...props}
    >
      {children}
    </div>
  );
};

export default Card;
