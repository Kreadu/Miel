"use client";

import { useSyncExternalStore } from "react";

import { loadMyOrders, type MyOrder, rememberOrder } from "@/lib/store/my-orders";

/** S27-04: "Mis pedidos" del cliente en esta tienda (solo en su navegador). */
const listeners = new Set<() => void>();
const cache = new Map<string, { raw: string; list: MyOrder[] }>();

function storage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function snapshot(slug: string): MyOrder[] {
  const s = storage();
  const raw = s?.getItem(`tienda-pedidos:${slug}`) ?? "";
  const hit = cache.get(slug);
  if (hit && hit.raw === raw) return hit.list;
  const list = s ? loadMyOrders(s, slug) : [];
  cache.set(slug, { raw, list });
  return list;
}

const EMPTY: MyOrder[] = [];

export function useMyOrders(slug: string): MyOrder[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => snapshot(slug),
    () => EMPTY,
  );
}

export function saveMyOrder(slug: string, order: MyOrder) {
  const s = storage();
  if (!s) return;
  rememberOrder(s, slug, order);
  listeners.forEach((l) => l());
}
