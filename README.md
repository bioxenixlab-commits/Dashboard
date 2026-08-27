# Bio-Xenix Lab

A modern, full-stack student management dashboard for educational institutions. Built with Django REST Framework (backend) and React + TypeScript (frontend).

## 🏗️ Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│   Backend       │────▶│   Database      │
│   (React/TS)    │     │   (Django/DRF)  │     │   (PostgreSQL)  │
│   Vercel        │     │   Railway       │     │   Neon          │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## ✨ Features

### Teacher Dashboard
- **Students Management** - Add/edit/delete students with auto-generated IDs (YYNNN format), batch assignment, password reset
- **Batches** - Create batches per class, delete with student re-assignment
- **Payments** - 12-month tracking from custom start month/year, bulk updates, SMS notifications (pseudo)
- **Exams** - Create exams per class/batch, enter marks with auto-calc %, rankings, publish results
- **Notices** - Class/batch targeted notices with priority levels and expiry dates
- **Homework** - Assign homework with due dates, track submissions, grade with feedback
- **Attendance** - Daily attendance with 4 statuses (Present/Absent/Late/Excused), auto-save on checkbox change, calendar view

### Student Portal
- **Dashboard** - Stats cards (exams taken, overall %, unpaid months, best rank) + recent performance
- **Performance** - Complete exam history with marks, percentages, ranks
- **Payments** - Monthly payment status with year selector
- **Notices** - Relevant notices for student's class/batch
- **Homework** - Assigned homework with submission status
- **Exams** - Upcoming & past exams with results
- **Attendance** - Calendar grid view + yearly stats + detailed list

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Backend** | Django 4.2, DRF, SimpleJWT, PostgreSQL |
| **Frontend** | React 18, TypeScript, Vite, TanStack Query |
| **UI** | Tailwind CSS, shadcn/ui components, Lucide icons |
| **Auth** | JWT (access/refresh tokens with auto-refresh) |
| **Database** | PostgreSQL (Neon for production) |
| **Deployment** | Vercel (FE), Railway (BE), Neon (DB) |
| **Local Dev** | Docker Compose |

## 🚀 Quick Start (Local Development)

### Prerequisites
- Docker & Docker Compose
- Node.js 20+ (for frontend dev without Docker)
- Python 3.12+ (for backend dev without Docker)

### Option 1: Docker Compose (Recommended)

```bash
cd bio-xenix-lab

# Start all services
docker-compose up --build

# Access:
# Frontend: http://localhost:5173
# Backend API: http://localhost:8000/api
# API Docs: http://localhost:8000/api/docs/
# Database: localhost:5432
```

### Option 2: Manual Setup

