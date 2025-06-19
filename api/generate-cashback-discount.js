export default async function handler(req, res) {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Origin", "https://essentiahome.com");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { customer_id, customer_email, cashback_amount } = req.body;

  if (!customer_id || !customer_email || cashback_amount === undefined) {
    console.error("❌ Missing fields:", { customer_id, customer_email, cashback_amount });
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const totalDiscount = (Math.round(cashback_amount * 100) / 100).toFixed(2); // round to 2 decimals
    const discountCode = `CB${customer_id.slice(-4)}-${Date.now()}`;
    const adminToken = process.env.SHOPIFY_ADMIN_API_TOKEN;

    const discountPayload = {
      discount_code: {
        code: discountCode,
        usage_limit: 1,
        customer_selection: "prerequisite",
        customer_ids: [Number(customer_id)],
        starts_at: new Date().toISOString(),
        applies_once: true,
        combines_with_discount_applications: false,
        value_type: "fixed_amount",
        value: parseFloat(totalDiscount),
        applies_to: { all: true }
      }
    };

    const response = await fetch("https://demoessentiahome.myshopify.com/admin/api/2023-10/price_rules.json", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": adminToken
      },
      body: JSON.stringify(discountPayload)
    });

    const result = await response.json();

    if (!result.discount_code || !result.discount_code.code) {
      console.error("❌ Shopify discount API failed:", result);
      return res.status(500).json({ error: "Failed to create discount code" });
    }

    const finalCode = result.discount_code.code;
    return res.status(200).json({ success: true, code: finalCode });

  } catch (err) {
    console.error("🔥 Server error while creating discount:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
