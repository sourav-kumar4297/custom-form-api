export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://essentiahome.com");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { customer_id, customer_email, cashback_amount, cart_total } = req.body;
  if (!customer_id || !customer_email || cashback_amount === undefined || cart_total === undefined) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const SHOPIFY_STORE = "demoessentiahome.myshopify.com";
  const SHOPIFY_API_TOKEN = process.env.SHOPIFY_ADMIN_API_TOKEN;

  try {
    // ⏳ Get updated preference
    const customerRes = await fetch(`https://${SHOPIFY_STORE}/admin/api/2023-10/customers/${customer_id}.json`, {
      headers: {
        "X-Shopify-Access-Token": SHOPIFY_API_TOKEN,
        "Content-Type": "application/json",
      },
    });

    const customerData = await customerRes.json();
    const tags = customerData.customer.tags.split(',').map(t => t.trim().toLowerCase());
    const hasDiscountPreference = tags.includes("cashback_preference:discount");

    // 🎯 Calculate discount
    const rawCartTotal = Number(cart_total);
    const cashback = hasDiscountPreference ? Number(cashback_amount) : 0;
    const cart10Percent = rawCartTotal * 0.10;
    const totalDiscount = cashback + cart10Percent;

    console.log("🧠 Customer Tags:", tags);
    console.log("💡 Preference:", hasDiscountPreference ? "discount" : "bank");
    console.log("💰 Cashback:", cashback);
    console.log("totalcart amount", rawCartTotal);
    console.log("🧮 Cart 10%:", cart10Percent);
    console.log("✅ Total Discount:", totalDiscount);

    const discountCode = `CB${String(customer_id).slice(-4)}-${Date.now()}`;

    // 🔧 Create Price Rule
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
          value: `-${Math.round(totalDiscount)}`,
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
      console.error("❌ Price Rule Error:", await priceRuleRes.text());
      return res.status(500).json({ error: "Price rule creation failed" });
    }

    const ruleId = priceRuleData.price_rule.id;

    // 🎟 Create Discount Code
    const discountCodeRes = await fetch(`https://${SHOPIFY_STORE}/admin/api/2023-10/price_rules/${ruleId}/discount_codes.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": SHOPIFY_API_TOKEN,
      },
      body: JSON.stringify({
        discount_code: { code: discountCode }
      })
    });

    const discountData = await discountCodeRes.json();
    if (!discountData.discount_code || !discountData.discount_code.code) {
      console.error("❌ Discount Code Error:", await discountCodeRes.text());
      return res.status(500).json({ error: "Discount code creation failed" });
    }

    return res.status(200).json({ success: true, code: discountData.discount_code.code });

  } catch (err) {
    console.error("🔥 Internal Server Error:", err);
    return res.status(500).json({ error: "Something went wrong" });
  }
}
