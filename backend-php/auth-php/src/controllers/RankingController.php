<?php
namespace App\Controllers;

use App\Services\RankingService;

class RankingController
{
    public function __construct(private RankingService $service) {}

    public function index(): void
    {
        try {
            $result = $this->service->getRankings($this->getQueryFilters());
            jsonResponse($result);
        } catch (\InvalidArgumentException $e) {
            jsonResponse(['error' => $e->getMessage()], 400);
        } catch (\Throwable $e) {
            jsonResponse([
                'error' => 'No se pudieron obtener los rankings',
                'details' => $e->getMessage(),
            ], 500);
        }
    }

    private function getQueryFilters(): array
    {
        return [
            'gender' => $_GET['gender'] ?? null,
            'distance' => $_GET['distance'] ?? null,
            'stroke' => $_GET['stroke'] ?? null,
            'poolConfiguration' => $_GET['poolConfiguration'] ?? null,
            'limit' => $_GET['limit'] ?? null,
            'offset' => $_GET['offset'] ?? null,
            'year' => $_GET['year'] ?? null,
            'startDate' => $_GET['startDate'] ?? null,
            'endDate' => $_GET['endDate'] ?? null,
        ];
    }
}
