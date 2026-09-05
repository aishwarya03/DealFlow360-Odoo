import { sendSuccess } from '../../utils/apiResponse.js';
import * as recommendationService from './recommendation.service.js';

export const list = async (req, res) => {
  const recommendations = await recommendationService.listRecommendations(req.validatedQuery);

  sendSuccess(res, 'Product recommendations', { recommendations, count: recommendations.length });
};

export const getOne = async (req, res) => {
  const recommendation = await recommendationService.getRecommendationById(req.params.id);

  sendSuccess(res, 'Product recommendation', { recommendation });
};

export const create = async (req, res) => {
  const recommendation = await recommendationService.createRecommendation(req.body);

  sendSuccess(res, 'Product recommendation created', { recommendation }, 201);
};

export const update = async (req, res) => {
  const recommendation = await recommendationService.updateRecommendation(req.params.id, req.body);

  sendSuccess(res, 'Product recommendation updated', { recommendation });
};

export const deactivate = async (req, res) => {
  const recommendation = await recommendationService.deactivateRecommendation(req.params.id);

  sendSuccess(res, 'Product recommendation deactivated', { recommendation });
};

export const suggest = async (req, res) => {
  const suggestions = await recommendationService.getSuggestions(req.validatedQuery.productIds, {
    includeMargin: true,
  });

  sendSuccess(res, 'Suggestions', { suggestions, count: suggestions.length });
};

// Public counterpart of `suggest` — same evaluator, margin fields stripped.
export const suggestPublic = async (req, res) => {
  const suggestions = await recommendationService.getSuggestions(req.validatedQuery.productIds, {
    includeMargin: false,
  });

  sendSuccess(res, 'Suggestions', { suggestions, count: suggestions.length });
};
