'use client';

import React, { useEffect, useRef, useState } from 'react';

export default function AutoFitText({
  text,
  className,
  maxPx = 48,
  minPx = 20,
  step = 2,
}: {
  text: string;
  className?: string;
  maxPx?: number;
  minPx?: number;
  step?: number;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLSpanElement | null>(null);
  const [size, setSize] = useState(maxPx);

  useEffect(() => {
    const measure = () => {
      if (!containerRef.current || !contentRef.current) return;
      let s = maxPx;
      const maxWidth = containerRef.current.clientWidth || containerRef.current.offsetWidth;
      contentRef.current.style.fontSize = `${s}px`;
      contentRef.current.style.whiteSpace = 'nowrap';
      contentRef.current.style.display = 'inline-block';
      while (contentRef.current.scrollWidth > maxWidth && s > minPx) {
        s -= step;
        contentRef.current.style.fontSize = `${s}px`;
      }
      setSize(s);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [text, maxPx, minPx, step]);

  return (
    <div ref={containerRef} className="w-full overflow-hidden">
      <span ref={contentRef} className={className} style={{ fontSize: `${size}px` }}>
        {text}
      </span>
    </div>
  );
}
