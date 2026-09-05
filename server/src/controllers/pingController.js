import { sendSuccess } from '../utils/apiResponse.js';

export const ping = (req, res) => {
  sendSuccess(res, 'Backend Connected', null);
};