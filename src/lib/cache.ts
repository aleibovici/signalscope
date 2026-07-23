export class TTLCache<T> {
  private cache = new Map<string, { value: T; expiresAt: number }>();

  constructor(private ttlMs: number, private maxEntries: number = 100) {}

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() >= entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.value;
  }

  clear(): void {
    this.cache.clear();
  }

  set(key: string, value: T): void {
    if (this.cache.size >= this.maxEntries) {
      const now = Date.now();
      for (const [k, v] of this.cache) {
        if (now >= v.expiresAt) this.cache.delete(k);
      }
      if (this.cache.size >= this.maxEntries) {
        const oldest = [...this.cache.entries()].sort(
          (a, b) => a[1].expiresAt - b[1].expiresAt
        )[0];
        if (oldest) this.cache.delete(oldest[0]);
      }
    }
    this.cache.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }
}
