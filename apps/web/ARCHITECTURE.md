# DIME AI Platform Architecture

## System Overview

DIME AI is a full-stack influencer marketing platform with three main components:
1. **Frontend**: SvelteKit web application
2. **Backend**: Python FastAPI server for search algorithms
3. **Database & Auth**: Supabase (PostgreSQL + Auth)

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Layer                          │
│  ┌───────────────────────────────────────────────────────┐  │
│  │         SvelteKit Frontend (Port 5173)                │  │
│  │  - Campaign management UI                             │  │
│  │  - Influencer search interface                        │  │
│  │  - Chat-based campaign creation                       │  │
│  │  - Authentication UI                                  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS/REST
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Application Layer                       │
│  ┌──────────────────────┐      ┌────────────────────────┐  │
│  │  Python FastAPI      │      │  Supabase Edge         │  │
│  │  (Port 8000)         │      │  Functions             │  │
│  │  ─────────────────   │      │  ─────────────────     │  │
│  │  - Search Algorithm  │      │  - Webhooks            │  │
│  │  - ML Matching       │      │  - Event Triggers      │  │
│  │  - Data Processing   │      │  - Notifications       │  │
│  │  - Analytics         │      └────────────────────────┘  │
│  └──────────────────────┘                                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ PostgreSQL Protocol
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                         Data Layer                           │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Supabase PostgreSQL                      │  │
│  │  ┌──────────┬──────────┬──────────┬──────────────┐  │  │
│  │  │  Auth    │  Users   │Campaigns │ Influencers  │  │  │
│  │  │  Tables  │  Profiles│  Data    │  Database    │  │  │
│  │  └──────────┴──────────┴──────────┴──────────────┘  │  │
│  │  ┌──────────────────────────────────────────────┐  │  │
│  │  │         Row-Level Security (RLS)             │  │  │
│  │  └──────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Supabase Storage                         │  │
│  │  - User avatars                                       │  │
│  │  - Influencer profile images                          │  │
│  │  - Campaign assets                                    │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

### Frontend
- **Framework**: SvelteKit 2.0
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **State Management**: Svelte 5 Runes ($state, $derived)
- **Client Library**: @supabase/ssr

### Backend (Python Server)
- **Framework**: FastAPI
- **Language**: Python 3.11+
- **Database Client**: Supabase Python SDK
- **ML/Search**: scikit-learn, numpy, pandas
- **API Documentation**: OpenAPI/Swagger (auto-generated)
- **CORS**: FastAPI CORS middleware

### Database & Auth
- **Database**: Supabase PostgreSQL
- **Authentication**: Supabase Auth (email/password, OAuth)
- **Storage**: Supabase Storage (S3-compatible)
- **Real-time**: Supabase Realtime (PostgreSQL CDC)

### Billing
- **Provider**: Stripe Checkout & Billing Portal
- **Trial configuration**: `STRIPE_TRIAL_DAYS` environment variable (default 7 days)
- **Plan mapping**: Plan tier ↔︎ price IDs via `STRIPE_PRICE_*` environment variables

---

## Database Schema

### Core Tables

#### `users` (extends auth.users)
```sql
-- Managed by Supabase Auth
id: uuid (PK)
email: text
encrypted_password: text
email_confirmed_at: timestamp
created_at: timestamp
updated_at: timestamp
```

#### `profiles`
```sql
id: uuid (PK, FK -> auth.users)
full_name: text
company_name: text
avatar_url: text
subscription_tier: enum('free', 'starter', 'pro', 'enterprise')
subscription_status: enum('active', 'canceled', 'past_due')
trial_ends_at: timestamp
created_at: timestamp
updated_at: timestamp
```

#### `campaigns`
```sql
id: uuid (PK)
user_id: uuid (FK -> profiles.id)
name: text
status: enum('draft', 'active', 'paused', 'completed')
website_url: text
target_profile: text
follower_range_min: integer
follower_range_max: integer
target_locations: text[]
target_categories: text[]
budget: decimal
created_at: timestamp
updated_at: timestamp
```

