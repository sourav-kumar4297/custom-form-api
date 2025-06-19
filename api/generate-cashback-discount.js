// ✅ File: /api/generate-cashback-discount.js (for Vercel)

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Origin", "https://essentiahome.com");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { customer_id, customer_email, cashback_amount, cart_total } = req.body;
  if (!customer_id || !customer_email || cashback_amount == null || cart_total == null) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const totalDiscount = Math.round(cashback_amount + cart_total * 0.10);
  const code = `CB${customer_id.slice(-4)}-${Date.now()}`;
  const SHOPIFY_ADMIN_API_TOKEN = process.env.SHOPIFY_ADMIN_API_TOKEN;
  const STORE = "demoessentiahome.myshopify.com";

  try {
    // 1. Create Price Rule
    const priceRuleRes = await fetch(`https://${STORE}/admin/api/2024-04/price_rules.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": SHOPIFY_ADMIN_API_TOKEN
      },
      body: JSON.stringify({
        price_rule: {
          title: code,
          target_type: "line_item",
          target_selection: "all",
          allocation_method: "across",
          value_type: "fixed_amount",
          value: `-${totalDiscount}`,
          customer_selection: "prerequisite",
          prerequisite_customer_ids: [customer_id],
          starts_at: new Date().toISOString(),
          usage_limit: 1,
          once_per_customer: true,
          applies_once: true
        }
      })
    });

    const ruleData = await priceRuleRes.json();
    const priceRule = ruleData.price_rule;

    if (!priceRule || !priceRule.id) {
      return res.status(500).json({ error: "Failed to create price rule" });
    }

    // 2. Create Discount Code
    const discountRes = await fetch(`https://${STORE}/admin/api/2024-04/price_rules/${priceRule.id}/discount_codes.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": SHOPIFY_ADMIN_API_TOKEN
      },
      body: JSON.stringify({
        discount_code: {
          code
        }
      })
    });

    const discountData = await discountRes.json();
    const discountCode = discountData.discount_code;

    if (!discountCode) {
      return res.status(500).json({ error: "Failed to create discount code" });
    }

    return res.status(200).json({ success: true, code });
  } catch (err) {
    console.error("Server Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
