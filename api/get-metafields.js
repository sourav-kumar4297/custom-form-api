export default async function handler(req, res) {
  // --- CORS headers ---
  res.setHeader("Access-Control-Allow-Origin", "https://essentiahome.com");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Handle preflight OPTIONS request
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // --- Main logic ---
  const { customer_id } = req.query;

  const SHOPIFY_STORE_DOMAIN = "yourstore.myshopify.com"; // replace with actual store domain
  const ADMIN_API_ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_API_TOKEN;

  try {
    const response = await fetch(`https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-04/customers/${customer_id}/metafields.json`, {
      method: "GET",
      headers: {
        "X-Shopify-Access-Token": ADMIN_API_ACCESS_TOKEN,
        "Content-Type": "application/json"
      }
    });

    const data = await response.json();

    const cashback = data.metafields.find(f => f.key === "cashback_balance");
    const preference = data.metafields.find(f => f.key === "cashback_preference");

    return res.status(200).json({
      cashback_balance: cashback?.value || "0",
      cashback_preference: preference?.value || ""
    });

  } catch (error) {
    console.error("Error fetching metafields:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
