import { Variants, Transition } from 'motion/react';

// Buttery-smooth, responsive 60fps GPU-composited transitions (0.55s - 0.6s duration as requested)
export const hoverTransition: Transition = {
  type: "tween",
  duration: 0.55,
  ease: [0.22, 1, 0.36, 1],
};

// Pure transform-based hover effect with buttery smoothness
export const cardHover = {
  scale: 1.025,
  y: -5,
  transition: hoverTransition,
};

// Silky GPU-accelerated entry animation (0.55s duration)
export const entryVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 16,
  },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.55,
      ease: [0.22, 1, 0.36, 1],
      delay: Math.min(i * 0.03, 0.2),
    },
  }),
};

export const slideInVariants: Variants = {
  hidden: { x: -20, opacity: 0 },
  visible: {
    x: 0,
    opacity: 1,
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
  },
};

// Stagger container for lists and UI
export const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.03,
    },
  },
};

// Responsive, silky-smooth tab transition (0.55s - 0.6s duration)
export const tabTransition: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.58, ease: [0.22, 1, 0.36, 1] }
  },
  exit: { 
    opacity: 0,
    y: -10,
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] }
  },
};
