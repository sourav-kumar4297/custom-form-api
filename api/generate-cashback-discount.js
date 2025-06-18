export default async function handler(req, res) {
  // Handle preflight CORS request
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', 'https://essentiahome.com');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  res.setHeader('Access-Control-Allow-Origin', 'https://essentiahome.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { customer_id, cashback_amount, cart_total } = req.body;

  if (!customer_id || cashback_amount === undefined || cart_total === undefined) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const SHOPIFY_STORE_DOMAIN = "demoessentiahome.myshopify.com";
  const ADMIN_API_ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_API_TOKEN;

  const roundedCashback = Math.round(parseFloat(cashback_amount));
  const tenPercent = Math.round(parseFloat(cart_total) * 0.10);
  const totalDiscount = roundedCashback + tenPercent;

  const generatedCode = `CB-${customer_id.slice(-4)}-${Date.now()}`;

  try {
    const response = await fetch(`https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-04/discounts/code.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": ADMIN_API_ACCESS_TOKEN,
      },
      body: JSON.stringify({
        discount_code: {
          code: generatedCode,
          value_type: "fixed_amount",
          value: totalDiscount,
          usage_limit: 1,
          applies_once: true,
          customer_selection: "prerequisite",
          prerequisite_customer_ids: [customer_id],
          starts_at: new Date().toISOString(),
        },
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.discount_code) {
      console.error("❌ Failed to create discount:", data);
      return res.status(500).json({ error: "Failed to create discount code" });
    }

    return res.status(200).json({
      success: true,
      code: data.discount_code.code,
      amount: totalDiscount,
      cashback_used: roundedCashback,
    });

  } catch (error) {
    console.error("❌ Internal error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
