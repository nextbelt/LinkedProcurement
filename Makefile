# ══════════════════════════════════════════════════════════════════════════════
# LinkedProcurement — Project Makefile
# ══════════════════════════════════════════════════════════════════════════════
#
# Usage:
#   make setup      — One-time project setup (install deps, create .env files)
#   make up         — Start all Docker services (Postgres, Redis, ES, backend, frontend)
#   make down       — Stop all services
#   make dev        — Start backend + frontend locally (no Docker)
#   make dev-back   — Start backend only (uvicorn with hot reload)
#   make dev-front  — Start frontend only (Next.js dev server)
#   make test       — Run all tests (backend)
#   make lint       — Run linters (black, flake8, mypy)
#   make format     — Auto-format code with black
#   make migrate    — Run Alembic migrations (head)
#   make migration  — Create a new Alembic migration (NAME=description)
#   make clean      — Remove all build artifacts, caches, volumes
#   make logs       — Tail Docker logs
#   make shell-back — Open a shell in the backend container
#   make db-shell   — Open psql in the Postgres container
#   make seed       — Seed the database with sample data
#   make status     — Show Docker container status
#
# ══════════════════════════════════════════════════════════════════════════════

.PHONY: help setup up down dev dev-back dev-front test lint format migrate migration \
        clean logs shell-back db-shell seed status build push deploy \
        test-cov test-watch reset-db

# Default target
.DEFAULT_GOAL := help

# ── Variables ────────────────────────────────────────────────────────────────

DOCKER_COMPOSE   := docker compose
BACKEND_DIR      := backend
FRONTEND_DIR     := frontend
PYTHON           := python
PIP              := pip
ALEMBIC          := alembic
UVICORN          := uvicorn
NPM              := npm

