import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowRight, ChevronLeft, ChevronRight, Search } from 'lucide-react';

import Button from '../components/Button';
import EmptyState from '../components/EmptyState';
import ProductCard from '../components/ProductCard';
import Reveal from '../components/Reveal';
import SiteFooter from '../components/SiteFooter';
import SiteHeader from '../components/SiteHeader';
import { CATALOG, CATEGORIES } from '../data/catalog';
import { NETRIX_TAG, useBrandTag } from '../hooks/useBrandTag';
import { useCart } from '../hooks/useCart';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { cn } from '../lib/cn';

const ALL = 'all';
const PAGE_SIZE = 9;

const Products = () => {
  useBrandTag(`Products & Services · ${NETRIX_TAG.title}`, NETRIX_TAG.icon);
  const navigate = useNavigate();
  const { addItem } = useCart();
  const gridRef = useRef(null);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [activeCategory, setActiveCategory] = useState(ALL);
  const [page, setPage] = useState(1);

  // Any change to what's being filtered should start back at page 1 —
  // otherwise a narrower search can strand you on a page that no longer
  // exists. Adjusted during render (React's recommended pattern for
  // resetting state on a prop/derived-value change) rather than an effect,
  // which would cost an extra commit for the same result.
  const filterKey = `${debouncedSearch}|${activeCategory}`;
  const [lastFilterKey, setLastFilterKey] = useState(filterKey);
  if (filterKey !== lastFilterKey) {
    setLastFilterKey(filterKey);
    setPage(1);
  }

  const handleAdd = (product) => {
    addItem(product, 1);
    toast.success(`Added ${product.name} to your quote cart`);
  };

  // "Just this item" is deliberately independent of the persistent cart —
  // it goes straight to the form via route state, not through /cart.
  const handleRequestQuote = (product, quantity) => {
    navigate('/request-quote', { state: { items: [{ ...product, quantity }] } });
  };

  const query = debouncedSearch.trim().toLowerCase();
  const filtered = CATALOG.filter((product) => {
    const matchesCategory =
      activeCategory === ALL || product.category === activeCategory;
    const matchesQuery =
      query === '' ||
      product.name.toLowerCase().includes(query) ||
      product.description.toLowerCase().includes(query);
    return matchesCategory && matchesQuery;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const goToPage = (next) => {
    setPage(next);
    gridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />

      <section className="border-b border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-4xl px-6 py-16 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            Products &amp; Services
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-slate-600">
            Indicative pricing for planning purposes — every quotation is
            itemized for your site during a survey. Add anything you&apos;d
            like priced to your quote cart.
          </p>

          <div className="relative mx-auto mt-6 max-w-md">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products and services…"
              aria-label="Search products and services"
              className="w-full rounded-md border border-slate-300 bg-white py-2 pr-3 pl-9 text-sm text-slate-900 outline-none focus:border-brand-600"
            />
          </div>

          <div
            className="mx-auto mt-4 flex max-w-2xl gap-2 overflow-x-auto pb-1 scrollbar-none"
            role="tablist"
            aria-label="Filter by category"
          >
            {[{ key: ALL, label: 'All' }, ...CATEGORIES].map((cat) => (
              <button
                key={cat.key}
                type="button"
                role="tab"
                aria-selected={activeCategory === cat.key}
                onClick={() => setActiveCategory(cat.key)}
                className={cn(
                  'shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors',
                  activeCategory === cat.key
                    ? 'border-brand-600 bg-brand-600 text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                )}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div ref={gridRef} className="mx-auto max-w-6xl px-6 py-16">
        {filtered.length === 0 ? (
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
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {pageItems.map((product, index) => (
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

        <Reveal className="mt-14 rounded-lg border border-slate-200 bg-slate-50 p-8 text-center">
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
      </div>

      <SiteFooter />
    </div>
  );
};

export default Products;