#### `influencers`
```sql
id: uuid (PK)
external_id: text (unique - from social platforms)
name: text
username: text
platform: text
profile_url: text
avatar_url: text
followers_count: integer
engagement_rate: decimal
categories: text[]
location: text
bio: text
verified: boolean
last_synced_at: timestamp
created_at: timestamp
updated_at: timestamp
```

#### `campaign_influencers`
```sql
id: uuid (PK)
campaign_id: uuid (FK -> campaigns.id)
influencer_id: uuid (FK -> influencers.id)
status: enum('pending', 'invited', 'accepted', 'rejected', 'completed')
invitation_message: text
invitation_sent_at: timestamp
response_at: timestamp
created_at: timestamp
updated_at: timestamp
```

#### `invitations`
```sql
id: uuid (PK)
campaign_id: uuid (FK -> campaigns.id)
influencer_id: uuid (FK -> influencers.id)
user_id: uuid (FK -> profiles.id)
message: text
status: enum('sent', 'opened', 'replied', 'accepted', 'declined')
sent_at: timestamp
opened_at: timestamp
replied_at: timestamp
created_at: timestamp
```

#### `chat_messages`
```sql
id: uuid (PK)
campaign_id: uuid (FK -> campaigns.id)
user_id: uuid (FK -> profiles.id)
role: enum('user', 'assistant')
content: text
metadata: jsonb
created_at: timestamp
```

### Indexes
```sql
CREATE INDEX idx_campaigns_user_id ON campaigns(user_id);
CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_influencers_platform ON influencers(platform);
CREATE INDEX idx_influencers_followers ON influencers(followers_count);
CREATE INDEX idx_influencers_categories ON influencers USING GIN(categories);
CREATE INDEX idx_campaign_influencers_campaign ON campaign_influencers(campaign_id);
CREATE INDEX idx_campaign_influencers_status ON campaign_influencers(status);
```

---

## API Architecture

### Frontend → Supabase (Direct)
**Authentication & User Data**
```typescript
// supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'

export const supabase = createBrowserClient(
  PUBLIC_SUPABASE_URL,
  PUBLIC_SUPABASE_ANON_KEY
)

// Auth operations
await supabase.auth.signUp({ email, password })
await supabase.auth.signInWithPassword({ email, password })
await supabase.auth.signOut()

// Direct database queries (with RLS)
const { data } = await supabase
  .from('campaigns')
  .select('*')
  .eq('user_id', user.id)
```

### Frontend → Python Server
**Search & ML Operations**
```typescript
// API endpoints
POST   /api/search/influencers
GET    /api/search/influencers/:id
POST   /api/campaigns/:id/match
GET    /api/analytics/campaign/:id
POST   /api/chat/generate
```

### Python Server → Supabase
**Database Access with Service Role**
```python
# server/supabase_client.py
from supabase import create_client

supabase = create_client(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY  # Server-side only
)

# Query influencers
influencers = supabase.table('influencers')\
    .select('*')\
    .gte('followers_count', min_followers)\
    .lte('followers_count', max_followers)\
    .execute()
```

---

## Python Server Structure

```
server/
├── main.py                 # FastAPI app entry point
├── requirements.txt        # Python dependencies
├── .env                    # Environment variables
├── config/
│   └── settings.py        # Configuration management
├── api/
│   ├── __init__.py
│   ├── routes/
│   │   ├── search.py      # Influencer search endpoints
│   │   ├── campaigns.py   # Campaign matching
│   │   ├── analytics.py   # Analytics endpoints
│   │   └── chat.py        # AI chat endpoints
│   └── dependencies.py    # Shared dependencies
├── core/
│   ├── __init__.py
│   ├── search_engine.py   # Search algorithm core
│   ├── matching.py        # ML matching algorithm
│   └── scoring.py         # Influencer scoring
├── models/
│   ├── __init__.py
│   ├── schemas.py         # Pydantic models
│   └── database.py        # Database models
├── services/
│   ├── __init__.py
│   ├── supabase.py        # Supabase client
│   ├── cache.py           # Redis/in-memory cache
│   └── ai.py              # AI/ML services
└── utils/
    ├── __init__.py
    └── helpers.py         # Utility functions
```

