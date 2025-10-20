import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'cityName',
  standalone: true
})
export class CityNamePipe implements PipeTransform {

  /**
   * Retorna solo el nombre de la ciudad sin el código del país
   * @param city Nombre de la ciudad con código de país (ej: "Arnhem (NED)")
   * @returns Nombre limpio de la ciudad (ej: "Arnhem")
   */
  transform(city: string | null | undefined): string {
    if (!city) return '';

    // Eliminar código entre paréntesis: "Arnhem (NED)" -> "Arnhem"
    let cleanCity = city.replace(/\s*\([A-Z]{2,3}\)\s*/gi, '');

    // Eliminar código después de coma: "París, FRA" -> "París"
    cleanCity = cleanCity.replace(/,\s*[A-Z]{2,3}$/gi, '');

    // Eliminar código al final sin paréntesis: "Arnhem NED" -> "Arnhem"
    cleanCity = cleanCity.replace(/\s+[A-Z]{2,3}$/gi, '');

    return cleanCity.trim();
  }
}
