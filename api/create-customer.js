export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://essentiahome.com");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  const SHOPIFY_STORE_DOMAIN = "demoessentiahome.myshopify.com";
  const ADMIN_API_ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_API_TOKEN;

  const customerInput = req.body.customer;

  try {
    // Step 1: Search existing customer by email
    const searchRes = await fetch(`https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-04/customers/search.json?query=email:${customerInput.email}`, {
      headers: {
        "X-Shopify-Access-Token": ADMIN_API_ACCESS_TOKEN,
        "Content-Type": "application/json"
      }
    });

    const searchData = await searchRes.json();
    const existingCustomer = searchData.customers?.[0];

    if (!existingCustomer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const customerId = existingCustomer.id;

    // Step 2: Update note and tags
    const updatedTags = [...new Set((existingCustomer.tags || "").split(",").map(tag => tag.trim()).concat(["trade_account"]))].join(", ");

    const updateCustomerRes = await fetch(`https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-04/customers/${customerId}.json`, {
      method: "PUT",
      headers: {
        "X-Shopify-Access-Token": ADMIN_API_ACCESS_TOKEN,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        customer: {
          id: customerId,
          tags: updatedTags,
          note: `Company: ${customerInput.company_name || "-"}, Billing: ${customerInput.billing_address || "-"}, Suite: ${customerInput.suite || "-"}, City: ${customerInput.city || "-"}, State: ${customerInput.state || "-"}, Country: ${customerInput.country || "-"}, ZIP: ${customerInput.zip || "-"}, GST: ${customerInput.gst || "-"}`
        }
      })
    });

    const updateData = await updateCustomerRes.json();
    if (!updateCustomerRes.ok) {
      console.error("Customer update failed:", updateData);
      return res.status(500).json({ error: "Failed to update existing customer" });
    }

    // Step 3: Create/Update metafields
    const metafields = [
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
    ];

    for (const metafield of metafields) {
      const saveMetaRes = await fetch(`https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-04/customers/${customerId}/metafields.json`, {
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": ADMIN_API_ACCESS_TOKEN,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ metafield })
      });

      const metaResData = await saveMetaRes.json();
      if (!saveMetaRes.ok && !metaResData?.errors?.includes("has already been taken")) {
        console.error("Metafield update failed:", metaResData);
        return res.status(500).json({ error: "Metafield creation failed" });
      }
    }

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error("Error:", err);
    return res.status(500).json({ error: "Internal Server Error", message: err.message });
  }
}
