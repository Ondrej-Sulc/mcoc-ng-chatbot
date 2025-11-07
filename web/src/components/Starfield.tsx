'use client';

import { useEffect, useRef } from 'react';

export const Starfield = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let stars: { x: number; y: number; z: number }[] = [];
    const numStars = 500;

    const setup = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      stars = [];
      for (let i = 0; i < numStars; i++) {
        stars.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          z: Math.random() * canvas.width,
        });
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';

      ctx.beginPath();
      for (let i = 0; i < numStars; i++) {
        const star = stars[i];
        const x = (star.x - canvas.width / 2) * (canvas.width / star.z) + canvas.width / 2;
        const y = (star.y - canvas.height / 2) * (canvas.width / star.z) + canvas.height / 2;
        const r = Math.max(0.1, 2.5 * (1 - star.z / canvas.width));

        ctx.moveTo(x, y);
        ctx.arc(x, y, r, 0, Math.PI * 2);

        star.z -= 0.7; // Speed of stars
        if (star.z <= 0) {
          star.z = canvas.width;
        }
      }
      ctx.fill();
    };

    let animationFrameId: number;
    const animate = () => {
      draw();
      animationFrameId = window.requestAnimationFrame(animate);
    };

    const handleResize = () => {
      window.cancelAnimationFrame(animationFrameId);
      setup();
      animate();
    };

    setup();
    animate();

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed top-0 left-0 w-full h-full z-0 opacity-20 pointer-events-none"
    />
  );
};