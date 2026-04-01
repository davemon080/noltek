export const MARKET_CATEGORIES = [
  'Gadgets & Electronics',
  'Fashion & Apparel',
  'Home & Living',
  'Beauty & Personal Care',
  'Health & Wellness',
  'Groceries & Food',
] as const;

export type MarketCategory = (typeof MARKET_CATEGORIES)[number];
