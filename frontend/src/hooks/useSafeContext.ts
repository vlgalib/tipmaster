import { useContext, type Context } from 'react';

/**
 * Safe hook for using React contexts
 * Prevents React error #301
 */
export function useSafeContext<T>(context: Context<T | null>, errorMessage?: string): T {
  const value = useContext(context);
  
  if (value === null || value === undefined) {
    throw new Error(
      errorMessage || 
      `Context must be used within its Provider. Make sure the component is wrapped with the appropriate Provider.`
    );
  }
  
  return value;
}

/**
 * Hook for using context with fallback value
 */
export function useOptionalContext<T>(context: Context<T | null>, fallback: T): T {
  const value = useContext(context);
  return value ?? fallback;
} 