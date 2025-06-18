export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { customer_id, cashback_amount } = req.body;

  const SHOPIFY_STORE_DOMAIN = 'demoessentiahome.myshopify.com';
  const ADMIN_API_ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_API_TOKEN;

  if (!customer_id || !cashback_amount) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  try {
    const discountCode = `CB-${customer_id}-${Date.now()}`;

    const payload = {
      discount_code: {
        code: discountCode,
        usage_limit: 1,
        customer_selection: 'prerequisite',
        starts_at: new Date().toISOString(),
        value_type: 'fixed_amount',
        value: -Math.abs(Number(cashback_amount)),
        applies_once: true,
        combines_with: {
          order_discounts: false,
          product_discounts: false,
          shipping_discounts: false
        },
        customer_ids: [customer_id]
      }
    };

    const response = await fetch(`https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-04/price_rules.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': ADMIN_API_ACCESS_TOKEN
      },
      body: JSON.stringify({
        price_rule: {
          title: discountCode,
          target_type: 'line_item',
          target_selection: 'all',
          allocation_method: 'across',
          value_type: 'fixed_amount',
          value: -Math.abs(Number(cashback_amount)),
          customer_selection: 'prerequisite',
          starts_at: new Date().toISOString(),
          usage_limit: 1,
          prerequisite_subtotal_range: { greater_than_or_equal_to: 100 },
          customer_ids: [customer_id],
          once_per_customer: true
        }
      })
    });

    const ruleData = await response.json();

    if (!response.ok) {
      throw new Error(JSON.stringify(ruleData.errors || ruleData));
    }

    const ruleId = ruleData.price_rule.id;

    const codeRes = await fetch(`https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-04/price_rules/${ruleId}/discount_codes.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': ADMIN_API_ACCESS_TOKEN
      },
      body: JSON.stringify({
        discount_code: { code: discountCode }
      })
    });

    const codeData = await codeRes.json();

    if (!codeRes.ok) {
      throw new Error(JSON.stringify(codeData.errors || codeData));
    }

    res.status(200).json({
      success: true,
      code: codeData.discount_code.code
    });

  } catch (error) {
    console.error('Discount creation error:', error);
    res.status(500).json({ error: 'Failed to create discount' });
  }
}
