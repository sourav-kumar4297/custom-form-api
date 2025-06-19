export default async function handler(req, res) {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Origin", "https://essentiahome.com");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { customer_id, cashback_amount } = req.body;

  if (!customer_id || cashback_amount === undefined) {
    console.error("❌ Missing fields:", { customer_id, cashback_amount });
    return res.status(400).json({ error: "Missing required fields" });
  }

  const code = `CB${customer_id.slice(-4)}-${Date.now()}`;
  const fixedValue = Math.round(parseFloat(cashback_amount || 0));
  const token = process.env.SHOPIFY_ADMIN_API_TOKEN;

  const mutation = `
    mutation discountCodeBasicCreate {
      discountCodeBasicCreate(
        basicCodeDiscount: {
          title: "${code}",
          code: "${code}",
          startsAt: "${new Date().toISOString()}",
          usageLimit: 1,
          customerSelection: {
            customers: ["gid://shopify/Customer/${customer_id}"]
          },
          combinesWith: {
            orderDiscounts: false,
            productDiscounts: false,
            shippingDiscounts: false
          },
          customerGets: {
            value: {
              combine: [
                { percentage: { value: 10 } },
                { fixedAmount: { amount: ${fixedValue}, appliesOnEachItem: false } }
              ]
            },
            appliesOn: { allItems: true }
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
    const response = await fetch("https://demoessentiahome.myshopify.com/admin/api/2024-04/graphql.json", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": token
      },
      body: JSON.stringify({ query: mutation })
    });

    const json = await response?.json();
    const error = json?.data?.discountCodeBasicCreate?.userErrors;
    const discount = json?.data?.discountCodeBasicCreate?.discountCodeNode?.codeDiscount;

    if (error?.length || !discount?.code) {
      console.error("❌ GraphQL Error:", error);
      return res.status(500).json({ error: "Failed to create discount code" });
    }

    return res.status(200).json({ success: true, code: discount.code });

  } catch (err) {
    console.error("🔥 Server Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
