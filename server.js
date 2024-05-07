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
const nodemailer = require('nodemailer');
const axios = require('axios');

//photo upload 
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Uploads will be stored in the 'uploads/' directory
  },
  filename: (req, file, cb) => {
    const fileName = file.originalname.replace(/\s+/g, '-').toLowerCase();
    cb(null, `${fileName}-${Date.now()}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ storage });

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
  subscriptionPlan: { type: mongoose.Schema.Types.ObjectId, ref: 'SubscriptionPlan' },
  active: Boolean,
  agent: Boolean,
  razorpayPlan: String,
  email: String,
  contact: String,
  city: String,
  state: String,
  pincode: String,
  consent: Boolean,
  address: String,
  proofDocument: String
});

const Product = mongoose.model('Product', {
  name: String,
  description: String,
  image: String,
  category: String,
  price: Number,
  dimensions: String,
  city: String,
  state: String,
  pincode: String,
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
async function checkCustomerExists(email,contact) {
  try {
    // Fetch the customer from Razorpay based on email
    const customer = await razorpay.customers.create({
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

  var DummysubscriptionPlanId = "6611aba48dfcde682251d487";
    
  try {
    const { username, password, subscriptionPlanId, active = 1, agent = false, razorpayPlan = "", email, contact, city, state, pincode} = req.body;
      
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ username, password: hashedPassword, subscriptionPlan: DummysubscriptionPlanId, active, agent, razorpayPlan, email, contact, city, state, pincode });
    await user.save(); 

    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

const sendOTP = async (mobileNumber) => {
  try {
    const response = await axios.post('https://hashtagmails.com/ganpatiwalla/send-message.php', {
      mobileNumber: mobileNumber
    });

    if (response.data.success) {
      return 1
    } else {
      return 0
    }
  } catch (error) {
    return 0
  }
};

app.post("/verify-mobile", async(req,res) => {
  const mobileNumber = req.body.mobile;  // Replace with the mobile number
  const verify = sendOTP(mobileNumber);
  console.log(verify);  
  // if(verify == 0)
  // {
  //   res.status(401).json({status: "failed", message: "could not send the OTP" });
  // }
  // else
  // {
  // res.status(200).json({status: "success", message: "OTP sent"});
  // }
})

app.post('/vregister', async (req, res) => {

  
  try {
    const { subscriptionPlanId, active = 0, agent = true, email, contact, city, state, pincode, consent, address, document } = req.body;
    var razorpayPlan = "";
    var razorpayPrice = 0;
    var customerId;
    var DummysubscriptionPlanId = "6611aba48dfcde682251d487";
    
    
    //const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ subscriptionPlan: DummysubscriptionPlanId, active, agent, razorpayPlan, email, contact, city, state, pincode, consent, address, proofDocument: document });
    

    const existingUser = await User.findOne({ email, contact });

    if(existingUser)
    {
      res.json({ success: false, message:"User already exists and active." });
    }
    else
    {
      user.save();
      res.json({success: true, message: "User created successfully."}); 
    }



    

    
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

    if (user.agent !== false) {
      return res.status(401).json({ success: false, message: 'Authentication failed. Check username and password.' });
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

    const user = await User.findOne({ username, agent: true, active: true }).populate('subscriptionPlan');
    

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

    console.log("userdata", user);

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
app.post('/products', upload.single('file'), async (req, res) => {
  
  
  if (!req.file) {
    return res.status(400).send('No photo uploaded.');
  }
  
  
  try {
    const { name, description, category, price, dimensions, active, userId, subscriptionPlanId, file, city, state, pincode} = req.body;
    const photoUrl = `http://localhost:5001/${req.file.path}`;
    // Find the subscription plan to check the limit
    const subscriptionPlan = await SubscriptionPlan.findById(subscriptionPlanId);

    if (!subscriptionPlan) {
      return res.status(404).json({ success: false, message: 'Subscription plan not found.' });
    }

    // Check if the product limit has been reached
    const productsCount = await Product.countDocuments();
    if (productsCount >= subscriptionPlan.limit) {
      return res.status(200).json({
        success: false,
        message: 'Product limit reached for the subscribed subscription plan.',
      });
    }

    const product = new Product({
      name,
      description,
      image: req.file.path,
      category,
      price,
      dimensions,
      active: false,
      userId,
      subscriptionPlan: subscriptionPlanId,
      city,
      state,
      pincode
    });

    await product.save();

    res.status(200).json({ success: true, message: "Product added successfully.", data: product });
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


// Define route to handle file uploads
app.post('/uploadtest', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded');
  }

  const filePath = req.file.path;
  res.send(`File uploaded successfully. Path: ${filePath}`);
});



app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
