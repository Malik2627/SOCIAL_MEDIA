import multer from 'multer';

/**
 * Centralized Express error-handling middleware.
 * Formats Multer upload errors, Mongoose CastError/ValidationError, and unexpected 500 errors.
 * Never leaks stack traces in production (NODE_ENV === 'production').
 */
export function errorHandler(err, _req, res, _next) {
  // Multer file upload errors (e.g. LIMIT_FILE_SIZE)
  if (err instanceof multer.MulterError || err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File size exceeds the 5 MB limit',
      });
    }
    return res.status(400).json({
      success: false,
      message: err.message || 'File upload error',
    });
  }

  // Custom upload errors (e.g. INVALID_FILE_TYPE)
  if (err.code === 'INVALID_FILE_TYPE' || (err.statusCode === 400 && err.message?.includes('image'))) {
    return res.status(400).json({
      success: false,
      message: err.message || 'Invalid file type',
    });
  }

  // Malformed JSON body
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      message: 'Invalid JSON request body',
    });
  }

  // Mongoose CastError (e.g. invalid ObjectId)
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: `Invalid resource identifier: ${err.value}`,
    });
  }

  // Mongoose ValidationError
  if (err.name === 'ValidationError') {
    const firstMessage = Object.values(err.errors || {})[0]?.message;
    return res.status(400).json({
      success: false,
      message: firstMessage || 'Validation failed',
    });
  }

  // Generic or unexpected error
  const statusCode = typeof err.status === 'number'
    ? err.status
    : typeof err.statusCode === 'number'
      ? err.statusCode
      : 500;

  const isProduction = process.env.NODE_ENV === 'production';
  const response = {
    success: false,
    message: statusCode === 500 && isProduction ? 'Internal server error' : (err.message || 'Internal server error'),
  };

  if (!isProduction && err.stack) {
    response.stack = err.stack;
  }

  return res.status(statusCode).json(response);
}

export default errorHandler;
