export default async function handler(req, res) {
  // ✅ Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "https://essentiahome.com");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // ✅ Handle preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // ✅ Ensure method is POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { customer_id, customer_email, cashback_amount } = req.body;

  // ✅ Validate input
  if (!customer_id || !customer_email || cashback_amount === undefined) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const roundedCashback = Math.round(cashback_amount);
  const discountCode = `CB${customer_id.slice(-4)}-${Date.now()}`;
  const SHOPIFY_ADMIN_API_TOKEN = process.env.SHOPIFY_ADMIN_API_TOKEN;
  const SHOPIFY_STORE = "demoessentiahome.myshopify.com";

  // ✅ GraphQL mutation string
  const mutation = `
    mutation {
      discountCodeBasicCreate(
        basicCodeDiscount: {
          title: "${discountCode}"
          code: "${discountCode}"
          startsAt: "${new Date().toISOString()}"
          usageLimit: 1
          customerSelection: {
            customers: ["gid://shopify/Customer/${customer_id}"]
          }
          combinesWith: {
            orderDiscounts: false
            productDiscounts: false
            shippingDiscounts: false
          }
          customerGets: {
            value: {
              combine: [
                { percentage: { value: 10 } }
                { fixedAmount: { amount: ${roundedCashback}, appliesOnEachItem: false } }
              ]
            }
            appliesOn: {
              allItems: true
            }
          }
        }
      ) {
        discountCodeNode {
          codeDiscount {
            ... on DiscountCodeBasic {
              code
            }
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  try {
    const response = await fetch(`https://${SHOPIFY_STORE}.myshopify.com/admin/api/2024-04/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": SHOPIFY_ADMIN_API_TOKEN,
      },
      body: JSON.stringify({ query: mutation }),
    });

    const json = await response.json();

    const errors = json.data?.discountCodeBasicCreate?.userErrors || [];
    const code = json.data?.discountCodeBasicCreate?.discountCodeNode?.codeDiscount?.code;

    if (errors.length > 0) {
      console.error("❌ Shopify GraphQL Errors:", errors);
      return res.status(500).json({ error: errors[0].message });
    }

    if (!code) {
      console.error("❌ Discount code not returned from API.");
      return res.status(500).json({ error: "Discount code not returned from API" });
    }

    console.log("✅ Discount Code Created:", code);
    return res.status(200).json({ success: true, code });

  } catch (err) {
    console.error("❌ Internal Server Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
