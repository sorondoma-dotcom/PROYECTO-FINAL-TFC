<?php
namespace App\Controllers;

use App\Services\AuthService;

class AuthController
{
    public function __construct(private AuthService $service) {}

    public function register(): void
    {
        $input = $this->getJsonInput();
        try {
            $payload = $this->service->register(
                $input['name'] ?? '',
                $input['email'] ?? '',
                $input['password'] ?? ''
            );
            jsonResponse($payload, 201);
        } catch (\InvalidArgumentException $e) {
            jsonResponse(['error' => $e->getMessage()], 400);
        } catch (\Throwable $e) {
            jsonResponse(['error' => $e->getMessage()], 409);
        }
    }

    public function login(): void
    {
        $input = $this->getJsonInput();
        try {
            $user = $this->service->login(
                $input['email'] ?? '',
                $input['password'] ?? ''
            );
            jsonResponse(['message' => 'Login correcto', 'user' => $user]);
        } catch (\Throwable $e) {
            jsonResponse(['error' => $e->getMessage()], 401);
        }
    }

    public function logout(): void
    {
        $this->service->logout();
        jsonResponse(['message' => 'Sesion finalizada']);
    }

    public function requestPasswordReset(): void
    {
        $input = $this->getJsonInput();
        try {
            $reset = $this->service->requestPasswordReset($input['email'] ?? '');
            jsonResponse($reset);
        } catch (\InvalidArgumentException $e) {
            jsonResponse(['error' => $e->getMessage()], 400);
        } catch (\Throwable $e) {
            jsonResponse(['error' => $e->getMessage()], 404);
        }
    }

    public function resetPassword(): void
    {
        $input = $this->getJsonInput();
        try {
            $result = $this->service->resetPassword(
                $input['code'] ?? '',
                $input['newPassword'] ?? ''
            );
            jsonResponse($result);
        } catch (\InvalidArgumentException $e) {
            jsonResponse(['error' => $e->getMessage()], 400);
        } catch (\Throwable $e) {
            jsonResponse(['error' => $e->getMessage()], 403);
        }
    }

    public function sendVerificationCode(): void
    {
        $input = $this->getJsonInput();
        try {
            $result = $this->service->requestEmailVerification($input['email'] ?? '');
            jsonResponse($result);
        } catch (\InvalidArgumentException $e) {
            jsonResponse(['error' => $e->getMessage()], 400);
        } catch (\Throwable $e) {
            jsonResponse(['error' => $e->getMessage()], 404);
        }
    }

    public function verifyEmail(): void
    {
        $input = $this->getJsonInput();
        try {
            $result = $this->service->verifyEmail(
                $input['email'] ?? '',
                $input['code'] ?? ''
            );
            jsonResponse($result);
        } catch (\InvalidArgumentException $e) {
            jsonResponse(['error' => $e->getMessage()], 400);
        } catch (\Throwable $e) {
            jsonResponse(['error' => $e->getMessage()], 403);
        }
    }

    public function currentUser(): void
    {
        try {
            $user = $this->service->getAuthenticatedUser();
            jsonResponse(['user' => $user]);
        } catch (\Throwable $e) {
            jsonResponse(['error' => $e->getMessage()], 401);
        }
    }

    public function updateProfile(): void
    {
        $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
        $payload = [];

        if (is_string($contentType) && str_contains($contentType, 'multipart/form-data')) {
            $payload = $_POST;
        } else {
            $payload = $this->getJsonInput();
        }

        $avatarFile = $_FILES['avatar'] ?? null;
        if (!is_array($payload)) {
            $payload = [];
        }

        try {
            $user = $this->service->updateProfile($payload, is_array($avatarFile) ? $avatarFile : null);
            jsonResponse(['message' => 'Perfil actualizado correctamente', 'user' => $user]);
        } catch (\InvalidArgumentException $e) {
            jsonResponse(['error' => $e->getMessage()], 422);
        } catch (\RuntimeException $e) {
            jsonResponse(['error' => $e->getMessage()], 403);
        } catch (\Throwable $e) {
            jsonResponse(['error' => $e->getMessage()], 400);
        }
    }

    private function getJsonInput(): array
    {
        $raw = file_get_contents('php://input');
        $decoded = json_decode($raw, true);
        return is_array($decoded) ? $decoded : [];
    }
}
