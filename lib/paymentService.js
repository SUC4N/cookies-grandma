const midtransClient = require('midtrans-client');

async function createMidtransPayment(order) {
  const snap = new midtransClient.Snap({
    isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
    serverKey:    process.env.MIDTRANS_SERVER_KEY || '',
    clientKey:    process.env.MIDTRANS_CLIENT_KEY || '',
  });

  const items = [];
  if (order.nastar_qty    > 0) items.push({ id:'NASTAR',    name:'Premium Nastar',    price:80000, quantity:order.nastar_qty    });
  if (order.kastangel_qty > 0) items.push({ id:'KASTANGEL', name:'Premium Kastangel', price:115000, quantity:order.kastangel_qty });
  if (order.gift_wrapping === 'gift_wrap') items.push({ id:'GIFTWRAP', name:'Gift Wrapping', price:15000, quantity:1 });
  if (order.gift_wrapping === 'hamper')    items.push({ id:'HAMPER',   name:'Hamper Box',    price:35000, quantity:1 });

  return await snap.createTransaction({
    transaction_details: { order_id: order.order_number, gross_amount: order.total_price },
    item_details: items,
    customer_details: {
      first_name: order.customer_name, phone: order.customer_phone, email: order.customer_email || undefined,
    },
    callbacks: {
      finish:   `${process.env.VERCEL_URL ? 'https://'+process.env.VERCEL_URL : 'http://localhost:3000'}/?order=${order.order_number}&status=finish`,
      unfinish: `${process.env.VERCEL_URL ? 'https://'+process.env.VERCEL_URL : 'http://localhost:3000'}/?order=${order.order_number}&status=unfinish`,
      error:    `${process.env.VERCEL_URL ? 'https://'+process.env.VERCEL_URL : 'http://localhost:3000'}/?order=${order.order_number}&status=error`,
    },
  });
}

module.exports = { createMidtransPayment };
