/** What the server accepts: PDF, JPG, or PNG up to 10 MB (backend config/record_requests.php). */
export const MAX_UPLOAD_MB = 10
const ACCEPTED = /\.(pdf|jpe?g|png)$/i

/** A problem with the chosen file, or undefined when it can be uploaded. The server checks again. */
export function fileProblem(file: File) {
  if (!ACCEPTED.test(file.name)) return 'Upload a PDF, JPG, or PNG file.'
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) return `The file is too large. The limit is ${MAX_UPLOAD_MB} MB.`
  return undefined
}
