export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "https://essentiahome.com");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { customer_id, customer_email, cashback_amount, cart_total } = req.body;

  if (!customer_id || !customer_email || cashback_amount === undefined || cart_total === undefined) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const roundedCashback = Math.round(cashback_amount);
    const tenPercent = Math.round((cart_total * 10) / 100);
    const totalDiscount = roundedCashback + tenPercent;

    const discountCode = `CB${customer_id.slice(-4)}-${Date.now()}`;
    const SHOPIFY_ADMIN_API_TOKEN = process.env.SHOPIFY_ADMIN_API_TOKEN;

    const mutation = `
      mutation {
        discountCodeBasicCreate(
          basicCodeDiscount: {
            title: "${discountCode}",
            code: "${discountCode}",
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
                fixedAmount: {
                  amount: ${totalDiscount},
                  appliesOnEachItem: false
                }
              },
              appliesOn: {
                allItems: true
              }
            }
          }
        ) {
          userErrors {
            field
            message
          }
          discountCodeNode {
            codeDiscount {
              ... on DiscountCodeBasic {
                code
              }
            }
          }
        }
      }
    `;

    const response = await fetch("https://demoessentiahome.myshopify.com/admin/api/2024-04/graphql.json", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": SHOPIFY_ADMIN_API_TOKEN
      },
      body: JSON.stringify({ query: mutation })
    });

    const json = await response.json();
    const errors = json.data?.discountCodeBasicCreate?.userErrors;

    if (errors?.length) {
      console.error("GraphQL Errors:", errors);
      return res.status(500).json({ error: errors[0].message });
    }

    const code = json.data?.discountCodeBasicCreate?.discountCodeNode?.codeDiscount?.code;

    if (!code) {
      return res.status(500).json({ error: "Discount code not returned from API" });
    }

    console.log("✅ Discount code created:", code);
    return res.status(200).json({ success: true, code, discount: totalDiscount });

  } catch (err) {
    console.error("❌ Server error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
