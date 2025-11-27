<?php

namespace App\Repositories;

use App\Models\AthleteResult;
use PDO;

/**
 * Repositorio para gestionar los resultados de los atletas
 */
class AthleteResultRepository
{
    private PDO $pdo;

    public function __construct()
    {
        $this->pdo = getPDO();
    }

    /**
     * Obtiene todos los resultados de un atleta específico
     * 
     * @param int $athleteId ID del atleta
     * @param array $filters Filtros opcionales (event, poolLength, etc.)
     * @return AthleteResult[]
     */
    public function getResultsByAthleteId(int $athleteId, array $filters = []): array
    {
        $sql = "SELECT * FROM resultados WHERE athlete_id = :athlete_id";
        $params = ['athlete_id' => $athleteId];

        // Agregar filtros opcionales
        if (!empty($filters['event'])) {
            $sql .= " AND event LIKE :event";
            $params['event'] = '%' . $filters['event'] . '%';
        }

        if (!empty($filters['poolLength'])) {
            $sql .= " AND pool_length = :pool_length";
            $params['pool_length'] = $filters['poolLength'];
        }

        if (!empty($filters['medal'])) {
            $sql .= " AND medal = :medal";
            $params['medal'] = $filters['medal'];
        }

        if (!empty($filters['yearFrom'])) {
            $sql .= " AND YEAR(race_date) >= :year_from";
            $params['year_from'] = $filters['yearFrom'];
        }

        if (!empty($filters['yearTo'])) {
            $sql .= " AND YEAR(race_date) <= :year_to";
            $params['year_to'] = $filters['yearTo'];
        }

        // Ordenar por fecha más reciente primero
        $sql .= " ORDER BY race_date DESC, id DESC";

        // Limitar resultados si se especifica
        if (!empty($filters['limit'])) {
            $sql .= " LIMIT :limit";
        }

        try {
            $stmt = $this->pdo->prepare($sql);
            
            // Bind de parámetros
            foreach ($params as $key => $value) {
                $stmt->bindValue(':' . $key, $value);
            }

            if (!empty($filters['limit'])) {
                $stmt->bindValue(':limit', (int)$filters['limit'], PDO::PARAM_INT);
            }

            $stmt->execute();
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

            return array_map(fn($row) => AthleteResult::fromArray($row), $rows);
        } catch (\PDOException $e) {
            error_log("Error en getResultsByAthleteId: " . $e->getMessage());
            return [];
        }
    }

    /**
     * Obtiene un resultado específico por su ID
     * 
     * @param int $id ID del resultado
     * @return AthleteResult|null
     */
    public function getResultById(int $id): ?AthleteResult
    {
        $sql = "SELECT * FROM resultados WHERE id = :id LIMIT 1";
        
        try {
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute(['id' => $id]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);

            return $row ? AthleteResult::fromArray($row) : null;
        } catch (\PDOException $e) {
            error_log("Error en getResultById: " . $e->getMessage());
            return null;
        }
    }

    /**
     * Inserta un nuevo resultado
     * 
     * @param AthleteResult $result
     * @return int|null ID del resultado insertado o null si falla
     */
    public function insertResult(AthleteResult $result): ?int
    {
        $sql = "INSERT INTO resultados 
                (athlete_id, event, time_text, record_tags, medal, pool_length, 
                 age_at_result, competition, comp_country_code, race_date)
                VALUES 
                (:athlete_id, :event, :time_text, :record_tags, :medal, :pool_length,
                 :age_at_result, :competition, :comp_country_code, :race_date)";

        try {
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([
                'athlete_id' => $result->athleteId,
                'event' => $result->event,
                'time_text' => $result->timeText,
                'record_tags' => $result->recordTags,
                'medal' => $result->medal,
                'pool_length' => $result->poolLength,
                'age_at_result' => $result->ageAtResult,
                'competition' => $result->competition,
                'comp_country_code' => $result->compCountryCode,
                'race_date' => $result->raceDate
            ]);

            return (int) $this->pdo->lastInsertId();
        } catch (\PDOException $e) {
            error_log("Error en insertResult: " . $e->getMessage());
            return null;
        }
    }

    /**
     * Cuenta los resultados de un atleta
     * 
     * @param int $athleteId
     * @return int
     */
    public function countResultsByAthleteId(int $athleteId): int
    {
        $sql = "SELECT COUNT(*) as total FROM resultados WHERE athlete_id = :athlete_id";
        
        try {
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute(['athlete_id' => $athleteId]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);

            return (int) ($row['total'] ?? 0);
        } catch (\PDOException $e) {
            error_log("Error en countResultsByAthleteId: " . $e->getMessage());
            return 0;
        }
    }

    /**
     * Obtiene las medallas de un atleta
     * 
     * @param int $athleteId
     * @return array
     */
    public function getMedalsByAthleteId(int $athleteId): array
    {
        $sql = "SELECT 
                    SUM(CASE WHEN medal = 'Gold' THEN 1 ELSE 0 END) as gold,
                    SUM(CASE WHEN medal = 'Silver' THEN 1 ELSE 0 END) as silver,
                    SUM(CASE WHEN medal = 'Bronze' THEN 1 ELSE 0 END) as bronze
                FROM resultados 
                WHERE athlete_id = :athlete_id AND medal IS NOT NULL";
        
        try {
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute(['athlete_id' => $athleteId]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);

            return [
                'gold' => (int) ($row['gold'] ?? 0),
                'silver' => (int) ($row['silver'] ?? 0),
                'bronze' => (int) ($row['bronze'] ?? 0)
            ];
        } catch (\PDOException $e) {
            error_log("Error en getMedalsByAthleteId: " . $e->getMessage());
            return ['gold' => 0, 'silver' => 0, 'bronze' => 0];
        }
    }
}
