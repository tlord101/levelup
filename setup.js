const { Pool } = require('pg');
require('dotenv').config();

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/levelup_db',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function setupDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting LevelUp database setup...');
    
    // Create extensions
    console.log('📦 Creating extensions...');
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
    
    // Create users table
    console.log('👥 Creating users table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Create user_profiles table
    console.log('📊 Creating user_profiles table...');
    await client.query(`
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
    `);
    
    // Create body_scans table
    console.log('💪 Creating body_scans table...');
    await client.query(`
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
    `);
    
    // Create face_scans table
    console.log('😊 Creating face_scans table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS face_scans (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        image_url TEXT,
        skin_type VARCHAR(50),
        skin_issues TEXT[],
        ai_result JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Create food_scans table
    console.log('🍎 Creating food_scans table...');
    await client.query(`
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
    `);
    
    // Create nutrition_log table
    console.log('📈 Creating nutrition_log table...');
    await client.query(`
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
    `);
    
    // Create xp_logs table
    console.log('⭐ Creating xp_logs table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS xp_logs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        action VARCHAR(100),
        xp_amount INTEGER,
        source VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Create user_feed table
    console.log('📰 Creating user_feed table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_feed (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(50),
        content JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Create indexes for better performance
    console.log('🔍 Creating indexes...');
    await client.query('CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_body_scans_user_id ON body_scans(user_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_face_scans_user_id ON face_scans(user_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_food_scans_user_id ON food_scans(user_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_nutrition_log_user_date ON nutrition_log(user_id, date);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_xp_logs_user_id ON xp_logs(user_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_user_feed_user_id ON user_feed(user_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_user_feed_created_at ON user_feed(created_at DESC);');
    
    // Insert sample data for testing (optional)
    console.log('🧪 Inserting sample data...');
    
    // Check if sample user exists
    const existingUser = await client.query("SELECT id FROM users WHERE email = 'test@levelup.com'");
    
    if (existingUser.rows.length === 0) {
      // Create sample user
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('password123', 10);
      
      const userResult = await client.query(
        'INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id',
        ['test@levelup.com', hashedPassword]
      );
      
      const userId = userResult.rows[0].id;
      
      // Create sample profile
      await client.query(
        'INSERT INTO user_profiles (user_id, xp, level, goals, age, gender, height_cm, weight_kg) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [userId, 150, 2, 'weight_loss', 25, 'male', 180, 75.5]
      );
      
      // Add sample body scan
      await client.query(
        'INSERT INTO body_scans (user_id, image_url, body_type, fat_percent, muscle_percent, ai_result) VALUES ($1, $2, $3, $4, $5, $6)',
        [userId, 'sample-body-image.jpg', 'Athletic', 12.5, 45.2, JSON.stringify({
          body_type: 'Athletic',
          fat_percent: 12.5,
          muscle_percent: 45.2,
          confidence: 0.85,
          analysis: 'Sample body scan analysis'
        })]
      );
      
      // Add sample face scan
      await client.query(
        'INSERT INTO face_scans (user_id, image_url, skin_type, skin_issues, ai_result) VALUES ($1, $2, $3, $4, $5)',
        [userId, 'sample-face-image.jpg', 'Combination', ['acne'], JSON.stringify({
          skin_type: 'Combination',
          skin_issues: ['acne'],
          confidence: 0.78,
          recommendations: ['Use gentle cleanser', 'Apply moisturizer']
        })]
      );
      
      // Add sample food scan
      await client.query(
        'INSERT INTO food_scans (user_id, image_url, food_name, calories, protein, carbs, fat, ai_result) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [userId, 'sample-food-image.jpg', 'Chicken Breast', 165, 31, 0, 3.6, JSON.stringify({
          food_name: 'Chicken Breast',
          calories: 165,
          protein: 31,
          carbs: 0,
          fat: 3.6
        })]
      );
      
      // Add sample XP logs
      await client.query(
        'INSERT INTO xp_logs (user_id, action, xp_amount, source) VALUES ($1, $2, $3, $4)',
        [userId, 'body_scan', 10, 'scan']
      );
      
      await client.query(
        'INSERT INTO xp_logs (user_id, action, xp_amount, source) VALUES ($1, $2, $3, $4)',
        [userId, 'face_scan', 10, 'scan']
      );
      
      await client.query(
        'INSERT INTO xp_logs (user_id, action, xp_amount, source) VALUES ($1, $2, $3, $4)',
        [userId, 'food_scan', 10, 'scan']
      );
      
      // Add sample nutrition log
      await client.query(
        'INSERT INTO nutrition_log (user_id, total_calories, protein, carbs, fat) VALUES ($1, $2, $3, $4, $5)',
        [userId, 1650, 120, 180, 55]
      );
      
      // Add sample feed entries
      await client.query(
        'INSERT INTO user_feed (user_id, type, content) VALUES ($1, $2, $3)',
        [userId, 'scan', JSON.stringify({
          type: 'body_scan',
          message: 'Body scan completed! Body type: Athletic',
          data: { body_type: 'Athletic', fat_percent: 12.5 }
        })]
      );
      
      await client.query(
        'INSERT INTO user_feed (user_id, type, content) VALUES ($1, $2, $3)',
        [userId, 'level_up', JSON.stringify({
          message: 'Congratulations! You reached level 2!',
          newLevel: 2,
          xpGained: 10
        })]
      );
      
      console.log(`✅ Sample user created: test@levelup.com / password123`);
      console.log(`   User ID: ${userId}`);
    } else {
      console.log('✅ Sample user already exists');
    }
    
    console.log('✅ Database setup completed successfully!');
    console.log('\n📋 Setup Summary:');
    console.log('   - All tables created with proper relationships');
    console.log('   - Indexes added for optimal performance');
    console.log('   - Sample data inserted for testing');
    console.log('\n🧪 Test Account:');
    console.log('   Email: test@levelup.com');
    console.log('   Password: password123');
    console.log('\n🚀 You can now start the server with: npm start');
    
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run setup if called directly
if (require.main === module) {
  setupDatabase()
    .then(() => {
      console.log('Database setup completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Database setup failed:', error);
      process.exit(1);
    });
}

module.exports = { setupDatabase };