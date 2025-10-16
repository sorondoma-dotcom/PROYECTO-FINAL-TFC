import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'cityName',
  standalone: true
})
export class CityNamePipe implements PipeTransform {

  /**
   * Retorna solo el nombre de la ciudad sin el código del país
   * @param city Nombre de la ciudad con código de país (ej: "Barcelona (ESP)")
   * @returns Nombre limpio de la ciudad (ej: "Barcelona")
   */
  transform(city: string | null | undefined): string {
    if (!city) return '';

    // Eliminar código entre paréntesis
    let cleanCity = city.replace(/\s*\([A-Z]{2,3}\)\s*/g, '');

    // Eliminar código después de coma
    cleanCity = cleanCity.replace(/,\s*[A-Z]{2,3}$/g, '');

    return cleanCity.trim();
  }
}
