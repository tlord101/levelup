const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const axios = require('axios');
const cron = require('node-cron');
const crypto = require('crypto');
const OAuth = require('oauth-1.0a');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Supabase client setup
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// File upload configuration
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// FatSecret API OAuth 1.0a configuration
const oauth = OAuth({
  consumer: {
    key: process.env.FATSECRET_CONSUMER_KEY,
    secret: process.env.FATSECRET_CONSUMER_SECRET,
  },
  signature_method: 'HMAC-SHA1',
  hash_function(base_string, key) {
    return crypto
      .createHmac('sha1', key)
      .update(base_string)
      .digest('base64');
  },
});

// JWT Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// Mock AI Functions (replace with actual API calls)
async function analyzeBodyScan(imageUrl) {
  // Mock Replicate API call for body segmentation
  // In production, replace with actual Replicate API call
  const mockResults = [
    { body_type: 'Athletic', fat_percent: 12.5, muscle_percent: 45.2 },
    { body_type: 'Average', fat_percent: 18.3, muscle_percent: 38.7 },
    { body_type: 'Lean', fat_percent: 8.2, muscle_percent: 42.1 }
  ];
  
  const randomResult = mockResults[Math.floor(Math.random() * mockResults.length)];
  
  return {
    ...randomResult,
    confidence: 0.85,
    analysis: `Body composition analysis complete. Detected ${randomResult.body_type} build.`
  };
}

async function analyzeFaceScan(imageUrl) {
  // Mock face analysis
  const skinTypes = ['Dry', 'Oily', 'Combination', 'Sensitive', 'Normal'];
  const possibleIssues = ['acne', 'dark_spots', 'wrinkles', 'dryness', 'oiliness'];
  
  const skinType = skinTypes[Math.floor(Math.random() * skinTypes.length)];
  const issues = possibleIssues.filter(() => Math.random() > 0.6);
  
  return {
    skin_type: skinType,
    skin_issues: issues,
    confidence: 0.78,
    recommendations: [
      'Use a gentle cleanser twice daily',
      'Apply sunscreen with at least SPF 30',
      'Consider a moisturizer suitable for your skin type'
    ]
  };
}

async function identifyFood(imageUrl) {
  // Mock food identification - in production use Google Vision API or similar
  const commonFoods = [
    'Apple', 'Banana', 'Chicken Breast', 'Salmon', 'Rice', 'Broccoli',
    'Pasta', 'Bread', 'Egg', 'Yogurt', 'Oatmeal', 'Avocado'
  ];
  
  return commonFoods[Math.floor(Math.random() * commonFoods.length)];
}

// Authentication Routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, age, gender, height_cm, weight_kg, goals } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    // Check if user exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Create user
    const { data: user, error: userError } = await supabase
      .from('users')
      .insert([{ email, password: hashedPassword }])
      .select();

    if (userError) throw userError;

    const userId = user[0].id;

    // Create user profile
    await supabase.from('user_profiles').insert([{
      user_id: userId,
      age,
      gender,
      height_cm,
      weight_kg,
      goals
    }]);

    // Generate JWT
    const token = jwt.sign({ userId }, process.env.JWT_SECRET);

    res.status(201).json({
      success: true,
      user: { id: userId, email },
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const result = await supabase
      .from('users')
      .select('id, email, password')
      .eq('email', email)
      .single();
    
    if (!result.data) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const user = result.data;
    const isValidPassword = await bcrypt.compare(password, user.password);
    
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || 'your-secret-key');
    
    res.json({
      success: true,
      user: { id: user.id, email: user.email },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Scan Routes
app.post('/api/scan/body', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    const userId = req.user.userId;
    const imageUrl = req.body.image_url || 'mock-body-image-url';
    
    // Analyze body scan
    const aiResult = await analyzeBodyScan(imageUrl);
    
    // Save to database
    const { data: scanData, error: scanError } = await supabase
      .from('body_scans')
      .insert([{
        user_id: userId,
        image_url: imageUrl,
        body_type: aiResult.body_type,
        fat_percent: aiResult.fat_percent,
        muscle_percent: aiResult.muscle_percent,
        ai_result: aiResult
      }])
      .select();
    
    if (scanError) throw scanError;
    
    const scan = scanData[0];
    
    // Add XP
    await addXP(userId, 'body_scan', 10, 'scan');
    
    // Add to feed
    await supabase
      .from('user_feed')
      .insert([{
        user_id: userId,
        type: 'scan',
        content: {
          type: 'body_scan',
          message: `New body scan completed! Body type: ${aiResult.body_type}`,
          data: aiResult
        }
      }]);
    
    res.json({
      success: true,
      scan,
      xpGained: 10
    });
  } catch (error) {
    console.error('Body scan error:', error);
    res.status(500).json({ error: 'Body scan failed' });
  }
});

app.post('/api/scan/face', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    const userId = req.user.userId;
    const imageUrl = req.body.image_url || 'mock-face-image-url';
    
    // Analyze face scan
    const aiResult = await analyzeFaceScan(imageUrl);
    
    // Save to database
    const { data: scanData, error: scanError } = await supabase
      .from('face_scans')
      .insert([{
        user_id: userId,
        image_url: imageUrl,
        skin_type: aiResult.skin_type,
        skin_issues: aiResult.skin_issues,
        ai_result: aiResult
      }])
      .select();
    
    if (scanError) throw scanError;
    
    const scan = scanData[0];
    
    // Add XP
    await addXP(userId, 'face_scan', 10, 'scan');
    
    // Add to feed
    await supabase
      .from('user_feed')
      .insert([{
        user_id: userId,
        type: 'scan',
        content: {
          type: 'face_scan',
          message: `Face scan completed! Skin type: ${aiResult.skin_type}`,
          data: aiResult
        }
      }]);
    
    res.json({
      success: true,
      scan,
      xpGained: 10
    });
  } catch (error) {
    console.error('Face scan error:', error);
    res.status(500).json({ error: 'Face scan failed' });
  }
});

