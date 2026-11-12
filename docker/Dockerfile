# Stage 1: build the React frontend into static files
FROM node:22-slim AS frontend

WORKDIR /app

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ .

# Empty API URL = same origin: the app calls /api/... on the host that served it.
# Set here because it overrides the localhost value in frontend/.env.
ENV VITE_API_URL=
RUN npm run build


# Stage 2: Laravel serving the API and the built frontend
FROM php:8.3-cli

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    unzip \
    libpq-dev \
    libzip-dev \
    libicu-dev \
    && docker-php-ext-install \
    pdo_pgsql \
    pgsql \
    bcmath \
    intl \
    zip \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# Set working directory
WORKDIR /var/www/html

# Copy Laravel backend
COPY backend/ .

# Install Laravel dependencies
RUN composer install --no-dev --optimize-autoloader --no-interaction

# Put the built frontend (index.html + assets/) into Laravel's public folder
COPY --from=frontend /app/dist/ ./public/

# Set permissions
RUN chmod -R 775 storage bootstrap/cache

# Expose application port
EXPOSE 10000

# Start Laravel
CMD php artisan serve --host=0.0.0.0 --port=${PORT:-10000}
