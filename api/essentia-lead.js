
export default async function handler(req, res) {

  const ORIGIN = process.env.ALLOWED_ORIGIN || "https://www.essentiahome.com";
  res.setHeader("Access-Control-Allow-Origin", ORIGIN);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { name, email, phone, message } = req.body || {};
    if (!name || !email || !phone) {
      return res.status(400).json({ error: "Missing required fields (name, email, phone)" });
    }

    // 1) Auth
    const authResp = await fetch(
      "https://endpoints-backend.api.ap.assistive.site/retailitynew/login/api/auth/token",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: process.env.ASSISTIVE_USERNAME,
          password: process.env.ASSISTIVE_PASSWORD,
        }),
      }
    );

    if (!authResp.ok) {
      const t = await authResp.text();
      return res.status(401).json({ error: "Auth failed", details: t });
    }
    const authData = await authResp.json();
    const token = authData?.responseData?.authToken;
    if (!token) return res.status(401).json({ error: "No token in response" });

    // 2) Lead payload (adjust constants via env if needed)
    const REFERRAL = process.env.REFERRAL_CODE || "251398"; // Website
    const CUSTOMER_TYPE = process.env.CUSTOMER_TYPE || "250833";
    const TAG = process.env.TAG_CODE || "250937";           // Essentia Home
    const OWNER = process.env.OWNER_CODE || "11246";
    const STATUS = process.env.STATUS_CODE || "250817";

    const payload = {
      appVersion: null,
      deviceInfo: null,
      gps: null,
      isActive: 1,
      projectId: "500",
      customAttributeValues: [
        { attributeId: 80561, value: [{ name }] },                 // Customer Name
        { attributeId: 80580, value: [{ name: phone }] },          // Contact Number
        { attributeId: 81210, value: [{ name: email }] },          // Email
        { attributeId: 80654, value: [{ name: REFERRAL }] },       // Referral Source
        { attributeId: 80562, value: [{ name: CUSTOMER_TYPE }] },  // Customer Type
        { attributeId: 80563, value: [{ name: message || "" }] },  // Address/Message
        { attributeId: 80676, value: [{ name: TAG }] },            // Tag
        { attributeId: 80565, value: [{ name: OWNER }] },          // Owner
        { attributeId: 80566, value: [{ name: STATUS }] },         // Status
      ],
      transTimeZone: "IST",
    };

    // 3) Create lead
    const leadResp = await fetch(
      "https://endpoints-backend.api.ap.assistive.site/retailitynew/transactions/api/company/addEditCompany/",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      }
    );

    const leadData = await leadResp.json();
    return res.status(leadResp.ok ? 200 : leadResp.status).json(leadData);
  } catch (err) {
    return res.status(500).json({ error: "Proxy error", details: String(err) });
  }
}
