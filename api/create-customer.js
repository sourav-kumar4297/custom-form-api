export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://essentiahome.com");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  const SHOPIFY_STORE_DOMAIN = "demoessentiahome.myshopify.com";
  const ADMIN_API_ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_API_TOKEN;

  const customer = req.body.customer;
  if (!customer || !customer.email) {
    return res.status(400).json({ error: "Missing required customer email" });
  }

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

    if (!customerId) {
      // Step 2: Customer not found — Create new
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
    } else {
      // Step 3: Customer exists — Update fields except password if empty
      const updateBody = {
        customer: {
          id: customerId,
          first_name: customer.first_name,
          last_name: customer.last_name,
          phone: customer.phone,
          note: customer.note,
          tags: customer.tags
        }
      };

      if (customer.password) {
        updateBody.customer.password = customer.password;
        updateBody.customer.password_confirmation = customer.password_confirmation;
      }

      const updateRes = await fetch(`https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-04/customers/${customerId}.json`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": ADMIN_API_ACCESS_TOKEN
        },
        body: JSON.stringify(updateBody)
      });

      const updateData = await updateRes.json();
      if (!updateRes.ok) return res.status(updateRes.status).json({ error: updateData });
    }

    // Step 4: Fetch existing metafields
    const existingMetaRes = await fetch(`https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-04/customers/${customerId}/metafields.json`, {
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": ADMIN_API_ACCESS_TOKEN
      }
    });

    const existingMetaData = await existingMetaRes.json();
    const existingMetas = existingMetaData.metafields || [];

    const hasBalance = existingMetas.some(m => m.key === "cashback_balance" && m.namespace === "custom");
    const hasPreference = existingMetas.some(m => m.key === "preference" && m.namespace === "cashback");

    // Step 5: Prepare only missing metafields
    const metafieldsPayload = [];

    if (!hasBalance) {
      metafieldsPayload.push({
        namespace: "custom",
        key: "cashback_balance",
        type: "number_decimal",
        value: "0"
      });
    }

    if (!hasPreference) {
      metafieldsPayload.push({
        namespace: "cashback",
        key: "preference",
        type: "single_line_text_field",
        value: "discount"
      });
    }

    // Step 6: Create metafields only if needed
    if (metafieldsPayload.length > 0) {
      const metaRes = await fetch(`https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-04/customers/${customerId}/metafields.json`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": ADMIN_API_ACCESS_TOKEN
        },
        body: JSON.stringify({ metafields: metafieldsPayload })
      });

      if (!metaRes.ok) {
        const metaErr = await metaRes.json();
        return res.status(500).json({ error: "Customer saved but metafields failed", detail: metaErr });
      }
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Unexpected server error:", error);
    return res.status(500).json({ error: "Unexpected server error", message: error.message });
  }
}
