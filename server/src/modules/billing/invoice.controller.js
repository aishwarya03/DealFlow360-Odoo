import { sendSuccess, sendError } from '../../utils/apiResponse.js';

import * as invoiceService from './invoice.service.js';

export const list = async (req, res) => {
  try {
    const invoices = await invoiceService.listInvoices(req.validatedQuery);

    sendSuccess(res, 'Invoices', { invoices, count: invoices.length });
  } catch (error) {
    sendError(res, error.message);
  }
};

export const getOne = async (req, res) => {
  try {
    const invoice = await invoiceService.getInvoiceById(req.params.id);

    sendSuccess(res, 'Invoice', { invoice });
  } catch (error) {
    sendError(res, error.message);
  }
};

export const pay = async (req, res) => {
  try {
    const invoice = await invoiceService.markInvoicePaid(req.params.id, req.user);

    sendSuccess(res, 'Invoice marked paid', { invoice });
  } catch (error) {
    sendError(res, error.message);
  }
};
