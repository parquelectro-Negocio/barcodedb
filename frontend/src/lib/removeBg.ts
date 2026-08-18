// Client-side background removal (free, on-device). The library + its ~24MB
// WASM model are loaded LAZILY (dynamic import) only when this runs, so they
// never weigh down normal page loads. The model is cached after first use.
export async function stripBackground(file: File): Promise<File> {
  const { removeBackground } = await import('@imgly/background-removal');
  const blob = await removeBackground(file);
  const name = file.name.replace(/\.[^.]+$/, '') + '-nobg.png';
  return new File([blob], name, { type: 'image/png' });
}
