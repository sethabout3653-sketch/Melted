import { Variants, Transition } from 'motion/react';

// Highly optimized spring physics for 60fps GPU-composited motion
export const hoverTransition: Transition = {
  type: "tween",
  duration: 0.35,
  ease: [0.22, 1, 0.36, 1],
};

// Pure transform-based hover effect without expensive boxShadow repaints
export const cardHover = {
  scale: 1.02,
  y: -4,
  transition: hoverTransition,
};

// Lightweight GPU-accelerated entry animation (transform & opacity only)
export const entryVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 24,
  },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.16, 1, 0.3, 1],
      delay: Math.min(i * 0.04, 0.3),
    },
  }),
};

export const slideInVariants: Variants = {
  hidden: { x: -28, opacity: 0 },
  visible: {
    x: 0,
    opacity: 1,
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
  },
};

// Stagger container for children with minimal delay
export const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.05,
    },
  },
};

// Pure transform and opacity tab transition with zero filter/blur rasterization
export const tabTransition: Variants = {
  initial: { opacity: 0, y: 14, scale: 0.985 },
  animate: { 
    opacity: 1, 
    y: 0,
    scale: 1,
    transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] }
  },
  exit: { 
    opacity: 0,
    transition: { duration: 0.25, ease: [0.7, 0, 0.84, 0] }
  },
};
