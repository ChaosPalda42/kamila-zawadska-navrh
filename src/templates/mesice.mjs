/* Jména měsíců. Potřebuje je nadpis mřížky v kalendáři i list stolního
   kalendáře v liště aktualit, a to jsou dvě různé šablony — proto zvlášť,
   ne dvakrát opsaná. */

const MESICE_CS = ["leden", "únor", "březen", "duben", "květen", "červen",
  "červenec", "srpen", "září", "říjen", "listopad", "prosinec"];
const MESICE_EN = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

export function mesicJmeno(mesicCislo, jazyk) {
  const jmena = jazyk === "en" ? MESICE_EN : MESICE_CS;
  return jmena[mesicCislo - 1] || "";
}

export function nazevMesice(rok, mesicCislo, jazyk) {
  return `${mesicJmeno(mesicCislo, jazyk)} ${rok}`;
}
