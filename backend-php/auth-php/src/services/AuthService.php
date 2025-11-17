<?php
namespace App\Services;

use App\Repositories\UserRepository;

class AuthService
{
    public function __construct(private UserRepository $users) {}

    public function register(string $name, string $email, string $password): array
    {
        $email = strtolower(trim($email));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new \InvalidArgumentException('Email no válido');
        }
        if (strlen($password) < 6) {
            throw new \InvalidArgumentException('La contraseña debe tener al menos 6 caracteres');
        }
        if (!$name) {
            throw new \InvalidArgumentException('El nombre es obligatorio');
        }
        $existing = $this->users->findByEmail($email);
        if ($existing) {
            throw new \RuntimeException('El usuario ya existe');
        }

        $hash = password_hash($password, PASSWORD_DEFAULT);
        $user = $this->users->create($name, $email, $hash);

        return [
          'id' => $user->id,
          'name' => $user->name,
          'email' => $user->email,
          'createdAt' => $user->createdAt,
        ];
    }

    public function login(string $email, string $password): array
    {
        $email = strtolower(trim($email));
        $user = $this->users->findByEmail($email);
        if (!$user || !password_verify($password, $user->passwordHash)) {
            throw new \RuntimeException('Credenciales inválidas');
        }

        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'createdAt' => $user->createdAt,
        ];
    }
}
