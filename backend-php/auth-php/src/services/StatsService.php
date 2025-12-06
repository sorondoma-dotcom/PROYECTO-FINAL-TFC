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
            'worldRecords' => $this->getWorldRecordLeaders(),
            'finaPointsLeader' => $this->getTopFinaPointsLeader()
        ];
    }

    /**
     * Estadísticas generales del dashboard
     */
    public function getDashboardStats(): array
    {
        return [
            'totalAthletes' => $this->getTotalAthletes(),
            'totalResults' => $this->getTotalResults(),
            'totalCompetitions' => $this->getTotalCompetitions(),
            'countriesRepresented' => $this->getCountriesCount(),
            'recentActivity' => $this->getRecentActivity(),
            'topCountries' => $this->getTopCountriesByMedals(),
            'recordBreakers' => $this->getRecentRecordBreakers(),
            'upcomingStars' => $this->getYoungTalents(),
            'versatileAthletes' => $this->getMostVersatileAthletes(),
            'consistentPerformers' => $this->getMostConsistentAthletes()
        ];
    }

    /**
     * Atletas más versátiles (compiten en más eventos diferentes)
     */
    private function getMostVersatileAthletes(): array
    {
        $sql = <<<SQL
            SELECT 
                a.athlete_id,
                a.athlete_name,
                a.country_code,
                a.gender,
                COUNT(DISTINCT sr.stroke) as different_strokes,
                COUNT(DISTINCT sr.distance) as different_distances,
                COUNT(DISTINCT CONCAT(sr.distance, '-', sr.stroke)) as total_events,
                AVG(sr.points) as avg_points
            FROM atletas a
            INNER JOIN swimming_rankings sr ON a.athlete_id = sr.athlete_id
            WHERE sr.points IS NOT NULL
            GROUP BY a.athlete_id, a.athlete_name, a.country_code, a.gender
            HAVING total_events >= 3
            ORDER BY total_events DESC, avg_points DESC
            LIMIT 5
        SQL;

        $stmt = $this->pdo->query($sql);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Atletas más consistentes (mejor promedio de puntos FINA)
     */
    private function getMostConsistentAthletes(): array
    {
        $sql = <<<SQL
            SELECT 
                a.athlete_id,
                a.athlete_name,
                a.country_code,
                a.gender,
                AVG(sr.points) as avg_points,
                MIN(sr.points) as min_points,
                MAX(sr.points) as max_points,
                COUNT(*) as total_races,
                STDDEV(sr.points) as consistency_score
            FROM atletas a
            INNER JOIN swimming_rankings sr ON a.athlete_id = sr.athlete_id
            WHERE sr.points IS NOT NULL
            GROUP BY a.athlete_id, a.athlete_name, a.country_code, a.gender
            HAVING total_races >= 3
            ORDER BY avg_points DESC, consistency_score ASC
            LIMIT 5
        SQL;

        $stmt = $this->pdo->query($sql);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Jóvenes talentos (mejores atletas menores de 20 años)
     */
    private function getYoungTalents(): array
    {
        $sql = <<<SQL
            SELECT 
                a.athlete_id,
                a.athlete_name,
                a.age,
                a.country_code,
                a.gender,
                MAX(sr.points) as best_points,
                ANY_VALUE(sr.distance) as distance,
                ANY_VALUE(sr.stroke) as stroke,
                ANY_VALUE(sr.time_text) as time_text,
                COUNT(DISTINCT sr.competition) as competitions_count
            FROM atletas a
            INNER JOIN swimming_rankings sr ON a.athlete_id = sr.athlete_id
            WHERE a.age IS NOT NULL 
              AND a.age < 20
              AND sr.points IS NOT NULL
            GROUP BY a.athlete_id, a.athlete_name, a.age, a.country_code, a.gender
            ORDER BY best_points DESC
            LIMIT 5
        SQL;

        $stmt = $this->pdo->query($sql);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Países con más medallas
     */
    private function getTopCountriesByMedals(): array
    {
        $sql = <<<SQL
            SELECT 
                a.country_code,
                COUNT(CASE WHEN r.medal = 'Gold' THEN 1 END) as gold_count,
                COUNT(CASE WHEN r.medal = 'Silver' THEN 1 END) as silver_count,
                COUNT(CASE WHEN r.medal = 'Bronze' THEN 1 END) as bronze_count,
                COUNT(*) as total_medals,
                COUNT(DISTINCT a.athlete_id) as unique_athletes
            FROM resultados r
            INNER JOIN atletas a ON a.athlete_id = r.athlete_id
            WHERE r.medal IS NOT NULL AND r.medal != ''
              AND a.country_code IS NOT NULL
            GROUP BY a.country_code
            ORDER BY gold_count DESC, silver_count DESC, bronze_count DESC
            LIMIT 10
        SQL;

        $stmt = $this->pdo->query($sql);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Rompe-récords recientes (últimos 2 años)
     */
    private function getRecentRecordBreakers(): array
    {
        $sql = <<<SQL
            SELECT 
                a.athlete_id,
                a.athlete_name,
                a.country_code,
                a.gender,
                r.event,
                r.time_text,
                r.record_tags,
                r.competition,
                r.race_date,
                COUNT(*) as records_count
            FROM resultados r
            INNER JOIN atletas a ON a.athlete_id = r.athlete_id
            WHERE r.record_tags IS NOT NULL 
              AND r.record_tags != ''
              AND r.race_date >= DATE_SUB(CURDATE(), INTERVAL 2 YEAR)
            GROUP BY a.athlete_id, a.athlete_name, a.country_code, a.gender, 
                     r.event, r.time_text, r.record_tags, r.competition, r.race_date
            ORDER BY r.race_date DESC, records_count DESC
            LIMIT 10
        SQL;

        $stmt = $this->pdo->query($sql);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Actividad reciente (últimas 50 competiciones/resultados)
     */
    private function getRecentActivity(): array
    {
        $sql = <<<SQL
            SELECT 
                r.race_date,
                COUNT(DISTINCT r.competition) as competitions,
                COUNT(DISTINCT a.athlete_id) as athletes,
                COUNT(*) as total_results
            FROM resultados r
            INNER JOIN atletas a ON a.athlete_id = r.athlete_id
            WHERE r.race_date IS NOT NULL
            GROUP BY r.race_date
            ORDER BY r.race_date DESC
            LIMIT 30
        SQL;

        $stmt = $this->pdo->query($sql);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    private function getTotalAthletes(): int
    {
        $stmt = $this->pdo->query("SELECT COUNT(*) FROM atletas");
        return (int) $stmt->fetchColumn();
    }

    private function getTotalResults(): int
    {
        $stmt = $this->pdo->query("SELECT COUNT(*) FROM resultados");
        return (int) $stmt->fetchColumn();
    }

    private function getTotalCompetitions(): int
    {
        $stmt = $this->pdo->query("SELECT COUNT(DISTINCT competition) FROM resultados WHERE competition IS NOT NULL");
        return (int) $stmt->fetchColumn();
    }

    private function getCountriesCount(): int
    {
        $stmt = $this->pdo->query("SELECT COUNT(DISTINCT country_code) FROM atletas WHERE country_code IS NOT NULL");
        return (int) $stmt->fetchColumn();
    }

    public function getTopFinaPointsLeader(): ?array
    {
        $sql = <<<SQL
            SELECT 
                a.athlete_id,
                a.athlete_name,
                a.country_code,
                a.gender,
                sr.points as fina_points,
                sr.time_text as swim_time,
                sr.distance,
                sr.stroke,
                CONCAT(sr.distance, 'm ', sr.stroke, ' ', sr.pool_configuration) as event,
                sr.competition,
                sr.race_date as meet_date
            FROM swimming_rankings sr
            INNER JOIN atletas a ON a.athlete_id = sr.athlete_id
            WHERE sr.points IS NOT NULL 
              AND sr.points > 0
            ORDER BY sr.points DESC
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
            'gender' => $row['gender'] ?? null,
            'finaPoints' => (int) $row['fina_points'],
            'time' => $row['swim_time'] ?? null,
            'distance' => $row['distance'] ?? null,
            'stroke' => $row['stroke'] ?? null,
            'event' => $row['event'] ?? null,
            'competition' => $row['competition'] ?? null,
            'date' => $row['meet_date'] ?? null
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
