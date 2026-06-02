export const springGentle = { type: "spring", stiffness: 180, damping: 20, mass: 0.8 } as const;
export const springBounce = { type: "spring", stiffness: 260, damping: 15, mass: 0.7 } as const;
export const pop = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: { opacity: 1, scale: 1, transition: springBounce },
} as const;
export const slideUp = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: springGentle },
} as const;
export const confetti = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
} as const;
export const mascotIdle = {
  animate: { y: [0, -3, 0], transition: { duration: 3.6, repeat: Infinity, ease: "easeInOut" } },
} as const;
export const mascotCelebrate = {
  animate: {
    rotate: [0, -8, 8, 0],
    scale: [1, 1.04, 1],
    transition: { duration: 0.9, repeat: Infinity, repeatDelay: 1.2 },
  },
} as const;

export const MOTION_VARIANTS = {
  springGentle,
  springBounce,
  pop,
  slideUp,
  confetti,
  mascotIdle,
  mascotCelebrate,
} as const;
