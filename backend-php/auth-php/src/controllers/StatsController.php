<?php

namespace App\Controllers;

use App\Services\StatsService;

class StatsController
{
    public function __construct(private StatsService $statsService)
    {
    }

    public function getOlympicRecordLeader(): void
    {
        try {
            $leader = $this->statsService->getOlympicRecordLeader();
            if (!$leader) {
                jsonResponse([
                    'leader' => null,
                    'message' => 'No se encontraron registros olímpicos'
                ]);
                return;
            }

            jsonResponse(['leader' => $leader]);
        } catch (\Throwable $e) {
            error_log('StatsController::getOlympicRecordLeader error: ' . $e->getMessage());
            http_response_code(500);
            jsonResponse(['error' => 'No pudimos calcular el record olímpico']);
        }
    }
}
