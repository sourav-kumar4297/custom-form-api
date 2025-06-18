// File: /api/generate-cashback-discount.js

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { customer_id, cashback_amount } = req.body;

  if (!customer_id || !cashback_amount) {
    return res.status(400).json({ error: "Missing customer_id or cashback_amount" });
  }

  const roundedAmount = Math.round(Number(cashback_amount));
  const SHOPIFY_STORE_DOMAIN = "demoessentiahome.myshopify.com";
  const ADMIN_API_ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_API_TOKEN;

  if (!ADMIN_API_ACCESS_TOKEN) {
    return res.status(500).json({ error: "Missing Shopify Admin API Token" });
  }

  const discountCode = `CB-${customer_id.slice(-4)}-${Date.now()}`;

  try {
    // Step 1: Create Price Rule
    const priceRuleRes = await fetch(`https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-04/price_rules.json`, {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": ADMIN_API_ACCESS_TOKEN,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        price_rule: {
          title: discountCode,
          target_type: "line_item",
          target_selection: "all",
          allocation_method: "across",
          value_type: "fixed_amount",
          value: `-${roundedAmount}`,
          customer_selection: "prerequisite",
          prerequisite_customer_ids: [parseInt(customer_id)],
          usage_limit: 1,
          starts_at: new Date().toISOString()
        }
      })
    });

    const priceRuleData = await priceRuleRes.json();

    if (!priceRuleRes.ok || !priceRuleData.price_rule) {
      console.error("❌ Price rule creation failed", priceRuleData);
      return res.status(500).json({ error: "Price rule creation failed", details: priceRuleData });
    }

    const priceRuleId = priceRuleData.price_rule.id;

    // Step 2: Create Discount Code
    const discountRes = await fetch(`https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-04/price_rules/${priceRuleId}/discount_codes.json`, {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": ADMIN_API_ACCESS_TOKEN,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        discount_code: {
          code: discountCode
        }
      })
    });

    const discountData = await discountRes.json();

    if (!discountRes.ok || !discountData.discount_code) {
      console.error("❌ Discount code creation failed", discountData);
      return res.status(500).json({ error: "Discount code creation failed", details: discountData });
    }

    // Final success response
    return res.status(200).json({
      success: true,
      code: discountData.discount_code.code,
      amount: roundedAmount
    });

  } catch (err) {
    console.error("❌ Internal Server Error:", err);
    return res.status(500).json({ error: "Internal server error", details: err.message });
  }
}
