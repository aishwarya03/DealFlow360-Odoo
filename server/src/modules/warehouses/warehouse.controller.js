import { sendSuccess } from '../../utils/apiResponse.js';
import * as warehouseService from './warehouse.service.js';

export const list = async (req, res) => {
  const warehouses = await warehouseService.listWarehouses(req.query);

  sendSuccess(res, 'Warehouses', { warehouses, count: warehouses.length });
};

export const getOne = async (req, res) => {
  const warehouse = await warehouseService.getWarehouseById(req.params.id);

  sendSuccess(res, 'Warehouse', { warehouse });
};

export const create = async (req, res) => {
  const warehouse = await warehouseService.createWarehouse(req.body);

  sendSuccess(res, 'Warehouse created', { warehouse }, 201);
};

export const update = async (req, res) => {
  const warehouse = await warehouseService.updateWarehouse(req.params.id, req.body);

  sendSuccess(res, 'Warehouse updated', { warehouse });
};

export const deactivate = async (req, res) => {
  const warehouse = await warehouseService.deactivateWarehouse(req.params.id);

  sendSuccess(res, 'Warehouse deactivated', { warehouse });
};
