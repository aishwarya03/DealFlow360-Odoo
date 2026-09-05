import { sendSuccess } from '../../utils/apiResponse.js';
import * as inventoryService from './inventory.service.js';

export const list = async (req, res) => {
  const stock = await inventoryService.listStock(req.validatedQuery);

  sendSuccess(res, 'Stock', { stock, count: stock.length });
};

export const availability = async (req, res) => {
  const result = await inventoryService.getAvailability(req.params.productId);

  sendSuccess(res, 'Availability', result);
};

export const lowStock = async (req, res) => {
  const stock = await inventoryService.getLowStock();

  sendSuccess(res, 'Low stock', { stock, count: stock.length });
};

export const set = async (req, res) => {
  const stock = await inventoryService.setStock(req.body, req.user.id);

  sendSuccess(res, 'Stock level set', { stock });
};

export const adjust = async (req, res) => {
  const stock = await inventoryService.adjustStock(req.body, req.user.id);

  sendSuccess(res, 'Stock adjusted', { stock });
};

export const movements = async (req, res) => {
  const result = await inventoryService.getMovements(req.validatedQuery ?? {});

  sendSuccess(res, 'Stock movements', { movements: result, count: result.length });
};
