"use client";

import { MouseEvent } from 'react';

export const useSmoothScroll = () => {
  const smoothScroll = (e: MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    const targetId = href.replace(/.*#/, "");
    const elem = document.getElementById(targetId);
    if (!elem) return;

    const header = document.querySelector('header');
    const headerHeight = header ? header.offsetHeight : 0;

    const elemPosition = elem.getBoundingClientRect().top;
    const offsetPosition = elemPosition + window.pageYOffset - headerHeight;

    window.scrollTo({
      top: offsetPosition,
      behavior: 'smooth',
    });
  };

  return { smoothScroll };
};
