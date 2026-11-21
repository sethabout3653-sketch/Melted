import { Variants, Transition } from 'motion/react';

// Luxurious, buttery-smooth spring physics for 60fps GPU-composited motion
export const hoverTransition: Transition = {
  type: "tween",
  duration: 0.3,
  ease: [0.22, 1, 0.36, 1],
};

// Pure transform-based hover effect without expensive boxShadow repaints
export const cardHover = {
  scale: 1.03,
  y: -6,
  transition: hoverTransition,
};

// Rich GPU-accelerated entry animation (transform & opacity only)
export const entryVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 18,
  },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.55,
      ease: [0.16, 1, 0.3, 1],
      delay: Math.min(i * 0.04, 0.25),
    },
  }),
};

export const slideInVariants: Variants = {
  hidden: { x: -24, opacity: 0 },
  visible: {
    x: 0,
    opacity: 1,
    transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] },
  },
};

// Stagger container for children with smooth delay
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

// Pure transform and opacity tab transition with buttery smooth 0.6s duration
export const tabTransition: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] }
  },
  exit: { 
    opacity: 0,
    y: -8,
    transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] }
  },
};
