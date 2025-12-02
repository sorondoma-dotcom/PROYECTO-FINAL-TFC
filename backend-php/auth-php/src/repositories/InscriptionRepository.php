<?php
namespace App\Repositories;

use App\Models\Inscription;
use PDO;

class InscriptionRepository
{
    public function __construct(private PDO $pdo) {}

    public function create(
        int $competicion_id,
        int $athlete_id,
        ?int $numero_dorsal = null,
        ?string $notas = null
    ): Inscription {
        $stmt = $this->pdo->prepare(
            'INSERT INTO inscripciones_atleticas 
            (competicion_id, athlete_id, numero_dorsal, notas)
            VALUES (?, ?, ?, ?)'
        );

        $stmt->execute([$competicion_id, $athlete_id, $numero_dorsal, $notas]);

        $id = (int) $this->pdo->lastInsertId();
        return $this->findById($id);
    }

    public function findById(int $id): ?Inscription
    {
        $stmt = $this->pdo->prepare('SELECT * FROM inscripciones_atleticas WHERE id = ?');
        $stmt->execute([$id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ? Inscription::fromArray($row) : null;
    }

    public function findByCompetition(int $competicion_id): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT ia.*, a.athlete_name, a.country_code, a.gender, a.image_url
            FROM inscripciones_atleticas ia
            JOIN atletas a ON ia.athlete_id = a.athlete_id
            WHERE ia.competicion_id = ?
            ORDER BY ia.inscrito_en DESC'
        );
        $stmt->execute([$competicion_id]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function findByAthleteAndCompetition(int $athlete_id, int $competicion_id): ?Inscription
    {
        $stmt = $this->pdo->prepare(
            'SELECT * FROM inscripciones_atleticas WHERE athlete_id = ? AND competicion_id = ?'
        );
        $stmt->execute([$athlete_id, $competicion_id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ? Inscription::fromArray($row) : null;
    }

    public function findUpcomingByAthlete(int $athlete_id): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT ia.id,
                    ia.competicion_id,
                    ia.estado_inscripcion,
                    ia.inscrito_en,
                    ia.confirmado_en,
                    c.nombre,
                    c.descripcion,
                    c.pais,
                    c.ciudad,
                    c.tipo_piscina,
                    c.fecha_inicio,
                    c.fecha_fin,
                    c.lugar_evento,
                    c.logo_path,
                    c.estado
             FROM inscripciones_atleticas ia
             INNER JOIN competiciones_agendadas c ON c.id = ia.competicion_id
                         WHERE ia.athlete_id = ?
                             AND (c.fecha_inicio IS NULL OR c.fecha_inicio >= NOW())
                         ORDER BY (c.fecha_inicio IS NULL) ASC, c.fecha_inicio ASC, ia.inscrito_en DESC'
        );
        $stmt->execute([$athlete_id]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    public function update(int $id, array $data): ?Inscription
    {
        $fields = [];
        $values = [];

        foreach ($data as $key => $value) {
            if (in_array($key, ['numero_dorsal', 'estado_inscripcion', 'notas', 'confirmado_en'])) {
                $fields[] = "{$key} = ?";
                $values[] = $value;
            }
        }

        if (empty($fields)) {
            return $this->findById($id);
        }

        $values[] = $id;
        $stmt = $this->pdo->prepare('UPDATE inscripciones_atleticas SET ' . implode(', ', $fields) . ' WHERE id = ?');
        $stmt->execute($values);

        return $this->findById($id);
    }

    public function delete(int $id): bool
    {
        $stmt = $this->pdo->prepare('DELETE FROM inscripciones_atleticas WHERE id = ?');
        return $stmt->execute([$id]);
    }

    public function deleteByCompetition(int $competicion_id): bool
    {
        $stmt = $this->pdo->prepare('DELETE FROM inscripciones_atleticas WHERE competicion_id = ?');
        return $stmt->execute([$competicion_id]);
    }

    public function countByCompetition(int $competicion_id, bool $onlyActive = false): int
    {
        if ($onlyActive) {
            $stmt = $this->pdo->prepare('SELECT COUNT(*) as count FROM inscripciones_atleticas WHERE competicion_id = ? AND estado_inscripcion != \'retirado\'');
        } else {
            $stmt = $this->pdo->prepare('SELECT COUNT(*) as count FROM inscripciones_atleticas WHERE competicion_id = ?');
        }
        $stmt->execute([$competicion_id]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        return (int) ($result['count'] ?? 0);
    }
}
