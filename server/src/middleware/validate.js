import { sendError } from '../utils/apiResponse.js';

// Parses req.body against a zod schema before the controller runs, so services
// can assume well-formed input. On success req.body is replaced with the parsed
// result, which strips unknown keys and applies defaults and coercions.
const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);

  if (!result.success) {
    const errors = result.error.issues.map((issue) => ({
      field: issue.path.join('.') || '(body)',
      message: issue.message,
    }));

    return sendError(res, 'Validation failed', errors, 422);
  }

  req.body = result.data;
  next();
};

// Same check for query strings. Express 5 exposes req.query as a getter-only
// property, so the parsed result is attached separately instead of assigned back.
export const validateQuery = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.query);

  if (!result.success) {
    const errors = result.error.issues.map((issue) => ({
      field: issue.path.join('.') || '(query)',
      message: issue.message,
    }));

    return sendError(res, 'Invalid query parameters', errors, 422);
  }

  req.validatedQuery = result.data;
  next();
};

export default validate;
