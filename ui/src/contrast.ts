export type Rgb = readonly [number, number, number]

export function parseHex(hex: string): Rgb {
  const digits = hex.replace('#', '')
  return [0, 2, 4].map((start) => parseInt(digits.slice(start, start + 2), 16)) as unknown as Rgb
}

export function mixOver(foreground: Rgb, background: Rgb, alpha: number): Rgb {
  return foreground.map((channel, i) => Math.round(channel * alpha + background[i] * (1 - alpha))) as unknown as Rgb
}

function luminance([red, green, blue]: Rgb): number {
  const [r, g, b] = [red, green, blue].map((channel) => {
    const value = channel / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(first: Rgb, second: Rgb): number {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a)
  return (lighter + 0.05) / (darker + 0.05)
}
