require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./src/db/database');
const { sendOrderEmails, sendNewsletterEmail } = require('./src/services/emailService');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname)));

function toCurrency(amount) {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    maximumFractionDigits: 0,
  }).format(amount);
}


app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Skizaa Banaa backend is running.' });
});

app.get('/api/products', (req, res) => {
  const products = db.prepare('SELECT * FROM products WHERE is_active = 1 ORDER BY id').all();
  res.json(products);
});

app.get('/api/products/:id', (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ? AND is_active = 1').get(req.params.id);
  if (!product) {
    return res.status(404).json({ message: 'Product not found.' });
  }

  res.json(product);
});

app.post('/api/newsletter/subscribe', async (req, res) => {
  const { email } = req.body;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ message: 'Please enter a valid email.' });
  }

  try {
    const existing = db.prepare('SELECT * FROM newsletter_subscribers WHERE email = ?').get(email.toLowerCase());
    if (existing) {
      return res.status(200).json({ message: 'You are already subscribed.', success: true });
    }

    db.prepare('INSERT INTO newsletter_subscribers (email) VALUES (?)').run(email.toLowerCase());

    await sendNewsletterEmail({
      email,
      subject: 'Welcome to Skizaa Banaa',
      message: 'Thank you for subscribing to Skizaa Banaa. You will receive our latest updates and special offers.',
    });

    res.json({ message: 'Subscription successful.', success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Could not create subscription.' });
  }
});

app.post('/api/orders/checkout', async (req, res) => {
  const { customer, items, paymentMethod = 'MPESA', notes = '' } = req.body;

  if (!customer || !customer.fullName || !customer.email || !customer.phone || !customer.address) {
    return res.status(400).json({ message: 'Customer details are required.' });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'Your cart is empty.' });
  }

  // Check quantity limit per item (max 6 units per item)
  for (const item of items) {
    if (item.quantity > 6) {
      const product = db.prepare('SELECT name FROM products WHERE id = ?').get(item.id);
      return res.status(400).json({
        message: `Maximum 6 units allowed per item. You requested ${item.quantity} units of ${product?.name || 'this product'}.`
      });
    }
  }

  try {
    const customerExists = db.prepare('SELECT * FROM customers WHERE email = ?').get(customer.email.toLowerCase());

    let customerId;
    if (customerExists) {
      customerId = customerExists.id;
      db.prepare(`
        UPDATE customers
        SET full_name = ?, phone = ?, address = ?
        WHERE id = ?
      `).run(customer.fullName, customer.phone, customer.address, customerId);
    } else {
      const result = db.prepare(`
        INSERT INTO customers (full_name, email, phone, address)
        VALUES (?, ?, ?, ?)
      `).run(customer.fullName, customer.email.toLowerCase(), customer.phone, customer.address);
      customerId = result.lastInsertRowid;
    }

    const orderId = `SKZ-${uuidv4().slice(0, 8).toUpperCase()}`;
    const deliveryFee = Number(req.body.deliveryFee) || 100;
    let subtotal = 0;

    const orderItems = items.map((item) => {
      const product = db.prepare('SELECT * FROM products WHERE id = ?').get(item.id);
      const itemTotal = product.price * item.quantity;
      subtotal += itemTotal;

      return {
        productId: product.id,
        productName: product.name,
        quantity: item.quantity,
        unitPrice: product.price,
        totalPrice: itemTotal,
      };
    });

    const total = subtotal + deliveryFee;

    db.prepare(`
      INSERT INTO orders (id, customer_id, payment_method, payment_status, subtotal, delivery_fee, total, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(orderId, customerId, paymentMethod, 'pending', subtotal, deliveryFee, total, notes);

    const insertOrderItem = db.prepare(`
      INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, total_price)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const item of orderItems) {
      insertOrderItem.run(orderId, item.productId, item.productName, item.quantity, item.unitPrice, item.totalPrice);
    }

    // Send order receipt emails (don't fail order if email fails)
    try {
      await sendOrderEmails({
        customerName: customer.fullName,
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
        orderId,
        items: orderItems.map((item) => ({ name: item.productName, quantity: item.quantity, price: item.unitPrice })),
        total,
        paymentMethod,
      });
    } catch (emailError) {
      console.error('Failed to send order emails:', emailError.message);
      // Continue anyway - the order was successfully placed
    }

    return res.status(201).json({
      message: 'Order placed successfully. We will contact you when your package is ready.',
      orderId,
      total,
      currency: toCurrency(total),
    });
  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({ message: 'Checkout failed.', error: error.message });
  }
});

app.post('/api/payments/mpesa/callback', async (req, res) => {
  const callback = req.body;
  const result = callback.Body?.stkCallback || {};

  const { MerchantRequestID, CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = result;

  const amountMeta = CallbackMetadata?.Item?.find((item) => item.Name === 'Amount');
  const mpesaReceiptMeta = CallbackMetadata?.Item?.find((item) => item.Name === 'MpesaReceiptNumber');
  const transactionDateMeta = CallbackMetadata?.Item?.find((item) => item.Name === 'TransactionDate');
  const phoneMeta = CallbackMetadata?.Item?.find((item) => item.Name === 'PhoneNumber');

  const matchedTransaction = db.prepare(`
    SELECT * FROM mpesa_transactions
    WHERE checkout_request_id = ? OR merchant_request_id = ?
  `).get(CheckoutRequestID, MerchantRequestID);

  const orderId = matchedTransaction?.order_id;

  if (matchedTransaction) {
    db.prepare(`
      UPDATE mpesa_transactions
      SET result_code = ?, result_desc = ?, amount = ?, mpesa_receipt_number = ?, transaction_date = ?, phone_number = ?
      WHERE id = ?
    `).run(
      ResultCode,
      ResultDesc,
      amountMeta?.Value || 0,
      mpesaReceiptMeta?.Value || null,
      transactionDateMeta?.Value || null,
      phoneMeta?.Value || null,
      matchedTransaction.id,
    );
  } else if (MerchantRequestID || CheckoutRequestID) {
    db.prepare(`
      INSERT INTO mpesa_transactions (order_id, merchant_request_id, checkout_request_id, result_code, result_desc, amount, mpesa_receipt_number, transaction_date, phone_number)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      orderId || 'UNKNOWN',
      MerchantRequestID,
      CheckoutRequestID,
      ResultCode,
      ResultDesc,
      amountMeta?.Value || 0,
      mpesaReceiptMeta?.Value || null,
      transactionDateMeta?.Value || null,
      phoneMeta?.Value || null,
    );
  }

  if (orderId) {
    if (ResultCode === 0) {
      db.prepare(`
        UPDATE orders
        SET payment_status = 'paid', status = 'completed'
        WHERE id = ?
      `).run(orderId);

      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
      const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(order.customer_id);
      const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);

      await sendOrderEmails({
        customerName: customer.full_name,
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
        orderId,
        items: items.map((item) => ({ name: item.product_name, quantity: item.quantity, price: item.unit_price })),
        total: order.total,
        paymentMethod: order.payment_method,
      });
    } else {
      db.prepare(`
        UPDATE orders
        SET payment_status = 'failed', status = 'failed'
        WHERE id = ?
      `).run(orderId);
    }
  }

  res.json({
    ResponseCode: '0',
    ResponseDescription: 'Accepted',
  });
});

app.get('/api/orders/:id', (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) {
    return res.status(404).json({ message: 'Order not found.' });
  }

  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(req.params.id);
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(order.customer_id);

  res.json({ order, customer, items });
});

app.listen(PORT, () => {
  console.log(`Skizaa Banaa backend listening on http://localhost:${PORT}`);
});
