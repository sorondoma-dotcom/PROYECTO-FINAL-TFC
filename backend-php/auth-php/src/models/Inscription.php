<?php
namespace App\Models;

class Inscription
{
    public int $id;
    public int $competicion_id;
    public int $athlete_id;
    public ?int $numero_dorsal;
    public string $estado_inscripcion; // inscrito, confirmado, retirado, descalificado
    public ?string $notas;
    public string $inscrito_en;
    public ?string $confirmado_en;

    public static function fromArray(array $row): self
    {
        $insc = new self();
        $insc->id = (int) $row['id'];
        $insc->competicion_id = (int) $row['competicion_id'];
        $insc->athlete_id = (int) $row['athlete_id'];
        $insc->numero_dorsal = isset($row['numero_dorsal']) ? (int) $row['numero_dorsal'] : null;
        $insc->estado_inscripcion = $row['estado_inscripcion'] ?? 'inscrito';
        $insc->notas = $row['notas'] ?? null;
        $insc->inscrito_en = $row['inscrito_en'];
        $insc->confirmado_en = $row['confirmado_en'] ?? null;
        return $insc;
    }

    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'competicion_id' => $this->competicion_id,
            'athlete_id' => $this->athlete_id,
            'numero_dorsal' => $this->numero_dorsal,
            'estado_inscripcion' => $this->estado_inscripcion,
            'notas' => $this->notas,
            'inscrito_en' => $this->inscrito_en,
            'confirmado_en' => $this->confirmado_en
        ];
    }
}
