const ADJECTIVES = [
  "swift", "keen", "bold", "sharp", "bright",
  "quick", "steady", "eagle", "iron", "silver",
  "golden", "alert", "sonic", "prime", "cyber",
];

const NOUNS = [
  "falcon", "hawk", "wolf", "bear", "bull",
  "trader", "scout", "signal", "apex", "ranger",
  "viper", "lynx", "titan", "pulse", "radar",
];

export function generateUsername(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(Math.random() * 900) + 100; // 100–999
  return `${adj}_${noun}_${num}`;
}
