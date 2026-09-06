import { sendSuccess } from '../../utils/apiResponse.js';
import * as purchaseOrderService from './purchaseOrder.service.js';

export const list = async (req, res) => {
  const purchaseOrders = await purchaseOrderService.listPurchaseOrders(req.validatedQuery);

  sendSuccess(res, 'Purchase orders', { purchaseOrders, count: purchaseOrders.length });
};

export const getOne = async (req, res) => {
  const purchaseOrder = await purchaseOrderService.getPurchaseOrderById(req.params.id);

  sendSuccess(res, 'Purchase order', { purchaseOrder });
};

export const create = async (req, res) => {
  const purchaseOrder = await purchaseOrderService.createPurchaseOrder(req.body);

  sendSuccess(res, 'Purchase order placed', { purchaseOrder }, 201);
};

export const update = async (req, res) => {
  const purchaseOrder = await purchaseOrderService.updatePurchaseOrder(req.params.id, req.body);

  sendSuccess(res, 'Purchase order updated', { purchaseOrder });
};

export const order = async (req, res) => {
  const purchaseOrder = await purchaseOrderService.markOrdered(req.params.id);

  sendSuccess(res, 'Purchase order sent to vendor', { purchaseOrder });
};

export const complete = async (req, res) => {
  const purchaseOrder = await purchaseOrderService.markDone(req.params.id, req.user?.id);

  sendSuccess(res, 'Purchase order received — stock updated', { purchaseOrder });
};

export const cancel = async (req, res) => {
  const purchaseOrder = await purchaseOrderService.cancelPurchaseOrder(req.params.id);

  sendSuccess(res, 'Purchase order cancelled', { purchaseOrder });
};
