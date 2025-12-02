<?php

namespace App\Controllers;

use App\Services\AthleteProfileService;
use App\Services\AthleteResultService;

/**
 * Controlador para gestionar los resultados de los atletas
 */
class AthleteController
{
    private AthleteResultService $athleteResultService;
    private AthleteProfileService $athleteProfileService;

    public function __construct(AthleteResultService $athleteResultService, AthleteProfileService $athleteProfileService)
    {
        $this->athleteResultService = $athleteResultService;
        $this->athleteProfileService = $athleteProfileService;
    }

    /**
     * GET /api/athletes
     * Obtiene la lista de todos los atletas de la tabla atletas
     */
    public function getAllAthletes(): void
    {
        try {
            $pdo = getPDO();
            $sql = 'SELECT athlete_id, athlete_name, gender, country_code, age, image_url FROM atletas ORDER BY athlete_name LIMIT 10000';
            $stmt = $pdo->query($sql);
            $athletes = $stmt->fetchAll(\PDO::FETCH_ASSOC);

            jsonResponse([
                'success' => true,
                'total' => count($athletes),
                'data' => $athletes
            ], 200);
        } catch (\Exception $e) {
            error_log("Error en AthleteController::getAllAthletes: " . $e->getMessage());
            jsonResponse([
                'error' => 'Error al obtener los atletas',
                'message' => $e->getMessage()
            ], 500);
        }
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

    public function getSelfProfile(): void
    {
        $athleteId = $_SESSION['athlete_id'] ?? null;
        if (!$athleteId) {
            jsonResponse([
                'error' => 'Solo los nadadores pueden acceder a su perfil personal'
            ], 403);
        }

        try {
            $profile = $this->athleteProfileService->getAthleteProfile((int) $athleteId);
            if (!$profile) {
                jsonResponse([
                    'error' => 'No encontramos la ficha del nadador en la base de datos'
                ], 404);
            }

            jsonResponse([
                'success' => true,
                'athlete' => $profile['athlete'],
                'upcomingCompetitions' => $profile['upcomingCompetitions']
            ]);
        } catch (\Throwable $e) {
            error_log('AthleteController::getSelfProfile error: ' . $e->getMessage());
            jsonResponse([
                'error' => 'No pudimos cargar tu perfil en este momento'
            ], 500);
        }
    }

    public function getProfileById(int $athleteId): void
    {
        try {
            $profile = $this->athleteProfileService->getAthleteProfile($athleteId);
            if (!$profile) {
                jsonResponse([
                    'error' => 'No encontramos la ficha del nadador en la base de datos'
                ], 404);
                return;
            }

            jsonResponse([
                'success' => true,
                'athlete' => $profile['athlete'],
                'upcomingCompetitions' => $profile['upcomingCompetitions']
            ]);
        } catch (\Throwable $e) {
            error_log('AthleteController::getProfileById error: ' . $e->getMessage());
            jsonResponse([
                'error' => 'No pudimos cargar el perfil solicitado'
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
