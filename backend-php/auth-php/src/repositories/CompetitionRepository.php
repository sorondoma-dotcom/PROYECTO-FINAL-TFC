<?php
namespace App\Repositories;

use App\Models\Competition;
use PDO;

class CompetitionRepository
{
    public function __construct(private PDO $pdo) {}

    public function create(
        string $nombre,
        ?string $descripcion,
        ?string $pais,
        ?string $ciudad,
        string $tipo_piscina,
        string $fecha_inicio,
        ?string $fecha_fin,
        ?string $lugar_evento,
        string $logo_path,
        ?int $creada_por
    ): Competition {
        $stmt = $this->pdo->prepare(
            'INSERT INTO competiciones_agendadas 
            (nombre, descripcion, pais, ciudad, tipo_piscina, fecha_inicio, fecha_fin, lugar_evento, logo_path, creada_por)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );

        $stmt->execute([
            $nombre, $descripcion, $pais, $ciudad, $tipo_piscina,
            $fecha_inicio, $fecha_fin, $lugar_evento, $logo_path, $creada_por
        ]);

        $id = (int) $this->pdo->lastInsertId();
        return $this->findById($id);
    }

    public function findById(int $id): ?Competition
    {
        $stmt = $this->pdo->prepare('SELECT * FROM competiciones_agendadas WHERE id = ?');
        $stmt->execute([$id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ? Competition::fromArray($row) : null;
    }

    public function findAll(string $orderBy = 'fecha_inicio', string $order = 'DESC'): array
    {
        $stmt = $this->pdo->query(
            "SELECT * FROM competiciones_agendadas ORDER BY {$orderBy} {$order}"
        );
        return array_map(
            fn($row) => Competition::fromArray($row),
            $stmt->fetchAll(PDO::FETCH_ASSOC)
        );
    }

    public function findByStatus(string $estado): array
    {
        $stmt = $this->pdo->prepare('SELECT * FROM competiciones_agendadas WHERE estado = ? ORDER BY fecha_inicio DESC');
        $stmt->execute([$estado]);
        return array_map(
            fn($row) => Competition::fromArray($row),
            $stmt->fetchAll(PDO::FETCH_ASSOC)
        );
    }

    public function update(int $id, array $data): ?Competition
    {
        $fields = [];
        $values = [];

        foreach ($data as $key => $value) {
            if (in_array($key, ['nombre', 'descripcion', 'pais', 'ciudad', 'tipo_piscina', 'fecha_inicio', 'fecha_fin', 'lugar_evento', 'logo_path', 'estado'])) {
                $fields[] = "{$key} = ?";
                $values[] = $value;
            }
        }

        if (empty($fields)) {
            return $this->findById($id);
        }

        $values[] = $id;
        $stmt = $this->pdo->prepare('UPDATE competiciones_agendadas SET ' . implode(', ', $fields) . ' WHERE id = ?');
        $stmt->execute($values);

        return $this->findById($id);
    }

    public function delete(int $id): bool
    {
        $stmt = $this->pdo->prepare('DELETE FROM competiciones_agendadas WHERE id = ?');
        return $stmt->execute([$id]);
    }

    public function findByNombre(string $nombre): ?Competition
    {
        $stmt = $this->pdo->prepare('SELECT * FROM competiciones_agendadas WHERE nombre = ?');
        $stmt->execute([$nombre]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ? Competition::fromArray($row) : null;
    }
}
