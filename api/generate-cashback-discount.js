export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://essentiahome.com");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { customer_id, customer_email, cashback_amount, cart_total } = req.body;

  console.log("📥 Incoming Payload:", req.body);

  if (!customer_id || !customer_email || cashback_amount === undefined || cart_total === undefined) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const cartTotalRaw = Number(cart_total);
  const cashbackRaw = Number(cashback_amount);
  const cart10Percent = (cartTotalRaw * 0.10);
  const totalDiscountAmount = cashbackRaw + cart10Percent;

  console.log("🧮 Raw Values:");
  console.log("🪙 Cashback =", cashbackRaw);
  console.log("📦 10% of Cart =", cart10Percent);
  console.log("🧾 Final Discount to Apply =", totalDiscountAmount);

  // Double Check Safety
  if (isNaN(cashbackRaw) || isNaN(cart10Percent)) {
    return res.status(400).json({ error: "Invalid number values" });
  }

  if (cashbackRaw < 0 || cart10Percent < 0) {
    return res.status(400).json({ error: "Invalid cashback or cart value" });
  }

  if (totalDiscountAmount > 10000) {
    return res.status(400).json({ error: "Discount cap exceeded" });
  }

  const discountCode = `CB${customer_id.slice(-4)}-${Date.now()}`;
  const SHOPIFY_STORE = "demoessentiahome.myshopify.com";
  const SHOPIFY_API_TOKEN = process.env.SHOPIFY_ADMIN_API_TOKEN;

  try {
    const priceRuleRes = await fetch(`https://${SHOPIFY_STORE}/admin/api/2023-10/price_rules.json`, {
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
          value: `-${totalDiscountAmount.toFixed(2)}`, // 💡 allow decimal value string
          customer_selection: "prerequisite",
          prerequisite_customer_ids: [customer_id],
          usage_limit: 1,
          starts_at: new Date().toISOString(),
          once_per_customer: true,
          combines_with: {
            order_discounts: false,
            product_discounts: false,
            shipping_discounts: false,
          },
          ends_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        }
      })
    });

    const priceRuleData = await priceRuleRes.json();
    if (!priceRuleData.price_rule || !priceRuleData.price_rule.id) {
      console.error("❌ Price rule creation failed:", await priceRuleRes.text());
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
      console.error("❌ Discount code generation failed:", await discountRes.text());
      return res.status(500).json({ error: "Failed to create discount code" });
    }

    console.log("✅ Final Discount Code:", discountData.discount_code.code);
    return res.status(200).json({ success: true, code: discountData.discount_code.code });

  } catch (err) {
    console.error("🔥 Internal server error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
