import ApiError from '../utils/apiError.js';

// Route params are always strings. Prisma rejects a string where the schema
// declares an Int, so ids are converted once here rather than in every service.
// A non-numeric id becomes a clean 400 instead of a Prisma type error.
const parseId =
  (param = 'id') =>
  (req, res, next) => {
    const raw = req.params[param];
    const value = Number(raw);

    if (!Number.isInteger(value) || value < 1) {
      return next(ApiError.badRequest(`'${raw}' is not a valid ${param}`));
    }

    req.params[param] = value;
    next();
  };

export default parseId;
