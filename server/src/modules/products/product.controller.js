import ApiError from '../../utils/apiError.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import * as productService from './product.service.js';

export const list = async (req, res) => {
  const result = await productService.listProducts(req.validatedQuery);

  sendSuccess(res, 'Products', result);
};

export const publicList = async (req, res) => {
  const result = await productService.listPublicProducts(req.validatedQuery);

  sendSuccess(res, 'Products', result);
};

export const publicGetOne = async (req, res) => {
  const product = await productService.getPublicProductById(req.params.id);

  sendSuccess(res, 'Product', { product });
};

export const getOne = async (req, res) => {
  const product = await productService.getProductById(req.params.id);

  sendSuccess(res, 'Product', { product });
};

export const create = async (req, res) => {
  const product = await productService.createProduct(req.body);

  sendSuccess(res, 'Product created', { product }, 201);
};

export const update = async (req, res) => {
  const product = await productService.updateProduct(req.params.id, req.body);

  sendSuccess(res, 'Product updated', { product });
};

export const deactivate = async (req, res) => {
  const product = await productService.deactivateProduct(req.params.id);

  sendSuccess(res, 'Product deactivated', { product });
};

export const listSubscriptionPlans = async (req, res) => {
  const plans = await productService.listProductSubscriptionPlans(req.params.id);

  sendSuccess(res, 'Subscription plans', { plans });
};

export const upsertSubscriptionPlans = async (req, res) => {
  const plans = await productService.upsertProductSubscriptionPlans(req.params.id, req.body.plans);

  sendSuccess(res, 'Subscription plans updated', { plans });
};

export const uploadImage = async (req, res) => {
  if (!req.file) throw ApiError.badRequest('No image file provided (field name: image)');

  const imageUrl = `/uploads/products/${req.file.filename}`;
  const product = await productService.setProductImage(req.params.id, imageUrl);

  sendSuccess(res, 'Product image updated', { product });
};
