import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/** Knows the passbook's own `shadow-*` names (styles.css), so they replace shadcn's `shadow-md`. */
const twMerge = extendTailwindMerge({
  extend: { theme: { shadow: ['sheet', 'slip', 'menu', 'tip', 'band'] } },
});

/** Joins class names and lets later Tailwind classes win over earlier ones. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
