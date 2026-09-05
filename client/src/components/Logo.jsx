import { cn } from '../lib/cn';

/*
 * The mark is the product's own loop:
 * Quote -> Approve -> Fulfil -> Bill -> Negotiate -> back to Quote.
 */
export const LogoMark = ({ className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
    className={cn('size-6', className)}
  >
    <path
      d="M20.5 12a8.5 8.5 0 1 1-2.9-6.4"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
    />
    <path
      d="M20.7 3.6v5.1h-5.1"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="12" cy="12" r="2.75" fill="currentColor" />
  </svg>
);

const Logo = ({ wordmark = true, className = '', markClassName = '' }) => (
  <span className={cn('inline-flex items-center gap-2', className)}>
    <LogoMark className={cn('text-brand-600', markClassName)} />
    {wordmark && (
      <span className="text-lg font-semibold tracking-tight">
        DealFlow<span className="text-brand-600">360</span>
      </span>
    )}
  </span>
);

export default Logo;
