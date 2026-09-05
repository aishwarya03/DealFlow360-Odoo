import ApiError from '../../utils/apiError.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import * as productService from './product.service.js';

export const list = async (req, res) => {
  const products = await productService.listProducts(req.validatedQuery);

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

export const uploadImage = async (req, res) => {
  if (!req.file) throw ApiError.badRequest('No image file provided (field name: image)');

  const imageUrl = `/uploads/products/${req.file.filename}`;
  const product = await productService.setProductImage(req.params.id, imageUrl);

  sendSuccess(res, 'Product image updated', { product });
};
