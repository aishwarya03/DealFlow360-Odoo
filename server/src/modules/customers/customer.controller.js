import { sendSuccess } from '../../utils/apiResponse.js';
import * as customerService from './customer.service.js';

export const list = async (req, res) => {
  const customers = await customerService.listCustomers(req.query);

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
