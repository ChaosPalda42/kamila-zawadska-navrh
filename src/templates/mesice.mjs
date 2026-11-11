/* Month names. The calendar grid's heading needs them and so does the desk
   calendar leaf in the news bar, and those are two different templates --
   hence a module of their own instead of the same list written twice. */

const MONTHS_CS = ["leden", "únor", "březen", "duben", "květen", "červen",
  "červenec", "srpen", "září", "říjen", "listopad", "prosinec"];
const MONTHS_EN = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

export function mesicJmeno(mesicCislo, language) {
  const names = language === "en" ? MONTHS_EN : MONTHS_CS;
  return names[mesicCislo - 1] || "";
}

export function nazevMesice(year, mesicCislo, language) {
  return `${mesicJmeno(mesicCislo, language)} ${year}`;
}
