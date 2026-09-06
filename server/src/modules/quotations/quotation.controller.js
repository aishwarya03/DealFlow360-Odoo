import { sendSuccess, sendError } from '../../utils/apiResponse.js';

import * as quotationService from './quotation.service.js';

export const list = async (req, res) => {
  try {
    const quotations = await quotationService.listQuotations(
      req.validatedQuery,
      req.user
    );

    sendSuccess(res, 'Quotations', {
      quotations,
      count: quotations.length,
    });
  } catch (error) {
    sendError(res, error.message);
  }
};

export const getOne = async (req, res) => {
  try {
    const quotation = await quotationService.getQuotationById(
      req.params.id,
      req.user
    );

    sendSuccess(res, 'Quotation', { quotation });
  } catch (error) {
    sendError(res, error.message);
  }
};

export const create = async (req, res) => {
  try {
    const quotation = await quotationService.createQuotation(
      req.body,
      req.user
    );

    sendSuccess(res, 'Quotation created', { quotation }, 201);
  } catch (error) {
    sendError(res, error.message);
  }
};

export const updateLines = async (req, res) => {
  try {
    const quotation = await quotationService.updateQuotationLines(
      req.params.id,
      req.body,
      req.user
    );

    sendSuccess(res, 'Quotation lines updated', { quotation });
  } catch (error) {
    sendError(res, error.message);
  }
};

export const submit = async (req, res) => {
  try {
    const quotation = await quotationService.submitQuotation(
      req.params.id,
      req.user
    );

    sendSuccess(res, 'Quotation submitted', { quotation });
  } catch (error) {
    sendError(res, error.message);
  }
};

export const confirm = async (req, res) => {
  try {
    const quotation = await quotationService.confirmQuotation(
      req.params.id,
      req.user,
      req.body.note
    );

    sendSuccess(res, 'Quotation confirmed', { quotation });
  } catch (error) {
    sendError(res, error.message);
  }
};

export const withdraw = async (req, res) => {
  try {
    const quotation = await quotationService.withdrawQuotation(
      req.params.id,
      req.user,
      req.body.note
    );

    sendSuccess(res, 'Quotation withdrawn', { quotation });
  } catch (error) {
    sendError(res, error.message);
  }
};

export const dispatch = async (req, res) => {
  try {
    const quotation = await quotationService.dispatchQuotation(req.params.id, req.user);

    sendSuccess(res, 'Quotation dispatched', { quotation });
  } catch (error) {
    sendError(res, error.message);
  }
};

export const deliver = async (req, res) => {
  try {
    const quotation = await quotationService.deliverQuotation(req.params.id, req.user);

    sendSuccess(res, 'Quotation delivered', { quotation });
  } catch (error) {
    sendError(res, error.message);
  }
};
