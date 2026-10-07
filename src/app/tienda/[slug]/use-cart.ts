"use client";

import { useCallback, useSyncExternalStore } from "react";

import { type Cart, loadCart, saveCart } from "@/lib/store/cart";

/**
 * S27-02: carrito de la tienda guardado en el navegador del cliente (localStorage, por tienda).
 * Si el navegador no deja guardar, vive en memoria mientras la página esté abierta.
 */
const EMPTY: Cart = {};
const listeners = new Set<() => void>();
let current: { slug: string; cart: Cart } | null = null;

function storage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function read(slug: string): Cart {
  if (current?.slug !== slug) {
    const s = storage();
    current = { slug, cart: s ? loadCart(s, slug) : {} };
  }
  return current.cart;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useCart(slug: string) {
  const cart = useSyncExternalStore(subscribe, () => read(slug), () => EMPTY);
  const update = useCallback(
    (fn: (cart: Cart) => Cart) => {
      const next = fn(read(slug));
      current = { slug, cart: next };
      const s = storage();
      if (s) saveCart(s, slug, next);
      listeners.forEach((l) => l());
    },
    [slug],
  );
  return { cart, update };
}
