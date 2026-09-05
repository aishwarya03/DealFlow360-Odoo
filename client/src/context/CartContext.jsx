import { useCallback, useEffect, useMemo, useState } from 'react';

import { CartContext } from './cartInstance';

const STORAGE_KEY = 'netrix.quoteCart';

const readStoredCart = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const writeStoredCart = (items) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Storage unavailable — cart just won't survive a reload.
  }
};

/**
 * A "request a quote" cart, not a checkout cart — there is no price
 * authority or payment here. It exists so a visitor can compose a
 * structured multi-item enquiry instead of one free-text paragraph.
 * See docs/SOURCE_OF_TRUTH.md §2.11 (QuoteRequest).
 */
export const CartProvider = ({ children }) => {
  const [items, setItems] = useState(readStoredCart);

  useEffect(() => {
    writeStoredCart(items);
  }, [items]);

  // `plan` carries the billing choice made on the product page for a
  // subscribable product: { isRecurring, recurringCycle, price, cycle }.
  // price/cycle override the product's own list price/display cycle so the
  // cart shows what was actually picked (e.g. the YEARLY plan amount, not
  // the one-time list price). Re-adding the same product with a different
  // plan updates the existing line's plan instead of leaving it stale.
  const addItem = useCallback((product, quantity = 1, plan = null) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.id === product.id ? { ...i, ...plan, quantity: i.quantity + quantity } : i
        );
      }
      return [...prev, { ...product, ...plan, quantity }];
    });
  }, []);

  const updateQuantity = useCallback((id, quantity) => {
    setItems((prev) =>
      quantity <= 0
        ? prev.filter((i) => i.id !== id)
        : prev.map((i) => (i.id === id ? { ...i, quantity } : i))
    );
  }, []);

  const removeItem = useCallback((id) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const count = useMemo(() => items.reduce((sum, i) => sum + i.quantity, 0), [items]);

  const value = useMemo(
    () => ({ items, count, addItem, updateQuantity, removeItem, clearCart }),
    [items, count, addItem, updateQuantity, removeItem, clearCart]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};
