export const EASINGS = {
  smooth: [0.215, 0.61, 0.355, 1] as const,
  easeOut: [0.165, 0.84, 0.44, 1] as const,
  spring: [0.175, 0.885, 0.32, 1.275] as const,
};

export const DURATIONS = {
  pageEnter: 0.4,
  contentSwitch: 0.3,
  accordion: 0.2,
  overlay: 0.2,
  buttonHover: 0.15,
} as const;
