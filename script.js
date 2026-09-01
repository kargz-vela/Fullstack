const products = [
  { id: 1, name: 'Urban Street Tee', price: 1500, image: 'img/products/f1.jpg' },
  { id: 2, name: 'Classic Graphical Tee', price: 1700, image: 'img/products/f2.jpg' },
  { id: 3, name: 'Minimalist White Tee', price: 1450, image: 'img/products/f3.jpg' },
  { id: 4, name: 'Signature Oversized Fit', price: 1800, image: 'img/products/f4.jpg' },
  { id: 5, name: 'Premium Cotton Tee', price: 1600, image: 'img/products/f5.jpg' },
  { id: 6, name: 'Casual Summer Design', price: 1900, image: 'img/products/f6.jpg' },
  { id: 7, name: 'Fresh Arrival Classic', price: 1750, image: 'img/products/n1.jpg' },
  { id: 8, name: 'Relaxed Tailored Fit', price: 1520, image: 'img/products/n2.jpg' }
];

// Use backend server on port 5000, or current domain if served from same server
const API_BASE = window.location.port === '5501' 
  ? 'http://localhost:5000' 
  : `${window.location.protocol}//${window.location.host}`;
const cartKey = 'skizaa-banaa-cart';
const cartSessionKey = 'skizaa-banaa-session';
const productCards = Array.from(document.querySelectorAll('.pro'));
const productSequence = [1, 2, 3, 4, 5, 6, 7, 8];
const menuButton = document.querySelector('.mobile-menu-btn');
const navbar = document.getElementById('navbar');
const filterChips = Array.from(document.querySelectorAll('.filter-chip'));

productCards.forEach((card, index) => {
  const productId = productSequence[index % productSequence.length];
  card.dataset.productId = String(productId);

  const link = card.querySelector('a');
  const button = card.querySelector('.cart, .add-to-cart-btn, .cart-btn');

  if (link) {
    link.dataset.productId = String(productId);
    link.href = 'cart.html';
  }

  if (button) {
    button.dataset.productId = String(productId);
    button.classList.add('add-to-cart-btn');
  }
});

function getDeliveryFee() {
  const selectedDelivery = document.querySelector('.delivery-option.selected input[type="radio"]');
  const deliveryMethod = selectedDelivery ? selectedDelivery.value : 'Standard';
  
  const feeMap = {
    'Standard': 100,
    'Express': 250,
    'Pickup': 0
  };
  
  return feeMap[deliveryMethod] || 100;
}

function renderCheckoutPage() {
  const container = document.getElementById('checkout-items');
  const totalElement = document.getElementById('checkout-total');
  const deliveryFeeElement = document.getElementById('checkout-delivery-fee');

  if (!container || !totalElement || !deliveryFeeElement) return;

  const cart = getCart();

  if (cart.length === 0) {
    container.innerHTML = '<p>Your cart is empty.</p>';
    deliveryFeeElement.textContent = 'Ksh0';
    totalElement.textContent = 'Ksh0';
    return;
  }

  const cartProducts = cart.map((item) => {
    const product = products.find((entry) => entry.id === item.id);
    return product ? { ...product, quantity: item.quantity } : null;
  }).filter(Boolean);

  const subtotal = cartProducts.reduce((sum, product) => sum + product.price * product.quantity, 0);
  const deliveryFee = getDeliveryFee();
  const total = subtotal + deliveryFee;

  container.innerHTML = cartProducts.map((product) => `
    <div class="checkout-item">
      <span>${product.name} x ${product.quantity}</span>
      <strong>Ksh${product.price * product.quantity}</strong>
    </div>
  `).join('');

  deliveryFeeElement.textContent = `Ksh${deliveryFee}`;
  totalElement.textContent = `Ksh${total}`;
}

