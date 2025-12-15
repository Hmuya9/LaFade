-- Update existing Standard plan with correct Stripe price ID
UPDATE "Plan"
SET 
  "stripePriceId" = 'price_1SaUJ3yBfxr20XaLCg8Iukmaj',
  "priceMonthly" = 4500
WHERE "name" = 'Standard' OR "name" = 'Standard Cut Membership';

-- Update existing Deluxe plan with correct Stripe price ID
UPDATE "Plan"
SET 
  "stripePriceId" = 'price_1SaUKWbfxr20XaLC3CEn5nep',
  "priceMonthly" = 9000
WHERE "name" = 'Deluxe' OR "name" = 'Deluxe Cut Membership';

-- Insert Standard plan if it doesn't exist
INSERT INTO "Plan" ("id", "name", "priceMonthly", "cutsPerMonth", "isHome", "stripePriceId")
SELECT 
  gen_random_uuid()::text,
  'Standard',
  4500,
  2,
  false,
  'price_1SaUJ3yBfxr20XaLCg8Iukmaj'
WHERE NOT EXISTS (
  SELECT 1 FROM "Plan" WHERE "stripePriceId" = 'price_1SaUJ3yBfxr20XaLCg8Iukmaj'
);

-- Insert Deluxe plan if it doesn't exist
INSERT INTO "Plan" ("id", "name", "priceMonthly", "cutsPerMonth", "isHome", "stripePriceId")
SELECT 
  gen_random_uuid()::text,
  'Deluxe',
  9000,
  2,
  true,
  'price_1SaUKWbfxr20XaLC3CEn5nep'
WHERE NOT EXISTS (
  SELECT 1 FROM "Plan" WHERE "stripePriceId" = 'price_1SaUKWbfxr20XaLC3CEn5nep'
);
