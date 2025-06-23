export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://essentiahome.com");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  const SHOPIFY_STORE_DOMAIN = "demoessentiahome.myshopify.com";
  const ADMIN_API_ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_API_TOKEN;

  const customer = req.body.customer;

  try {
    // Step 1: Create the customer
    const response = await fetch(`https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-04/customers.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": ADMIN_API_ACCESS_TOKEN
      },
      body: JSON.stringify({ customer })
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data });

    const customerId = data.customer?.id;
    if (!customerId) return res.status(500).json({ error: "Customer ID not found after creation" });

    // Step 2: Add metafields for cashback_balance and cashback_preference
    const metafieldsPayload = {
      metafields: [
        {
          namespace: "custom",
          key: "cashback_balance",
          type: "number_decimal",
          value: "0"
        },
        {
          namespace: "cashback",
          key: "preference",
          type: "single_line_text_field",
          value: "discount"
        }
      ]
    };

    const metafieldRes = await fetch(`https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-04/customers/${customerId}/metafields.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": ADMIN_API_ACCESS_TOKEN
      },
      body: JSON.stringify(metafieldsPayload)
    });

    const metaData = await metafieldRes.json();
    if (!metafieldRes.ok) {
      console.error("Failed to create metafields:", metaData);
      return res.status(500).json({ error: "Customer created, but metafields failed" });
    }

    return res.status(200).json({ success: true, customer: data.customer });

  } catch (error) {
    console.error("Customer creation error:", error);
    return res.status(500).json({ error: "Server error", message: error.message });
  }
}
