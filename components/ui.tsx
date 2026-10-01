"use client";

import { motion, useInView, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useEffect, useRef, type ReactNode } from "react";

/* ------------------------------------------------------------- Reveal */
export function Reveal({
  children,
  delay = 0,
  y = 18,
  className,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------ AnimatedNumber */
export function AnimatedNumber({
  value,
  digits = 0,
  duration = 0.9,
  className,
  prefix = "",
  suffix = "",
}: {
  value: number;
  digits?: number;
  duration?: number;
  className?: string;
  prefix?: string;
  suffix?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { duration: duration * 1000, bounce: 0 });
  const text = useTransform(spring, (latest) => `${prefix}${latest.toFixed(digits)}${suffix}`);

  useEffect(() => {
    if (inView) mv.set(value);
  }, [inView, value, mv]);

  return (
    <motion.span ref={ref} className={className}>
      {text}
    </motion.span>
  );
}

/* -------------------------------------------------------------- Panel */
export function Panel({
  children,
  className = "",
  title,
  eyebrow,
  action,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  eyebrow?: string;
  action?: ReactNode;
}) {
  return (
    <section className={`panel relative overflow-hidden ${className}`}>
      {(title || eyebrow) && (
        <header className="flex items-center justify-between gap-4 border-b border-line-soft px-5 py-3.5">
          <div>
            {eyebrow && <p className="label-xs mb-1.5">{eyebrow}</p>}
            {title && <h2 className="text-[13px] font-semibold tracking-[0.14em] text-ink uppercase">{title}</h2>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

/* ------------------------------------------------------------- Labels */
export function Label({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`label-xs ${className}`}>{children}</p>;
}

export function Chip({
  children,
  active,
  onClick,
  color,
  className = "",
}: {
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
  color?: string;
  className?: string;
}) {
  const Tag = onClick ? "button" : "span";
  return (
    <Tag
      onClick={onClick}
      className={`label-xs rounded-full border px-2.5 py-1.5 transition-all duration-200 ${
        active
          ? "border-transparent text-void"
          : "border-line bg-panel-2/60 text-muted hover:border-faint hover:text-ink"
      } ${onClick ? "cursor-pointer" : ""} ${className}`}
      style={active ? { background: color ?? "var(--color-a)", color: "#06070a" } : undefined}
    >
      {children}
    </Tag>
  );
}

/* ------------------------------------------------------------- Bars */
export function Meter({
  value,
  max = 100,
  color = "var(--color-a)",
  height = 4,
  track = "#161a23",
}: {
  value: number;
  max?: number;
  color?: string;
  height?: number;
  track?: string;
}) {
  const pctValue = Math.max(0, Math.min(1, value / max));
  return (
    <div className="w-full overflow-hidden rounded-full" style={{ height, background: track }}>
      <motion.div
        className="h-full rounded-full"
        initial={{ width: 0 }}
        whileInView={{ width: `${pctValue * 100}%` }}
        viewport={{ once: true }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        style={{ background: color, boxShadow: `0 0 12px ${color}55` }}
      />
    </div>
  );
}

/* --------------------------------------------------------- SectionHead */
export function SectionHead({
  eyebrow,
  title,
  blurb,
  right,
}: {
  eyebrow: string;
  title: string;
  blurb?: string;
  right?: ReactNode;
}) {
  return (
    <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
      <div className="max-w-2xl">
        <p className="label-xs mb-3 text-a">{eyebrow}</p>
        <h1 className="text-[clamp(1.9rem,4.4vw,3.4rem)] leading-[1.02] font-semibold tracking-[-0.03em] text-ink">
          {title}
        </h1>
        {blurb && <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted">{blurb}</p>}
      </div>
      {right}
    </div>
  );
}

/* --------------------------------------------------------- Empty state */
export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-20 text-center">
      <p className="text-sm text-ink">{title}</p>
      {hint && <p className="max-w-sm text-xs text-faint">{hint}</p>}
    </div>
  );
}
