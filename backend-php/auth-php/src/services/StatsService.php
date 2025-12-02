<?php

namespace App\Services;

use PDO;

class StatsService
{
    public function __construct(private PDO $pdo)
    {
    }

    public function getHallOfFameStats(): array
    {
        return [
            'olympicLeader' => $this->getTopOlympicRecordHolder(),
            'gold' => $this->getMedalLeaders('Gold'),
            'silver' => $this->getMedalLeaders('Silver'),
            'worldRecords' => $this->getWorldRecordLeaders()
        ];
    }

    private function getTopOlympicRecordHolder(): ?array
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

    private function getMedalLeaders(string $medal): array
    {
        return [
            'male' => $this->fetchLeaderByMedalAndGender($medal, 'M'),
            'female' => $this->fetchLeaderByMedalAndGender($medal, 'F')
        ];
    }

    private function getWorldRecordLeaders(): array
    {
        return [
            'male' => $this->fetchWorldRecordLeaderByGender('M'),
            'female' => $this->fetchWorldRecordLeaderByGender('F')
        ];
    }

    private function fetchLeaderByMedalAndGender(string $medal, string $gender): ?array
    {
        $sql = <<<SQL
            SELECT 
                a.athlete_id,
                a.athlete_name,
                a.country_code,
                COUNT(*) AS total_medals
            FROM resultados r
            INNER JOIN atletas a ON a.athlete_id = r.athlete_id
            WHERE a.gender = :gender
              AND r.medal = :medal
            GROUP BY a.athlete_id, a.athlete_name, a.country_code
            ORDER BY total_medals DESC
            LIMIT 1
        SQL;

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([
            'gender' => $gender,
            'medal' => $medal
        ]);

        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            return null;
        }

        return [
            'athleteId' => (int) $row['athlete_id'],
            'name' => $row['athlete_name'],
            'countryCode' => $row['country_code'] ?? null,
            'total' => (int) $row['total_medals']
        ];
    }

    private function fetchWorldRecordLeaderByGender(string $gender): ?array
    {
        $sql = <<<SQL
            SELECT 
                a.athlete_id,
                a.athlete_name,
                a.country_code,
                COUNT(*) AS total_wr
            FROM resultados r
            INNER JOIN atletas a ON a.athlete_id = r.athlete_id
            WHERE a.gender = :gender
              AND (r.record_tags LIKE '%WR%' OR r.record_tags LIKE '%World Record%')
            GROUP BY a.athlete_id, a.athlete_name, a.country_code
            ORDER BY total_wr DESC
            LIMIT 1
        SQL;

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute(['gender' => $gender]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            return null;
        }

        return [
            'athleteId' => (int) $row['athlete_id'],
            'name' => $row['athlete_name'],
            'countryCode' => $row['country_code'] ?? null,
            'total' => (int) $row['total_wr']
        ];
    }
}
