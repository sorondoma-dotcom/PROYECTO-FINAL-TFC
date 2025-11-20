<?php
namespace App\Services;

use App\Models\User;
use App\Repositories\UserRepository;

class AuthService
{
    private const PASSWORD_PATTERN = '/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/';
    private const NAME_PATTERN = '/^\p{L}+(?:\s\p{L}+)*$/u';

    public function __construct(private UserRepository $users) {}

    public function register(string $name, string $email, string $password): array
    {
        $email = $this->normalizeEmail($email);
        $password = $this->validatePassword($password);
        $name = $this->validateName($name);

        $existing = $this->users->findByEmail($email);
        if ($existing) {
            throw new \RuntimeException('El usuario ya existe');
        }

        $hash = password_hash($password, PASSWORD_DEFAULT);
        $user = $this->users->create($name, $email, $hash);

        $this->persistUserSession($user);

        return $this->formatUser($user);
    }

    public function login(string $email, string $password): array
    {
        $email = $this->normalizeEmail($email);
        $password = trim($password);

        if ($password === '') {
            throw new \InvalidArgumentException('La contrasena es obligatoria');
        }

        $user = $this->users->findByEmail($email);
        if (!$user || !password_verify($password, $user->passwordHash)) {
            throw new \RuntimeException('Credenciales invalidas');
        }

        $this->persistUserSession($user);

        return $this->formatUser($user);
    }

    public function logout(): void
    {
        $this->ensureSession();
        $_SESSION = [];

        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(
                session_name(),
                '',
                time() - 42000,
                $params['path'],
                $params['domain'],
                $params['secure'],
                $params['httponly']
            );
        }

        session_destroy();
    }

    public function requestPasswordReset(string $email): array
    {
        $email = $this->normalizeEmail($email);

        $user = $this->users->findByEmail($email);
        if (!$user) {
            throw new \RuntimeException('No encontramos una cuenta con ese correo');
        }

        $code = (string) random_int(100000, 999999);
        $expiresAt = time() + 600;

        $this->ensureSession();
        $_SESSION['password_reset'] = [
            'email' => $email,
            'code' => $code,
            'expires_at' => $expiresAt,
        ];

        return [
            'email' => $email,
            'code' => $code,
            'expiresAt' => date(DATE_ATOM, $expiresAt),
        ];
    }

    public function resetPassword(string $code, string $newPassword): array
    {
        $this->ensureSession();

        if (!isset($_SESSION['password_reset'])) {
            throw new \RuntimeException('No hay una solicitud de recuperacion activa');
        }

        $resetData = $_SESSION['password_reset'];

        if ($resetData['code'] !== $code) {
            throw new \InvalidArgumentException('Codigo de recuperacion invalido');
        }

        if (time() > $resetData['expires_at']) {
            unset($_SESSION['password_reset']);
            throw new \RuntimeException('El codigo ha expirado. Solicita uno nuevo');
        }

        $newPassword = $this->validatePassword($newPassword);

        $user = $this->users->findByEmail($resetData['email']);
        if (!$user) {
            throw new \RuntimeException('Usuario no encontrado');
        }

        $hash = password_hash($newPassword, PASSWORD_DEFAULT);
        $this->users->updatePassword($user->id, $hash);

        unset($_SESSION['password_reset']);

        return [
            'message' => 'Contrasena actualizada correctamente',
            'email' => $resetData['email'],
        ];
    }

    private function normalizeEmail(string $email): string
    {
        $normalized = strtolower(trim($email));
        if (!filter_var($normalized, FILTER_VALIDATE_EMAIL)) {
            throw new \InvalidArgumentException('Email no valido');
        }
        return $normalized;
    }

    private function validatePassword(string $password): string
    {
        $password = trim($password);
        if (!preg_match(self::PASSWORD_PATTERN, $password)) {
            throw new \InvalidArgumentException('La contrasena debe tener 8 caracteres e incluir mayusculas, minusculas y numeros.');
        }
        return $password;
    }

    private function validateName(string $name): string
    {
        $clean = trim(preg_replace('/\s+/', ' ', $name) ?? '');
        if ($clean === '' || strlen($clean) < 3 || strlen($clean) > 80) {
            throw new \InvalidArgumentException('El nombre debe tener entre 3 y 80 caracteres.');
        }
        if (!preg_match(self::NAME_PATTERN, $clean)) {
            throw new \InvalidArgumentException('El nombre solo puede incluir letras y espacios.');
        }
        return $clean;
    }

    private function ensureSession(): void
    {
        if (session_status() !== PHP_SESSION_ACTIVE) {
            session_start();
        }
    }

    private function persistUserSession(User $user): void
    {
        $this->ensureSession();
        session_regenerate_id(true);
        $_SESSION['user_id'] = $user->id;
        $_SESSION['user_name'] = $user->name;
        $_SESSION['user_email'] = $user->email;
    }

    private function formatUser(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'createdAt' => $user->createdAt,
        ];
    }
}
