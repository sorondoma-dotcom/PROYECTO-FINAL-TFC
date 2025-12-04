<?php
namespace App\Models;

class User
{
    public int $id;
    public string $name;
    public ?string $lastName;
    public string $email;
    public string $passwordHash;
    public string $createdAt;
    public ?string $emailVerifiedAt;
    public ?string $verificationCodeHash;
    public ?string $verificationExpiresAt;
    public ?string $role;
    public ?bool $isAdmin;
    public ?int $athleteId;
    public ?string $avatarPath;
    public ?string $avatarMime = null;
    public ?string $avatarUpdatedAt = null;
    public bool $avatarHasBlob = false;

    public static function fromArray(array $row): self
    {
        $user = new self();
        $user->id = (int) $row['id'];
        $user->name = $row['name'];
        $user->lastName = $row['last_name'] ?? null;
        $user->email = $row['email'];
        $user->passwordHash = $row['password'];
        $user->createdAt = $row['created_at'];
        $user->emailVerifiedAt = $row['email_verified_at'] ?? null;
        $user->verificationCodeHash = $row['verification_code_hash'] ?? null;
        $user->verificationExpiresAt = $row['verification_expires_at'] ?? null;
        $user->role = $row['role'] ?? 'user';
        $user->isAdmin = (bool) ($row['is_admin'] ?? false);
        $user->athleteId = isset($row['athlete_id']) ? (int) $row['athlete_id'] : null;
        $user->avatarPath = $row['avatar_path'] ?? null;
        $user->avatarMime = $row['avatar_mime'] ?? null;
        $user->avatarUpdatedAt = $row['avatar_updated_at'] ?? null;
        $user->avatarHasBlob = (bool) ($row['avatar_has_blob'] ?? false);
        return $user;
    }
}