### Key Python Dependencies
```txt
fastapi==0.109.0
uvicorn[standard]==0.27.0
supabase==2.3.0
python-dotenv==1.0.0
pydantic==2.5.0
pydantic-settings==2.1.0
scikit-learn==1.4.0
numpy==1.26.0
pandas==2.2.0
redis==5.0.0
python-multipart==0.0.6
```

---

## Search Algorithm Design

### Influencer Matching Algorithm

```python
# core/search_engine.py
class InfluencerSearchEngine:
    def search(self, criteria: SearchCriteria) -> List[Influencer]:
        """
        Multi-factor search algorithm:
        1. Filter by hard constraints (followers, location, platform)
        2. Score by soft criteria (engagement, categories, relevance)
        3. Rank by composite score
        4. Return top N results
        """

        # Step 1: Filter
        candidates = self._filter_candidates(criteria)

        # Step 2: Score
        scored = self._score_influencers(candidates, criteria)

        # Step 3: Rank
        ranked = self._rank_by_score(scored)

        # Step 4: Return
        return ranked[:criteria.limit]

    def _calculate_score(self, influencer, criteria) -> float:
        """
        Composite scoring:
        - Engagement rate weight: 0.35
        - Category match weight: 0.25
        - Follower count fit: 0.20
        - Location match: 0.10
        - Platform relevance: 0.10
        """
        engagement_score = self._score_engagement(influencer)
        category_score = self._score_categories(influencer, criteria)
        follower_score = self._score_followers(influencer, criteria)
        location_score = self._score_location(influencer, criteria)
        platform_score = self._score_platform(influencer, criteria)

        return (
            engagement_score * 0.35 +
            category_score * 0.25 +
            follower_score * 0.20 +
            location_score * 0.10 +
            platform_score * 0.10
        )
```

---

## Authentication Flow

### Sign Up
```
1. User enters email/password in frontend
2. SvelteKit → Supabase Auth API
3. Supabase creates auth.users record
4. Trigger creates profiles record (via database trigger)
5. Confirmation email sent
6. User redirects to /campaign
```

### Sign In
```
1. User enters credentials
2. SvelteKit → Supabase Auth API
3. Supabase validates and returns session
4. Session stored in cookies (SSR-safe)
5. User redirects to /campaign
```

### Session Management
```typescript
// hooks.server.ts
export const handle = async ({ event, resolve }) => {
  event.locals.supabase = createServerClient(...)
  event.locals.getSession = async () => {
    const { data: { session } } = await event.locals.supabase.auth.getSession()
    return session
  }
  return resolve(event)
}
```

---

## Data Flow Examples

### Campaign Creation Flow
```
1. User interacts with chatbot (SvelteKit)
2. Messages stored in chat_messages table
3. On completion, SvelteKit creates campaign record
4. Frontend calls Python server: POST /api/campaigns/:id/match
5. Python server queries Supabase for influencers
6. Search algorithm processes and ranks influencers
7. Results cached and returned to frontend
8. Frontend displays results in table
```

### Influencer Search Flow
```
1. User enters search criteria (frontend)
2. Frontend calls: POST /api/search/influencers
3. Python server receives request
4. Query Supabase influencers table with filters
5. Apply ML scoring algorithm
6. Rank and paginate results
7. Return JSON to frontend
8. Frontend renders influencer cards
```

### Invitation Flow
```
1. User clicks "Invite" button
2. Modal opens, user enters message
3. Frontend creates invitation record (Supabase)
4. Supabase Edge Function triggers email notification
5. Status updated to 'sent'
6. Real-time subscription updates UI
```

---

## Security Architecture

### Row-Level Security (RLS)

```sql
-- Users can only see their own profile
CREATE POLICY "Users can view own profile"
ON profiles FOR SELECT
USING (auth.uid() = id);

-- Users can only see their own campaigns
CREATE POLICY "Users can view own campaigns"
ON campaigns FOR SELECT
USING (auth.uid() = user_id);

-- Users can only create campaigns for themselves
CREATE POLICY "Users can create own campaigns"
ON campaigns FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- All authenticated users can view influencers
CREATE POLICY "Authenticated users can view influencers"
ON influencers FOR SELECT
TO authenticated
USING (true);

-- Users can only see invitations for their campaigns
CREATE POLICY "Users can view own campaign invitations"
ON invitations FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM campaigns
    WHERE campaigns.id = campaign_id
    AND campaigns.user_id = auth.uid()
  )
);
```

