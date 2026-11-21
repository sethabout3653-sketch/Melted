import { Variants, Transition } from 'motion/react';

// Buttery-smooth, responsive 60fps GPU-composited transitions (transform & opacity only)
export const hoverTransition: Transition = {
  type: "tween",
  duration: 0.24,
  ease: [0.22, 1, 0.36, 1],
};

// Pure transform-based hover effect without expensive boxShadow repaints
export const cardHover = {
  scale: 1.025,
  y: -5,
  transition: hoverTransition,
};

// Snappy yet silky GPU-accelerated entry animation (transform & opacity only)
export const entryVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 12,
  },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.32,
      ease: [0.22, 1, 0.36, 1],
      delay: Math.min(i * 0.02, 0.14),
    },
  }),
};

export const slideInVariants: Variants = {
  hidden: { x: -16, opacity: 0 },
  visible: {
    x: 0,
    opacity: 1,
    transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] },
  },
};

// Stagger container for lightweight lists
export const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.025,
      delayChildren: 0.02,
    },
  },
};

// Responsive, silky-smooth tab transition without sluggish 1s wait delays
export const tabTransition: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] }
  },
  exit: { 
    opacity: 0,
    y: -6,
    transition: { duration: 0.14, ease: [0.22, 1, 0.36, 1] }
  },
};
