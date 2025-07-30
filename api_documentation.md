# LevelUp Backend API Documentation

## Base URL
```
http://localhost:3000/api
```

## Authentication
All protected endpoints require a Bearer token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

## Endpoints

### Authentication

#### Register User
```http
POST /api/auth/register
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword",
  "age": 25,
  "gender": "male",
  "height_cm": 180,
  "weight_kg": 75.5,
  "goals": "weight_loss"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  },
  "token": "jwt_token_here"
}
```

#### Login User
```http
POST /api/auth/login
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  },
  "token": "jwt_token_here"
}
```

---

### Scanning Endpoints

#### Body Scan
```http
POST /api/scan/body
```

**Headers:**
```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Request Body:**
- `image`: File upload (optional)
- `image_url`: String (optional - for testing)

**Response:**
```json
{
  "success": true,
  "scan": {
    "id": "uuid",
    "user_id": "uuid",
    "image_url": "string",
    "body_type": "Athletic",
    "fat_percent": 12.5,
    "muscle_percent": 45.2,
    "ai_result": {
      "body_type": "Athletic",
      "fat_percent": 12.5,
      "muscle_percent": 45.2,
      "confidence": 0.85,
      "analysis": "Body composition analysis complete..."
    },
    "created_at": "2025-07-30T10:00:00Z"
  },
  "xpGained": 10
}
```

#### Face Scan
```http
POST /api/scan/face
```

**Headers:**
```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Request Body:**
- `image`: File upload (optional)
- `image_url`: String (optional - for testing)

**Response:**
```json
{
  "success": true,
  "scan": {
    "id": "uuid",
    "user_id": "uuid",
    "image_url": "string",
    "skin_type": "Combination",
    "skin_issues": ["acne", "dryness"],
    "ai_result": {
      "skin_type": "Combination",
      "skin_issues": ["acne", "dryness"],
      "confidence": 0.78,
      "recommendations": [
        "Use a gentle cleanser twice daily",
        "Apply sunscreen with at least SPF 30"
      ]
    },
    "created_at": "2025-07-30T10:00:00Z"
  },
  "xpGained": 10
}
```

#### Food Scan
```http
POST /api/scan/food
```

**Headers:**
```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Request Body:**
- `image`: File upload (optional)
- `image_url`: String (optional - for testing)

**Response:**
```json
{
  "success": true,
  "scan": {
    "id": "uuid",
    "user_id": "uuid",
    "image_url": "string",
    "food_name": "Chicken Breast",
    "calories": 165.0,
    "protein": 31.0,
    "carbs": 0.0,
    "fat": 3.6,
    "ai_result": {
      "food_name": "Chicken Breast",
      "calories": 165.0,
      "protein": 31.0,
      "carbs": 0.0,
      "fat": 3.6
    },
    "created_at": "2025-07-30T10:00:00Z"
  },
  "nutrition": {
    "food_name": "Chicken Breast",
    "calories": 165.0,
    "protein": 31.0,
    "carbs": 0.0,
    "fat": 3.6
  },
  "xpGained": 10
}
```

---

### Dashboard

#### Get Dashboard Data
```http
GET /api/dashboard/:user_id
```

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "profile": {
    "user_id": "uuid",
    "xp": 150,
    "level": 2,
    "goals": "weight_loss",
    "age": 25,
    "gender": "male",
    "height_cm": 180,
    "weight_kg": 75.5
  },
  "todayNutrition": {
    "user_id": "uuid",
    "date": "2025-07-30",
    "total_calories": 1450.0,
    "carbs": 120.0,
    "protein": 85.0,
    "fat": 45.0
  },
  "recentScans": [
    {
      "type": "food",
      "created_at": "2025-07-30T09:30:00Z",
      "result": "Chicken Breast"
    },
    {
      "type": "body",
      "created_at": "2025-07-30T08:00:00Z",
      "result": "Athletic"
    }
  ],
  "feed": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "type": "scan",
      "content": {
        "type": "food_scan",
        "message": "Food scanned: Chicken Breast (165 cal)",
        "data": {...}
      },
      "created_at": "2025-07-30T09:30:00Z"
    }
  ]
}
```

---

### AI Features

