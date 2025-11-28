<?php

namespace App\Services;

use App\Repositories\AthleteResultRepository;

/**
 * Servicio para gestionar la lógica de negocio de los resultados de atletas
 */
class AthleteResultService
{
    private AthleteResultRepository $repository;

    public function __construct(AthleteResultRepository $repository)
    {
        $this->repository = $repository;
    }

    /**
     * Obtiene los resultados de un atleta con filtros opcionales
     * 
     * @param int $athleteId
     * @param array $filters
     * @return array
     */
    public function getAthleteResults(int $athleteId, array $filters = []): array
    {
        $results = $this->repository->getResultsByAthleteId($athleteId, $filters);
        
        return array_map(fn($result) => $result->toArray(), $results);
    }

    /**
     * Obtiene los resultados de un atleta por nombre con filtros opcionales
     * 
     * @param string $athleteName
     * @param array $filters
     * @return array
     */
    public function getAthleteResultsByName(string $athleteName, array $filters = []): array
    {
        $results = $this->repository->getResultsByAthleteName($athleteName, $filters);
        
        return array_map(fn($result) => $result->toArray(), $results);
    }

    /**
     * Obtiene el conteo de medallas de un atleta
     * 
     * @param int $athleteId
     * @return array
     */
    public function getAthleteMedals(int $athleteId): array
    {
        return $this->repository->getMedalsByAthleteId($athleteId);
    }

    /**
     * Obtiene estadísticas generales de un atleta
     * 
     * @param int $athleteId
     * @return array
     */
    public function getAthleteStats(int $athleteId): array
    {
        $totalResults = $this->repository->countResultsByAthleteId($athleteId);
        $medals = $this->repository->getMedalsByAthleteId($athleteId);
        $totalMedals = $medals['gold'] + $medals['silver'] + $medals['bronze'];

        return [
            'totalResults' => $totalResults,
            'totalMedals' => $totalMedals,
            'medals' => $medals
        ];
    }
}
