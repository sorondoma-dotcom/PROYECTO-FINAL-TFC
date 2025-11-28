<?php
namespace App\Controllers;

use App\Services\CompetitionService;

class CompetitionController
{
    public function __construct(private CompetitionService $competitionService) {}

    public function createCompetition(): void
    {
        try {
            $body = json_decode(file_get_contents('php://input'), true);

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

            $result = $this->competitionService->createCompetition(
                $body['nombre'],
                $body['descripcion'] ?? null,
                $body['pais'] ?? null,
                $body['ciudad'] ?? null,
                $body['tipo_piscina'] ?? '50m',
                $body['fecha_inicio'],
                $body['fecha_fin'] ?? null,
                $body['lugar_evento'] ?? null,
                $_SESSION['user_id'] ?? null
            );

            http_response_code(201);
            echo json_encode($result);
        } catch (\Exception $e) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
    }

    public function updateCompetition(int $id): void
    {
        try {
            $body = json_decode(file_get_contents('php://input'), true);

            $result = $this->competitionService->updateCompetition($id, $body);

            echo json_encode($result);
        } catch (\Exception $e) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
    }

    public function deleteCompetition(int $id): void
    {
        try {
            $result = $this->competitionService->deleteCompetition($id);
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
            echo json_encode($result);
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
            echo json_encode($result);
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
}
