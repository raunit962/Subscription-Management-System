/**
 * HttpError — throwable error with HTTP status code.
 * Express error-handler middleware catches these.
 */
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/**
 * Express error-handler middleware.
 * Must be registered LAST with app.use(errorHandler).
 */
function errorHandler(err, _req, res, _next) {
  const status = err.status || 500;
  const message = err.message || 'Internal server error';
  if (status === 500) {
    console.error('Unhandled error:', err);
  }
  res.status(status).json({ error: message });
}

module.exports = { HttpError, errorHandler };

