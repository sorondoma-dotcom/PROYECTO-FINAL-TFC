<?php
namespace App\Controllers;

use App\Services\CompetitionService;

class CompetitionController
{
    public function __construct(private CompetitionService $competitionService) {}

    public function createCompetition(): void
    {
        $logoPath = null;

        try {
            $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
            $isMultipart = str_contains($contentType, 'multipart/form-data');

            if ($isMultipart) {
                $body = $_POST;
            } else {
                $body = json_decode(file_get_contents('php://input'), true) ?? [];
            }

            if (!isset($body['nombre']) || empty($body['nombre'])) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Nombre es requerido']);
                return;
            }

            if (!isset($body['fecha_inicio']) || empty($body['fecha_inicio'])) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Fecha de inicio es requerida']);
                return;
            }

            if ($isMultipart && isset($_FILES['logo']) && $_FILES['logo']['error'] !== UPLOAD_ERR_NO_FILE) {
                $logoPath = $this->storeCompetitionLogo($_FILES['logo']);
            }

            if (!$logoPath) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Debes adjuntar un logo de competición.'
                ]);
                return;
            }

            $result = $this->competitionService->createCompetition(
                $body['nombre'],
                $body['descripcion'] ?? null,
                $body['pais'] ?? null,
                $body['ciudad'] ?? null,
                $body['tipo_piscina'] ?? '50m',
                $body['fecha_inicio'],
                $body['fecha_fin'] ?? null,
                $body['lugar_evento'] ?? null,
                $logoPath,
                $_SESSION['user_id'] ?? null
            );

            http_response_code(201);
            echo json_encode($this->formatCompetitionResponse($result));
        } catch (\Exception $e) {
            if ($logoPath) {
                $this->deleteCompetitionLogo($logoPath);
            }
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
    }

    public function updateCompetition(int $id): void
    {
        try {
            $body = json_decode(file_get_contents('php://input'), true);

            $result = $this->competitionService->updateCompetition($id, $body);
            echo json_encode($this->formatCompetitionResponse($result));
        } catch (\Exception $e) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
    }

    public function deleteCompetition(int $id): void
    {
        try {
            $result = $this->competitionService->deleteCompetition($id);
            if (!empty($result['removed_logo'])) {
                $this->deleteCompetitionLogo($result['removed_logo']);
            }
            echo json_encode($result);
        } catch (\Exception $e) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
    }

    public function getCompetition(int $id): void
    {
        try {
            $result = $this->competitionService->getCompetition($id);
            echo json_encode($this->formatCompetitionResponse($result));
        } catch (\Exception $e) {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
    }

    public function getAllCompetitions(): void
    {
        try {
            $estado = $_GET['estado'] ?? null;
            $result = $this->competitionService->getAllCompetitions($estado);
            echo json_encode($this->formatCompetitionResponse($result));
        } catch (\Exception $e) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
    }

    public function registerAthlete(int $id): void
    {
        try {
            $body = json_decode(file_get_contents('php://input'), true);

            if (!isset($body['athlete_id'])) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'athlete_id es requerido']);
                return;
            }

            $result = $this->competitionService->registerAthlete(
                $id,
                $body['athlete_id'],
                $body['numero_dorsal'] ?? null,
                $body['notas'] ?? null
            );

            http_response_code(201);
            echo json_encode($result);
        } catch (\Exception $e) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
    }

    public function unregisterAthlete(int $inscripcionId): void
    {
        try {
            $result = $this->competitionService->unregisterAthlete($inscripcionId);
            echo json_encode($result);
        } catch (\Exception $e) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
    }

    public function updateInscription(int $inscripcionId): void
    {
        try {
            $body = json_decode(file_get_contents('php://input'), true);

            $result = $this->competitionService->updateInscription($inscripcionId, $body);
            echo json_encode($result);
        } catch (\Exception $e) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
    }

    private function storeCompetitionLogo(array $file): ?string
    {
        if ($file['error'] !== UPLOAD_ERR_OK) {
            throw new \RuntimeException('No se pudo subir el logo de la competición');
        }

        if ($file['size'] > 5 * 1024 * 1024) {
            throw new \RuntimeException('El logo no puede superar los 5 MB.');
        }

        $allowed = [
            'image/png' => 'png',
            'image/jpeg' => 'jpg',
            'image/webp' => 'webp',
            'image/svg+xml' => 'svg'
        ];

        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        if (!$finfo) {
            throw new \RuntimeException('No se pudo validar el tipo de archivo del logo.');
        }

        $mime = finfo_file($finfo, $file['tmp_name']);
        finfo_close($finfo);

        if (!$mime || !isset($allowed[$mime])) {
            throw new \RuntimeException('Formato de logo no permitido. Usa PNG, JPG, WebP o SVG.');
        }

        $uploadDir = dirname(__DIR__, 2) . '/public/uploads/competitions';
        if (!is_dir($uploadDir) && !mkdir($uploadDir, 0775, true) && !is_dir($uploadDir)) {
            throw new \RuntimeException('No se pudo preparar el directorio de subida.');
        }

        $filename = uniqid('competition_', true) . '.' . $allowed[$mime];
        $destination = $uploadDir . '/' . $filename;

        if (!move_uploaded_file($file['tmp_name'], $destination)) {
            throw new \RuntimeException('Error al guardar el logo de la competición.');
        }

        return '/uploads/competitions/' . $filename;
    }

    private function deleteCompetitionLogo(string $relativePath): void
    {
        if (!$relativePath || !str_contains($relativePath, '/uploads/competitions/')) {
            return;
        }

        $fullPath = dirname(__DIR__, 2) . '/public' . $relativePath;
        if (is_file($fullPath)) {
            @unlink($fullPath);
        }
    }

    private function formatCompetitionResponse(array $payload): array
    {
        if (isset($payload['competition']) && is_array($payload['competition'])) {
            $payload['competition'] = $this->appendLogoUrl($payload['competition']);
        }

        if (isset($payload['competitions']) && is_array($payload['competitions'])) {
            $payload['competitions'] = array_map(
                fn (array $competition) => $this->appendLogoUrl($competition),
                $payload['competitions']
            );
        }

        return $payload;
    }

    private function appendLogoUrl(array $competition): array
    {
        $competition['logo_url'] = $this->buildLogoUrl($competition['logo_path'] ?? null);
        return $competition;
    }

    private function buildLogoUrl(?string $relativePath): ?string
    {
        if (!$relativePath) {
            return null;
        }

        $relativePath = '/' . ltrim($relativePath, '/');

        $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
        $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
        $basePath = rtrim($this->getPublicBasePath(), '/');

        return sprintf('%s://%s%s%s', $scheme, $host, $basePath, $relativePath);
    }

    private function getPublicBasePath(): string
    {
        $scriptName = $_SERVER['SCRIPT_NAME'] ?? '';
        $position = strrpos($scriptName, '/');
        if ($position === false) {
            return '/';
        }

        return substr($scriptName, 0, $position + 1);
    }
}
