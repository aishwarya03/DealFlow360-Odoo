import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, ArrowUpRight, Minus, Package, Plus, ShoppingCart } from 'lucide-react';

import Button from '../components/Button';
import ProductSuggestions from '../components/ProductSuggestions';
import SiteFooter from '../components/SiteFooter';
import SiteHeader from '../components/SiteHeader';
import { CATEGORY_ICONS, CATEGORY_LABELS } from '../data/catalog';
import { getPublicProduct } from '../api/products';
import { toCartItem } from '../lib/cartItem';
import { NETRIX_TAG, useBrandTag } from '../hooks/useBrandTag';
import { useCart } from '../hooks/useCart';
import { formatPrice } from '../lib/currency';

const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { items, addItem, updateQuantity } = useCart();

  const [product, setProduct] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useBrandTag(`${product?.name ?? 'Product'} · ${NETRIX_TAG.title}`, NETRIX_TAG.icon);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    getPublicProduct(id)
      .then((result) => !cancelled && setProduct(result))
      .catch(() => !cancelled && toast.error('Could not load this product'))
      .finally(() => !cancelled && setIsLoading(false));

    return () => {
      cancelled = true;
    };
  }, [id]);

  const cartQuantity = items.find((i) => i.id === product?.id)?.quantity ?? 0;
  const inCart = cartQuantity > 0;
  const Icon = (product && CATEGORY_ICONS[product.category]) || Package;
  const imageUrl = product?.imageUrl?.startsWith('http')
    ? product.imageUrl
    : product?.imageUrl
      ? `${import.meta.env.VITE_API_URL}${product.imageUrl}`
      : null;
  const categoryName = product?.category?.path ?? product?.category?.name ?? product?.productType;

  const handleAdd = () => {
    addItem(product, 1);
    toast.success(`Added ${product.name} to your quote cart`);
  };

  const handleRequestQuote = () => {
    navigate('/request-quote', {
      state: { items: [{ ...product, quantity: inCart ? cartQuantity : 1 }] },
    });
  };

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />

      <main className="mx-auto w-full max-w-5xl px-6 py-10 sm:px-10">
        <Link
          to="/products"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to catalogue
        </Link>

        {isLoading ? (
          <div className="py-24 text-center text-sm text-slate-500">Loading product…</div>
        ) : !product ? (
          <div className="py-24 text-center text-sm text-slate-500">Product not found.</div>
        ) : (
          <div className="mt-6 grid gap-10 lg:grid-cols-2">
            <div className="relative flex aspect-[1.25/1] items-center justify-center overflow-hidden rounded-xl bg-slate-100 p-10">
              <span className="absolute top-4 left-4 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-semibold tracking-[0.14em] text-slate-500 uppercase shadow-sm">
                {product.productType === 'SERVICE' ? 'Service' : 'In stock'}
              </span>
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={product.name}
                  className="size-full object-contain mix-blend-multiply"
                />
              ) : (
                <Icon className="size-24 text-slate-300" aria-hidden="true" />
              )}
            </div>

            <div>
              <p className="text-xs font-bold tracking-[0.14em] text-brand-600 uppercase">
                {CATEGORY_LABELS[product.category] ?? categoryName}
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                {product.name}
              </h1>
              <p className="mt-1 text-xs text-slate-400">SKU {product.sku}</p>

              <p className="mt-5 text-base leading-7 text-slate-600">
                {product.description || 'Configured for your team and ready to quote.'}
              </p>

              <div className="mt-6 flex items-end gap-3">
                <p className="text-2xl font-bold tabular-nums text-slate-950">
                  {formatPrice(product)}
                </p>
                {product.isSubscribable && (
                  <span className="mb-1 rounded-full bg-green-50 px-2 py-1 text-xs font-semibold text-green-700">
                    Flexible plan
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-slate-400">Indicative price, per {product.unit}</p>

              <div className="relative mt-8 h-11 max-w-xs">
                <div
                  className={`absolute inset-0 transition-all duration-200 ease-out ${
                    inCart ? 'pointer-events-none scale-95 opacity-0' : 'scale-100 opacity-100'
                  }`}
                >
                  <Button className="w-full" onClick={handleAdd}>
                    <ShoppingCart className="size-4" aria-hidden="true" />
                    Add to Quote
                  </Button>
                </div>

                <div
                  className={`absolute inset-0 flex items-center justify-between rounded-md border border-slate-300 transition-all duration-200 ease-out ${
                    inCart ? 'scale-100 opacity-100' : 'pointer-events-none scale-95 opacity-0'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => updateQuantity(product.id, cartQuantity - 1)}
                    className="flex h-full flex-1 items-center justify-center text-slate-500 hover:text-red-600"
                    aria-label={cartQuantity === 1 ? 'Remove from quote cart' : 'Decrease quantity'}
                  >
                    <Minus className="size-4" aria-hidden="true" />
                  </button>
                  <span className="min-w-8 text-center text-sm font-medium tabular-nums text-slate-900">
                    {cartQuantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => updateQuantity(product.id, cartQuantity + 1)}
                    className="flex h-full flex-1 items-center justify-center text-slate-500 hover:text-slate-900"
                    aria-label="Increase quantity"
                  >
                    <Plus className="size-4" aria-hidden="true" />
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={handleRequestQuote}
                className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-slate-400 transition hover:text-brand-600"
              >
                Request a quote for just this item
                <ArrowUpRight className="size-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}

        {product && (
          <ProductSuggestions
            productIds={[product.id]}
            className="mt-14 border-t border-slate-100 pt-10"
            onAdd={(suggested) => {
              addItem(toCartItem(suggested), 1);
              toast.success(`Added ${suggested.name} to your quote cart`);
            }}
          />
        )}
      </main>

      <SiteFooter />
    </div>
  );
};

export default ProductDetail;
