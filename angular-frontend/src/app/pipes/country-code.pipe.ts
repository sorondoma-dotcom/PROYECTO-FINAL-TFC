import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'countryCode',
  standalone: true
})
export class CountryCodePipe implements PipeTransform {

  /**
   * Extrae el código de país de una ciudad si está presente
   * Formato esperado: "Barcelona (ESP)" o "París, FRA"
   * @param city Nombre de la ciudad con código de país
   * @returns Código del país o null si no se encuentra
   */
  transform(city: string | null | undefined): string | null {
    if (!city) return null;

    // Buscar código entre paréntesis: "Barcelona (ESP)"
    const parenthesisMatch = city.match(/\(([A-Z]{2,3})\)/);
    if (parenthesisMatch) return parenthesisMatch[1];

    // Buscar código después de coma: "París, FRA"
    const commaMatch = city.match(/,\s*([A-Z]{2,3})$/);
    if (commaMatch) return commaMatch[1];

    return null;
  }
}
