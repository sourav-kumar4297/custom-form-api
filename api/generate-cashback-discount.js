export default async function handler(req, res) {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Origin", "https://essentiahome.com");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { customer_id, customer_email, cashback_amount, cart_total } = req.body;

  if (!customer_id || !customer_email || cashback_amount === undefined || cart_total === undefined) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const roundedCartTotal = Math.round(Number(cart_total));
const cashback = Math.round(Number(cashback_amount));
const cart10Percent = (roundedCartTotal * 0.10);
console.log("🔍 Final Discount Calculation Check:");
console.log("🪙 Cashback:", cashback);
console.log("🧮 Cart 10%:", cart10Percent);
console.log("✅ Final Discount:", cashback + cart10Percent);


// Step 1: Lock boundaries
if (cashback < 0 || cart10Percent < 0) {
  return res.status(400).json({ error: "Invalid cashback or cart value" });
}

// Step 2: Calculate max allowed
const maxAllowedDiscount = cashback + cart10Percent;

// Step 3: Safety cap (e.g., max ₹10,000 discount?)
if (maxAllowedDiscount > 10000) {
  return res.status(400).json({ error: "Discount limit exceeded" });
}

// FINAL locked value
const totalDiscountAmount = maxAllowedDiscount;


  const discountCode = `CB${customer_id.slice(-4)}-${Date.now()}`;
  const SHOPIFY_STORE = "demoessentiahome.myshopify.com";
  const SHOPIFY_API_TOKEN = process.env.SHOPIFY_ADMIN_API_TOKEN;

  try {
    const response = await fetch(`https://${SHOPIFY_STORE}/admin/api/2023-10/price_rules.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": SHOPIFY_API_TOKEN,
      },
      body: JSON.stringify({
        price_rule: {
          title: `Trade-${discountCode}`,
          target_type: "line_item",
          target_selection: "all",
          allocation_method: "across",
          value_type: "fixed_amount",
          value: `-${totalDiscountAmount}`,
          customer_selection: "prerequisite",
          prerequisite_customer_ids: [customer_id],
          usage_limit: 1,
          starts_at: new Date().toISOString(),
          once_per_customer: true,
          combines_with: {
            order_discounts: false,
            product_discounts: false,
            shipping_discounts: false,
          }
        }
      })
    });

    const priceRuleData = await response.json();

    if (!priceRuleData.price_rule || !priceRuleData.price_rule.id) {
      console.error("❌ Price rule creation failed:", priceRuleData);
      return res.status(500).json({ error: "Failed to create price rule" });
    }

    const priceRuleId = priceRuleData.price_rule.id;

    const discountRes = await fetch(`https://${SHOPIFY_STORE}/admin/api/2023-10/price_rules/${priceRuleId}/discount_codes.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": SHOPIFY_API_TOKEN,
      },
      body: JSON.stringify({
        discount_code: {
          code: discountCode
        }
      })
    });

    const discountData = await discountRes.json();

    if (!discountData.discount_code || !discountData.discount_code.code) {
      console.error("❌ Discount code generation failed:", discountData);
      return res.status(500).json({ error: "Failed to create discount code" });
    }

    return res.status(200).json({ success: true, code: discountData.discount_code.code });
  } catch (err) {
    console.error("🔥 Internal server error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