app.post('/api/scan/food', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    const userId = req.user.userId;
    const imageUrl = req.body.image_url || 'mock-food-image-url';
    
    // Identify food from image
    const identifiedFood = await identifyFood(imageUrl);
    
    // Search FatSecret API
    const searchResult = await searchFood(identifiedFood);
    let nutritionData = {
      food_name: identifiedFood,
      calories: 100,
      protein: 5,
      carbs: 15,
      fat: 3
    };
    
    if (searchResult && searchResult.foods && searchResult.foods.food) {
      const foods = Array.isArray(searchResult.foods.food) ? searchResult.foods.food : [searchResult.foods.food];
      if (foods.length > 0) {
        const foodDetails = await getFoodDetails(foods[0].food_id);
        if (foodDetails && foodDetails.food && foodDetails.food.servings) {
          const serving = foodDetails.food.servings.serving[0] || foodDetails.food.servings.serving;
          nutritionData = {
            food_name: foodDetails.food.food_name,
            calories: parseFloat(serving.calories) || 0,
            protein: parseFloat(serving.protein) || 0,
            carbs: parseFloat(serving.carbohydrate) || 0,
            fat: parseFloat(serving.fat) || 0
          };
        }
      }
    }
    
    // Save food scan
    const { data: scanData, error: scanError } = await supabase
      .from('food_scans')
      .insert([{
        user_id: userId,
        image_url: imageUrl,
        food_name: nutritionData.food_name,
        calories: nutritionData.calories,
        protein: nutritionData.protein,
        carbs: nutritionData.carbs,
        fat: nutritionData.fat,
        ai_result: nutritionData
      }])
      .select();
    
    if (scanError) throw scanError;
    
    const scan = scanData[0];
    
    // Update nutrition log for today
    await supabase
      .from('nutrition_log')
      .upsert([{
        user_id: userId,
        date: new Date().toISOString().split('T')[0],
        total_calories: nutritionData.calories,
        protein: nutritionData.protein,
        carbs: nutritionData.carbs,
        fat: nutritionData.fat
      }]);
    
    // Add XP
    await addXP(userId, 'food_scan', 10, 'scan');
    
    // Add to feed
    await supabase
      .from('user_feed')
      .insert([{
        user_id: userId,
        type: 'scan',
        content: {
          type: 'food_scan',
          message: `Food scanned: ${nutritionData.food_name} (${nutritionData.calories} cal)`,
          data: nutritionData
        }
      }]);
    
    res.json({
      success: true,
      scan,
      nutrition: nutritionData,
      xpGained: 10
    });
  } catch (error) {
    console.error('Food scan error:', error);
    res.status(500).json({ error: 'Food scan failed' });
  }
});

