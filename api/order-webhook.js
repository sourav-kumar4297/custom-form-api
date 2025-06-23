export default async function handler(req, res) {
  // CORS setup
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', 'https://essentiahome.com');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  res.setHeader('Access-Control-Allow-Origin', 'https://essentiahome.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { customer_id, preference } = req.body;

  const SHOPIFY_STORE_DOMAIN = "demoessentiahome.myshopify.com";
  const ADMIN_API_ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_API_TOKEN;

  try {
    // 🧠 Get Customer
    const getCustomer = await fetch(`https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-04/customers/${customer_id}.json`, {
      headers: {
        "X-Shopify-Access-Token": ADMIN_API_ACCESS_TOKEN,
        "Content-Type": "application/json"
      }
    });

    const customerData = await getCustomer.json();
    const currentTags = customerData.customer.tags.split(',').map(tag => tag.trim());

    // 🏷️ Update customer tag: cashback_preference:<value>
    const updatedTags = currentTags.filter(tag => !tag.startsWith('cashback_preference:'));
    updatedTags.push(`cashback_preference:${preference}`);

    const updateRes = await fetch(`https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-04/customers/${customer_id}.json`, {
      method: "PUT",
      headers: {
        "X-Shopify-Access-Token": ADMIN_API_ACCESS_TOKEN,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        customer: {
          id: customer_id,
          tags: updatedTags.join(', ')
        }
      })
    });

    if (!updateRes.ok) {
      const errData = await updateRes.json();
      throw new Error(errData.errors || "Failed to update tags");
    }

    // 🔎 Check if metafield already exists
    const metafieldCheck = await fetch(`https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-04/customers/${customer_id}/metafields.json`, {
      headers: {
        "X-Shopify-Access-Token": ADMIN_API_ACCESS_TOKEN,
        "Content-Type": "application/json"
      }
    });

    const metafields = await metafieldCheck.json();
    const hasPreferenceField = metafields.metafields?.some(mf => mf.namespace === 'cashback' && mf.key === 'preference');

    // 🛠️ If not found, create preference metafield
    if (!hasPreferenceField) {
      const createMetaRes = await fetch(`https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-04/customers/${customer_id}/metafields.json`, {
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": ADMIN_API_ACCESS_TOKEN,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          metafield: {
            namespace: "cashback",
            key: "preference",
            type: "single_line_text_field",
            value: preference || "discount"
          }
        })
      });

      if (!createMetaRes.ok) {
        const errData = await createMetaRes.json();
        console.warn("⚠️ Metafield creation warning:", errData);
      }
    }

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error("💥 Preference Update Failed:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
