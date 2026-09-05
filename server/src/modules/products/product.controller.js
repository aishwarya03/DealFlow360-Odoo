import { sendSuccess } from '../../utils/apiResponse.js';
import * as productService from './product.service.js';

export const list = async (req, res) => {
  const products = await productService.listProducts(req.query);

  sendSuccess(res, 'Products', { products, count: products.length });
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
