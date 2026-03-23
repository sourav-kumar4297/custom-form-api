import shopify from "../utils/shopify.js";
import { sendEmail } from "../utils/mailer.js";

export default async function handler(req, res) {

  // ✅ CORS FIX
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const { customer } = req.body;

    console.log("Incoming:", customer);

    // ✅ Validation
    if (!customer?.email || !customer?.first_name) {
      return res.status(400).json({ error: "Missing fields" });
    }

    let customerId;

    // ✅ Shopify Logic
    try {
      const existing = await shopify.get(
        `/customers/search.json?query=email:${customer.email}`
      );

      if (existing.data.customers.length > 0) {
        customerId = existing.data.customers[0].id;

        await shopify.put(`/customers/${customerId}.json`, {
          customer: {
            id: customerId,
            note: customer.note
          }
        });

      } else {
        const response = await shopify.post(`/customers.json`, {
          customer: {
            first_name: customer.first_name,
            last_name: customer.last_name,
            email: customer.email,
            phone: customer.phone,
            note: customer.note,
            tags: "trade_pending",
            send_email_welcome: false
          }
        });

        customerId = response.data.customer.id;
      }

    } catch (shopifyError) {
      console.log("Shopify Error:", shopifyError?.response?.data || shopifyError.message);

      return res.status(500).json({
        error: "Shopify error",
        details: shopifyError?.response?.data || shopifyError.message
      });
    }

    // ✅ Email (safe)
    try {
      await sendEmail({
        to: customer.email,
        subject: "Trade Request",
        html: `<p>Hi ${customer.first_name}, request received</p>`
      });
    } catch (e) {
      console.log("Email failed:", e.message);
    }

    return res.status(200).json({ success: true });

  } catch (error) {
    console.log("FINAL ERROR:", error);

    return res.status(500).json({
      error: error.message
    });
  }
}