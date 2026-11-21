import { Variants, Transition } from 'motion/react';

// Highly optimized spring physics for 60fps GPU-composited motion
export const hoverTransition: Transition = {
  type: "tween",
  duration: 0.16,
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
    y: 12,
  },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.22,
      ease: [0.16, 1, 0.3, 1],
      delay: Math.min(i * 0.02, 0.12),
    },
  }),
};

export const slideInVariants: Variants = {
  hidden: { x: -16, opacity: 0 },
  visible: {
    x: 0,
    opacity: 1,
    transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] },
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
  initial: { opacity: 0, y: 6 },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.14, ease: [0.16, 1, 0.3, 1] }
  },
  exit: { 
    opacity: 0,
    transition: { duration: 0.08, ease: [0.7, 0, 0.84, 0] }
  },
};