#### Generate Wellness Plan
```http
POST /api/ai/generate-plan
```

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "goal": "weight_loss"
}
```

**Response:**
```json
{
  "success": true,
  "plan": {
    "goal": "weight_loss",
    "duration": "4 weeks",
    "difficulty": "Intermediate",
    "plan": {
      "fitness": [
        "30 minutes cardio 4x/week",
        "Strength training 2x/week",
        "10,000 steps daily"
      ],
      "nutrition": [
        "Caloric deficit of 500 calories/day",
        "High protein intake (1g per lb bodyweight)",
        "Limit processed foods"
      ],
      "skincare": [
        "Drink 8 glasses of water daily",
        "Use gentle cleanser morning and night",
        "Apply moisturizer with SPF"
      ]
    },
    "tips": [
      "Consistency is key to seeing results",
      "Track your progress weekly",
      "Listen to your body and rest when needed"
    ]
  },
  "xpGained": 20
}
```

---

### Health Check

#### Health Status
```http
GET /api/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-07-30T10:00:00.000Z"
}
```

---

## XP System

### XP Rewards
- **Body Scan**: +10 XP
- **Face Scan**: +10 XP
- **Food Scan**: +10 XP
- **AI Plan Generation**: +20 XP

### Level Up Logic
- **Level 1**: 0-99 XP
- **Level 2**: 100-199 XP
- **Level 3**: 200-299 XP
- **Level N**: (N-1) × 100 to (N × 100) - 1 XP

When a user levels up, a special feed entry is automatically created.

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "error": "Error message description"
}
```

### Common HTTP Status Codes
- `200`: Success
- `201`: Created
- `400`: Bad Request
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found
- `500`: Internal Server Error

---

## Database Schema

### Tables Overview

1. **users**: Core user authentication
2. **user_profiles**: User details and gamification data
3. **body_scans**: Body composition analysis results
4. **face_scans**: Skin analysis results
5. **food_scans**: Food identification and nutrition data
6. **nutrition_log**: Daily nutrition tracking
7. **xp_logs**: XP gain history
8. **user_feed**: Activity feed for users

---

## External API Integrations

### FatSecret API
- **Purpose**: Food nutrition data
- **Authentication**: OAuth 1.0a
- **Endpoints Used**:
  - `foods.search`: Search for foods
  - `food.get`: Get detailed nutrition info

### Replicate API (Planned)
- **Purpose**: Body and face analysis
- **Models**:
  - Body segmentation: `axinc-ai/silhouette-segmentation`
  - Face enhancement: `sczhou/codeformer`

### Google Vision API (Planned)
- **Purpose**: Food identification from images
- **Features**: Label detection, text recognition

---

## Testing with FlutterFlow

### Base URL Configuration
Set your FlutterFlow API base URL to:
```
http://your-server-domain:3000/api
```

### Authentication Flow
1. Register/Login to get JWT token
2. Store token in FlutterFlow app state
3. Include token in all subsequent API calls

### Mock Data
The backend includes mock data responses for testing:
- Body scans return randomized body composition data
- Face scans return randomized skin analysis
- Food scans identify common foods with nutrition data

### File Upload Testing
For testing without actual file uploads, you can use the `image_url` parameter in request bodies instead of uploading files.

---

## Deployment

### Environment Variables Required
```bash
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret-key
FATSECRET_CONSUMER_KEY=your-key
FATSECRET_CONSUMER_SECRET=your-secret
```

### Quick Start
```bash
npm install
cp .env.example .env
# Edit .env with your configuration
npm run dev
```

### Production Deployment
```bash
npm start
```

---

## Cron Jobs

### Weekly Progress Summary
- **Schedule**: Every Monday at 9:00 AM
- **Purpose**: Generate weekly progress summaries for users
- **Action**: Creates feed entries with scan statistics

---

## Rate Limiting & Security

### Implemented Features
- JWT-based authentication
- Password hashing with bcrypt
- SQL injection protection with parameterized queries
- File upload size limits (10MB)
- CORS configuration

### Recommended Additions
- Rate limiting middleware
- Input validation with Joi/Yup
- API key authentication for sensitive endpoints
- Request logging and monitoring