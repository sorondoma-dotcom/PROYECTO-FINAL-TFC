import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'countryFlag',
  standalone: true
})
export class CountryFlagPipe implements PipeTransform {
  private static readonly DEFAULT_FLAG = String.fromCodePoint(0x1F310);

  private readonly iso3ToIso2: Record<string, string> = {
    ARG: 'AR',
    AUS: 'AU',
    AUT: 'AT',
    BEL: 'BE',
    BGR: 'BG',
    BRA: 'BR',
    CAN: 'CA',
    CHE: 'CH',
    CHN: 'CN',
    COL: 'CO',
    CRO: 'HR',
    CZE: 'CZ',
    DEN: 'DK',
    ESP: 'ES',
    EST: 'EE',
    FIN: 'FI',
    FRA: 'FR',
    GBR: 'GB',
    GER: 'DE',
    GRC: 'GR',
    HKG: 'HK',
    HUN: 'HU',
    IND: 'IN',
    IRL: 'IE',
    ISL: 'IS',
    ISR: 'IL',
    ITA: 'IT',
    JPN: 'JP',
    KOR: 'KR',
    LTU: 'LT',
    LUX: 'LU',
    LVA: 'LV',
    MEX: 'MX',
    MKD: 'MK',
    MNE: 'ME',
    NED: 'NL',
    NOR: 'NO',
    NZL: 'NZ',
    POL: 'PL',
    POR: 'PT',
    ROU: 'RO',
    ROM: 'RO',
    RSA: 'ZA',
    RUS: 'RU',
    SLO: 'SI',
    SRB: 'RS',
    SUI: 'CH',
    SVK: 'SK',
    SVN: 'SI',
    SWE: 'SE',
    TUR: 'TR',
    UKR: 'UA',
    URY: 'UY',
    USA: 'US'
  };

  private readonly aliasToIso2: Record<string, string> = {
    ALEMANIA: 'DE',
    ALE: 'DE',
    ARGENTINA: 'AR',
    AUSTRALIA: 'AU',
    AUSTRIA: 'AT',
    BELGICA: 'BE',
    BELGIUM: 'BE',
    BRASIL: 'BR',
    BRAZIL: 'BR',
    CANADA: 'CA',
    CHINA: 'CN',
    COREADELSUR: 'KR',
    CROACIA: 'HR',
    CROATIA: 'HR',
    DINAMARCA: 'DK',
    DENMARK: 'DK',
    ESPANA: 'ES',
    SPAIN: 'ES',
    ESTONIA: 'EE',
    FINLANDIA: 'FI',
    FINLAND: 'FI',
    FRANCIA: 'FR',
    FRANCE: 'FR',
    GALES: 'GB',
    GREECE: 'GR',
    HONGKONG: 'HK',
    HUNGRIA: 'HU',
    HUNGARY: 'HU',
    INDIA: 'IN',
    IRLANDA: 'IE',
    IRELAND: 'IE',
    ISLANDIA: 'IS',
    ICELAND: 'IS',
    ITALIA: 'IT',
    ITALY: 'IT',
    JAPON: 'JP',
    JAPAN: 'JP',
    MACEDONIADELNORTE: 'MK',
    NORTHMACEDONIA: 'MK',
    MEXICO: 'MX',
    NUEVAZELANDA: 'NZ',
    NEWZEALAND: 'NZ',
    NORUEGA: 'NO',
    NORWAY: 'NO',
    PAISESBAJOS: 'NL',
    NETHERLANDS: 'NL',
    PORTUGAL: 'PT',
    RUMANIA: 'RO',
    ROMANIA: 'RO',
    SERBIA: 'RS',
    SOUTHAFRICA: 'ZA',
    SUDAFRICA: 'ZA',
    SUECIA: 'SE',
    SWEDEN: 'SE',
    SUIZA: 'CH',
    SWITZERLAND: 'CH',
    TURQUIA: 'TR',
    TURKEY: 'TR',
    UCRANIA: 'UA',
    UKRAINE: 'UA',
    UNITEDKINGDOM: 'GB',
    REINOUNIDO: 'GB',
    UNITEDSTATES: 'US',
    EEUU: 'US',
    ESTADOSUNIDOS: 'US'
  };

  transform(countryCode: string | null | undefined): string {
    if (!countryCode) return CountryFlagPipe.DEFAULT_FLAG;

    const isoCode = this.resolveIsoAlpha2(countryCode);
    if (!isoCode) {
      console.warn('Codigo de pais no reconocido: ' + countryCode);
      return CountryFlagPipe.DEFAULT_FLAG;
    }

    return this.isoToFlag(isoCode);
  }

  private resolveIsoAlpha2(rawValue: string): string | null {
    const trimmed = rawValue.trim();
    if (!trimmed) return null;

    const upper = trimmed.toUpperCase();
    if (/^[A-Z]{2}$/.test(upper)) {
      return upper;
    }

    if (/^[A-Z]{3}$/.test(upper)) {
      const iso = this.iso3ToIso2[upper];
      if (iso) return iso;
    }

    const normalized = this.normalizeForAlias(upper);
    if (normalized.length) {
      const iso = this.aliasToIso2[normalized];
      if (iso) return iso;
    }

    return null;
  }

  private normalizeForAlias(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Z]/g, '');
  }

  private isoToFlag(iso: string): string {
    if (!/^[A-Z]{2}$/.test(iso)) {
      console.warn('Codigo ISO invalido para bandera: ' + iso);
      return CountryFlagPipe.DEFAULT_FLAG;
    }

    const first = 0x1F1E6 + (iso.charCodeAt(0) - 65);
    const second = 0x1F1E6 + (iso.charCodeAt(1) - 65);
    return String.fromCodePoint(first, second);
  }
}
