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

    public function streamAvatar(int $userId): void
    {
        try {
            $options = $this->buildAvatarStreamOptions();
            $avatar = $this->service->getUserAvatar($userId, $options);
            if (!$avatar) {
                http_response_code(404);
                return;
            }

            $etag = '"' . sha1($avatar['data']) . '"';
            $lastModified = $this->formatLastModifiedHeader($avatar['updated_at'] ?? null);

            header('Cache-Control: public, max-age=604800, immutable');
            if ($etag) {
                header('ETag: ' . $etag);
            }
            if ($lastModified !== null) {
                header('Last-Modified: ' . $lastModified);
            }

            if ($this->isClientCacheFresh($etag, $lastModified)) {
                http_response_code(304);
                return;
            }

            header('Content-Type: ' . $avatar['mime']);
            header('Content-Length: ' . strlen($avatar['data']));
            echo $avatar['data'];
        } catch (\Throwable $e) {
            http_response_code(500);
            echo '';
        }
    }

    private function getJsonInput(): array
    {
        $raw = file_get_contents('php://input');
        $decoded = json_decode($raw, true);
        return is_array($decoded) ? $decoded : [];
    }

    private function buildAvatarStreamOptions(): ?array
    {
        $size = isset($_GET['size']) ? strtolower((string) $_GET['size']) : null;
        $sizeMap = [
            'xs' => 48,
            'sm' => 96,
            'md' => 192,
            'lg' => 384,
            'xl' => 768,
        ];

        $maxWidth = null;
        if ($size && isset($sizeMap[$size])) {
            $maxWidth = $sizeMap[$size];
        }

        if (isset($_GET['w'])) {
            $custom = max(16, min(1024, (int) $_GET['w']));
            $maxWidth = $custom;
        }

        $options = [];
        if ($maxWidth !== null) {
            $options['maxWidth'] = $maxWidth;
            $options['maxHeight'] = $maxWidth;
            $options['quality'] = $maxWidth <= 96 ? 72 : ($maxWidth <= 192 ? 78 : 85);
        }

        $accept = $_SERVER['HTTP_ACCEPT'] ?? '';
        if (stripos($accept, 'image/webp') !== false) {
            $options['format'] = 'webp';
        }

        return $options ?: null;
    }

    private function formatLastModifiedHeader(?string $value): ?string
    {
        if (!$value) {
            return null;
        }
        $timestamp = strtotime($value);
        if ($timestamp === false) {
            return null;
        }
        return gmdate('D, d M Y H:i:s', $timestamp) . ' GMT';
    }

    private function isClientCacheFresh(?string $etag, ?string $lastModified): bool
    {
        $ifNoneMatch = $_SERVER['HTTP_IF_NONE_MATCH'] ?? '';
        if ($etag && $ifNoneMatch && trim($ifNoneMatch) === $etag) {
            return true;
        }

        if ($lastModified) {
            $ifModifiedSince = $_SERVER['HTTP_IF_MODIFIED_SINCE'] ?? '';
            if ($ifModifiedSince && strtotime($ifModifiedSince) >= strtotime($lastModified)) {
                return true;
            }
        }

        return false;
    }
}
