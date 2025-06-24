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
    let customerId = searchData.customers?.[0]?.id;

    if (customerId) {
      // Step 2A: Update existing customer
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
        return res.status(500).json({ error: "Existing customer update failed" });
      }
    } else {
      // Step 2B: Create new customer
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
      if (!customerId) {
        return res.status(500).json({ error: "Customer created but ID missing" });
      }
    }

    // Step 3: Add or update metafields
    const metafieldsPayload = {
      metafields: [
        {
          namespace: "custom",
          key: "cashback_balance",
          type: "number_decimal",
          value: "0",
        },
        {
          namespace: "cashback",
          key: "preference",
          type: "single_line_text_field",
          value: "discount",
        },
      ],
    };

    const metafieldRes = await fetch(
      `https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-04/customers/${customerId}/metafields.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": ADMIN_API_ACCESS_TOKEN,
        },
        body: JSON.stringify(metafieldsPayload),
      }
    );

    const metaData = await metafieldRes.json();
    if (!metafieldRes.ok) {
      console.error("Metafield creation failed:", metaData);
      return res.status(200).json({
        success: true,
        warning: "Customer updated but preference settings failed",
      });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Unexpected server error:", error);
    return res.status(500).json({ error: "Unexpected server error", message: error.message });
  }
}
