<?php
namespace App\Repositories;

use App\Models\SwimmingRanking;
use PDO;

class SwimmingRankingRepository
{
    private PDO $db;

    public function __construct()
    {
        $this->db = \getPDO();
    }

    /**
     * @return array{items: SwimmingRanking[], total: int}
     */
    public function findByFilters(array $filters, int $limit, int $offset = 0): array
    {
        [$where, $params] = $this->buildWhereClause($filters);

        $sql = "SELECT sr.*, 
                       a.athlete_name AS athlete_name_join,
                       a.age AS athlete_age,
                       a.gender AS athlete_gender,
                       a.country_code AS athlete_country_code,
                       a.image_url AS athlete_image_url,
                       a.athlete_profile_url AS athlete_profile_url_join
                FROM swimming_rankings sr
                INNER JOIN atletas a ON a.athlete_id = sr.athlete_id
                {$where}
                ORDER BY sr.overall_rank ASC
                LIMIT :limit OFFSET :offset";
        $stmt = $this->db->prepare($sql);

        foreach ($params as $key => $value) {
            $type = is_int($value) ? PDO::PARAM_INT : PDO::PARAM_STR;
            $stmt->bindValue(':' . $key, $value, $type);
        }
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);

        $stmt->execute();
        $rows = $stmt->fetchAll();
        $items = array_map(fn ($row) => SwimmingRanking::fromArray($row), $rows);

        $countSql = "SELECT COUNT(*) 
                     FROM swimming_rankings sr
                     INNER JOIN atletas a ON a.athlete_id = sr.athlete_id
                     {$where}";
        $countStmt = $this->db->prepare($countSql);
        foreach ($params as $key => $value) {
            $type = is_int($value) ? PDO::PARAM_INT : PDO::PARAM_STR;
            $countStmt->bindValue(':' . $key, $value, $type);
        }
        $countStmt->execute();
        $total = (int) $countStmt->fetchColumn();

        return [
            'items' => $items,
            'total' => $total,
        ];
    }

    /**
     * @return array{0: string, 1: array<string, string|int>}
     */
    private function buildWhereClause(array $filters): array
    {
        $where = [];
        $params = [];

        if (!empty($filters['gender'])) {
            $where[] = 'sr.gender = :gender';
            $params['gender'] = $filters['gender'];
        }

        if (!empty($filters['distance'])) {
            $where[] = 'sr.distance = :distance';
            $params['distance'] = (int) $filters['distance'];
        }

        if (!empty($filters['stroke'])) {
            $where[] = 'sr.stroke = :stroke';
            $params['stroke'] = $filters['stroke'];
        }

        if (!empty($filters['poolConfiguration'])) {
            $where[] = 'sr.pool_configuration = :poolConfiguration';
            $params['poolConfiguration'] = $filters['poolConfiguration'];
        }

        if (!empty($filters['year'])) {
            $where[] = 'YEAR(sr.race_date) = :year';
            $params['year'] = (int) $filters['year'];
        }

        if (!empty($filters['startDate'])) {
            $where[] = 'sr.race_date >= :startDate';
            $params['startDate'] = $filters['startDate'];
        }

        if (!empty($filters['endDate'])) {
            $where[] = 'sr.race_date <= :endDate';
            $params['endDate'] = $filters['endDate'];
        }

        $clause = $where ? 'WHERE ' . implode(' AND ', $where) : '';

        return [$clause, $params];
    }
}
