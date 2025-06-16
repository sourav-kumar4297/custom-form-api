export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { customer_id, preference } = req.body;

  const SHOPIFY_STORE_DOMAIN = "yourstore.myshopify.com";
  const ADMIN_API_ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_API_TOKEN;

  const metafieldPayload = {
    metafield: {
      namespace: "rewards",
      key: "cashback_preference",
      type: "single_line_text_field",
      value: preference
    }
  };

  const response = await fetch(`https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-04/customers/${customer_id}/metafields.json`, {
    method: "POST",
    headers: {
      "X-Shopify-Access-Token": ADMIN_API_ACCESS_TOKEN,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(metafieldPayload)
  });

  const result = await response.json();

  if (!response.ok) {
    return res.status(500).json({ error: result });
  }

  return res.status(200).json({ success: true });
}
