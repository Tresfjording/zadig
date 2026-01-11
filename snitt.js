const { gyldige } = require("./main");

export const snitt = gyldige.reduce((a, b) => a + b, 0) / gyldige.length;
