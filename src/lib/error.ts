/**
 * Centralized error handling utilities
 */

export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export function handleApiError(error: unknown): { message: string; statusCode: number } {
  if (error instanceof AppError) {
    return {
      message: error.message,
      statusCode: error.statusCode
    }
  }

  if (error instanceof Error) {
    // Log to external service in production
    if (process.env.NODE_ENV === 'production') {
      // TODO: Send to Sentry, LogRocket, etc.
      console.error('API Error:', error.message)
    } else {
      console.error('API Error:', error)
    }

    return {
      message: 'An unexpected error occurred',
      statusCode: 500
    }
  }

  return {
    message: 'An unknown error occurred',
    statusCode: 500
  }
}

export function createErrorResponse(error: unknown) {
  const { message, statusCode } = handleApiError(error)
  return Response.json(
    { error: message },
    { status: statusCode }
  )
}
