function pad2(value) {
  return String(value).padStart(2, "0");
}

export function getIsoWeek(date) {
  const tempDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = tempDate.getUTCDay() || 7;

  tempDate.setUTCDate(tempDate.getUTCDate() + 4 - dayNum);

  const yearStart = new Date(Date.UTC(tempDate.getUTCFullYear(), 0, 1));

  return Math.ceil((((tempDate - yearStart) / 86400000) + 1) / 7);
}

export function parseFechaReporte(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const texto = String(value).trim();

  if (!texto || texto === "-") {
    return null;
  }

  const match = texto.match(/^(\d{2})\/(\d{2})\/(\d{2})-(\d{2}):(\d{2})$/);

  if (!match) {
    return null;
  }

  const [, dd, mm, yy, hh, min] = match;

  const year = 2000 + Number(yy);
  const monthIndex = Number(mm) - 1;

  const date = new Date(year, monthIndex, Number(dd), Number(hh), Number(min), 0);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const fecha = `${year}-${pad2(Number(mm))}-${pad2(Number(dd))}`;
  const fechaHora = `${fecha} ${pad2(Number(hh))}:${pad2(Number(min))}:00`;

  return {
    fechaHora,
    fecha,
    semana: getIsoWeek(date),
    mes: Number(mm),
    anio: year
  };
}