<?php

namespace App\Services;

use PDO;

class StatsService
{
    public function __construct(private PDO $pdo)
    {
    }

    public function getOlympicRecordLeader(): ?array
    {
        $sql = <<<SQL
            SELECT 
                a.athlete_id,
                a.athlete_name,
                a.country_code,
                COUNT(*) AS total_records
            FROM resultados r
            INNER JOIN atletas a ON a.athlete_id = r.athlete_id
            WHERE (r.record_tags LIKE '%OR%' OR r.record_tags LIKE '%Olympic%')
              AND (r.competition LIKE 'Olympic%' OR r.competition LIKE '%Olympic Games%')
            GROUP BY a.athlete_id, a.athlete_name, a.country_code
            ORDER BY total_records DESC
            LIMIT 1
        SQL;

        $stmt = $this->pdo->query($sql);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            return null;
        }

        return [
            'athleteId' => (int) $row['athlete_id'],
            'name' => $row['athlete_name'],
            'countryCode' => $row['country_code'] ?? null,
            'records' => (int) $row['total_records']
        ];
    }
}
