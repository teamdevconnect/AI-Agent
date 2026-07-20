export function delay(ms = 500): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function randomDelay(min = 300, max = 800): Promise<void> {
  return delay(min + Math.random() * (max - min));
}
