// server.js

const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const cors = require('cors');
const app = express();
require('dotenv').config();
const port = process.env.PORT || 3000;
const Razorpay = require('razorpay');
const multer = require('multer');
const path = require('path');


//photo upload 
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, `${Date.now()}${path.extname(file.originalname)}`);
  },
});
const upload = multer({ storage: storage });

// Razorpay setup
const razorpay = new Razorpay({
  key_id: process.env.RAZOR_PAY_KEY,
  key_secret: process.env.RAZOR_PAY_SECRET
});

// MongoDB connection
mongoose.connect('mongodb+srv://smartdarshak88:Darshak%401988@ganpatiwalacluster.yp8m6kk.mongodb.net', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// MongoDB models
const SubscriptionPlan = mongoose.model('SubscriptionPlan', {
  name: String,
  description: String,
  price: Number,
  limit: Number,
});

const User = mongoose.model('User', {
  username: String,
  password: String,
  subscriptionPlan: { type: mongoose.Schema.Types.ObjectId, ref: 'SubscriptionPlan' },
  active: Boolean,
  agent: Boolean,
  razorpayPlan: String,
  email: String,
  contact: String,
  city: String,
  state: String,
  pincode: String
});

const Product = mongoose.model('Product', {
  name: String,
  description: String,
  image: String,
  category: String,
  price: Number,
  dimensions: String,
  active: Boolean,
  userId: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const ProductQuery = mongoose.model('ProductQuery', {
  name: String,
  productName: String,
  message: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const Orders = mongoose.model('Orders', {
  orderId: String,
  customerId: String,
  userId: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
})

const WebhookEvents = mongoose.model('WebhookEvents', {
  id: Number,
  body: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
})

// Middleware
app.use(cors());
app.use(bodyParser.json());

//check if razorpay customer is exists or not
// Function to check if a customer exists
async function checkCustomerExists(name,email,contact) {
  try {
    // Fetch the customer from Razorpay based on email
    const customer = await razorpay.customers.create({
      name: name,
      email: email,
      contact: contact // Provide customer's contact number
    });

    return customer.id;
  } catch (error) {
    throw error;
  }
}

// create orders in razorpay 
async function createOrder(amount, currency, receipt, customerId) {
  try {
    // Create the order in Razorpay
    const order = await razorpay.orders.create({
      amount: amount * 100, // Razorpay expects amount in smallest currency unit (paise)
      currency: currency,
      receipt: receipt,
      customer_id: customerId,
      payment_capture: 0
    });

    return order;
  } catch (error) {
    throw error;
  }
}



// Routes

// 1) Create a Subscription plan
app.post('/subscription-plan', async (req, res) => {
  try {
    const { name, description } = req.body;
    const subscriptionPlan = new SubscriptionPlan({ name, description });
    await subscriptionPlan.save();
    res.json({ success: true, subscriptionPlan });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2) Register User with subscription plan selection
app.post('/register', async (req, res) => {
  try {
    const { username, password, subscriptionPlanId, active = 0, agent = false, razorpayPlan = "", email, contact, city, state, pincode} = req.body;

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ username, password: hashedPassword, subscriptionPlan: subscriptionPlanId, active, agent, razorpayPlan, email, contact, city, state, pincode });
    await user.save();

    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/vregister', async (req, res) => {
  try {
    const { username, password, subscriptionPlanId, active = 0, agent = true, email, contact, city, state, pincode } = req.body;
    var razorpayPlan = "";
    var razorpayPrice = 0;
    var customerId;
    

    if(subscriptionPlanId == "65ac3edc9e8cc51805bfcd9e")
    {
      razorpayPlan = process.env.BASIC_PLAN
      razorpayPrice = process.env.BASIC_PLAN_PRICE
    }
    else if(subscriptionPlanId == "65ac3f1e9e8cc51805bfcd9f")
    {
      razorpayPlan = process.env.PRO_PLAN
      razorpayPrice = process.env.PRO_PLAN_PRICE
    }
    else if(subscriptionPlanId == "65ac3f2f9e8cc51805bfcda0")
    {
      razorpayPlan = process.env.BUSINESS_PLAN
      razorpayPrice = process.env.BUSINESS_PLAN_PRICE
    }
    else
    {

    }
    
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ username, password: hashedPassword, subscriptionPlan: subscriptionPlanId, active, agent, razorpayPlan, email, contact, city, state, pincode });
    await user.save();

    const customer = await razorpay.customers.all({query: {email: email}});
    const result = customer.items.filter((e) => {
      return e.email === email;
    })

    if(result.length > 0)
    {
      customerIsExists = 1;
      customerId = result[0].id; 
      const order = await createOrder(razorpayPrice, "INR", "OnlineOrder", customerId);
      console.log(order);
      const orderId = order.id;
      const userId = user._id;
      const successOrder = new Orders({orderId, customerId, userId});
      await successOrder.save();
    }
    else
    {
      customerIsExists = 0;
      customerId = await checkCustomerExists(username, email, contact);
      console.log(customerId);
      const order = await createOrder(razorpayPrice, "INR", "OnlineOrder", customerId);
      console.log(order);
      const orderId = order.id;
      const userId = user._id;
      const successOrder = new Orders({orderId, customerId, userId});
      await successOrder.save();
    }

    
    
    

    // Define subscription parameters
    // const subscriptionOptions = {
    //   plan_id: razorpayPlan, // The ID of the plan created in your Razorpay dashboard
    //   customer_id: customerId, // The ID of the customer for whom you are creating the subscription
    //   total_count: 1, // Total billing cycles, adjust as needed
    //   quantity: 1, // Number of subscriptions, adjust as needed
    //   notes: {
    //     // Optional notes
    //     description: 'One time subscription',
    //     frequency: 'Yearly'
    //   }
    // };

    // Create subscription
    // await razorpay.subscriptions.create(subscriptionOptions, (error, subscription) => {
    //   if (error) {
    //     console.error('Subscription creation failed:', error);
    //   } else {
    //     console.log('Subscription created successfully:', subscription);
    //   }
    // });

    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

//2.5 check for webhook notifications from razorpay
app.get("/payment/callback", async (req, res) => {
  try {
    const logs = new WebhookEvents({body: req.body});
    logs.save();
  } catch(error) {
    console.log(error);
  }
});

// 3) Login User with subscription plan restrictions
app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username }).populate('subscriptionPlan');

    if (!user) {
      return res.status(401).json({ success: false, message: 'Authentication failed. User not found.' });
    }

    if (user.active !== true) {
      return res.status(401).json({ success: false, message: 'Authentication failed. User status not active.' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({ success: false, message: 'Authentication failed. Incorrect password.' });
    }

    const data = user;

    // Generate JWT token with user data and subscription plan details
    const token = jwt.sign(
      { _id: user._id, username: user.username, subscriptionPlan: user.subscriptionPlan },
      'secret_key'
    );

    res.json({ success: true, token, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/vlogin', async (req, res) => {
  try {
    const { username, password, agent } = req.body;

    const user = await User.findOne({ username, agent: true }).populate('subscriptionPlan');
    console.log("user",user);

    if (!user) {
      return res.status(401).json({ success: false, message: 'Authentication failed. Agent not found.' });
    }

    if (user.active !== true) {
      return res.status(401).json({ success: false, message: 'Authentication failed. Agent status not active.' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({ success: false, message: 'Authentication failed. Incorrect password.' });
    }

    const data = user;

    // Generate JWT token with user data and subscription plan details
    const token = jwt.sign(
      { _id: user._id, username: user.username, subscriptionPlan: user.subscriptionPlan },
      'secret_key'
    );

    res.json({ success: true, token, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/products', (req, res) => {
  try {
    const { limit, vendor, tags, order, random } = req.query;

    // Read products from the JSON file
    const productsData = fs.readFileSync('products.json');
    const products = JSON.parse(productsData);

    // Filter products with status "active"
    const activeProducts = products.filter(product => product.status === 'active');
    // tags filter if exists
    const filteredProducts = tags
      ? activeProducts.filter(product => {
        const productTags = product.tags || [];
        return tags.split(',').every(tag => productTags.includes(tag.trim()));
      })
      : activeProducts;
    // Applied Vendor filter
    const vendorProducts = vendor ? filteredProducts.filter(product => product.vendor === vendor) : activeProducts;
    // Apply limit if provided
    const limitedProducts = limit ? vendorProducts.slice(0, parseInt(limit, 10)) : vendorProducts;

    // Sort products based on order if order is provided
    if (order) {
      const sortOrder = order.toLowerCase() === 'desc' ? -1 : 1;
      limitedProducts.sort((a, b) => (a.price - b.price) * sortOrder);
    }

    // Shuffle products randomly if random is provided
    if (random) {
      for (let i = limitedProducts.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [limitedProducts[i], limitedProducts[j]] = [limitedProducts[j], limitedProducts[i]];
      }
    }

    res.json({ success: true, products: limitedProducts });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/subscription-plans', async (req, res) => {
  try {
    const subscriptionPlans = await SubscriptionPlan.find();
    res.json({ success: true, subscriptionPlans });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/decorations', (req, res) => {
  try {
    const { limit, vendor, tags, order, random } = req.query;

    // Read products from the JSON file
    const productsData = fs.readFileSync('decorations.json');
    const products = JSON.parse(productsData);

    // // Filter products with status "active"
    const activeProducts = products.filter(product => product.status === 'active');
    // // tags filter if exists
    const filteredProducts = tags
      ? activeProducts.filter(product => {
        const productTags = product.tags || [];
        return tags.split(',').every(tag => productTags.includes(tag.trim()));
      })
      : activeProducts;
    // Applied Vendor filter
    const vendorProducts = vendor ? filteredProducts.filter(product => product.vendor === vendor) : activeProducts;
    // Apply limit if provided
    const limitedProducts = limit ? vendorProducts.slice(0, parseInt(limit, 10)) : vendorProducts;

    // Sort products based on order if order is provided
    if (order) {
      const sortOrder = order.toLowerCase() === 'desc' ? -1 : 1;
      limitedProducts.sort((a, b) => (a.price - b.price) * sortOrder);
    }

    // Shuffle products randomly if random is provided
    if (random) {
      for (let i = limitedProducts.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [limitedProducts[i], limitedProducts[j]] = [limitedProducts[j], limitedProducts[i]];
      }
    }

    res.json({ success: true, decorations: limitedProducts });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

//upgrade subscription plan for userId
app.put('/upgrade-subscription/:userId/:newSubscriptionPlanId', async (req, res) => {
  try {
    const { userId, newSubscriptionPlanId } = req.params;

    // Find the user by ID
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // Find the new subscription plan by ID
    const newSubscriptionPlan = await SubscriptionPlan.findById(newSubscriptionPlanId);

    if (!newSubscriptionPlan) {
      return res.status(404).json({ success: false, message: 'New subscription plan not found.' });
    }

    // Update the user's subscription plan
    user.subscriptionPlan = newSubscriptionPlanId;
    await user.save();

    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Route to add a product
app.post('/products', upload.single('photo'), async (req, res) => {
  if (!req.file) {
    return res.status(400).send('No photo uploaded.');
  }
  
  
  try {
    const { name, description, category, price, dimensions, active, userId, subscriptionPlanId } = req.body;
    const photoUrl = `http://localhost:${PORT}/${req.file.path}`;
    // Find the subscription plan to check the limit
    const subscriptionPlan = await SubscriptionPlan.findById(subscriptionPlanId);

    if (!subscriptionPlan) {
      return res.status(404).json({ success: false, message: 'Subscription plan not found.' });
    }

    // Check if the product limit has been reached
    const productsCount = await Product.countDocuments();
    if (productsCount >= subscriptionPlan.limit) {
      return res.status(400).json({
        success: false,
        message: 'Product limit reached for the subscribed subscription plan.',
      });
    }

    const product = new Product({
      name,
      description,
      photoUrl,
      category,
      price,
      dimensions,
      active,
      userId,
      subscriptionPlan: subscriptionPlanId,
    });

    await product.save();

    res.json({ success: true, product });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/idolsQuery", async (req, res) => {
  try {
    const { name, productName, message } = req.body;

    // Create a new ProductQuery document with timestamps
    const productQuery = new ProductQuery({
      name,
      productName,
      message,
    });

    // Save the document to the MongoDB collection
    await productQuery.save();

    res.json({ success: true, message: 'Product query stored successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
})




app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
