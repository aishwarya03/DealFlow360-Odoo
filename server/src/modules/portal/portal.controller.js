import { sendSuccess } from '../../utils/apiResponse.js';
import * as portalService from './portal.service.js';

export const register = async (req, res) => {
  const result = await portalService.registerCustomer(req.body);

  sendSuccess(res, 'Account created', result, 201);
};

export const login = async (req, res) => {
  const result = await portalService.loginCustomer(req.body);

  sendSuccess(res, 'Signed in', result);
};

export const me = async (req, res) => {
  const customer = await portalService.getCurrentCustomer(req.user.id);

  sendSuccess(res, 'Current customer', { customer });
};

/**
 * The public "Request a Quote" submission: signs the customer up and raises
 * their first quotation in one call, because from their side it is one
 * action. Registration runs first — if the email is already claimed it fails
 * here, before anything else is written.
 */
export const registerAndRequest = async (req, res) => {
  const result = await portalService.registerAndRequestQuotation(req.body);

  sendSuccess(res, 'Quote request submitted', result, 201);
};

export const createQuotation = async (req, res) => {
  const quotation = await portalService.createQuotationForCustomer(req.user.id, req.body);

  sendSuccess(res, 'Quotation requested', { quotation }, 201);
};

export const listQuotations = async (req, res) => {
  const quotations = await portalService.listCustomerQuotations(req.user.id);

  sendSuccess(res, 'Your quotations', { quotations, count: quotations.length });
};

export const getQuotation = async (req, res) => {
  const quotation = await portalService.getCustomerQuotation(req.user.id, req.params.id);

  sendSuccess(res, 'Quotation', { quotation });
};
