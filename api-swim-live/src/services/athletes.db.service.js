const createPool = require('../../lib/mysql');

const pool = createPool();

/**
 * Obtiene atletas desde la tabla `athletes` con filtros simples y paginación.
 * @param {{limit?:number, offset?:number, gender?:string, country?:string, name?:string}} filters
 */
async function fetchAthletesFromDb(filters = {}) {
  const limit = Number.isFinite(filters.limit) ? Math.min(Math.max(filters.limit, 1), 200) : 50;
  const offset = Number.isFinite(filters.offset) ? Math.max(filters.offset, 0) : 0;

  const params = [];
  const where = [];

  if (filters.gender) {
    where.push('gender = ?');
    params.push(filters.gender.toUpperCase());
  }

  if (filters.country) {
    where.push('country = ?');
    params.push(filters.country.toUpperCase());
  }

  if (filters.name) {
    where.push('name LIKE ?');
    params.push(`%${filters.name}%`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [rows] = await pool.query(
    `SELECT name, country, gender, birth_year, image_url AS imageUrl, profile_url AS profileUrl, slug
     FROM athletes
     ${whereSql}
     ORDER BY name ASC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM athletes ${whereSql}`,
    params
  );

  return {
    success: true,
    total,
    limit,
    offset,
    data: rows,
  };
}

module.exports = {
  fetchAthletesFromDb,
};
