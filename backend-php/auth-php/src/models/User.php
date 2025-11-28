<?php
namespace App\Models;

class User
{
    public int $id;
    public string $name;
    public string $email;
    public string $passwordHash;
    public string $createdAt;
    public ?string $emailVerifiedAt;
    public ?string $verificationCodeHash;
    public ?string $verificationExpiresAt;
    public ?string $role;
    public ?bool $isAdmin;

    public static function fromArray(array $row): self
    {
        $user = new self();
        $user->id = (int) $row['id'];
        $user->name = $row['name'];
        $user->email = $row['email'];
        $user->passwordHash = $row['password'];
        $user->createdAt = $row['created_at'];
        $user->emailVerifiedAt = $row['email_verified_at'] ?? null;
        $user->verificationCodeHash = $row['verification_code_hash'] ?? null;
        $user->verificationExpiresAt = $row['verification_expires_at'] ?? null;
        $user->role = $row['role'] ?? 'user';
        $user->isAdmin = (bool) ($row['is_admin'] ?? false);
        return $user;
    }
}
