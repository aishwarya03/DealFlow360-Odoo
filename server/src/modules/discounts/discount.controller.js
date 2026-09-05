import { sendSuccess } from '../../utils/apiResponse.js';
import { evaluateDiscount } from './discountEvaluation.service.js';
import * as ruleService from './discountRule.service.js';

export const listRules = async (req, res) => {
  const rules = await ruleService.listRules(req.validatedQuery);

  sendSuccess(res, 'Discount rules', { rules, count: rules.length });
};

export const getRule = async (req, res) => {
  const rule = await ruleService.getRuleById(req.params.id);

  sendSuccess(res, 'Discount rule', { rule });
};

export const createRule = async (req, res) => {
  const rule = await ruleService.createRule(req.body);

  sendSuccess(res, 'Discount rule created', { rule }, 201);
};

export const updateRule = async (req, res) => {
  const rule = await ruleService.updateRule(req.params.id, req.body);

  sendSuccess(res, 'Discount rule updated', { rule });
};

export const deactivateRule = async (req, res) => {
  const rule = await ruleService.deactivateRule(req.params.id);

  sendSuccess(res, 'Discount rule deactivated', { rule });
};

// getApplicableDiscountRule, exposed directly — answers "what is this
// customer allowed on this kind of product?" without building a quote.
export const resolveRule = async (req, res) => {
  const { customerTierId, categoryId } = req.validatedQuery;
  const rule = await ruleService.getApplicableDiscountRule(customerTierId, categoryId);

  sendSuccess(res, 'Applicable discount rule', { rule });
};

export const evaluate = async (req, res) => {
  const result = await evaluateDiscount(req.body);

  sendSuccess(res, 'Discount evaluation', result);
};
