<?php
namespace App\Models;

class Competition
{
    public int $id;
    public string $nombre;
    public ?string $descripcion;
    public ?string $pais;
    public ?string $ciudad;
    public string $tipo_piscina; // '25m' o '50m'
    public string $fecha_inicio;
    public ?string $fecha_fin;
    public ?string $lugar_evento;
    public ?int $creada_por;
    public string $estado; // pendiente, en_curso, finalizada, cancelada
    public string $created_at;
    public string $updated_at;

    public static function fromArray(array $row): self
    {
        $comp = new self();
        $comp->id = (int) $row['id'];
        $comp->nombre = $row['nombre'];
        $comp->descripcion = $row['descripcion'] ?? null;
        $comp->pais = $row['pais'] ?? null;
        $comp->ciudad = $row['ciudad'] ?? null;
        $comp->tipo_piscina = $row['tipo_piscina'] ?? '50m';
        $comp->fecha_inicio = $row['fecha_inicio'];
        $comp->fecha_fin = $row['fecha_fin'] ?? null;
        $comp->lugar_evento = $row['lugar_evento'] ?? null;
        $comp->creada_por = isset($row['creada_por']) ? (int) $row['creada_por'] : null;
        $comp->estado = $row['estado'] ?? 'pendiente';
        $comp->created_at = $row['created_at'];
        $comp->updated_at = $row['updated_at'];
        return $comp;
    }

    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'nombre' => $this->nombre,
            'descripcion' => $this->descripcion,
            'pais' => $this->pais,
            'ciudad' => $this->ciudad,
            'tipo_piscina' => $this->tipo_piscina,
            'fecha_inicio' => $this->fecha_inicio,
            'fecha_fin' => $this->fecha_fin,
            'lugar_evento' => $this->lugar_evento,
            'creada_por' => $this->creada_por,
            'estado' => $this->estado,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at
        ];
    }
}