# Colors for output
CYAN   := \033[36m
GREEN  := \033[32m
YELLOW := \033[33m
RED    := \033[31m
RESET  := \033[0m
BOLD   := \033[1m

# ── Help ─────────────────────────────────────────────────────────────────────

help: ## Show this help message
	@echo ""
	@echo "$(BOLD)$(CYAN)LinkedProcurement$(RESET) — Development Commands"
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-15s$(RESET) %s\n", $$1, $$2}'
	@echo ""

# ── Setup ────────────────────────────────────────────────────────────────────

setup: ## One-time project setup (install deps, create .env files, install hooks)
	@echo "$(CYAN)━━━ Setting up LinkedProcurement ━━━$(RESET)"
	@echo ""
	@# Backend setup
	@echo "$(GREEN)▸ Installing backend dependencies...$(RESET)"
	cd $(BACKEND_DIR) && $(PIP) install -r requirements.txt
	@echo ""
	@# Frontend setup
	@echo "$(GREEN)▸ Installing frontend dependencies...$(RESET)"
	cd $(FRONTEND_DIR) && $(NPM) install
	@echo ""
	@# Create .env files if they don't exist
	@echo "$(GREEN)▸ Checking environment files...$(RESET)"
	@if [ ! -f $(BACKEND_DIR)/.env ]; then \
		cp $(BACKEND_DIR)/.env.example $(BACKEND_DIR)/.env 2>/dev/null || \
		echo "$(YELLOW)⚠  Create $(BACKEND_DIR)/.env from .env.example$(RESET)"; \
	else \
		echo "  $(BACKEND_DIR)/.env already exists"; \
	fi
	@if [ ! -f $(FRONTEND_DIR)/.env.local ]; then \
		echo "NEXT_PUBLIC_API_URL=http://localhost:8100" > $(FRONTEND_DIR)/.env.local; \
		echo "NEXT_PUBLIC_SUPABASE_URL=" >> $(FRONTEND_DIR)/.env.local; \
		echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=" >> $(FRONTEND_DIR)/.env.local; \
		echo "  Created $(FRONTEND_DIR)/.env.local"; \
	else \
		echo "  $(FRONTEND_DIR)/.env.local already exists"; \
	fi
	@echo ""
	@echo "$(GREEN)✔ Setup complete!$(RESET)"
	@echo "  Run $(BOLD)make up$(RESET) to start Docker services"
	@echo "  Run $(BOLD)make dev$(RESET) to start local development servers"

# ── Docker Commands ──────────────────────────────────────────────────────────

up: ## Start all Docker services (Postgres, Redis, ES, backend, frontend)
	@echo "$(CYAN)▸ Starting all services...$(RESET)"
	$(DOCKER_COMPOSE) up -d
	@echo ""
	@echo "$(GREEN)✔ Services started!$(RESET)"
	@echo "  Backend:       http://localhost:8100"
	@echo "  Frontend:      http://localhost:3100"
	@echo "  API Docs:      http://localhost:8100/docs"
	@echo "  Postgres:      localhost:5433"
	@echo "  Redis:         localhost:6380"
	@echo "  Elasticsearch: localhost:9201"

down: ## Stop all Docker services
	@echo "$(YELLOW)▸ Stopping all services...$(RESET)"
	$(DOCKER_COMPOSE) down
	@echo "$(GREEN)✔ All services stopped$(RESET)"

restart: ## Restart all Docker services
	@echo "$(CYAN)▸ Restarting all services...$(RESET)"
	$(DOCKER_COMPOSE) restart

build: ## Build Docker images (use after Dockerfile changes)
	@echo "$(CYAN)▸ Building Docker images...$(RESET)"
	$(DOCKER_COMPOSE) build --no-cache

status: ## Show Docker container status
	@echo "$(CYAN)━━━ Container Status ━━━$(RESET)"
	$(DOCKER_COMPOSE) ps

logs: ## Tail Docker logs (all services)
	$(DOCKER_COMPOSE) logs -f --tail=100

logs-back: ## Tail backend logs only
	$(DOCKER_COMPOSE) logs -f --tail=100 backend

logs-front: ## Tail frontend logs only
	$(DOCKER_COMPOSE) logs -f --tail=100 frontend

# ── Local Development ────────────────────────────────────────────────────────

dev: ## Start backend + frontend locally (with hot reload)
	@echo "$(CYAN)▸ Starting local development servers...$(RESET)"
	@echo "  Starting infrastructure (Postgres, Redis, ES)..."
	$(DOCKER_COMPOSE) up -d postgres redis elasticsearch
	@echo ""
	@echo "$(GREEN)▸ Start these in separate terminals:$(RESET)"
	@echo "  $(BOLD)make dev-back$(RESET)    → http://localhost:8000"
	@echo "  $(BOLD)make dev-front$(RESET)   → http://localhost:3000"

dev-back: ## Start backend (uvicorn with hot reload)
	cd $(BACKEND_DIR) && $(UVICORN) app.main:app --reload --host 0.0.0.0 --port 8000

dev-front: ## Start frontend (Next.js dev server)
	cd $(FRONTEND_DIR) && $(NPM) run dev

# ── Database ─────────────────────────────────────────────────────────────────

migrate: ## Run all pending Alembic migrations
	@echo "$(CYAN)▸ Running database migrations...$(RESET)"
	cd $(BACKEND_DIR) && $(ALEMBIC) upgrade head
	@echo "$(GREEN)✔ Migrations complete$(RESET)"

migration: ## Create a new Alembic migration (usage: make migration NAME="add_users_table")
	@if [ -z "$(NAME)" ]; then \
		echo "$(RED)✖ Error: NAME is required$(RESET)"; \
		echo "  Usage: make migration NAME=\"add_users_table\""; \
		exit 1; \
	fi
	@echo "$(CYAN)▸ Creating migration: $(NAME)$(RESET)"
	cd $(BACKEND_DIR) && $(ALEMBIC) revision --autogenerate -m "$(NAME)"
	@echo "$(GREEN)✔ Migration created$(RESET)"

migrate-down: ## Rollback the last migration
	@echo "$(YELLOW)▸ Rolling back last migration...$(RESET)"
	cd $(BACKEND_DIR) && $(ALEMBIC) downgrade -1
	@echo "$(GREEN)✔ Rollback complete$(RESET)"

migrate-history: ## Show migration history
	cd $(BACKEND_DIR) && $(ALEMBIC) history --verbose

reset-db: ## Drop and recreate the database (DESTRUCTIVE!)
	@echo "$(RED)⚠  WARNING: This will destroy all data!$(RESET)"
	@echo "  Press Ctrl+C to cancel, or Enter to continue..."
	@read confirm
	$(DOCKER_COMPOSE) down -v
	$(DOCKER_COMPOSE) up -d postgres
	@sleep 5
	cd $(BACKEND_DIR) && $(ALEMBIC) upgrade head
	@echo "$(GREEN)✔ Database reset complete$(RESET)"

db-shell: ## Open psql shell in the Postgres container
	$(DOCKER_COMPOSE) exec postgres psql -U sscn_user -d sscn_db

shell-back: ## Open a shell in the backend container
	$(DOCKER_COMPOSE) exec backend /bin/bash

# ── Testing ──────────────────────────────────────────────────────────────────

test: ## Run all backend tests
	@echo "$(CYAN)▸ Running tests...$(RESET)"
	cd $(BACKEND_DIR) && $(PYTHON) -m pytest tests/ -v --tb=short
	@echo "$(GREEN)✔ Tests complete$(RESET)"

test-cov: ## Run tests with coverage report
	@echo "$(CYAN)▸ Running tests with coverage...$(RESET)"
	cd $(BACKEND_DIR) && $(PYTHON) -m pytest tests/ -v --tb=short \
		--cov=app --cov-report=term-missing --cov-report=html:htmlcov
	@echo "$(GREEN)✔ Coverage report: backend/htmlcov/index.html$(RESET)"

test-watch: ## Run tests in watch mode (reruns on file change)
	cd $(BACKEND_DIR) && $(PYTHON) -m pytest tests/ -v --tb=short -f

test-front: ## Run frontend tests
	cd $(FRONTEND_DIR) && $(NPM) test

# ── Linting & Formatting ────────────────────────────────────────────────────

lint: ## Run all linters (black check, flake8, mypy)
	@echo "$(CYAN)▸ Running linters...$(RESET)"
	@echo "$(GREEN)  ▸ black (check)$(RESET)"
	cd $(BACKEND_DIR) && $(PYTHON) -m black --check --diff app/ tests/
	@echo "$(GREEN)  ▸ flake8$(RESET)"
	cd $(BACKEND_DIR) && $(PYTHON) -m flake8 app/ tests/ --max-line-length=120 --exclude=__pycache__,alembic
	@echo "$(GREEN)  ▸ mypy$(RESET)"
	cd $(BACKEND_DIR) && $(PYTHON) -m mypy app/ --ignore-missing-imports --no-error-summary
	@echo "$(GREEN)✔ Linting complete$(RESET)"

format: ## Auto-format code with black + isort
	@echo "$(CYAN)▸ Formatting code...$(RESET)"
	cd $(BACKEND_DIR) && $(PYTHON) -m black app/ tests/
	@echo "$(GREEN)✔ Formatting complete$(RESET)"

lint-front: ## Run frontend linter (ESLint)
	cd $(FRONTEND_DIR) && $(NPM) run lint

# ── Seed Data ────────────────────────────────────────────────────────────────

seed: ## Seed the database with sample data
	@echo "$(CYAN)▸ Seeding database...$(RESET)"
	cd $(BACKEND_DIR) && $(PYTHON) -c "from scripts.seed import run; run()" 2>/dev/null || \
		echo "$(YELLOW)⚠  No seed script found. Create backend/scripts/seed.py$(RESET)"

# ── Cleanup ──────────────────────────────────────────────────────────────────

clean: ## Remove all build artifacts, caches, Docker volumes
	@echo "$(RED)▸ Cleaning project...$(RESET)"
	@# Docker
	$(DOCKER_COMPOSE) down -v --remove-orphans 2>/dev/null || true
	@# Python caches
	find $(BACKEND_DIR) -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find $(BACKEND_DIR) -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
	find $(BACKEND_DIR) -type d -name "htmlcov" -exec rm -rf {} + 2>/dev/null || true
	find $(BACKEND_DIR) -name "*.pyc" -delete 2>/dev/null || true
	find $(BACKEND_DIR) -name ".coverage" -delete 2>/dev/null || true
	@# Frontend caches
	rm -rf $(FRONTEND_DIR)/.next 2>/dev/null || true
	rm -rf $(FRONTEND_DIR)/node_modules/.cache 2>/dev/null || true
	@echo "$(GREEN)✔ Cleaned$(RESET)"

clean-all: clean ## Clean everything including node_modules
	rm -rf $(FRONTEND_DIR)/node_modules 2>/dev/null || true
	@echo "$(GREEN)✔ Deep clean complete (run 'make setup' to reinstall)$(RESET)"

# ── Deployment ───────────────────────────────────────────────────────────────

deploy-check: ## Pre-deployment checks
	@echo "$(CYAN)━━━ Pre-Deployment Checklist ━━━$(RESET)"
	@echo "  ▸ Running tests..."
	@cd $(BACKEND_DIR) && $(PYTHON) -m pytest tests/ -q --tb=line && \
		echo "  $(GREEN)✔ Tests pass$(RESET)" || \
		echo "  $(RED)✖ Tests failing$(RESET)"
	@echo "  ▸ Checking formatting..."
	@cd $(BACKEND_DIR) && $(PYTHON) -m black --check app/ 2>/dev/null && \
		echo "  $(GREEN)✔ Code formatted$(RESET)" || \
		echo "  $(YELLOW)⚠  Code needs formatting$(RESET)"
	@echo "  ▸ Checking for .env files..."
	@test -f $(BACKEND_DIR)/.env && \
		echo "  $(GREEN)✔ Backend .env exists$(RESET)" || \
		echo "  $(RED)✖ Backend .env missing$(RESET)"
	@echo ""
