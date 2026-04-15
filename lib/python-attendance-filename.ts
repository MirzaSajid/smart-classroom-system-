/** Matches `program.py` naming: roll + underscore + slugified name. */
export function slugForPythonFilename(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "") || "student"
  )
}
