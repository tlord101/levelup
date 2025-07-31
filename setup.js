const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function setupDatabase() {
  console.log('🚀 Starting LevelUp Supabase setup...');

  // Supabase manages tables via its dashboard or SQL editor.
  // You cannot create tables via the JS client, so use the Supabase dashboard for schema setup.

  // Insert sample user if not exists
  const { data: existingUser, error: userError } = await supabase
    .from('users')
    .select('id')
    .eq('email', 'test@levelup.com')
    .single();

  if (!existingUser) {
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash('password123', 10);

    // Insert user
    const { data: user, error: insertUserError } = await supabase
      .from('users')
      .insert([
        { email: 'test@levelup.com', password: hashedPassword }
      ])
      .select();

    const userId = user[0].id;

    // Insert profile
    await supabase.from('user_profiles').insert([
      {
        user_id: userId,
        xp: 150,
        level: 2,
        goals: 'weight_loss',
        age: 25,
        gender: 'male',
        height_cm: 180,
        weight_kg: 75.5
      }
    ]);

    // Insert other sample data as needed...
    // Example: body_scans, face_scans, food_scans, xp_logs, nutrition_log, user_feed

    console.log(`✅ Sample user created: test@levelup.com / password123`);
    console.log(`   User ID: ${userId}`);
  } else {
    console.log('✅ Sample user already exists');
  }

  console.log('✅ Supabase setup completed successfully!');
  console.log('\n🧪 Test Account:');
  console.log('   Email: test@levelup.com');
  console.log('   Password: password123');
  console.log('\n🚀 You can now start the server with: npm start');
}

if (require.main === module) {
  setupDatabase()
    .then(() => {
      console.log('Supabase setup completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Supabase setup failed:', error);
      process.exit(1);
    });
}

module.exports = { setupDatabase };
// Note: Table creation and schema changes must be done in the Supabase dashboard or SQL editor.