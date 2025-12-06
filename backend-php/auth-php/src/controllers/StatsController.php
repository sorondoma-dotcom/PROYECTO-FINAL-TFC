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
            $payload = $this->statsService->getHallOfFameStats();
            jsonResponse($payload);
        } catch (\Throwable $e) {
            error_log('StatsController::getOlympicRecordLeader error: ' . $e->getMessage());
            http_response_code(500);
            jsonResponse(['error' => 'No pudimos calcular las estadisticas solicitadas']);
        }
    }

    public function getDashboardStats(): void
    {
        try {
            $payload = $this->statsService->getDashboardStats();
            jsonResponse($payload);
        } catch (\Throwable $e) {
            error_log('StatsController::getDashboardStats error: ' . $e->getMessage());
            http_response_code(500);
            jsonResponse(['error' => 'No pudimos calcular las estadisticas del dashboard']);
        }
    }
}
