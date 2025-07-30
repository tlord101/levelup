const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const multer = require('multer');
const axios = require('axios');
const cron = require('node-cron');
const crypto = require('crypto');
const OAuth = require('oauth-1.0a');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/levelup_db',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

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

// Database initialization
async function initializeDatabase() {
  const client = await pool.connect();
  try {
    // Create tables
    await client.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
      
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS user_profiles (
        user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        xp INTEGER DEFAULT 0,
        level INTEGER DEFAULT 1,
        goals TEXT,
        age INTEGER,
        gender VARCHAR(20),
        height_cm INTEGER,
        weight_kg DECIMAL(5,2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS body_scans (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        image_url TEXT,
        body_type VARCHAR(50),
        fat_percent DECIMAL(5,2),
        muscle_percent DECIMAL(5,2),
        ai_result JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS face_scans (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        image_url TEXT,
        skin_type VARCHAR(50),
        skin_issues TEXT[],
        ai_result JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS food_scans (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        image_url TEXT,
        food_name VARCHAR(255),
        calories DECIMAL(8,2),
        protein DECIMAL(6,2),
        carbs DECIMAL(6,2),
        fat DECIMAL(6,2),
        ai_result JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS nutrition_log (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        date DATE DEFAULT CURRENT_DATE,
        total_calories DECIMAL(8,2) DEFAULT 0,
        carbs DECIMAL(6,2) DEFAULT 0,
        protein DECIMAL(6,2) DEFAULT 0,
        fat DECIMAL(6,2) DEFAULT 0,
        UNIQUE(user_id, date)
      );

      CREATE TABLE IF NOT EXISTS xp_logs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        action VARCHAR(100),
        xp_amount INTEGER,
        source VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS user_feed (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(50),
        content JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
  } finally {
    client.release();
  }
}

// XP System Functions
async function addXP(userId, action, xpAmount, source = 'scan') {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Add XP to user profile
    await client.query(
      'UPDATE user_profiles SET xp = xp + $1 WHERE user_id = $2',
      [xpAmount, userId]
    );
    
    // Log XP gain
    await client.query(
      'INSERT INTO xp_logs (user_id, action, xp_amount, source) VALUES ($1, $2, $3, $4)',
      [userId, action, xpAmount, source]
    );
    
    // Check for level up
    const result = await client.query(
      'SELECT xp, level FROM user_profiles WHERE user_id = $1',
      [userId]
    );
    
    const { xp, level } = result.rows[0];
    const requiredXP = level * 100;
    
    if (xp >= requiredXP) {
      const newLevel = level + 1;
      await client.query(
        'UPDATE user_profiles SET level = $1 WHERE user_id = $2',
        [newLevel, userId]
      );
      
      // Add level up to feed
      await client.query(
        'INSERT INTO user_feed (user_id, type, content) VALUES ($1, $2, $3)',
        [userId, 'level_up', JSON.stringify({ 
          message: `Congratulations! You reached level ${newLevel}!`,
          newLevel,
          xpGained: xpAmount
        })]
      );
    }
    
    await client.query('COMMIT');
    return { success: true, leveledUp: xp >= requiredXP };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// FatSecret API Functions
async function searchFood(foodName) {
  const requestData = {
    url: 'https://platform.fatsecret.com/rest/server.api',
    method: 'GET',
    data: {
      method: 'foods.search',
      search_expression: foodName,
      format: 'json'
    }
  };

  const authHeader = oauth.toHeader(oauth.authorize(requestData, {}));
  
  try {
    const response = await axios.get(requestData.url, {
      params: requestData.data,
      headers: authHeader
    });
    return response.data;
  } catch (error) {
    console.error('FatSecret search error:', error);
    return null;
  }
}

async function getFoodDetails(foodId) {
  const requestData = {
    url: 'https://platform.fatsecret.com/rest/server.api',
    method: 'GET',
    data: {
      method: 'food.get',
      food_id: foodId,
      format: 'json'
    }
  };

  const authHeader = oauth.toHeader(oauth.authorize(requestData, {}));
  
  try {
    const response = await axios.get(requestData.url, {
      params: requestData.data,
      headers: authHeader
    });
    return response.data;
  } catch (error) {
    console.error('FatSecret details error:', error);
    return null;
  }
}

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
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Create user
      const userResult = await client.query(
        'INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id',
        [email, hashedPassword]
      );
      
      const userId = userResult.rows[0].id;
      
      // Create user profile
      await client.query(
        'INSERT INTO user_profiles (user_id, age, gender, height_cm, weight_kg, goals) VALUES ($1, $2, $3, $4, $5, $6)',
        [userId, age, gender, height_cm, weight_kg, goals]
      );
      
      await client.query('COMMIT');
      
      // Generate JWT
      const token = jwt.sign({ userId }, process.env.JWT_SECRET || 'your-secret-key');
      
      res.status(201).json({
        success: true,
        user: { id: userId, email },
        token
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const result = await pool.query(
      'SELECT id, email, password FROM users WHERE email = $1',
      [email]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const user = result.rows[0];
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
    const result = await pool.query(
      'INSERT INTO body_scans (user_id, image_url, body_type, fat_percent, muscle_percent, ai_result) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [userId, imageUrl, aiResult.body_type, aiResult.fat_percent, aiResult.muscle_percent, JSON.stringify(aiResult)]
    );
    
    // Add XP
    await addXP(userId, 'body_scan', 10, 'scan');
    
    // Add to feed
    await pool.query(
      'INSERT INTO user_feed (user_id, type, content) VALUES ($1, $2, $3)',
      [userId, 'scan', JSON.stringify({
        type: 'body_scan',
        message: `New body scan completed! Body type: ${aiResult.body_type}`,
        data: aiResult
      })]
    );
    
    res.json({
      success: true,
      scan: result.rows[0],
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
    const result = await pool.query(
      'INSERT INTO face_scans (user_id, image_url, skin_type, skin_issues, ai_result) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [userId, imageUrl, aiResult.skin_type, aiResult.skin_issues, JSON.stringify(aiResult)]
    );
    
    // Add XP
    await addXP(userId, 'face_scan', 10, 'scan');
    
    // Add to feed
    await pool.query(
      'INSERT INTO user_feed (user_id, type, content) VALUES ($1, $2, $3)',
      [userId, 'scan', JSON.stringify({
        type: 'face_scan',
        message: `Face scan completed! Skin type: ${aiResult.skin_type}`,
        data: aiResult
      })]
    );
    
    res.json({
      success: true,
      scan: result.rows[0],
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
    const result = await pool.query(
      'INSERT INTO food_scans (user_id, image_url, food_name, calories, protein, carbs, fat, ai_result) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [userId, imageUrl, nutritionData.food_name, nutritionData.calories, nutritionData.protein, nutritionData.carbs, nutritionData.fat, JSON.stringify(nutritionData)]
    );
    
    // Update nutrition log for today
    await pool.query(`
      INSERT INTO nutrition_log (user_id, date, total_calories, protein, carbs, fat) 
      VALUES ($1, CURRENT_DATE, $2, $3, $4, $5)
      ON CONFLICT (user_id, date) 
      DO UPDATE SET 
        total_calories = nutrition_log.total_calories + $2,
        protein = nutrition_log.protein + $3,
        carbs = nutrition_log.carbs + $4,
        fat = nutrition_log.fat + $5
    `, [userId, nutritionData.calories, nutritionData.protein, nutritionData.carbs, nutritionData.fat]);
    
    // Add XP
    await addXP(userId, 'food_scan', 10, 'scan');
    
    // Add to feed
    await pool.query(
      'INSERT INTO user_feed (user_id, type, content) VALUES ($1, $2, $3)',
      [userId, 'scan', JSON.stringify({
        type: 'food_scan',
        message: `Food scanned: ${nutritionData.food_name} (${nutritionData.calories} cal)`,
        data: nutritionData
      })]
    );
    
    res.json({
      success: true,
      scan: result.rows[0],
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
    const profileResult = await pool.query(
      'SELECT * FROM user_profiles WHERE user_id = $1',
      [userId]
    );
    
    // Get today's nutrition
    const nutritionResult = await pool.query(
      'SELECT * FROM nutrition_log WHERE user_id = $1 AND date = CURRENT_DATE',
      [userId]
    );
    
    // Get recent scans
    const recentScans = await pool.query(`
      SELECT 'body' as type, created_at, body_type as result FROM body_scans WHERE user_id = $1
      UNION ALL
      SELECT 'face' as type, created_at, skin_type as result FROM face_scans WHERE user_id = $1
      UNION ALL
      SELECT 'food' as type, created_at, food_name as result FROM food_scans WHERE user_id = $1
      ORDER BY created_at DESC LIMIT 5
    `, [userId]);
    
    // Get recent feed
    const feedResult = await pool.query(
      'SELECT * FROM user_feed WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10',
      [userId]
    );
    
    res.json({
      success: true,
      profile: profileResult.rows[0],
      todayNutrition: nutritionResult.rows[0] || null,
      recentScans: recentScans.rows,
      feed: feedResult.rows
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
    const profileResult = await pool.query(
      'SELECT * FROM user_profiles WHERE user_id = $1',
      [userId]
    );
    
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
    await pool.query(
      'INSERT INTO user_feed (user_id, type, content) VALUES ($1, $2, $3)',
      [userId, 'ai_plan', JSON.stringify({
        message: `New AI wellness plan generated for ${goal}!`,
        plan: aiPlan
      })]
    );
    
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
    const usersResult = await pool.query('SELECT id FROM users');
    
    for (const user of usersResult.rows) {
      const userId = user.id;
      
      // Get week's stats
      const weekStats = await pool.query(`
        SELECT 
          COUNT(CASE WHEN type = 'body' THEN 1 END) as body_scans,
          COUNT(CASE WHEN type = 'face' THEN 1 END) as face_scans,
          COUNT(CASE WHEN type = 'food' THEN 1 END) as food_scans
        FROM (
          SELECT 'body' as type FROM body_scans WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '7 days'
          UNION ALL
          SELECT 'face' as type FROM face_scans WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '7 days'
          UNION ALL
          SELECT 'food' as type FROM food_scans WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '7 days'
        ) scans
      `, [userId]);
      
      const stats = weekStats.rows[0];
      const totalScans = parseInt(stats.body_scans) + parseInt(stats.face_scans) + parseInt(stats.food_scans);
      
      if (totalScans > 0) {
        await pool.query(
          'INSERT INTO user_feed (user_id, type, content) VALUES ($1, $2, $3)',
          [userId, 'weekly_summary', JSON.stringify({
            message: `Week in review: ${totalScans} total scans completed!`,
            stats: {
              bodyScans: stats.body_scans,
              faceScans: stats.face_scans,
              foodScans: stats.food_scans,
              totalScans
            }
          })]
        );
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
  await initializeDatabase();
  
  app.listen(PORT, () => {
    console.log(`LevelUp Backend Server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
  });
}

startServer().catch(console.error);

module.exports = app;