// Dashboard Route
app.get('/api/dashboard/:user_id', authenticateToken, async (req, res) => {
  try {
    const userId = req.params.user_id;
    
    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (profileError) throw profileError;
    
    // Get today's nutrition
    const { data: nutrition, error: nutritionError } = await supabase
      .from('nutrition_log')
      .select('*')
      .eq('user_id', userId)
      .eq('date', new Date().toISOString().split('T')[0])
      .single();
    
    if (nutritionError) throw nutritionError;
    
    // Get recent scans
    const { data: recentScans, error: scansError } = await supabase
      .from('body_scans')
      .select('created_at, body_type')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (scansError) throw scansError;
    
    // Get recent feed
    const { data: feed, error: feedError } = await supabase
      .from('user_feed')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (feedError) throw feedError;
    
    res.json({
      success: true,
      profile,
      todayNutrition: nutrition || null,
      recentScans: recentScans || [],
      feed: feed || []
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
});

// AI-Generated Wellness Plan
app.post('/api/ai/generate-plan', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { goal } = req.body;
    
    // Get user profile and recent scans for context
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (profileError) throw profileError;
    
    // Mock AI plan generation (replace with OpenAI API)
    const plans = {
      weight_loss: {
        fitness: [
          '30 minutes cardio 4x/week',
          'Strength training 2x/week',
          '10,000 steps daily'
        ],
        nutrition: [
          'Caloric deficit of 500 calories/day',
          'High protein intake (1g per lb bodyweight)',
          'Limit processed foods'
        ],
        skincare: [
          'Drink 8 glasses of water daily',
          'Use gentle cleanser morning and night',
          'Apply moisturizer with SPF'
        ]
      },
      muscle_gain: {
        fitness: [
          'Strength training 4x/week',
          'Progressive overload each week',
          'Focus on compound movements'
        ],
        nutrition: [
          'Caloric surplus of 300-500 calories/day',
          'High protein intake (1.2g per lb bodyweight)',
          'Pre and post workout nutrition'
        ],
        skincare: [
          'Stay hydrated',
          'Use gentle cleanser after workouts',
          'Apply moisturizer daily'
        ]
      }
    };
    
    const selectedPlan = plans[goal] || plans.weight_loss;
    
    const aiPlan = {
      goal,
      duration: '4 weeks',
      difficulty: 'Intermediate',
      plan: selectedPlan,
      tips: [
        'Consistency is key to seeing results',
        'Track your progress weekly',
        'Listen to your body and rest when needed'
      ]
    };
    
    // Add XP
    await addXP(userId, 'ai_plan_generated', 20, 'ai');
    
    // Add to feed
    await supabase
      .from('user_feed')
      .insert([{
        user_id: userId,
        type: 'ai_plan',
        content: {
          message: `New AI wellness plan generated for ${goal}!`,
          plan: aiPlan
        }
      }]);
    
    res.json({
      success: true,
      plan: aiPlan,
      xpGained: 20
    });
  } catch (error) {
    console.error('AI plan generation error:', error);
    res.status(500).json({ error: 'Failed to generate AI plan' });
  }
});

// Weekly Progress Summary (Cron Job)
cron.schedule('0 9 * * 1', async () => { // Every Monday at 9 AM
  console.log('Running weekly progress summary...');
  
  try {
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id');
    
    if (usersError) throw usersError;
    
    for (const user of users) {
      const userId = user.id;
      
      // Get week's stats
      const { data: weekStats, error: statsError } = await supabase
        .from('body_scans')
        .select('COUNT(*)')
        .eq('user_id', userId)
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .single();
      
      if (statsError) throw statsError;
      
      const totalScans = parseInt(weekStats.count) || 0;
      
      if (totalScans > 0) {
        await supabase
          .from('user_feed')
          .insert([{
            user_id: userId,
            type: 'weekly_summary',
            content: {
              message: `Week in review: ${totalScans} total scans completed!`,
              stats: {
                totalScans
              }
            }
          }]);
      }
    }
  } catch (error) {
    console.error('Weekly summary error:', error);
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Initialize database and start server
async function startServer() {
  app.listen(PORT, () => {
    console.log(`LevelUp Backend Server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
  });
}

startServer().catch(console.error);

module.exports = app;