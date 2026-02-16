// /api/create-customer.js
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://www.essentiahome.com");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  const SHOPIFY_STORE_DOMAIN = "demoessentiahome.myshopify.com";
  const ADMIN_API_ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_API_TOKEN;

  const customer = req.body.customer;
  if (!customer?.email || !customer?.first_name || !customer?.phone) {
    return res.status(400).json({ error: "Missing required fields" });
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
    const existingCustomer = searchData.customers?.[0];
    let customerId = existingCustomer?.id;

    // Step 2: Update or Create customer
    let createdCustomer = null;
    if (customerId) {
      const updatedPayload = {
        customer: {
          id: customerId,
          first_name: customer.first_name,
          last_name: customer.last_name,
          phone: customer.phone,
          tags: "trade_account",
          note: customer.note
        }
      };
      const updateRes = await fetch(`https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-04/customers/${customerId}.json`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": ADMIN_API_ACCESS_TOKEN
        },
        body: JSON.stringify(updatedPayload)
      });

      const updateData = await updateRes.json();
      if (!updateRes.ok) {
        return res.status(updateRes.status).json({ error: "Customer exists but update failed", detail: updateData });
      }
      createdCustomer = updateData.customer;
    } else {
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
      createdCustomer = createData.customer;
      customerId = createdCustomer.id;
    }

    // Step 3: Add/Update metafields only if not already set
    const existingMetafieldsRes = await fetch(`https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-04/customers/${customerId}/metafields.json`, {
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": ADMIN_API_ACCESS_TOKEN
      }
    });
    const existingMetafieldsData = await existingMetafieldsRes.json();

    const existingKeys = (existingMetafieldsData?.metafields || []).map(m => `${m.namespace}:${m.key}`);

    const metafieldsPayload = {
      metafields: []
    };

    if (!existingKeys.includes("custom:cashback_balance")) {
      metafieldsPayload.metafields.push({
        namespace: "custom",
        key: "cashback_balance",
        type: "number_decimal",
        value: "0"
      });
    }

    if (!existingKeys.includes("cashback:preference")) {
      metafieldsPayload.metafields.push({
        namespace: "cashback",
        key: "preference",
        type: "single_line_text_field",
        value: "discount"
      });
    }

    let metafieldError = false;
    if (metafieldsPayload.metafields.length > 0) {
      const metafieldRes = await fetch(`https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-04/customers/${customerId}/metafields.json`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": ADMIN_API_ACCESS_TOKEN
        },
        body: JSON.stringify(metafieldsPayload)
      });

      if (!metafieldRes.ok) metafieldError = true;
    }

    if (metafieldError) {
      return res.status(200).json({ success: true, warning: "Customer created/updated but metafields failed" });
    } else {
      return res.status(200).json({ success: true });
    }
  } catch (error) {
    return res.status(500).json({ error: "Unexpected server error", message: error.message });
  }
}
