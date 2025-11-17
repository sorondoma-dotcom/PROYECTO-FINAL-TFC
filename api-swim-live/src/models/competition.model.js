class CompetitionSummary {
  constructor({ id, date, course, city, name, urlResultados, hasResults }) {
    this.id = id || '';
    this.date = date || '';
    this.course = course || '';
    this.city = city || '';
    this.name = name || '';
    this.urlResultados = urlResultados || undefined;
    this.hasResults = Boolean(hasResults);
  }

  static fromListing(raw = {}) {
    return new CompetitionSummary(raw);
  }

  toJSON() {
    return {
      id: this.id,
      date: this.date,
      course: this.course,
      city: this.city,
      name: this.name,
      urlResultados: this.urlResultados,
      hasResults: this.hasResults
    };
  }
}

class PdfLink {
  constructor({ texto, url, file, tipo, index }) {
    this.texto = texto || '';
    this.url = url || '';
    this.file = file || '';
    this.tipo = tipo;
    this.index = index;
  }

  toJSON() {
    return {
      texto: this.texto,
      url: this.url,
      file: this.file,
      tipo: this.tipo,
      index: this.index
    };
  }
}

class EventItem {
  constructor({ distancia, tipo, categoria, hora, info, pdfSalidas = [], pdfResultados = [] }) {
    this.distancia = distancia || '';
    this.tipo = tipo || '';
    this.categoria = categoria || '';
    this.hora = hora || '';
    this.info = info || '';
    this.pdfSalidas = pdfSalidas.map((link) => (link instanceof PdfLink ? link : new PdfLink(link)));
    this.pdfResultados = pdfResultados.map((link) => (link instanceof PdfLink ? link : new PdfLink(link)));
  }

  toJSON() {
    return {
      distancia: this.distancia,
      tipo: this.tipo,
      categoria: this.categoria,
      hora: this.hora,
      info: this.info,
      pdfSalidas: this.pdfSalidas.map((link) => link.toJSON()),
      pdfResultados: this.pdfResultados.map((link) => link.toJSON())
    };
  }
}

class EventSchedule {
  constructor({ estilo, masculino = [], femenino = [] }) {
    this.estilo = estilo || '';
    this.masculino = masculino.map((item) => (item instanceof EventItem ? item : new EventItem(item)));
    this.femenino = femenino.map((item) => (item instanceof EventItem ? item : new EventItem(item)));
  }

  toJSON() {
    return {
      estilo: this.estilo,
      masculino: this.masculino.map((item) => item.toJSON()),
      femenino: this.femenino.map((item) => item.toJSON())
    };
  }
}

class CompetitionDetail {
  constructor({ infoCompeticion = {}, eventosPorEstilo = [] }) {
    this.infoCompeticion = {
      titulo: infoCompeticion.titulo || '',
      subtitulo: infoCompeticion.subtitulo || '',
      fecha: infoCompeticion.fecha || '',
      ciudad: infoCompeticion.ciudad || ''
    };
    this.eventosPorEstilo = eventosPorEstilo.map((item) =>
      item instanceof EventSchedule ? item : new EventSchedule(item)
    );
  }

  toJSON() {
    return {
      infoCompeticion: this.infoCompeticion,
      eventosPorEstilo: this.eventosPorEstilo.map((item) => item.toJSON())
    };
  }
}

module.exports = {
  CompetitionSummary,
  CompetitionDetail,
  EventItem,
  EventSchedule,
  PdfLink
};
