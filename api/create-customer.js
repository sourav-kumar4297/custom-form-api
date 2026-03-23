import shopify from "../utils/shopify.js";
import { sendEmail } from "../utils/mailer.js";

export default async function handler(req, res) {

  // ✅ CORS FIX (FULL)
  const allowedOrigin = process.env.ALLOWED_ORIGIN || "*";

  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // ✅ Handle preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const { customer } = req.body;

    // ✅ Validation
    if (!customer?.email || !customer?.first_name) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    console.log("Incoming customer:", customer.email);

    // ✅ Check existing customer
    const existing = await shopify.get(
      `/customers/search.json?query=email:${customer.email}`
    );

    let customerId;

    if (existing.data.customers.length > 0) {
      customerId = existing.data.customers[0].id;

      // 🔄 Update existing customer note only
      await shopify.put(`/customers/${customerId}.json`, {
        customer: {
          id: customerId,
          note: customer.note
        }
      });

    } else {
      // 🆕 Create new customer with pending tag
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

    // 📧 Send Email to USER (safe)
    try {
      await sendEmail({
        to: customer.email,
        subject: "Trade Account Request Received",
        html: `
          <h2>Hi ${customer.first_name}</h2>
          <p>Your trade account request has been submitted.</p>
          <p>Our team is reviewing your application.</p>
          <p>You will receive an email once approved.</p>
        `
      });
    } catch (err) {
      console.log("User email failed:", err.message);
    }

    // 📧 Send Email to ADMIN (safe)
    try {
      const adminEmails = process.env.ADMIN_EMAILS?.split(",") || [];

      if (adminEmails.length > 0) {
        await sendEmail({
          to: adminEmails,
          subject: "New Trade Account Request",
          html: `
            <h3>New Trade Application</h3>
            <p><b>Name:</b> ${customer.first_name} ${customer.last_name || ""}</p>
            <p><b>Email:</b> ${customer.email}</p>
            <p><b>Phone:</b> ${customer.phone || "-"}</p>
            <pre>${customer.note || ""}</pre>
          `
        });
      }
    } catch (err) {
      console.log("Admin email failed:", err.message);
    }

    // ✅ Final Response
    return res.status(200).json({
      success: true,
      message: "Trade request submitted successfully"
    });

  } catch (error) {
    console.error("ERROR:", error?.response?.data || error.message);

    return res.status(500).json({
      error: "Something went wrong",
      details: error?.response?.data || error.message
    });
  }
}