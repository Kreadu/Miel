"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  // ponytail: sync icon after hydration; queueMicrotask avoids set-state-in-effect lint
  useEffect(() => {
    queueMicrotask(() => setDark(document.documentElement.classList.contains("dark")));
  }, []);

  const toggle = () => {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    setDark(next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {}
  };

  return (
    <Button variant="ghost" size="icon" aria-label="Cambiar tema" onClick={toggle}>
      {dark ? <Moon /> : <Sun />}
    </Button>
  );
}

