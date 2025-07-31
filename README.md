# LevelUp Backend

LevelUp is a health and fitness platform backend built with Node.js, Express, and Supabase. It provides authentication, body/face/food scanning, nutrition logging, and gamified XP tracking.

## Features

- **User Registration & Login** (JWT authentication)
- **Body, Face, and Food Scanning** endpoints
- **Nutrition & XP Logging**
- **Supabase Database Integration**
- **Third-party API support** (FatSecret, OpenAI, Replicate, Google Vision)
- **Secure file uploads**
- **RESTful API design**

## Getting Started

### Prerequisites

- Node.js (v18+)
- Supabase project with required tables
- API keys for FatSecret, OpenAI, Replicate, Google Vision

### Installation

```sh
git clone https://github.com/your-username/levelup.git
cd levelup
npm install
```

### Environment Setup

Configure your `.env` file:

```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
JWT_SECRET=your_jwt_secret
FATSECRET_CONSUMER_KEY=your_fatsecret_consumer_key
FATSECRET_CONSUMER_SECRET=your_fatsecret_consumer_secret
OPENAI_API_KEY=your_openai_api_key
REPLICATE_API_TOKEN=your_replicate_api_token
GOOGLE_VISION_API_KEY=your_google_vision_api_key
PORT=3000
NODE_ENV=development
```

### Database Setup

Create tables in Supabase using the SQL Editor:

```sql
-- users table
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- user_profiles table
CREATE TABLE user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  xp integer DEFAULT 0,
  level integer DEFAULT 1,
  goals text,
  age integer,
  gender text,
  height_cm integer,
  weight_kg numeric,
  created_at timestamp with time zone DEFAULT now()
);
```

### Running the Application

```sh
npm run dev
```
or
```sh
npm start
```

### API Documentation

See [`api_documentation.md`](./api_documentation.md) for full endpoint details.

## Example Usage

**Register User**
```sh
curl -X POST http://localhost:3000/api/auth/register ^
  -H "Content-Type: application/json" ^
  -d "{\"email\": \"user@example.com\", \"password\": \"securepassword\", \"age\": 25, \"gender\": \"male\", \"height_cm\": 180, \"weight_kg\": 75.5, \"goals\": \"weight_loss\"}"
```

**Login User**
```sh
curl -X POST http://localhost:3000/api/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"email\": \"user@example.com\", \"password\": \"securepassword\"}"
```

## Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.