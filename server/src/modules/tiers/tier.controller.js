import { sendSuccess } from '../../utils/apiResponse.js';
import * as tierService from './tier.service.js';
import * as scoring from './tierScoring.service.js';

export const getScoringConfig = async (req, res) => {
  const config = await scoring.getScoringConfig();

  sendSuccess(res, 'Tier scoring config', { config });
};

export const updateScoringConfig = async (req, res) => {
  const config = await scoring.updateScoringConfig(req.body);

  sendSuccess(res, 'Tier scoring config updated', { config });
};

export const recalculateAll = async (req, res) => {
  const result = await scoring.recalculateAllTiers();

  sendSuccess(res, 'Tiers recalculated', result);
};

export const list = async (req, res) => {
  const tiers = await tierService.listTiers(req.validatedQuery);

  sendSuccess(res, 'Customer tiers', { tiers, count: tiers.length });
};

export const getOne = async (req, res) => {
  const tier = await tierService.getTierById(req.params.id);

  sendSuccess(res, 'Customer tier', { tier });
};

export const create = async (req, res) => {
  const tier = await tierService.createTier(req.body);

  sendSuccess(res, 'Customer tier created', { tier }, 201);
};

export const update = async (req, res) => {
  const tier = await tierService.updateTier(req.params.id, req.body);

  sendSuccess(res, 'Customer tier updated', { tier });
};

export const deactivate = async (req, res) => {
  const tier = await tierService.deactivateTier(req.params.id);

  sendSuccess(res, 'Customer tier deactivated', { tier });
};