function getCart() {
  const savedCart = localStorage.getItem(cartKey);
  if (!savedCart) return [];

  try {
    return JSON.parse(savedCart);
  } catch (error) {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem(cartKey, JSON.stringify(cart));
}

function clearCart() {
  console.log('Clearing cart...');
  console.log('Cart before clear:', localStorage.getItem(cartKey));
  localStorage.removeItem(cartKey);
  console.log('Cart after remove:', localStorage.getItem(cartKey));
  updateCartBadge();
  renderCartPage();
  renderCheckoutPage();
  console.log('Cart cleared successfully');
}

function initializeCartSession() {
  if (!sessionStorage.getItem(cartSessionKey)) {
    sessionStorage.setItem(cartSessionKey, String(Date.now()));
    clearCart();
  }
}

function updateCartBadge() {
  const allCartBadges = document.querySelectorAll('.cart-count');
  const cart = getCart();
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  allCartBadges.forEach((badge) => {
    badge.textContent = totalItems;
  });
}

function addToCart(productId) {
  const cart = getCart();
  const cartItem = cart.find((item) => item.id === productId);

  if (cartItem) {
    cartItem.quantity += 1;
  } else {
    cart.push({ id: productId, quantity: 1 });
  }

  saveCart(cart);
  updateCartBadge();
}

function renderCartPage() {
  const cartItemsContainer = document.getElementById('cart-items');
  if (!cartItemsContainer) return;

  const cart = getCart();

  if (cart.length === 0) {
    cartItemsContainer.innerHTML = `
      <div class="empty-cart">
        <p>Your cart is empty.</p>
        <a href="shop.html" class="normal">Continue Shopping</a>
      </div>
    `;
    const subtotal = document.getElementById('subtotal');
    const total = document.getElementById('total');
    const delivery = document.querySelector('.summary-row:nth-of-type(2) strong');
    if (subtotal) subtotal.textContent = 'Ksh0';
    if (total) total.textContent = 'Ksh0';
    if (delivery) delivery.textContent = 'Ksh0';

    const checkoutButton = document.getElementById('checkout-button');
    const checkoutMessage = document.getElementById('checkout-message');
    if (checkoutButton) {
      checkoutButton.disabled = true;
      checkoutButton.style.opacity = '0.5';
      checkoutButton.style.cursor = 'not-allowed';
    }
    if (checkoutMessage) {
      checkoutMessage.classList.add('show');
    }
    return;
  }

  const cartProducts = cart.map((item) => {
    const product = products.find((entry) => entry.id === item.id);
    if (!product) return null;

    return {
      ...product,
      quantity: item.quantity
    };
  }).filter(Boolean);

  cartItemsContainer.innerHTML = cartProducts.map((product) => `
    <div class="cart-item" data-id="${product.id}">
      <div class="cart-item-product">
        <img src="${product.image}" alt="${product.name}">
        <div>
          <h5>${product.name}</h5>
        </div>
      </div>
      <div><strong>Ksh${product.price}</strong></div>
      <div>
        <div class="qty-box">
          <button type="button" class="decrease" data-id="${product.id}">-</button>
          <span>${product.quantity}</span>
          <button type="button" class="increase" data-id="${product.id}">+</button>
        </div>
      </div>
      <div><strong>Ksh${product.price * product.quantity}</strong></div>
    </div>
  `).join('');

  const subtotal = cartProducts.reduce((sum, product) => sum + product.price * product.quantity, 0);
  const delivery = subtotal > 0 ? 100 : 0;
  const total = subtotal + delivery;

  const subtotalEl = document.getElementById('subtotal');
  const totalEl = document.getElementById('total');
  const deliveryEl = document.querySelector('.summary-row:nth-of-type(2) strong');
  if (subtotalEl) subtotalEl.textContent = `Ksh${subtotal}`;
  if (deliveryEl) deliveryEl.textContent = `Ksh${delivery}`;
  if (totalEl) totalEl.textContent = `Ksh${total}`;

  const checkoutButton = document.getElementById('checkout-button');
  const checkoutMessage = document.getElementById('checkout-message');
  if (checkoutButton) {
    checkoutButton.disabled = false;
    checkoutButton.style.opacity = '1';
    checkoutButton.style.cursor = 'pointer';
  }
  if (checkoutMessage) {
    checkoutMessage.classList.remove('show');
  }

  document.querySelectorAll('.increase').forEach((button) => {
    button.addEventListener('click', () => changeQty(Number(button.dataset.id), 1));
  });

  document.querySelectorAll('.decrease').forEach((button) => {
    button.addEventListener('click', () => changeQty(Number(button.dataset.id), -1));
  });
}

function changeQty(productId, delta) {
  const cart = getCart();
  const existingItem = cart.find((item) => item.id === productId);

  if (!existingItem) return;

  existingItem.quantity += delta;

  if (existingItem.quantity <= 0) {
    const updatedCart = cart.filter((item) => item.id !== productId);
    saveCart(updatedCart);
  } else {
    saveCart(cart);
  }

  updateCartBadge();
  renderCartPage();
  renderCheckoutPage();
}

async function subscribeNewsletter(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const input = form.querySelector('input[type="text"], input[type="email"]');
  const button = form.querySelector('button');
  const email = input ? input.value.trim() : '';

  if (!email) {
    alert('Please enter your email address.');
    return;
  }

  button.disabled = true;
  button.textContent = 'Subscribing...';

  try {
    const response = await fetch(`${API_BASE}/api/newsletter/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Subscription failed.');

    alert(data.message || 'Subscribed successfully.');
    form.reset();
  } catch (error) {
    alert(error.message || 'Could not subscribe.');
  } finally {
    button.disabled = false;
    button.textContent = 'Sign Up';
  }
}

function initCheckoutDeliveryFields() {
  const deliveryOptions = document.querySelectorAll('.delivery-option');
  if (!deliveryOptions.length) return;

  const syncSelectedOption = (selectedOption) => {
    deliveryOptions.forEach((option) => {
      const radio = option.querySelector('input[type="radio"]');
      const isSelected = option === selectedOption;
      option.classList.toggle('selected', isSelected);
      if (radio) radio.checked = isSelected;
    });
    renderCheckoutPage();
  };

  deliveryOptions.forEach((option) => {
    const radio = option.querySelector('input[type="radio"]');
    if (radio) {
      radio.addEventListener('change', () => syncSelectedOption(option));
    }

    option.addEventListener('click', (event) => {
      if (event.target === radio || option.contains(event.target)) {
        syncSelectedOption(option);
      }
    });
  });
}

async function submitCheckout(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const cart = getCart();

  if (cart.length === 0) {
    alert('Your cart is empty.');
    return;
  }

  const formData = new FormData(form);
  const county = String(formData.get('county') || '').trim();
  const deliveryMethod = String(formData.get('deliveryMethod') || 'Standard').trim();
  const landmark = String(formData.get('landmark') || '').trim();
  const deliveryNotes = String(formData.get('deliveryNotes') || '').trim();

  const customer = {
    fullName: String(formData.get('fullName') || '').trim(),
    email: String(formData.get('email') || '').trim(),
    phone: String(formData.get('phone') || '').trim(),
    county,
    address: String(formData.get('address') || '').trim(),
    landmark,
    deliveryNotes,
    deliveryMethod,
  };

  if (!customer.fullName || !customer.email || !customer.phone || !customer.address || !customer.county) {
    alert('Please complete all delivery details before placing your order.');
    return;
  }

  customer.address = `${customer.address}, ${customer.county}${landmark ? `, near ${landmark}` : ''}`;

  const deliveryFee = getDeliveryFee();
  const payload = {
    customer,
    items: cart.map((item) => ({ id: Number(item.id), quantity: Number(item.quantity) })),
    paymentMethod: 'CASH',
    deliveryFee,
    notes: deliveryNotes || `Delivery method: ${deliveryMethod} (Fee: Ksh${deliveryFee})`
  };

  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  submitButton.textContent = 'Placing order...';

  try {
    console.log('Submitting order with payload:', payload);
    const response = await fetch(`${API_BASE}/api/orders/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    console.log('Response status:', response.status);
    
    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      console.error('Failed to parse response JSON:', parseError);
      throw new Error(`Server error: ${response.status} ${response.statusText}`);
    }

    if (!response.ok) {
      const stockMessage = data.stockProblems && data.stockProblems.length
        ? data.stockProblems.map((problem) => problem.message).join('\n')
        : data.message || 'Unable to complete order.';
      throw new Error(stockMessage);
    }

    const successMessage = data.message || 'Your order was successfully placed.';
    
    // Clear cart immediately
    clearCart();
    
    // Redirect to receipt page with order ID
    const orderId = data.orderId;
    window.location.href = `receipt.html?orderId=${orderId}`;
    
    return;
  } catch (error) {
    console.error('Checkout error:', error);
    alert(error.message || 'Checkout failed.');
  } finally {
    if (!document.querySelector('.order-success-overlay')) {
      submitButton.disabled = false;
      submitButton.textContent = 'Place Order';
    }
  }
}

function showCheckoutSuccessOverlay(message = 'Your order was successful. You will be contacted when your package is ready.') {
  let secondsLeft = 5;
  const overlay = document.createElement('div');
  overlay.className = 'order-success-overlay';
  overlay.innerHTML = `
    <div class="order-success-card">
      <h2>✓ Thank you for your order!</h2>
      <p>${message}</p>
      <p class="order-success-countdown">Redirecting to the homepage in <span id="order-countdown">${secondsLeft}</span> seconds so you can explore more.</p>
      <button type="button" id="order-success-home-btn">Explore More</button>
    </div>
  `;
  document.body.appendChild(overlay);
  
  // Trigger reflow to ensure the overlay is rendered
  overlay.offsetHeight;

  const countdownElement = document.getElementById('order-countdown');
  const homeUrl = 'index.html';
  
  const interval = setInterval(() => {
    secondsLeft -= 1;
    if (countdownElement) {
      countdownElement.textContent = String(secondsLeft);
    }
    if (secondsLeft <= 0) {
      clearInterval(interval);
      window.location.href = homeUrl;
    }
  }, 1000);

  const homeButton = document.getElementById('order-success-home-btn');
  if (homeButton) {
    homeButton.addEventListener('click', () => {
      clearInterval(interval);
      window.location.href = homeUrl;
    });
  }

  // Fallback redirect after 6 seconds
  window.setTimeout(() => {
    if (document.querySelector('.order-success-overlay')) {
      window.location.href = homeUrl;
    }
  }, 6000);
}

if (filterChips.length) {
  const filterProducts = (filter) => {
    productCards.forEach((card) => {
      const matches = filter === 'all' || card.dataset.category === filter;
      card.style.display = matches ? '' : 'none';
    });
  };

  filterChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      const selectedFilter = chip.dataset.filter || 'all';
      filterChips.forEach((item) => item.classList.toggle('active', item === chip));
      filterProducts(selectedFilter);
    });
  });
}

