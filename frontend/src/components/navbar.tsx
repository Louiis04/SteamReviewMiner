"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ModeToggle } from "@/components/mode-toggle";

const links = [
  { href: "/", label: "Início" },
  { href: "/explore", label: "Explorar" },
  { href: "/top", label: "Top Jogos" },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <img src="/steam-logo.svg" alt="Steam" className="h-6 w-6" />
          <span className="text-lg">Steam Review Miner</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm font-medium">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-md px-3 py-2 transition-colors",
                pathname === link.href
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              {link.label}
            </Link>
          ))}
          <ModeToggle />
        </nav>
      </div>
    </header>
  );
}
