# LinkedProcurement

![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Python](https://img.shields.io/badge/Python_3.11-3776AB?style=for-the-badge&logo=python&logoColor=white)
![Railway](https://img.shields.io/badge/Railway-0B0D0E?style=for-the-badge&logo=railway&logoColor=white)

> **B2B Supply Chain Sourcing Platform** — LinkedIn-verified POCs, real-time RFQ management, and AI-powered supplier matching.

---

## ✨ Features

- **LinkedIn Verified POCs** — Every point of contact is verified through LinkedIn OAuth 2.0
- **Real-time RFQ Management** — Create, manage, and respond to RFQs with live updates
- **AI-Powered Matching** — Smart supplier recommendations based on capabilities and history
- **Advanced Search** — Elasticsearch-powered search with faceted filtering
- **Real-time Messaging** — WebSocket-based communication between buyers and suppliers
- **Document Management** — Secure file uploads with AWS S3 integration
- **Analytics Dashboard** — Performance metrics and business intelligence
- **Multi-Factor Authentication** — TOTP-based MFA for enhanced security
- **Organization & RBAC** — Multi-tenant organizations with role-based access control
- **SOC 2 Compliant** — Built with enterprise-grade security practices

## 🏗️ Architecture

| Layer          | Technology                        |
|----------------|-----------------------------------|
| **Backend**    | FastAPI · Python 3.11 · SQLAlchemy |
| **Frontend**   | Next.js 14 · TypeScript · TailwindCSS |
| **Database**   | PostgreSQL 15 (Supabase)          |
| **Auth**       | JWT + LinkedIn OAuth 2.0 + MFA    |
| **Search**     | Elasticsearch 8.x                 |
| **Cache**      | Redis 7                           |
| **Real-time**  | Pusher WebSockets                 |
| **Email**      | SendGrid                          |
| **Storage**    | AWS S3                            |
| **Payments**   | Stripe                            |
| **Monitoring** | Sentry                            |
| **CI/CD**      | GitHub Actions + Railway           |

## 🚀 Quick Start

### Option 1: Docker Compose (Fastest)

```bash
git clone <repo-url>
cd "Sourcing Supply Chain Net"

# Copy environment files
cp backend/.env.example backend/.env
cp frontend/.env.local.example frontend/.env.local

# Start all services
docker-compose up -d
```

Services will be available at:
- **Frontend**: http://localhost:3100
- **Backend API**: http://localhost:8100
- **API Docs**: http://localhost:8100/docs

### Option 2: Local Development (Recommended for Development)

```bash
# One-time setup
start-local-dev.bat

# Start both servers
run-local.bat
```

Or manually:

```bash
# Terminal 1 — Backend
cd backend
python -m venv venv && venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Terminal 2 — Frontend
cd frontend
npm install
npm run dev
```

- **Backend**: http://localhost:8000 (API docs at `/docs`)
- **Frontend**: http://localhost:3000

## 📁 Project Structure

```
├── .github/workflows/      # CI/CD pipelines (GitHub Actions)
│   ├── ci.yml               # Lint, test, build, security scan
│   └── deploy.yml            # Deployment notifications
├── backend/
│   ├── app/
│   │   ├── api/              # Route handlers (auth, rfq, billing, etc.)
│   │   ├── core/             # Config, database, security, encryption
│   │   ├── middleware/       # RBAC, security headers
│   │   ├── models/           # SQLAlchemy models
│   │   ├── schemas/          # Pydantic schemas
│   │   └── services/         # Business logic (email, search, etc.)
│   ├── alembic/              # Database migrations
│   ├── tests/                # Pytest test suite
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/       # React components
│   │   ├── pages/            # Next.js pages
│   │   ├── lib/              # Utilities and helpers
│   │   └── types/            # TypeScript types
│   ├── Dockerfile
│   └── package.json
├── docs/                     # SOC 2, deployment, security docs
├── docker-compose.yml        # Local dev with all services
└── supabase/schema.sql       # Database schema
```

## 📖 API Documentation

Interactive API docs are available at `/docs` (Swagger UI) or `/redoc` when the backend is running.

### Key Endpoints

| Category       | Endpoint                        | Description                   |
|----------------|---------------------------------|-------------------------------|
| **Auth**       | `GET /api/auth/linkedin`        | Initiate LinkedIn OAuth       |
|                | `POST /api/auth/linkedin/callback` | Handle OAuth callback      |
|                | `POST /api/auth/refresh`        | Refresh access token          |
| **RFQs**       | `POST /api/rfqs`                | Create RFQ                    |
|                | `GET /api/rfqs`                 | List RFQs with filtering      |
|                | `POST /api/rfqs/{id}/responses` | Submit response               |
| **Companies**  | `POST /api/companies`           | Create company                |
|                | `GET /api/search/suppliers`     | Search suppliers              |
| **Billing**    | `POST /api/billing/subscribe`   | Create subscription           |
| **Health**     | `GET /health`                   | Service health check          |

## 🔧 Environment Variables

### Backend (`backend/.env`)

```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/sscn_db

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key

# Authentication
JWT_SECRET_KEY=your-jwt-secret
LINKEDIN_CLIENT_ID=your-linkedin-client-id
LINKEDIN_CLIENT_SECRET=your-linkedin-client-secret

# Services
REDIS_URL=redis://localhost:6379/0
ELASTICSEARCH_URL=http://localhost:9200
SENDGRID_API_KEY=SG.your-key
STRIPE_SECRET_KEY=sk_your-key
SENTRY_DSN=https://your-sentry-dsn

# Storage
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
S3_BUCKET_NAME=sscn-documents
```

### Frontend (`frontend/.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_your-key
NEXT_PUBLIC_PUSHER_KEY=your-pusher-key
NEXT_PUBLIC_PUSHER_CLUSTER=us2
```

## 🧪 Testing

```bash
# Backend tests
cd backend
pytest tests/ -v --cov=app --cov-report=term-missing

# Frontend type check
cd frontend
npx tsc --noEmit

# Frontend build verification
npm run build
```

CI runs automatically on push to `main`/`develop` and on pull requests — see [.github/workflows/ci.yml](.github/workflows/ci.yml).

## 🚢 Deployment

**Production** is deployed on **Railway** with auto-deploy from the `main` branch.

- Backend and Frontend are separate Railway services
- PostgreSQL is hosted on Supabase
- See [docs/RAILWAY_DEPLOYMENT.md](docs/RAILWAY_DEPLOYMENT.md) for details

## 🔐 Security

- JWT authentication with refresh tokens
- LinkedIn OAuth 2.0 integration
- TOTP-based Multi-Factor Authentication
- Role-based access control (RBAC)
- Rate limiting (60 req/min)
- Input sanitization & CORS protection
- SOC 2 Type II compliance — see [docs/SOC2_COMPLIANCE_GUIDE.md](docs/SOC2_COMPLIANCE_GUIDE.md)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

CI checks (lint, type check, tests, security scan, Docker build) must pass before merge.

## 📝 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

**LinkedProcurement** — Built with ❤️ for the global supply chain community

🌐 [linkedprocurement.com](https://linkedprocurement.com)