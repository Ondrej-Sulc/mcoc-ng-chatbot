"use client";

import { MouseEvent } from 'react';

export const useSmoothScroll = () => {
  const smoothScroll = (e: MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    const targetId = href.replace(/.*#/, "");
    const elem = document.getElementById(targetId);
    elem?.scrollIntoView({
      behavior: 'smooth',
    });
  };

  return { smoothScroll };
};