**Backend:**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env  # Edit with your Neon connection string
python manage.py migrate
python manage.py createsuperuser  # Create teacher account
python manage.py runserver
```

**Frontend:**
```bash
cd frontend
npm install
cp .env.example .env.local  # Edit VITE_API_URL if needed
npm run dev
```

### Default Login
- **Teacher:** Use the superuser created via `createsuperuser`
- **Student:** Use Student ID (e.g., `27001`) and auto-generated password from teacher

## 📁 Project Structure

```
bio-xenix-lab/
├── backend/
│   ├── config/                 # Django settings, URLs, WSGI/ASGI
│   ├── apps/
│   │   ├── accounts/           # Auth, JWT, permissions
│   │   ├── batches/            # Batch CRUD + reassign
│   │   ├── students/           # Student CRUD + search
│   │   ├── payments/           # Payment tracking + notify
│   │   ├── exams/              # Exams, results, rankings
│   │   ├── notices/            # Notice board
│   │   ├── homework/           # Homework + submissions
│   │   ├── attendance/         # Daily attendance + stats
│   │   └── core/               # Dashboard stats API
│   ├── requirements.txt
│   ├── Dockerfile
│   └── manage.py
├── frontend/
│   ├── src/
│   │   ├── app/                # Routes, Layout
│   │   ├── components/ui/      # Reusable UI components
│   │   ├── features/           # Feature-based modules
│   │   │   ├── auth/
│   │   │   ├── dashboard/
│   │   │   ├── students/
│   │   │   ├── batches/
│   │   │   ├── payments/
│   │   │   ├── exams/
│   │   │   ├── notices/
│   │   │   ├── homework/
│   │   │   └── attendance/
│   │   ├── hooks/              # Custom hooks (useAuth, useApi, useToast)
│   │   └── lib/                # API client, types, utils
│   ├── package.json, tsconfig, tailwind.config
│   ├── Dockerfile.dev / Dockerfile.prod
│   └── nginx.conf
├── docker-compose.yml          # Local development
├── docker-compose.prod.yml     # Production
├── .github/workflows/ci-cd.yml # CI/CD pipeline
└── README.md
```

## 🔐 Environment Variables

### Backend (.env)
```env
DJANGO_SECRET_KEY=your-secret-key
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
DATABASE_URL=postgresql://user:pass@host:5432/dbname
CORS_ALLOWED_ORIGINS=http://localhost:5173
CSRF_TRUSTED_ORIGINS=http://localhost:5173
JWT_ACCESS_LIFETIME=60m
JWT_REFRESH_LIFETIME=7d
```

### Frontend (.env.local)
```env
VITE_API_URL=http://localhost:8000/api
```

## 📡 API Endpoints

### Authentication
- `POST /api/auth/teacher/login/` - Teacher login
- `POST /api/auth/student/login/` - Student login
- `POST /api/auth/token/refresh/` - Refresh access token

### Teacher Endpoints (require IsTeacher permission)
- `GET/POST /api/students/` - List/Create students
- `GET/PATCH/DELETE /api/students/{id}/` - Student detail
- `POST /api/students/{id}/reset_password/` - Reset password
- `GET/POST /api/batches/` - List/Create batches
- `POST /api/batches/{id}/delete_with_reassign/` - Delete with reassign
- `GET/POST /api/payments/` - Payment management
- `GET/POST /api/exams/` - Exam management
- `GET/POST /api/notices/` - Notice board
- `GET/POST /api/homework/` - Homework management
- `GET/POST /api/attendance/` - Attendance tracking

### Student Endpoints (require IsStudentOwner permission)
- `GET /api/auth/student/stats/` - Dashboard stats
- `GET /api/auth/student/performance/` - Exam performance
- `GET /api/auth/student/payments/` - Payment history
- `GET /api/notices/student_notices/` - Relevant notices
- `GET /api/homework/student_homework/` - Assigned homework
- `GET /api/exams/student_exams/` - Upcoming & past exams
- `GET /api/attendance/student_calendar/` - Calendar view
- `GET /api/attendance/student_stats/` - Yearly stats

## 🎨 UI/UX Highlights

- **Responsive Sidebar** - Collapsible, mobile drawer navigation
- **Real-time Updates** - TanStack Query caching + auto-refetch
- **Optimistic UI** - Instant feedback on attendance checkbox, payment toggle
- **Smart Forms** - Batch dropdown filters by selected class
- **Global Search** - Debounced search across students/exams
- **Calendar View** - Month grid with color-coded attendance
- **Toast Notifications** - Success/error/info via sonner
- **Loading Skeletons** - Better perceived performance

## 🚢 Deployment

### Free Tier Deployment
| Service | Provider | Free Tier |
|---------|----------|-----------|
| Frontend | Vercel | 100GB bandwidth, unlimited projects |
| Backend | Railway | $5/month credit (~500h runtime) |
| Database | Neon | 0.5GB PostgreSQL, auto-suspend |

### Deploy Steps

1. **Push to GitHub** - CI/CD runs tests & builds Docker images
2. **Backend (Railway):**
   - Connect GitHub repo
   - Add PostgreSQL (Neon) connection string
   - Set environment variables
   - Deploy
3. **Frontend (Vercel):**
   - Import GitHub repo
   - Set `VITE_API_URL` to Railway backend URL
   - Deploy
4. **Configure CORS** - Add Vercel domain to backend `CORS_ALLOWED_ORIGINS`

### Production Environment Variables

**Railway (Backend):**
```env
DEBUG=False
DJANGO_SECRET_KEY=...
ALLOWED_HOSTS=yourdomain.railway.app,yourdomain.vercel.app
DATABASE_URL=postgresql://... (from Neon)
CORS_ALLOWED_ORIGINS=https://yourdomain.vercel.app
CSRF_TRUSTED_ORIGINS=https://yourdomain.vercel.app
```

**Vercel (Frontend):**
```env
VITE_API_URL=https://yourdomain.railway.app/api
```

## 🧪 Testing

```bash
# Backend
cd backend
python manage.py test

# Frontend
cd frontend
npm run lint
npx tsc --noEmit
npm run build
```

## 📝 License

MIT License - feel free to use for your institution!

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

---

Built with ❤️ for **Bio-Xenix Lab** - Bio-Xenix Lab