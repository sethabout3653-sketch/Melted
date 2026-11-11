import { Variants, Transition } from 'motion/react';

// Highly optimized spring physics for 60fps GPU-composited motion
export const hoverTransition: Transition = {
  type: "spring",
  stiffness: 400,
  damping: 25,
  mass: 0.8,
};

// Pure transform-based hover effect without expensive boxShadow repaints
export const cardHover = {
  scale: 1.03,
  y: -5,
  transition: hoverTransition,
};

// Lightweight GPU-accelerated entry animation (transform & opacity only)
export const entryVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 12,
  },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 350,
      damping: 28,
      delay: Math.min(i * 0.015, 0.15), // Cap delay to prevent long queue lag
    },
  }),
};

export const slideInVariants: Variants = {
  hidden: { x: -12, opacity: 0 },
  visible: {
    x: 0,
    opacity: 1,
    transition: { type: "spring", stiffness: 350, damping: 28 },
  },
};

// Stagger container for children with minimal delay
export const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.02,
      delayChildren: 0.02,
    },
  },
};

// Pure transform and opacity tab transition with zero filter/blur rasterization
export const tabTransition: Variants = {
  initial: { opacity: 0, y: 4 },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.15, ease: "easeOut" }
  },
  exit: { 
    opacity: 0,
    transition: { duration: 0.1, ease: "easeIn" }
  },
};
