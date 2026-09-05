import prisma from '../../prisma/client.js';
import ApiError from '../../utils/apiError.js';
import { toNumber } from '../../utils/money.js';

const toPublicCategory = (category) => ({
  id: category.id,
  name: category.name,
  parentId: category.parentId,
  discountCeiling: toNumber(category.discountCeiling),
  productCount: category._count?.products ?? undefined,
  childCount: category._count?.children ?? undefined,
  createdAt: category.createdAt,
  updatedAt: category.updatedAt,
});

const withCounts = { _count: { select: { products: true, children: true } } };

// Builds "Hardware / Computers" style breadcrumbs and nests children under
// their parent. Done in JS over a flat query rather than a recursive SQL CTE
// — the tree is small (admin-authored categories, not user data) so this
// stays simple and easy to reason about.
const buildTree = (flatCategories) => {
  const byId = new Map(flatCategories.map((c) => [c.id, { ...c, children: [] }]));
  const roots = [];

  for (const category of byId.values()) {
    if (category.parentId && byId.has(category.parentId)) {
      byId.get(category.parentId).children.push(category);
    } else {
      roots.push(category);
    }
  }

  const withPath = (node, parentPath) => {
    node.path = parentPath ? `${parentPath} / ${node.name}` : node.name;
    node.children.forEach((child) => withPath(child, node.path));
  };
  roots.forEach((root) => withPath(root, ''));

  return roots;
};

export const listCategoriesFlat = async (filters = {}) => {
  const where = {};
  if (filters.search) {
    where.name = { contains: filters.search, mode: 'insensitive' };
  }

  const categories = await prisma.category.findMany({
    where,
    include: withCounts,
    orderBy: { name: 'asc' },
  });

  // Attaching a breadcrumb path to the flat list too, so a <select> can show
  // "Hardware / Computers" without the caller having to walk parentId chains.
  const allForPathing = filters.search
    ? await prisma.category.findMany({ include: withCounts })
    : categories;
  const pathById = new Map();
  buildTree(allForPathing).forEach(function walk(node) {
    pathById.set(node.id, node.path);
    node.children.forEach(walk);
  });

  return categories.map((category) => ({
    ...toPublicCategory(category),
    path: pathById.get(category.id) ?? category.name,
  }));
};

export const listCategoriesTree = async () => {
  const categories = await prisma.category.findMany({ include: withCounts });
  const tree = buildTree(categories);

  const toPublicNode = (node) => ({
    ...toPublicCategory(node),
    path: node.path,
    children: node.children.map(toPublicNode),
  });

  return tree.map(toPublicNode);
};

export const getCategoryById = async (id) => {
  const category = await prisma.category.findUnique({ where: { id }, include: withCounts });

  if (!category) throw ApiError.notFound(`No category with id ${id}`);

  return toPublicCategory(category);
};

const assertParentExists = async (parentId) => {
  if (parentId === null || parentId === undefined) return;

  const parent = await prisma.category.findUnique({ where: { id: parentId } });
  if (!parent) throw ApiError.badRequest(`No category with id ${parentId} to use as parent`);
};

export const createCategory = async (data) => {
  await assertParentExists(data.parentId);

  const clash = await prisma.category.findFirst({
    where: { name: data.name, parentId: data.parentId ?? null },
  });
  if (clash) {
    throw ApiError.conflict(`A category named "${data.name}" already exists at this level`);
  }

  const category = await prisma.category.create({ data, include: withCounts });

  return toPublicCategory(category);
};

// A category cannot become its own descendant — walks up the proposed
// parent's chain looking for the category being moved.
const assertNotOwnDescendant = async (categoryId, proposedParentId) => {
  let cursor = proposedParentId;
  while (cursor !== null && cursor !== undefined) {
    if (cursor === categoryId) {
      throw ApiError.badRequest('A category cannot be moved under its own descendant');
    }
    const node = await prisma.category.findUnique({ where: { id: cursor } });
    cursor = node?.parentId ?? null;
  }
};

export const updateCategory = async (id, data) => {
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound(`No category with id ${id}`);

  if (data.parentId !== undefined) {
    await assertParentExists(data.parentId);
    if (data.parentId !== null) await assertNotOwnDescendant(id, data.parentId);
  }

  if (data.name) {
    const parentId = data.parentId !== undefined ? data.parentId : existing.parentId;
    const clash = await prisma.category.findFirst({
      where: { name: data.name, parentId: parentId ?? null, NOT: { id } },
    });
    if (clash) {
      throw ApiError.conflict(`A category named "${data.name}" already exists at this level`);
    }
  }

  const category = await prisma.category.update({ where: { id }, data, include: withCounts });

  return toPublicCategory(category);
};

// Hard delete, unlike products/customers/warehouses: an unused category
// carries no history worth preserving. Blocked instead of cascaded if
// anything still depends on it, so deleting a category can never silently
// orphan a product or a subtree.
export const deleteCategory = async (id) => {
  const category = await prisma.category.findUnique({ where: { id }, include: withCounts });
  if (!category) throw ApiError.notFound(`No category with id ${id}`);

  if (category._count.children > 0) {
    throw ApiError.badRequest(
      `Cannot delete "${category.name}": it has ${category._count.children} child categories. Delete or move them first.`
    );
  }
  if (category._count.products > 0) {
    throw ApiError.badRequest(
      `Cannot delete "${category.name}": ${category._count.products} products are assigned to it. Reassign them first.`
    );
  }

  await prisma.category.delete({ where: { id } });
};

// Used by the product list filter: matching a parent category should also
// match products filed under any of its descendants (see schema.prisma
// comment on Category — a product may attach to a parent or a child).
export const getDescendantCategoryIds = async (categoryId) => {
  const all = await prisma.category.findMany({ select: { id: true, parentId: true } });
  const childrenOf = new Map();
  for (const cat of all) {
    if (!childrenOf.has(cat.parentId)) childrenOf.set(cat.parentId, []);
    childrenOf.get(cat.parentId).push(cat.id);
  }

  const ids = [categoryId];
  const queue = [categoryId];
  while (queue.length) {
    const current = queue.shift();
    for (const childId of childrenOf.get(current) ?? []) {
      ids.push(childId);
      queue.push(childId);
    }
  }

  return ids;
};
