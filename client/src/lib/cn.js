/**
 * Joins class names, dropping falsy values so conditionals stay inline:
 *   cn('base', isActive && 'active', className)
 */
export const cn = (...classes) => classes.filter(Boolean).join(' ');
