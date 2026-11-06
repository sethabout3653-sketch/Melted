import { Variants, Transition } from 'motion/react';

// Enhanced spring physics for "snappy" hover effects
export const hoverTransition: Transition = {
  type: "spring",
  stiffness: 500,
  damping: 20,
};

export const cardHover = {
  scale: 1.04,
  y: -8,
  rotate: 1,
  boxShadow: "0 20px 40px -15px rgba(6, 182, 212, 0.3)", // Cyan-500 glow
};

// Diversified entry variants
// We use a "custom" function to allow different animations or staggered delays
export const entryVariants: Variants = {
  hidden: (i: number = 0) => {
    const directions = ['up', 'down', 'left', 'right', 'scale'];
    const dir = directions[i % directions.length];
    const variants: Record<string, any> = {
      up: { opacity: 0, y: 30, scale: 0.9 },
      down: { opacity: 0, y: -30, scale: 0.9 },
      left: { opacity: 0, x: -30, scale: 0.9 },
      right: { opacity: 0, x: 30, scale: 0.9 },
      scale: { opacity: 0, scale: 0.5, rotate: -5 },
    };
    return variants[dir];
  },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    x: 0,
    scale: 1,
    rotate: 0,
    transition: {
      type: "spring",
      stiffness: 260,
      damping: 20,
      delay: i * 0.02,
    },
  }),
};

export const slideInVariants: Variants = {
  hidden: { x: -20, opacity: 0 },
  visible: {
    x: 0,
    opacity: 1,
    transition: { type: "spring", stiffness: 300, damping: 25 },
  },
};

// Stagger container for children
export const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
};

// Layout transitions for tabs
export const tabTransition: Variants = {
  initial: { opacity: 0, scale: 0.98, filter: 'blur(4px)' },
  animate: { opacity: 1, scale: 1, filter: 'blur(0px)' },
  exit: { opacity: 0, scale: 1.02, filter: 'blur(4px)' },
};
