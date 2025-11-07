"use client";

import Link from "next/link";
import { useSmoothScroll } from "@/hooks/useSmoothScroll";
import { MouseEvent, ReactNode } from "react";

interface SmoothScrollLinkProps {
  href: string;
  children: ReactNode;
  className?: string;
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
}

export const SmoothScrollLink = ({ href, children, className, onClick }: SmoothScrollLinkProps) => {
  const { smoothScroll } = useSmoothScroll();

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    smoothScroll(e, href);
    if (onClick) {
      onClick(e);
    }
  };

  return (
    <Link
      href={href}
      onClick={handleClick}
      className={className}
    >
      {children}
    </Link>
  );
};
