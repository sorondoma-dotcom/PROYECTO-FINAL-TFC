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
            email VARCHAR(255) NOT NULL UNIQUE,
            password VARCHAR(255) NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            email_verified_at DATETIME NULL DEFAULT NULL,
            verification_code_hash VARCHAR(255) NULL DEFAULT NULL,
            verification_expires_at DATETIME NULL DEFAULT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';
        
        $this->db->exec($sql);

        $this->addColumnIfMissing('email_verified_at', 'DATETIME NULL DEFAULT NULL');
        $this->addColumnIfMissing('verification_code_hash', 'VARCHAR(255) NULL DEFAULT NULL');
        $this->addColumnIfMissing('verification_expires_at', 'DATETIME NULL DEFAULT NULL');
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

    public function findByEmail(string $email): ?User
    {
        $stmt = $this->db->prepare('SELECT * FROM users WHERE email = :email LIMIT 1');
        $stmt->execute(['email' => strtolower($email)]);
        $row = $stmt->fetch();
        return $row ? User::fromArray($row) : null;
    }

    public function create(string $name, string $email, string $passwordHash, ?string $verificationCodeHash, ?\DateTimeInterface $expiresAt): User
    {
        $stmt = $this->db->prepare(
            'INSERT INTO users (name, email, password, email_verified_at, verification_code_hash, verification_expires_at)
             VALUES (:name, :email, :password, NULL, :verification_code_hash, :verification_expires_at)'
        );
        $stmt->execute([
            'name' => $name,
            'email' => strtolower($email),
            'password' => $passwordHash,
            'verification_code_hash' => $verificationCodeHash,
            'verification_expires_at' => $expiresAt ? $expiresAt->format('Y-m-d H:i:s') : null,
        ]);

        $id = (int) $this->db->lastInsertId();
        return $this->findById($id);
    }

    private function findById(int $id): ?User
    {
        $stmt = $this->db->prepare('SELECT * FROM users WHERE id = :id LIMIT 1');
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

    public function markVerified(int $userId): ?User
    {
        $stmt = $this->db->prepare(
            'UPDATE users SET email_verified_at = NOW(), verification_code_hash = NULL, verification_expires_at = NULL WHERE id = :id'
        );
        $stmt->execute(['id' => $userId]);
        return $this->findById($userId);
    }
}
