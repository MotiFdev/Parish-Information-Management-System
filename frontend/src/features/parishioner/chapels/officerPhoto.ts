/** Up to two initials for an officer without a picture, e.g. "Juan Dela Cruz" → "JD". */
export const initials = (name: string) => {
  const caps = name
    .split(' ')
    .filter((w) => /^[A-Z]/.test(w))
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
  return caps || name.trim().charAt(0).toUpperCase()
}
