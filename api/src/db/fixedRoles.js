const { normalizeRoleName } = require("../utils/normalize");

const FIXED_ROLES = [
  {
    lineName: "LÍNEA DE TZ ONE PIECE",
    cargoName: "Operador de colaje Mecanizado PS",
    areaName: "COLAJE",
    roleName: "Operador de colaje Mecanizado One Piece",
  },
  {
    lineName: "LÍNEA DE TZ ONE PIECE",
    cargoName: "Operador de colaje Mecanizado PS",
    areaName: "COLAJE",
    roleName: "Ayudante de One Piece",
  },
  {
    lineName: "LÍNEA DE TZ ONE PIECE",
    cargoName: "Pulidor de piezas PS",
    areaName: "TERMINADOS",
    roleName: "Pulidor de pieza One Piece",
  },
  {
    lineName: "LÍNEA DE TZ ONE PIECE",
    cargoName: "Pulidor de piezas PS",
    areaName: "TERMINADOS",
    roleName: "Cargador de Tazas",
  },
  {
    lineName: "LÍNEA DE TZ ONE PIECE",
    cargoName: "Clasificador de piezas PS",
    areaName: "CLASIFICACIÓN FINAL",
    roleName: "Clasificador de pieza One Piece",
  },
].map((role) => ({
  ...role,
  normalizedName: normalizeRoleName(role.roleName),
}));

module.exports = {
  FIXED_ROLES,
};
