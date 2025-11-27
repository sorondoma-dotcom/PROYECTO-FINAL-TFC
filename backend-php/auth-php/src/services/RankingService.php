<?php
namespace App\Services;

use App\Repositories\SwimmingRankingRepository;

class RankingService
{
    private const ALLOWED_GENDERS = ['M', 'F'];
    private const ALLOWED_DISTANCES = [50, 100, 200, 400, 800, 1500];
    private const ALLOWED_STROKES = [
        'BACKSTROKE',
        'BREASTSTROKE',
        'BUTTERFLY',
        'MEDLEY',
        'FREESTYLE',
        'FREESTYLE_RELAY',
        'MEDLEY_RELAY',
    ];
    private const ALLOWED_POOLS = ['LCM', 'SCM'];
    private const DEFAULT_LIMIT = 20;
    private const MAX_LIMIT = 500;

    public function __construct(private SwimmingRankingRepository $repository) {}

    public function getRankings(array $filters): array
    {
        $normalized = $this->normalizeFilters($filters);
        $limit = $normalized['limit'];
        $offset = $normalized['offset'];

        unset($normalized['limit'], $normalized['offset']);

        $result = $this->repository->findByFilters($normalized, $limit, $offset);

        return [
            'rankings' => array_map(static fn ($item) => $item->toArray(), $result['items']),
            'total' => $result['total'],
            'cachedLimit' => $result['total'],
            'limit' => $limit,
            'offset' => $offset,
            'filters' => [
                'gender' => $normalized['gender'],
                'distance' => $normalized['distance'],
                'stroke' => $normalized['stroke'],
                'poolConfiguration' => $normalized['poolConfiguration'],
                'year' => $normalized['year'] ?? null,
                'startDate' => $normalized['startDate'] ?? null,
                'endDate' => $normalized['endDate'] ?? null,
            ],
        ];
    }

    private function normalizeFilters(array $filters): array
    {
        $gender = strtoupper(trim((string) ($filters['gender'] ?? 'F')));
        if (!in_array($gender, self::ALLOWED_GENDERS, true)) {
            throw new \InvalidArgumentException('G��nero inv��lido. Usa M o F.');
        }

        $distance = isset($filters['distance']) ? (int) $filters['distance'] : 100;
        if (!in_array($distance, self::ALLOWED_DISTANCES, true)) {
            throw new \InvalidArgumentException('Distancia inv��lida. Usa 50, 100, 200, 400, 800 o 1500.');
        }

        $stroke = strtoupper(trim((string) ($filters['stroke'] ?? 'BACKSTROKE')));
        if (!in_array($stroke, self::ALLOWED_STROKES, true)) {
            throw new \InvalidArgumentException('Estilo inv��lido.');
        }

        $pool = strtoupper(trim((string) ($filters['poolConfiguration'] ?? 'LCM')));
        if (!in_array($pool, self::ALLOWED_POOLS, true)) {
            throw new \InvalidArgumentException('Configuraci��n de piscina inv��lida. Usa LCM o SCM.');
        }

        $limit = isset($filters['limit']) ? (int) $filters['limit'] : self::DEFAULT_LIMIT;
        if ($limit < 1 || $limit > self::MAX_LIMIT) {
            $limit = self::DEFAULT_LIMIT;
        }

        $offset = isset($filters['offset']) ? (int) $filters['offset'] : 0;
        if ($offset < 0) {
            $offset = 0;
        }

        $year = null;
        if (!empty($filters['year'])) {
            $year = (int) $filters['year'];
            if ($year < 1900 || $year > (int) date('Y') + 1) {
                throw new \InvalidArgumentException('A��o inv��lido para filtrar rankings.');
            }
        }

        $startDate = $this->normalizeDate($filters['startDate'] ?? null);
        $endDate = $this->normalizeDate($filters['endDate'] ?? null);

        return array_filter([
            'gender' => $gender,
            'distance' => $distance,
            'stroke' => $stroke,
            'poolConfiguration' => $pool,
            'year' => $year,
            'startDate' => $startDate,
            'endDate' => $endDate,
            'limit' => $limit,
            'offset' => $offset,
        ], static fn ($value) => $value !== null);
    }

    private function normalizeDate(mixed $value): ?string
    {
        if (!$value) {
            return null;
        }

        $date = \DateTimeImmutable::createFromFormat('Y-m-d', (string) $value);
        if (!$date) {
            throw new \InvalidArgumentException('Formato de fecha inv��lido. Usa YYYY-MM-DD.');
        }

        return $date->format('Y-m-d');
    }
}
