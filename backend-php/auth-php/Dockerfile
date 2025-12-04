FROM php:8.3-apache

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    libzip-dev \
    unzip \
  && docker-php-ext-install pdo pdo_mysql \
  && a2enmod rewrite headers \
  && rm -rf /var/lib/apt/lists/*

ENV APACHE_DOCUMENT_ROOT=/var/www/html/public

RUN sed -ri -e 's!/var/www/html!${APACHE_DOCUMENT_ROOT}!g' \
    /etc/apache2/sites-available/000-default.conf \
    /etc/apache2/apache2.conf

WORKDIR /var/www/html

COPY . .

RUN mkdir -p public/uploads data \
  && chown -R www-data:www-data public/uploads data

EXPOSE 80