### API Security

**Python Server**
```python
# Verify Supabase JWT tokens
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer

security = HTTPBearer()

async def verify_token(credentials = Depends(security)):
    token = credentials.credentials
    # Verify JWT with Supabase public key
    user = await verify_supabase_token(token)
    if not user:
        raise HTTPException(status_code=401)
    return user
```

### Environment Variables

```env
# .env (Frontend)
PUBLIC_SUPABASE_URL=https://xxx.supabase.co
PUBLIC_SUPABASE_ANON_KEY=eyJ...
PYTHON_API_URL=http://localhost:8000

# .env (Python Server)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # Never expose to frontend!
SUPABASE_JWT_SECRET=your-jwt-secret
REDIS_URL=redis://localhost:6379
ENVIRONMENT=development
```

---

## Deployment Architecture

### Development
```
Frontend:  localhost:5173 (Vite dev server)
Python:    localhost:8000 (uvicorn)
Supabase:  cloud.supabase.com
```

### Production
```
Frontend:  Vercel/Netlify (SvelteKit SSR)
Python:    Railway/Render/Fly.io (Docker container)
Supabase:  Supabase Cloud (managed)
```

### Docker Compose (Local)
```yaml
version: '3.8'
services:
  frontend:
    build: .
    ports:
      - "5173:5173"
    environment:
      - PUBLIC_SUPABASE_URL=${PUBLIC_SUPABASE_URL}
      - PUBLIC_SUPABASE_ANON_KEY=${PUBLIC_SUPABASE_ANON_KEY}

  python-api:
    build: ./server
    ports:
      - "8000:8000"
    environment:
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
    depends_on:
      - redis

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
```

---

## Performance Optimization

### Caching Strategy
```python
# Redis cache for search results
from redis import Redis
import json

cache = Redis.from_url(REDIS_URL)

def search_influencers(criteria):
    cache_key = f"search:{hash(criteria)}"

    # Check cache
    cached = cache.get(cache_key)
    if cached:
        return json.loads(cached)

    # Compute results
    results = search_engine.search(criteria)

    # Cache for 5 minutes
    cache.setex(cache_key, 300, json.dumps(results))

    return results
```

### Database Optimization
- Use Supabase connection pooling
- Implement database indexes on frequently queried columns
- Use materialized views for analytics
- Enable Supabase PostgREST query optimization

### API Optimization
- Implement request rate limiting
- Use pagination for large result sets
- Compress API responses (gzip)
- Implement API response caching

---

## Monitoring & Analytics

### Application Monitoring
- Python: FastAPI built-in /metrics endpoint
- Frontend: Vercel Analytics
- Database: Supabase Dashboard metrics
- Logs: Structured logging with Python logging module

### Error Tracking
- Sentry integration for both frontend and backend
- Supabase error logs for database issues
- Custom error reporting for search algorithm failures

---

## Future Enhancements

1. **Real-time Notifications**: WebSocket connections for instant updates
2. **AI Chatbot**: OpenAI integration for smarter campaign assistance
3. **Email Automation**: SendGrid/Resend integration for bulk invitations
4. **Analytics Dashboard**: Advanced campaign performance metrics
5. **Social Media Integration**: Direct API connections to Instagram, TikTok, etc.
6. **Payment Processing**: Stripe integration for subscription management
7. **Mobile App**: React Native or Flutter mobile application

---

## Getting Started

### 1. Setup Supabase Project
```bash
# Create project at supabase.com
# Copy API keys and URL
# Run migrations (see migrations/ folder)
```

### 2. Setup Python Server
```bash
cd server
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env  # Configure environment variables
uvicorn main:app --reload
```

### 3. Setup Frontend
```bash
npm install
cp .env.example .env  # Configure environment variables
npm run dev
```

### 4. Access Application
```
Frontend: http://localhost:5173
API Docs: http://localhost:8000/docs
Supabase: https://app.supabase.com
```
