import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowRight,
  Boxes,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Search,
  SlidersHorizontal,
} from 'lucide-react';

import Button from '../components/Button';
import EmptyState from '../components/EmptyState';
import ProductCard from '../components/ProductCard';
import Reveal from '../components/Reveal';
import SiteFooter from '../components/SiteFooter';
import SiteHeader from '../components/SiteHeader';
import { listPublicProducts } from '../api/products';
import { NETRIX_TAG, useBrandTag } from '../hooks/useBrandTag';
import { useCart } from '../hooks/useCart';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { cn } from '../lib/cn';

const ALL = 'all';
const PAGE_SIZE = 12;

const Products = () => {
  useBrandTag(`Products & Services · ${NETRIX_TAG.title}`, NETRIX_TAG.icon);
  const navigate = useNavigate();
  const { addItem } = useCart();
  const gridRef = useRef(null);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [activeCategory, setActiveCategory] = useState(ALL);
  const [page, setPage] = useState(1);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, activeCategory]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    listPublicProducts({
      page,
      limit: PAGE_SIZE,
      ...(debouncedSearch.trim() ? { search: debouncedSearch.trim() } : {}),
      ...(activeCategory !== ALL ? { category: activeCategory } : {}),
    })
      .then((result) => {
        if (cancelled) return;
        setProducts(result.products);
        setPagination(result.pagination);
        setCategories(result.categories?.map((category) => category.name) ?? []);
      })
      .catch(() => !cancelled && toast.error('Could not load products'))
      .finally(() => !cancelled && setIsLoading(false));

    return () => {
      cancelled = true;
    };
  }, [page, debouncedSearch, activeCategory]);

  const handleAdd = (product) => {
    addItem(product, 1);
    toast.success(`Added ${product.name} to your quote cart`);
  };

  // "Just this item" is deliberately independent of the persistent cart —
  // it goes straight to the form via route state, not through /cart.
  const handleRequestQuote = (product, quantity) => {
    navigate('/request-quote', { state: { items: [{ ...product, quantity }] } });
  };

  const query = debouncedSearch.trim();
  const totalPages = pagination.totalPages ?? 1;
  const currentPage = pagination.page ?? page;

  const goToPage = (next) => {
    setPage(next);
    gridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />

      <section className="border-b border-slate-200 bg-[#f6f7fb]">
        <div className="w-full px-6 pb-8 pt-12 sm:px-10 sm:pb-10 sm:pt-16 lg:px-14 xl:px-20">
          <div className="max-w-2xl">
            <p className="text-xs font-bold tracking-[0.18em] text-brand-600 uppercase">Netrix catalogue</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-5xl">
              Build your setup.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-slate-600">
              Browse hardware, software, and services for a more secure, better-connected workplace.
            </p>
          </div>

          <div className="relative mt-8 max-w-2xl">
            <Search
              className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search cameras, access control, support…"
              aria-label="Search products and services"
              className="w-full rounded-lg border border-slate-300 bg-white py-3.5 pr-4 pl-12 text-sm text-slate-900 shadow-sm outline-none transition focus:border-brand-600 focus:ring-4 focus:ring-brand-100"
            />
          </div>
        </div>
      </section>

      <div ref={gridRef} className="grid w-full gap-8 px-6 py-10 sm:px-10 lg:grid-cols-[220px_1fr] lg:gap-12 lg:px-14 lg:py-12 xl:px-20">
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <SlidersHorizontal className="size-4 text-brand-600" aria-hidden="true" />
              Browse by category
            </div>
            <div className="mt-4 space-y-1 border-l border-slate-200 pl-3" role="tablist" aria-label="Filter by category">
              {[{ key: ALL, label: 'All products' }, ...categories.map((category) => ({ key: category, label: category }))].map((cat) => (
                <button
                  key={cat.key}
                  type="button"
                  role="tab"
                  aria-selected={activeCategory === cat.key}
                  onClick={() => setActiveCategory(cat.key)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition',
                    activeCategory === cat.key
                      ? 'bg-brand-50 font-semibold text-brand-700'
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                  )}
                >
                  {cat.label}
                  {activeCategory === cat.key && <CircleCheck className="size-4" aria-hidden="true" />}
                </button>
              ))}
            </div>
            <div className="mt-10 rounded-lg bg-slate-950 p-4 text-white">
              <Boxes className="size-5 text-brand-300" aria-hidden="true" />
              <p className="mt-3 text-sm font-semibold">Need a complete setup?</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">Tell us about your site and we&apos;ll shape the right bundle.</p>
              <Link to="/request-quote" className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-white hover:text-brand-200">
                Talk to sales <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </aside>

        <main className="min-w-0">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">{activeCategory === ALL ? 'All products' : activeCategory}</h2>
              <p className="mt-1 text-xs text-slate-500">Showing carefully selected products and services</p>
            </div>
            <div className="flex w-full flex-wrap gap-2 lg:hidden" role="tablist" aria-label="Filter by category">
              {[{ key: ALL, label: 'All products' }, ...categories.map((category) => ({ key: category, label: category }))].map((cat) => (
                <button
                  key={cat.key}
                  type="button"
                  role="tab"
                  aria-selected={activeCategory === cat.key}
                  onClick={() => setActiveCategory(cat.key)}
                  className={cn(
                    'rounded-md border px-3 py-2 text-sm font-medium transition',
                    activeCategory === cat.key
                      ? 'border-brand-200 bg-brand-50 text-brand-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  )}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        {isLoading ? (
          <div className="py-16 text-center text-sm text-slate-500">
            Loading products…
          </div>
        ) : products.length === 0 ? (
          <EmptyState
            icon={Search}
            title={
              query ? `No matches for "${debouncedSearch}"` : 'No products here'
            }
            description="Try a different term or category, or clear the filters to see everything we offer."
            action={
              <Button
                variant="secondary"
                onClick={() => {
                  setSearch('');
                  setActiveCategory(ALL);
                }}
              >
                Clear filters
              </Button>
            }
          />
        ) : (
          <>
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
              {products.map((product, index) => (
                <Reveal key={product.id} delay={index * 40}>
                  <ProductCard
                    product={product}
                    onAdd={handleAdd}
                    onRequestQuote={handleRequestQuote}
                  />
                </Reveal>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="mt-10 flex items-center justify-center gap-4">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => goToPage(currentPage - 1)}
                >
                  <ChevronLeft className="size-4" aria-hidden="true" />
                  Previous
                </Button>
                <span className="text-sm tabular-nums text-slate-500">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={currentPage === totalPages}
                  onClick={() => goToPage(currentPage + 1)}
                >
                  Next
                  <ChevronRight className="size-4" aria-hidden="true" />
                </Button>
              </div>
            )}
          </>
        )}

        <Reveal className="mt-14 rounded-xl border border-slate-200 bg-slate-50 p-8 text-center">
          <h2 className="text-lg font-semibold text-slate-900">
            Don&apos;t see exactly what you need?
          </h2>
          <p className="mt-1.5 text-sm text-slate-600">
            Most rollouts mix a few of these — tell us about your site and
            we&apos;ll put together an itemized quotation.
          </p>
          <Link to="/request-quote" className="mt-5 inline-block">
            <Button size="lg">
              Request a Quote
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          </Link>
        </Reveal>
        </main>
      </div>

      <SiteFooter />
    </div>
  );
};

export default Products;
