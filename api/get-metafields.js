export default async function handler(req, res) {
  const { customer_id } = req.query;

  const SHOPIFY_STORE_DOMAIN = "yourstore.myshopify.com";
  const ADMIN_API_ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_API_TOKEN;

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

  res.status(200).json({
    cashback_balance: cashback?.value || "0",
    cashback_preference: preference?.value || ""
  });
}
