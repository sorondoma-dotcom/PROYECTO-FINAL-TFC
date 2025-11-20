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
            $user = $this->service->register(
                $input['name'] ?? '',
                $input['email'] ?? '',
                $input['password'] ?? ''
            );
            jsonResponse(['message' => 'Usuario creado', 'user' => $user], 201);
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
        jsonResponse(['message' => 'Sesión finalizada']);
    }

    public function requestPasswordReset(): void
    {
        $input = $this->getJsonInput();
        try {
            $reset = $this->service->requestPasswordReset($input['email'] ?? '');
            jsonResponse(['message' => 'Código generado', 'reset' => $reset]);
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

    private function getJsonInput(): array
    {
        $raw = file_get_contents('php://input');
        $decoded = json_decode($raw, true);
        return is_array($decoded) ? $decoded : [];
    }
}
