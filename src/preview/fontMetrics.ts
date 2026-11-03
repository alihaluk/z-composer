// Advance widths of the printer's ^A0 font (CG Triumvirate Bold Condensed) as a fraction of
// the character height, measured in the Labelary emulator at 8 dots/mm (docs/SCOPE.md D7).
// Accented capitals use their base letter (the emulator draws them incorrectly), and symbols
// the emulator draws with a substitute glyph (- + = < > ~ @ %) are left out on purpose:
// characters without an entry are measured with the preview font instead.
export const A0_ADVANCE: Record<string, number> = {
  " ": 0.295,
  "!": 0.295,
  "\"": 0.478,
  "#": 0.478,
  "$": 0.478,
  "&": 0.608,
  "'": 0.295,
  "(": 0.295,
  ")": 0.295,
  "*": 0.478,
  ",": 0.295,
  ".": 0.295,
  "/": 0.295,
  "0": 0.478,
  "1": 0.478,
  "2": 0.478,
  "3": 0.478,
  "4": 0.478,
  "5": 0.478,
  "6": 0.478,
  "7": 0.478,
  "8": 0.478,
  "9": 0.478,
  ":": 0.295,
  ";": 0.295,
  "?": 0.443,
  "A": 0.553,
  "B": 0.553,
  "C": 0.535,
  "D": 0.59,
  "E": 0.5,
  "F": 0.5,
  "G": 0.59,
  "H": 0.608,
  "I": 0.277,
  "J": 0.443,
  "K": 0.553,
  "L": 0.478,
  "M": 0.755,
  "N": 0.608,
  "O": 0.573,
  "P": 0.553,
  "Q": 0.573,
  "R": 0.59,
  "S": 0.535,
  "T": 0.5,
  "U": 0.608,
  "V": 0.535,
  "W": 0.813,
  "X": 0.553,
  "Y": 0.553,
  "Z": 0.5,
  "[": 0.295,
  "]": 0.295,
  "_": 0.5,
  "a": 0.46,
  "b": 0.5,
  "c": 0.443,
  "d": 0.5,
  "e": 0.478,
  "f": 0.277,
  "g": 0.5,
  "h": 0.5,
  "i": 0.258,
  "j": 0.258,
  "k": 0.443,
  "l": 0.258,
  "m": 0.755,
  "n": 0.5,
  "o": 0.478,
  "p": 0.5,
  "q": 0.5,
  "r": 0.33,
  "s": 0.423,
  "t": 0.277,
  "u": 0.5,
  "v": 0.443,
  "w": 0.665,
  "x": 0.443,
  "y": 0.443,
  "z": 0.388,
  "Â": 0.553,
  "Ç": 0.535,
  "Î": 0.277,
  "Ö": 0.573,
  "Û": 0.608,
  "Ü": 0.608,
  "â": 0.46,
  "ç": 0.443,
  "î": 0.258,
  "ö": 0.478,
  "û": 0.5,
  "ü": 0.5,
  "Ğ": 0.59,
  "ğ": 0.5,
  "İ": 0.277,
  "ı": 0.258,
  "Ş": 0.535,
  "ş": 0.423,
  "€": 0.478,
};

/** Width in dots of a text in ^A0 at height h and width w, or null for a character without data. */
export function a0Width(text: string, height: number, width = height): number | null {
  let sum = 0;
  for (const c of text) {
    const advance = A0_ADVANCE[c];
    if (advance === undefined) return null;
    sum += advance;
  }
  return sum * width;
}

/** Average advance of the letters and digits, for estimating characters per line. */
export const A0_AVERAGE_ADVANCE = (() => {
  const letters = Object.entries(A0_ADVANCE).filter(([c]) => /[\p{L}\p{N}]/u.test(c)).map(([, v]) => v);
  return letters.reduce((a, b) => a + b, 0) / letters.length;
})();
