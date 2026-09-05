// Same shape product.service.js's listPublicProducts/getPublicProductById give
// the cart everywhere else — a recommendation's `product` field (see
// recommendation.service.js's getSuggestions) is never itself full cart-item
// shape, so this is the one place that has to bridge it.
export const toCartItem = (product) => ({
  id: product.id,
  sku: product.sku,
  name: product.name,
  imageUrl: product.imageUrl,
  price: product.listPrice,
  cycle: product.isSubscribable ? 'month' : null,
});