if (menuButton && navbar) {
  menuButton.addEventListener('click', () => {
    const isOpen = navbar.classList.toggle('active');
    menuButton.classList.toggle('open', isOpen);
    menuButton.setAttribute('aria-expanded', String(isOpen));
  });

  document.addEventListener('click', (event) => {
    const clickedInsideNav = navbar.contains(event.target);
    const clickedButton = menuButton.contains(event.target);

    if (window.innerWidth <= 799 && navbar.classList.contains('active') && !clickedInsideNav && !clickedButton) {
      navbar.classList.remove('active');
      menuButton.classList.remove('open');
      menuButton.setAttribute('aria-expanded', 'false');
    }
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 799) {
      navbar.classList.remove('active');
      menuButton.classList.remove('open');
      menuButton.setAttribute('aria-expanded', 'false');
    }
  });
}

document.querySelectorAll('.pro a, .add-to-cart-btn, .cart, .cart-btn').forEach((button) => {
  button.addEventListener('click', (event) => {
    event.preventDefault();

    const productId = Number(button.dataset.productId || button.closest('.pro')?.dataset.productId);
    if (!productId || !products.some((product) => product.id === productId)) return;

    addToCart(productId);
    updateCartBadge();

    button.classList.remove('added');
    void button.offsetWidth;
    button.classList.add('added');

    const toast = document.getElementById('cart-toast');
    if (toast) {
      toast.classList.remove('show');
      void toast.offsetWidth;
      toast.classList.add('show');
      window.clearTimeout(toast._hideTimeout);
      toast._hideTimeout = window.setTimeout(() => {
        toast.classList.remove('show');
      }, 1200);
    }

    window.clearTimeout(button._cartPulseTimeout);
    button._cartPulseTimeout = window.setTimeout(() => {
      button.classList.remove('added');
    }, 450);
  });
});

const cartButtons = document.querySelectorAll('.pro .cart, .pro .cart-btn, .add-to-cart-btn');
cartButtons.forEach((button) => {
  button.setAttribute('title', 'Add to cart');
});

const checkoutButton = document.getElementById('checkout-button');
if (checkoutButton) {
  checkoutButton.addEventListener('click', () => {
    window.location.href = 'checkout.html';
  });
}

const newsletterForm = document.querySelector('.newsletter-form');
if (newsletterForm) {
  newsletterForm.addEventListener('submit', subscribeNewsletter);
}

const checkoutForm = document.querySelector('.checkout-form');
if (checkoutForm) {
  checkoutForm.addEventListener('submit', submitCheckout);
}

initCheckoutDeliveryFields();

initializeCartSession();
updateCartBadge();
renderCartPage();
renderCheckoutPage();
