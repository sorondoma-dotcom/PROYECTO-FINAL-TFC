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
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';
        
        $this->db->exec($sql);
    }

    public function findByEmail(string $email): ?User
    {
        $stmt = $this->db->prepare('SELECT * FROM users WHERE email = :email LIMIT 1');
        $stmt->execute(['email' => strtolower($email)]);
        $row = $stmt->fetch();
        return $row ? User::fromArray($row) : null;
    }

    public function create(string $name, string $email, string $passwordHash): User
    {
        $stmt = $this->db->prepare(
            'INSERT INTO users (name, email, password)
             VALUES (:name, :email, :password)'
        );
        $stmt->execute([
            'name' => $name,
            'email' => strtolower($email),
            'password' => $passwordHash,
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
}
