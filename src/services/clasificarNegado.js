export function clasificarNegado({ aSurtir, aDeber, inventarioAnterior }) {
  const surtir = Number(aSurtir || 0);
  const deber = Number(aDeber || 0);

  if (inventarioAnterior === null || inventarioAnterior === undefined || Number.isNaN(Number(inventarioAnterior))) {
    return "SIN_DATO_INVENTARIO";
  }

  const inventario = Number(inventarioAnterior);

  if (deber <= 0) {
    return "SIN_NEGADO";
  }

  if (inventario >= surtir) {
    return "CON_EXISTENCIA_SUFICIENTE";
  }

  if (inventario > 0 && inventario < surtir) {
    return "EXISTENCIA_PARCIAL_INSUFICIENTE";
  }

  return "SIN_EXISTENCIA";
}