import { sendSuccess } from '../../utils/apiResponse.js';
import * as categoryService from './category.service.js';

export const list = async (req, res) => {
  const categories = await categoryService.listCategoriesFlat(req.validatedQuery);

  sendSuccess(res, 'Categories', { categories, count: categories.length });
};

export const tree = async (req, res) => {
  const categories = await categoryService.listCategoriesTree();

  sendSuccess(res, 'Category tree', { categories });
};

export const getOne = async (req, res) => {
  const category = await categoryService.getCategoryById(req.params.id);

  sendSuccess(res, 'Category', { category });
};

export const create = async (req, res) => {
  const category = await categoryService.createCategory(req.body);

  sendSuccess(res, 'Category created', { category }, 201);
};

export const update = async (req, res) => {
  const category = await categoryService.updateCategory(req.params.id, req.body);

  sendSuccess(res, 'Category updated', { category });
};

export const remove = async (req, res) => {
  await categoryService.deleteCategory(req.params.id);

  sendSuccess(res, 'Category deleted', null);
};
