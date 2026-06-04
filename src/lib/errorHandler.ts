import { z } from 'zod';

export function getUserFriendlyError(error: any): string {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message || "Validation failed. Please check your inputs.";
  }
  
  if (error instanceof Error) {
    if (error.message.includes('Network Error')) return "Network error. Please check your internet connection.";
    return error.message;
  }

  // Map internal errors to user-friendly messages
  const errorMap: Record<string, string> = {
    'permission-denied': "You don't have permission to perform this action",
    'not-found': 'The requested item was not found',
    'already-exists': 'This item already exists',
    'invalid-argument': 'Invalid input provided',
    'unauthenticated': 'Please log in to continue',
    'resource-exhausted': 'Too many requests. Please try again later.'
  };

  const code = error?.code || error?.message || 'unknown';
  
  // Find substring match if the error code isn't an exact match
  for (const key of Object.keys(errorMap)) {
    if (typeof code === 'string' && code.includes(key)) {
      return errorMap[key];
    }
  }

  return errorMap[code] || 'An unexpected error occurred. Please try again.';
}
