# Stage 1: Build React frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend/ .
RUN npm run build

# Stage 2: Python backend
FROM python:3.12-slim
WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./backend/
COPY ipl_2026_squads.xlsx .
COPY ipl_2026_fixtures.xlsx .

# Copy built React app into backend static folder
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

# Data directory for SQLite
RUN mkdir -p /data

ENV DATABASE_URL=sqlite:////data/ipl.db
ENV PYTHONPATH=/app/backend

EXPOSE 8000

WORKDIR /app/backend
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
