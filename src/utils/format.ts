export const capitalize = (text: string) => {
  return text.charAt(0).toUpperCase() + text.slice(1);
};

// "midi-dress" → "Midi Dress"
export const toTitle = (text: string) => {
  return text.split("-").map(capitalize).join(" ");
};

// "midi-dress" → "MIDI DRESS"
export const toUpperLabel = (text: string) => {
  return text.replace(/-/g, " ").toUpperCase();
};

// ["fall", "winter"] → "Fall / Winter"
export const joinTitles = (values: readonly string[], separator = " / ") => {
  return values.map(toTitle).join(separator);
};

// { color: "brown", subCategory: "blazer" } → "Brown Blazer"
export const getClothingName = (clothing: {
  color: string;
  subCategory: string;
}) => {
  return `${toTitle(clothing.color)} ${toTitle(clothing.subCategory)}`;
};
