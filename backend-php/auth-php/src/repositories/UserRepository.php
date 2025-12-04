<?php
namespace App\Repositories;

use PDO;
use App\Models\User;

class UserRepository
{
    private PDO $db;

    public function __construct()
    {
        $this->db = \getPDO();
        $this->ensureTable();
    }

    private function ensureTable(): void
    {
        $sql = 'CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            last_name VARCHAR(255) NULL DEFAULT NULL,
            email VARCHAR(255) NOT NULL UNIQUE,
            password VARCHAR(255) NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            email_verified_at DATETIME NULL DEFAULT NULL,
            verification_code_hash VARCHAR(255) NULL DEFAULT NULL,
            verification_expires_at DATETIME NULL DEFAULT NULL,
            role VARCHAR(50) DEFAULT "user",
            is_admin BOOLEAN DEFAULT FALSE,
            athlete_id INT UNSIGNED NULL,
            avatar_path VARCHAR(255) NULL DEFAULT NULL,
            avatar_blob LONGBLOB NULL DEFAULT NULL,
            avatar_mime VARCHAR(100) NULL DEFAULT NULL,
            avatar_updated_at DATETIME NULL DEFAULT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';
        
        $this->db->exec($sql);

        $this->addColumnIfMissing('email_verified_at', 'DATETIME NULL DEFAULT NULL');
        $this->addColumnIfMissing('verification_code_hash', 'VARCHAR(255) NULL DEFAULT NULL');
        $this->addColumnIfMissing('verification_expires_at', 'DATETIME NULL DEFAULT NULL');
        $this->addColumnIfMissing('role', "VARCHAR(50) DEFAULT 'user'");
        $this->addColumnIfMissing('is_admin', 'BOOLEAN DEFAULT FALSE');
        $this->addColumnIfMissing('athlete_id', 'INT UNSIGNED NULL');
        $this->addColumnIfMissing('last_name', 'VARCHAR(255) NULL DEFAULT NULL');
        $this->addColumnIfMissing('avatar_path', 'VARCHAR(255) NULL DEFAULT NULL');
        $this->addColumnIfMissing('avatar_blob', 'LONGBLOB NULL DEFAULT NULL');
        $this->addColumnIfMissing('avatar_mime', 'VARCHAR(100) NULL DEFAULT NULL');
        $this->addColumnIfMissing('avatar_updated_at', 'DATETIME NULL DEFAULT NULL');
        $this->addColumnIfMissing('updated_at', 'TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
        $this->addIndexIfMissing('idx_users_athlete_id', 'athlete_id');
    }

    private function baseSelectColumns(): string
    {
        return implode(', ', [
            'id',
            'name',
            'last_name',
            'email',
            'password',
            'created_at',
            'updated_at',
            'email_verified_at',
            'verification_code_hash',
            'verification_expires_at',
            'role',
            'is_admin',
            'athlete_id',
            'avatar_path',
            'avatar_mime',
            'avatar_updated_at',
            'CASE WHEN avatar_blob IS NULL OR OCTET_LENGTH(avatar_blob) = 0 THEN 0 ELSE 1 END AS avatar_has_blob'
        ]);
    }

    private function addColumnIfMissing(string $column, string $definition): void
    {
        // MariaDB/MySQL do not allow binding identifiers, so interpolate the known column name directly.
        $stmt = $this->db->prepare(sprintf("SHOW COLUMNS FROM users LIKE '%s'", $column));
        $stmt->execute();
        $exists = $stmt->fetch();

        if (!$exists) {
            $this->db->exec(sprintf('ALTER TABLE users ADD %s %s', $column, $definition));
        }
    }

    private function addIndexIfMissing(string $indexName, string $column): void
    {
        $stmt = $this->db->prepare('SHOW INDEX FROM users WHERE Key_name = :index');
        $stmt->execute(['index' => $indexName]);
        $exists = $stmt->fetch();

        if (!$exists) {
            $this->db->exec(sprintf('ALTER TABLE users ADD INDEX %s (%s)', $indexName, $column));
        }
    }

    public function findByEmail(string $email): ?User
    {
        $stmt = $this->db->prepare(sprintf('SELECT %s FROM users WHERE email = :email LIMIT 1', $this->baseSelectColumns()));
        $stmt->execute(['email' => strtolower($email)]);
        $row = $stmt->fetch();
        return $row ? User::fromArray($row) : null;
    }

    public function create(string $name, string $email, string $passwordHash, ?string $verificationCodeHash, ?\DateTimeInterface $expiresAt, ?int $athleteId = null): User
    {
        $stmt = $this->db->prepare(
            'INSERT INTO users (name, email, password, email_verified_at, verification_code_hash, verification_expires_at, athlete_id)
             VALUES (:name, :email, :password, NULL, :verification_code_hash, :verification_expires_at, :athlete_id)'
        );
        $stmt->execute([
            'name' => $name,
            'email' => strtolower($email),
            'password' => $passwordHash,
            'verification_code_hash' => $verificationCodeHash,
            'verification_expires_at' => $expiresAt ? $expiresAt->format('Y-m-d H:i:s') : null,
            'athlete_id' => $athleteId,
        ]);

        $id = (int) $this->db->lastInsertId();
        return $this->findById($id);
    }

    public function findById(int $id): ?User
    {
        $stmt = $this->db->prepare(sprintf('SELECT %s FROM users WHERE id = :id LIMIT 1', $this->baseSelectColumns()));
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        return $row ? User::fromArray($row) : null;
    }
    
    public function updatePassword(int $userId, string $passwordHash): bool
    {
        $stmt = $this->db->prepare('UPDATE users SET password = :password WHERE id = :id');
        return $stmt->execute([
            'id' => $userId,
            'password' => $passwordHash,
        ]);
    }

    public function updateVerificationCode(int $userId, string $codeHash, \DateTimeInterface $expiresAt): bool
    {
        $stmt = $this->db->prepare(
            'UPDATE users SET verification_code_hash = :hash, verification_expires_at = :expires WHERE id = :id'
        );

        return $stmt->execute([
            'id' => $userId,
            'hash' => $codeHash,
            'expires' => $expiresAt->format('Y-m-d H:i:s'),
        ]);
    }

    public function clearVerificationCode(int $userId): bool
    {
        $stmt = $this->db->prepare(
            'UPDATE users SET verification_code_hash = NULL, verification_expires_at = NULL WHERE id = :id'
        );

        return $stmt->execute(['id' => $userId]);
    }

    public function updateProfile(int $userId, array $data): ?User
    {
        $fields = [];
        $params = ['id' => $userId];

        if (array_key_exists('name', $data)) {
            $fields[] = 'name = :name';
            $params['name'] = $data['name'];
        }

        if (array_key_exists('last_name', $data)) {
            $fields[] = 'last_name = :last_name';
            $params['last_name'] = $data['last_name'];
        }

        $paramTypes = [];

        if (array_key_exists('avatar_path', $data)) {
            $fields[] = 'avatar_path = :avatar_path';
            $params['avatar_path'] = $data['avatar_path'];
        }

        if (array_key_exists('avatar_blob', $data)) {
            $fields[] = 'avatar_blob = :avatar_blob';
            $params['avatar_blob'] = $data['avatar_blob'];
            $paramTypes['avatar_blob'] = PDO::PARAM_LOB;
        }

        if (array_key_exists('avatar_mime', $data)) {
            $fields[] = 'avatar_mime = :avatar_mime';
            $params['avatar_mime'] = $data['avatar_mime'];
        }

        if (array_key_exists('avatar_updated_at', $data)) {
            $fields[] = 'avatar_updated_at = :avatar_updated_at';
            $params['avatar_updated_at'] = $data['avatar_updated_at'];
        }

        if (!$fields) {
            return $this->findById($userId);
        }

        $fields[] = 'updated_at = NOW()';
        $sql = sprintf('UPDATE users SET %s WHERE id = :id', implode(', ', $fields));
        $stmt = $this->db->prepare($sql);
        foreach ($params as $key => $value) {
            $type = $paramTypes[$key] ?? PDO::PARAM_STR;
            if ($type === PDO::PARAM_LOB) {
                $stmt->bindValue(':' . $key, $value, PDO::PARAM_LOB);
            } else {
                $stmt->bindValue(':' . $key, $value);
            }
        }
        $stmt->execute();

        return $this->findById($userId);
    }

    public function markVerified(int $userId): ?User
    {
        $stmt = $this->db->prepare(
            'UPDATE users SET email_verified_at = NOW(), verification_code_hash = NULL, verification_expires_at = NULL WHERE id = :id'
        );
        $stmt->execute(['id' => $userId]);
        return $this->findById($userId);
    }

    public function getAvatarBinary(int $userId): ?array
    {
        $stmt = $this->db->prepare('SELECT avatar_blob, avatar_mime, avatar_updated_at FROM users WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $userId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row || $row['avatar_blob'] === null) {
            return null;
        }

        return [
            'data' => $row['avatar_blob'],
            'mime' => $row['avatar_mime'] ?: 'image/jpeg',
            'updated_at' => $row['avatar_updated_at'] ?? null,
        ];
    }
}
