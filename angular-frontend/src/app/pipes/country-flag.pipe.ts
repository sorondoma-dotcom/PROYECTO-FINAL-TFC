import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'countryFlag',
  standalone: true
})
export class CountryFlagPipe implements PipeTransform {

  // Mapeo de códigos de país de 3 letras (IOC) a códigos ISO alpha-2 para banderas
  private countryCodeMap: { [key: string]: string } = {
    // Países más comunes en natación
    'ESP': 'ES', 'ESPAÑA': 'ES', 'SPAIN': 'ES',
    'FRA': 'FR', 'FRANCIA': 'FR', 'FRANCE': 'FR',
    'USA': 'US', 'EEUU': 'US', 'UNITED STATES': 'US',
    'GBR': 'GB', 'UK': 'GB', 'REINO UNIDO': 'GB', 'UNITED KINGDOM': 'GB',
    'ITA': 'IT', 'ITALIA': 'IT', 'ITALY': 'IT',
    'GER': 'DE', 'ALE': 'DE', 'ALEMANIA': 'DE', 'GERMANY': 'DE',
    'POR': 'PT', 'PORTUGAL': 'PT',
    'NED': 'NL', 'HOLANDA': 'NL', 'NETHERLANDS': 'NL', 'PAÍSES BAJOS': 'NL',
    'BEL': 'BE', 'BÉLGICA': 'BE', 'BELGIUM': 'BE',
    'SUI': 'CH', 'SUIZA': 'CH', 'SWITZERLAND': 'CH',
    'AUS': 'AU', 'AUSTRALIA': 'AU',
    'CAN': 'CA', 'CANADÁ': 'CA', 'CANADA': 'CA',
    'JPN': 'JP', 'JAPÓN': 'JP', 'JAPAN': 'JP',
    'CHN': 'CN', 'CHINA': 'CN',
    'BRA': 'BR', 'BRASIL': 'BR', 'BRAZIL': 'BR',
    'ARG': 'AR', 'ARGENTINA': 'AR',
    'MEX': 'MX', 'MÉXICO': 'MX', 'MEXICO': 'MX',
    'RUS': 'RU', 'RUSIA': 'RU', 'RUSSIA': 'RU',
    'SWE': 'SE', 'SUECIA': 'SE', 'SWEDEN': 'SE',
    'NOR': 'NO', 'NORUEGA': 'NO', 'NORWAY': 'NO',
    'DEN': 'DK', 'DIN': 'DK', 'DINAMARCA': 'DK', 'DENMARK': 'DK',
    'FIN': 'FI', 'FINLANDIA': 'FI', 'FINLAND': 'FI',
    'POL': 'PL', 'POLONIA': 'PL', 'POLAND': 'PL',
    'HUN': 'HU', 'HUNGRÍA': 'HU', 'HUNGARY': 'HU',
    'CZE': 'CZ', 'CHEQUIA': 'CZ', 'CZECH REPUBLIC': 'CZ',
    'AUT': 'AT', 'AUSTRIA': 'AT',
    'GRE': 'GR', 'GRECIA': 'GR', 'GREECE': 'GR',
    'TUR': 'TR', 'TURQUÍA': 'TR', 'TURKEY': 'TR',
    'RSA': 'ZA', 'SUDÁFRICA': 'ZA', 'SOUTH AFRICA': 'ZA',
    'NZL': 'NZ', 'NUEVA ZELANDA': 'NZ', 'NEW ZEALAND': 'NZ',
    'KOR': 'KR', 'COREA': 'KR', 'SOUTH KOREA': 'KR',
    'IND': 'IN', 'INDIA': 'IN',
    'IRL': 'IE', 'IRLANDA': 'IE', 'IRELAND': 'IE',
    'SCO': 'GB', 'ESCOCIA': 'GB', 'SCOTLAND': 'GB',
    'WAL': 'GB', 'GALES': 'GB', 'WALES': 'GB',
    'ROM': 'RO', 'RUMANIA': 'RO', 'ROMANIA': 'RO',
    'UKR': 'UA', 'UCRANIA': 'UA', 'UKRAINE': 'UA',
    'SRB': 'RS', 'SERBIA': 'RS',
    'CRO': 'HR', 'CROACIA': 'HR', 'CROATIA': 'HR',
    'SVK': 'SK', 'ESLOVAQUIA': 'SK', 'SLOVAKIA': 'SK',
    'SVN': 'SI', 'ESLOVENIA': 'SI', 'SLOVENIA': 'SI',
    'BUL': 'BG', 'BULGARIA': 'BG',
    'ISL': 'IS', 'ISLANDIA': 'IS', 'ICELAND': 'IS',
    'LTU': 'LT', 'LITUANIA': 'LT', 'LITHUANIA': 'LT',
    'LAT': 'LV', 'LET': 'LV', 'LETONIA': 'LV', 'LATVIA': 'LV',
    'EST': 'EE', 'ESTONIA': 'EE'
  };

  /**
   * Transforma un código de país en un emoji de bandera
   * @param countryCode Código del país (ej: "NED", "ESP", "FRA")
   * @returns Emoji de la bandera del país
   */
  transform(countryCode: string | null | undefined): string {
    if (!countryCode) return '🌍';

    const normalized = countryCode.toUpperCase().trim();
    
    // Primero intentar encontrar en el mapa
    let isoCode = this.countryCodeMap[normalized];
    
    // Si no está en el mapa y ya es de 2 caracteres, usarlo directamente
    if (!isoCode && normalized.length === 2) {
      isoCode = normalized;
    }
    
    // Si no tenemos código ISO, retornar mundo
    if (!isoCode) {
      console.warn(`Código de país no reconocido: ${countryCode}`);
      return '🌍';
    }

    // Convertir código ISO alpha-2 a emoji de bandera
    // Los emojis de banderas son combinaciones de Regional Indicator Symbols
    // La fórmula correcta es: 0x1F1E6 + (charCode - 65)
    if (isoCode.length === 2) {
      const first = isoCode.charCodeAt(0);
      const second = isoCode.charCodeAt(1);
      
      // Validar que sean letras mayúsculas (A=65, Z=90)
      if (first < 65 || first > 90 || second < 65 || second > 90) {
        console.warn(`Código ISO inválido: ${isoCode}`);
        return '🌍';
      }

      // Convertir a Regional Indicator Symbols
      const firstSymbol = 0x1F1E6 + (first - 65);
      const secondSymbol = 0x1F1E6 + (second - 65);
      
      return String.fromCodePoint(firstSymbol, secondSymbol);
    }

    return '🌍'; // Emoji por defecto si no se encuentra
  }
}