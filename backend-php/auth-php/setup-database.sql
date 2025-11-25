-- Script de configuración completa para MySQL
-- Ejecutar como root o usuario con privilegios

-- 1. Crear la base de datos
CREATE DATABASE IF NOT EXISTS liveswim CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;



-- 4. Usar la base de datos
USE liveswim;

-- 5. Crear la tabla de usuarios
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  email_verified_at DATETIME NULL DEFAULT NULL,
  verification_code_hash VARCHAR(255) NULL DEFAULT NULL,
  verification_expires_at DATETIME NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Crear índice único en email
CREATE UNIQUE INDEX idx_users_email ON users(email);

-- 7. Insertar usuario de prueba (opcional)
-- Email: test@test.com
-- Password: test123
INSERT INTO users (name, email, password) 
VALUES ('Usuario Test', 'test@test.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi')
ON DUPLICATE KEY UPDATE name=name;

SELECT 'Base de datos configurada exitosamente!' as message;
