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
    // Step 1: Search customer by email
    const searchRes = await fetch(
      `https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-04/customers/search.json?query=email:${customer.email}`,
      {
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": ADMIN_API_ACCESS_TOKEN,
        },
      }
    );

    const searchData = await searchRes.json();
    let existingCustomer = searchData.customers?.[0];
    let customerId = existingCustomer?.id;

    // Step 2: Create or update customer
    if (customerId) {
      // Update details and password
      const updateRes = await fetch(
        `https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-04/customers/${customerId}.json`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": ADMIN_API_ACCESS_TOKEN,
          },
          body: JSON.stringify({ customer: { ...customer, id: customerId } }),
        }
      );

      const updateData = await updateRes.json();
      if (!updateRes.ok) {
        console.error("Customer update failed:", updateData);
        return res.status(500).json({ error: "Failed to update existing customer" });
      }
    } else {
      // Create new customer
      const createRes = await fetch(
        `https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-04/customers.json`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": ADMIN_API_ACCESS_TOKEN,
          },
          body: JSON.stringify({ customer }),
        }
      );

      const createData = await createRes.json();
      if (!createRes.ok) {
        console.error("Customer creation failed:", createData);
        return res.status(500).json({ error: "Customer creation failed" });
      }

      customerId = createData.customer?.id;
      if (!customerId) return res.status(500).json({ error: "Customer created but ID missing" });
    }

    // Step 3: Get existing metafields
    const metaGetRes = await fetch(
      `https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-04/customers/${customerId}/metafields.json`,
      {
        headers: {
          "X-Shopify-Access-Token": ADMIN_API_ACCESS_TOKEN,
          "Content-Type": "application/json",
        },
      }
    );
    const metaData = await metaGetRes.json();

    const cashbackField = metaData.metafields.find(m => m.key === "cashback_balance" && m.namespace === "custom");
    const preferenceField = metaData.metafields.find(m => m.key === "preference" && m.namespace === "cashback");

    // Step 4: Create or update cashback_balance
    const updateOrCreate = async ({ id, namespace, key, type, value }) => {
      const method = id ? "PUT" : "POST";
      const url = id
        ? `https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-04/metafields/${id}.json`
        : `https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-04/customers/${customerId}/metafields.json`;

      const payload = {
        metafield: { ...(id && { id }), namespace, key, type, value },
      };

      const res = await fetch(url, {
        method,
        headers: {
          "X-Shopify-Access-Token": ADMIN_API_ACCESS_TOKEN,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (!res.ok) {
        console.error(`Failed to ${method === "POST" ? "create" : "update"} ${key}:`, result);
        throw new Error(`Metafield ${key} update failed`);
      }
    };

    await updateOrCreate({
      id: cashbackField?.id,
      namespace: "custom",
      key: "cashback_balance",
      type: "number_decimal",
      value: cashbackField?.value || "0",
    });

    await updateOrCreate({
      id: preferenceField?.id,
      namespace: "cashback",
      key: "preference",
      type: "single_line_text_field",
      value: "discount",
    });

    return res.status(200).json({
      success: true,
      message: customerId ? "Customer created/updated and trade details saved" : "Account created",
    });
  } catch (error) {
    console.error("Unexpected server error:", error);
    return res.status(500).json({ error: "Unexpected server error", message: error.message });
  }
}
