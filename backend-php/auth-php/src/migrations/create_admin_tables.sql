ALTER TABLE users ADD COLUMN role VARCHAR(50) DEFAULT 'user' AFTER verification_expires_at;
ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT FALSE AFTER role;

CREATE TABLE IF NOT EXISTS competiciones_agendadas (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL UNIQUE,
  descripcion LONGTEXT,
  pais VARCHAR(100),
  ciudad VARCHAR(100),
  tipo_piscina ENUM('25m', '50m') DEFAULT '50m',
  fecha_inicio DATETIME NOT NULL,
  fecha_fin DATETIME,
  lugar_evento VARCHAR(255),
  creada_por INT,
  estado ENUM('pendiente', 'en_curso', 'finalizada', 'cancelada') DEFAULT 'pendiente',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (creada_por) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS competiciones_pruebas (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  competicion_id INT UNSIGNED NOT NULL,
  nombre_prueba VARCHAR(255) NOT NULL,
  distancia INT DEFAULT 100,
  estilo ENUM('Libre', 'Espalda', 'Pecho', 'Mariposa', 'Combinado') NOT NULL,
  genero ENUM('M', 'F', 'Mixto') DEFAULT 'Mixto',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_prueba (competicion_id, nombre_prueba, distancia, estilo),
  FOREIGN KEY (competicion_id) REFERENCES competiciones_agendadas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS inscripciones_atleticas (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  competicion_id INT UNSIGNED NOT NULL,
  athlete_id INT UNSIGNED NOT NULL,
  numero_dorsal INT,
  estado_inscripcion ENUM('inscrito', 'confirmado', 'retirado', 'descalificado') DEFAULT 'inscrito',
  notas TEXT,
  inscrito_en DATETIME DEFAULT CURRENT_TIMESTAMP,
  confirmado_en DATETIME,
  UNIQUE KEY unique_inscription (competicion_id, athlete_id),
  FOREIGN KEY (competicion_id) REFERENCES competiciones_agendadas(id) ON DELETE CASCADE,
  INDEX idx_athlete_id (athlete_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS inscripciones_pruebas (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  inscripcion_atletica_id INT UNSIGNED NOT NULL,
  prueba_id INT UNSIGNED NOT NULL,
  tiempo_inscripcion VARCHAR(32),
  tiempo_competencia VARCHAR(32),
  clasificacion INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_athlete_event (inscripcion_atletica_id, prueba_id),
  FOREIGN KEY (inscripcion_atletica_id) REFERENCES inscripciones_atleticas(id) ON DELETE CASCADE,
  FOREIGN KEY (prueba_id) REFERENCES competiciones_pruebas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE INDEX idx_competiciones_estado ON competiciones_agendadas(estado);
CREATE INDEX idx_competiciones_fecha ON competiciones_agendadas(fecha_inicio);
CREATE INDEX idx_inscripciones_competicion ON inscripciones_atleticas(competicion_id);
CREATE INDEX idx_inscripciones_atleta ON inscripciones_atleticas(athlete_id);
CREATE INDEX idx_pruebas_competicion ON competiciones_pruebas(competicion_id);
