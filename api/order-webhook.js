export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { line_items, total_price, customer } = req.body;

  const ADMIN_API_TOKEN = process.env.SHOPIFY_ADMIN_API_TOKEN;
  const STORE_DOMAIN = "demoessentiahome.myshopify.com";
  const API_VERSION = "2024-04";

  const cashbackAmount = (parseFloat(total_price) * 0.10).toFixed(2);

  try {
    // 1. Update metafield
    await fetch(`https://${STORE_DOMAIN}/admin/api/${API_VERSION}/customers/${customer.id}/metafields.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": ADMIN_API_TOKEN
      },
      body: JSON.stringify({
        metafield: {
          namespace: "custom",
          key: "cashback_balance",
          type: "single_line_text_field",
          value: `${cashbackAmount}`
        }
      })
    });

    // 2. Add tag `cashback_rewarded`
    const updatedTags = customer.tags ? `${customer.tags},cashback_rewarded` : "cashback_rewarded";

    await fetch(`https://${STORE_DOMAIN}/admin/api/${API_VERSION}/customers/${customer.id}.json`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": ADMIN_API_TOKEN
      },
      body: JSON.stringify({
        customer: {
          id: customer.id,
          tags: updatedTags
        }
      })
    });

    return res.status(200).json({ message: "Cashback metafield and tag added successfully." });
  } catch (error) {
    console.error("Webhook error:", error);
    return res.status(500).json({ error: "Failed to update cashback" });
  }
}
