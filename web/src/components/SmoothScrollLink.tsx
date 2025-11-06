"use client";

import Link from "next/link";
import { useSmoothScroll } from "@/hooks/useSmoothScroll";
import { MouseEvent, ReactNode } from "react";

interface SmoothScrollLinkProps {
  href: string;
  children: ReactNode;
  className?: string;
}

export const SmoothScrollLink = ({ href, children, className }: SmoothScrollLinkProps) => {
  const { smoothScroll } = useSmoothScroll();

  return (
    <Link
      href={href}
      onClick={(e) => smoothScroll(e, href)}
      className={className}
    >
      {children}
    </Link>
  );
};
