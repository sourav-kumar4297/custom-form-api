export default async function handler(req, res) {
  // --- CORS headers ---
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', 'https://essentiahome.com');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.status(200).end();
    return;
  }

  res.setHeader('Access-Control-Allow-Origin', 'https://essentiahome.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { customer_id, preference } = req.body;

  const SHOPIFY_STORE_DOMAIN = "demoessentiahome.myshopify.com"; 
  const ADMIN_API_ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_API_TOKEN;

  try {
    // First, check if the metafield already exists
    const getRes = await fetch(`https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-04/customers/${customer_id}/metafields.json`, {
      method: "GET",
      headers: {
        "X-Shopify-Access-Token": ADMIN_API_ACCESS_TOKEN,
        "Content-Type": "application/json"
      }
    });

    const getData = await getRes.json();
    const existing = getData.metafields.find(f => f.key === "cashback_preference");

    const metafieldPayload = {
      metafield: {
        namespace: "custom",
        key: "cashback_preference",
        type: "single_line_text_field",
        value: preference
      }
    };

    const method = existing ? "PUT" : "POST";
    const url = existing
      ? `https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-04/metafields/${existing.id}.json`
      : `https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-04/customers/${customer_id}/metafields.json`;

    const saveRes = await fetch(url, {
      method,
      headers: {
        "X-Shopify-Access-Token": ADMIN_API_ACCESS_TOKEN,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(metafieldPayload)
    });

    const saveData = await saveRes.json();

    if (!saveRes.ok) {
      throw new Error(saveData.errors || "Failed to save metafield");
    }

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error("Error saving preference:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
