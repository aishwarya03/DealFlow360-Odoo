import { sendSuccess } from '../../utils/apiResponse.js';
import {
  getCustomerTierScore,
  recalculateCustomerTier,
} from '../tiers/tierScoring.service.js';
import * as customerService from './customer.service.js';

// The score breakdown — "38/40, 21/25, 17/20, 12/15" — without writing.
export const tierScore = async (req, res) => {
  const result = await getCustomerTierScore(req.params.id);

  sendSuccess(res, 'Tier score', result);
};

export const recalculateTier = async (req, res) => {
  const result = await recalculateCustomerTier(req.params.id);

  sendSuccess(res, 'Tier recalculated', result);
};

export const list = async (req, res) => {
  const customers = await customerService.listCustomers(req.validatedQuery);

  sendSuccess(res, 'Customers', { customers, count: customers.length });
};

export const getOne = async (req, res) => {
  const customer = await customerService.getCustomerById(req.params.id);

  sendSuccess(res, 'Customer', { customer });
};

export const create = async (req, res) => {
  const customer = await customerService.createCustomer(req.body);

  sendSuccess(res, 'Customer created', { customer }, 201);
};

export const update = async (req, res) => {
  const customer = await customerService.updateCustomer(req.params.id, req.body);

  sendSuccess(res, 'Customer updated', { customer });
};

export const deactivate = async (req, res) => {
  const customer = await customerService.deactivateCustomer(req.params.id);

  sendSuccess(res, 'Customer deactivated', { customer });
};
