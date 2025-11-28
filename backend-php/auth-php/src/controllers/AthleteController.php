<?php

namespace App\Controllers;

use App\Services\AthleteResultService;

/**
 * Controlador para gestionar los resultados de los atletas
 */
class AthleteController
{
    private AthleteResultService $athleteResultService;

    public function __construct(AthleteResultService $athleteResultService)
    {
        $this->athleteResultService = $athleteResultService;
    }

    /**
     * GET /api/athletes/results?athleteId=123 OR /api/athletes/results?name=John%20Doe
     * Obtiene los resultados de un atleta específico por ID o por nombre
     */
    public function getResults(): void
    {
        try {
            $athleteId = $_GET['athleteId'] ?? null;
            $athleteName = $_GET['name'] ?? null;

            // Validar que se proporcione al menos un identificador
            if ((empty($athleteId) || !is_numeric($athleteId)) && empty($athleteName)) {
                jsonResponse([
                    'error' => 'Se requiere un identificador válido',
                    'message' => 'Debe proporcionar athleteId o name en la URL'
                ], 400);
                return;
            }

            // Filtros opcionales
            $filters = [];
            if (!empty($_GET['event'])) {
                $filters['event'] = $_GET['event'];
            }
            if (!empty($_GET['poolLength'])) {
                $filters['poolLength'] = $_GET['poolLength'];
            }
            if (!empty($_GET['medal'])) {
                $filters['medal'] = $_GET['medal'];
            }
            if (!empty($_GET['yearFrom'])) {
                $filters['yearFrom'] = $_GET['yearFrom'];
            }
            if (!empty($_GET['yearTo'])) {
                $filters['yearTo'] = $_GET['yearTo'];
            }
            if (!empty($_GET['limit'])) {
                $filters['limit'] = (int) $_GET['limit'];
            }

            // Buscar por ID si se proporciona
            if (!empty($athleteId) && is_numeric($athleteId)) {
                $results = $this->athleteResultService->getAthleteResults((int) $athleteId, $filters);
                
                jsonResponse([
                    'success' => true,
                    'athleteId' => (int) $athleteId,
                    'total' => count($results),
                    'results' => $results
                ], 200);
            } else if (!empty($athleteName)) {
                // Buscar por nombre si no se proporciona ID
                $results = $this->athleteResultService->getAthleteResultsByName($athleteName, $filters);
                
                jsonResponse([
                    'success' => true,
                    'athleteName' => $athleteName,
                    'total' => count($results),
                    'results' => $results
                ], 200);
            }
        } catch (\Exception $e) {
            error_log("Error en AthleteController::getResults: " . $e->getMessage());
            jsonResponse([
                'error' => 'Error al obtener los resultados',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * GET /api/athletes/results/medals?athleteId=123
     * Obtiene el conteo de medallas de un atleta
     */
    public function getMedals(): void
    {
        try {
            $athleteId = $_GET['athleteId'] ?? null;

            if (empty($athleteId) || !is_numeric($athleteId)) {
                jsonResponse([
                    'error' => 'Se requiere un athleteId válido'
                ], 400);
                return;
            }

            $medals = $this->athleteResultService->getAthleteMedals((int) $athleteId);

            jsonResponse([
                'success' => true,
                'athleteId' => (int) $athleteId,
                'medals' => $medals
            ], 200);
        } catch (\Exception $e) {
            error_log("Error en AthleteController::getMedals: " . $e->getMessage());
            jsonResponse([
                'error' => 'Error al obtener las medallas',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * GET /api/athletes/results/stats?athleteId=123
     * Obtiene estadísticas generales de un atleta
     */
    public function getStats(): void
    {
        try {
            $athleteId = $_GET['athleteId'] ?? null;

            if (empty($athleteId) || !is_numeric($athleteId)) {
                jsonResponse([
                    'error' => 'Se requiere un athleteId válido'
                ], 400);
                return;
            }

            $stats = $this->athleteResultService->getAthleteStats((int) $athleteId);

            jsonResponse([
                'success' => true,
                'athleteId' => (int) $athleteId,
                'stats' => $stats
            ], 200);
        } catch (\Exception $e) {
            error_log("Error en AthleteController::getStats: " . $e->getMessage());
            jsonResponse([
                'error' => 'Error al obtener las estadísticas',
                'message' => $e->getMessage()
            ], 500);
        }
    }
}
