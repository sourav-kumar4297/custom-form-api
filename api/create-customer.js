// Backend code to allow existing customers to apply for trade account with metafields
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
    // Step 1: Search for existing customer by email
    const searchRes = await fetch(`https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-04/customers/search.json?query=email:${customer.email}`, {
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": ADMIN_API_ACCESS_TOKEN
      }
    });

    const searchData = await searchRes.json();
    let customerId = searchData.customers?.[0]?.id;

    // Step 2: If not found, create the customer
    if (!customerId) {
      const createRes = await fetch(`https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-04/customers.json`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": ADMIN_API_ACCESS_TOKEN
        },
        body: JSON.stringify({ customer })
      });

      const createData = await createRes.json();
      if (!createRes.ok) return res.status(createRes.status).json({ error: createData });
      customerId = createData.customer?.id;
      if (!customerId) return res.status(500).json({ error: "Customer created, but ID missing" });
    }

    // Step 3: Add/Update metafields
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
      console.error("Metafield creation failed:", metaData);
      return res.status(500).json({ error: "Customer found/created but metafields failed" });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({ error: "Unexpected server error", message: error.message });
  }
}
