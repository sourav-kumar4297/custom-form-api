export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://essentiahome.com");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  const SHOPIFY_STORE_DOMAIN = "demoessentiahome.myshopify.com";
  const ADMIN_API_ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_API_TOKEN;

  const input = req.body.customer;

  try {
    // 1. Search existing customer
    const searchRes = await fetch(`https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-04/customers/search.json?query=email:${input.email}`, {
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": ADMIN_API_ACCESS_TOKEN
      }
    });

    const searchData = await searchRes.json();
    const existingCustomer = searchData.customers?.[0];
    let customerId = null;

    if (existingCustomer) {
      customerId = existingCustomer.id;

      // 2. Update tags and note
      const tagsSet = new Set((existingCustomer.tags || "").split(",").map(t => t.trim()));
      tagsSet.add("trade_account");
      const updatedTags = Array.from(tagsSet).join(", ");

      const updateCustomerPayload = {
        customer: {
          id: customerId,
          tags: updatedTags,
          note: input.note || existingCustomer.note || ""
        }
      };

      const updateRes = await fetch(`https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-04/customers/${customerId}.json`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": ADMIN_API_ACCESS_TOKEN
        },
        body: JSON.stringify(updateCustomerPayload)
      });

      if (!updateRes.ok) {
        const updateErr = await updateRes.json();
        return res.status(400).json({ error: "Failed to update existing customer", detail: updateErr });
      }
    } else {
      // 3. Create new customer
      const createPayload = {
        customer: {
          first_name: input.first_name,
          last_name: input.last_name,
          email: input.email,
          phone: input.phone,
          password: input.password,
          password_confirmation: input.password_confirmation,
          tags: "trade_account",
          send_email_welcome: false,
          note: input.note || ""
        }
      };

      const createRes = await fetch(`https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-04/customers.json`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": ADMIN_API_ACCESS_TOKEN
        },
        body: JSON.stringify(createPayload)
      });

      const createData = await createRes.json();

      if (!createRes.ok) {
        return res.status(createRes.status).json({ error: createData.errors || "Failed to create customer" });
      }

      customerId = createData.customer?.id;
    }

    // 4. Add metafields
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

    const metaRes = await fetch(`https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-04/customers/${customerId}/metafields.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": ADMIN_API_ACCESS_TOKEN
      },
      body: JSON.stringify(metafieldsPayload)
    });

    if (!metaRes.ok) {
      const metaErr = await metaRes.json();
      return res.status(500).json({ error: "Customer saved but metafields failed", detail: metaErr });
    }

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error("Error:", err);
    return res.status(500).json({ error: "Unexpected server error", message: err.message });
  }
}
