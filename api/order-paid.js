export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const SHOPIFY_STORE_DOMAIN = "demoessentiahome.myshopify.com";
  const ADMIN_API_ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_API_TOKEN;

  const order = req.body;

  // Check if customer is attached to the order
  const customer = order.customer;
  if (!customer) {
    return res.status(200).json({ message: "No customer in order. Skipping." });
  }

  const customerId = customer.id;

  try {
    // Step 1: Get Customer Tags + Existing Metafields
    const customerRes = await fetch(`https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-04/customers/${customerId}.json`, {
      method: "GET",
      headers: {
        "X-Shopify-Access-Token": ADMIN_API_ACCESS_TOKEN,
        "Content-Type": "application/json"
      }
    });
    const customerData = await customerRes.json();
    const tags = customerData.customer.tags;

    if (!tags.includes("TRADE")) {
      return res.status(200).json({ message: "Not a trade customer. Skipping." });
    }

    // Step 2: Get Existing Metafields
    const metaRes = await fetch(`https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-04/customers/${customerId}/metafields.json`, {
      headers: {
        "X-Shopify-Access-Token": ADMIN_API_ACCESS_TOKEN,
        "Content-Type": "application/json"
      }
    });

    const metaData = await metaRes.json();
    const cashbackField = metaData.metafields.find(f => f.key === "cashback_balance");
    const preferenceField = metaData.metafields.find(f => f.key === "cashback_preference");

    const preference = preferenceField?.value || "";

    // Step 3: Only reward if preference = use_next_purchase
    if (preference !== "use_next_purchase") {
      return res.status(200).json({ message: "Preference not set to use_next_purchase. Skipping." });
    }

    // Step 4: Calculate 10% cashback
    const orderSubtotal = parseFloat(order.subtotal_price || "0");
    const rewardAmount = (orderSubtotal * 0.1).toFixed(2);

    const previousBalance = parseFloat(cashbackField?.value || "0");
    const newBalance = (parseFloat(previousBalance) + parseFloat(rewardAmount)).toFixed(2);

    const metafieldPayload = {
      metafield: {
        namespace: "custom",
        key: "cashback_balance",
        type: "number_decimal",
        value: newBalance
      }
    };

    const method = cashbackField ? "PUT" : "POST";
    const url = cashbackField
      ? `https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-04/metafields/${cashbackField.id}.json`
      : `https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-04/customers/${customerId}/metafields.json`;

    // Step 5: Save Updated Balance
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
      throw new Error(saveData.errors || "Failed to save cashback balance");
    }

    return res.status(200).json({ success: true, new_balance: newBalance });

  } catch (err) {
    console.error("Webhook error:", err);
    return res.status(500).json({ error: "Webhook failed", message: err.message });
  }
}
