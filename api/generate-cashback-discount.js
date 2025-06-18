export default async function handler(req, res) {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Origin", "https://essentiahome.com");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Handle preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { customer_id, customer_email, cashback_amount } = req.body;

  if (!customer_id || !customer_email) {
    return res.status(400).json({ error: "Missing customer_id or customer_email" });
  }

  const roundedCashback = Math.round(parseFloat(cashback_amount || "0"));

  // If cashback is 0 or not a number, skip creating discount
  if (!roundedCashback || isNaN(roundedCashback) || roundedCashback <= 0) {
    return res.status(200).json({
      success: false,
      message: "Cashback is zero or invalid, no discount code created."
    });
  }

  const discountCode = `CB${customer_id.slice(-4)}-${Date.now()}`;
  const SHOPIFY_ADMIN_API_TOKEN = process.env.SHOPIFY_ADMIN_API_TOKEN;

  const payload = {
    discount_code: {
      code: discountCode,
      value_type: "fixed_amount",
      value: roundedCashback,
      usage_limit: 1,
      applies_once: true,
      customer_selection: "prerequisite",
      prerequisite_customer_ids: [customer_id],
      starts_at: new Date().toISOString()
    }
  };

  try {
    const response = await fetch(
      "https://demoessentiahome.myshopify.com/admin/api/2024-04/discounts/code.json",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": SHOPIFY_ADMIN_API_TOKEN
        },
        body: JSON.stringify(payload)
      }
    );

    const data = await response.json();

    if (!response.ok || !data.discount_code) {
      console.error("❌ Failed to create discount:", data);
      return res.status(500).json({ error: "Discount creation failed", details: data });
    }

    return res.status(200).json({ success: true, code: data.discount_code.code });
  } catch (err) {
    console.error("❌ Server error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
