-- Script para insertar/actualizar usuario de prueba
-- Ejecutar en phpMyAdmin o MySQL Workbench

USE liveswim;

-- Eliminar usuario de prueba si existe
DELETE FROM users WHERE email = 'test@test.com';

-- Insertar usuario de prueba con contraseña hasheada
-- Email: test@test.com
-- Password: test123
INSERT INTO users (name, email, password) 
VALUES ('Usuario Test', 'test@test.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi');

-- Verificar que se insertó correctamente
SELECT id, name, email, created_at FROM users WHERE email = 'test@test.com';
