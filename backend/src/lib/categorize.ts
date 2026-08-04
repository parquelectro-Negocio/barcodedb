// Auto-categorization by product name. Ordered rules, most specific first —
// returns the first matching category slug, or null. Single source of truth,
// run at product creation time (import + manual) so categorization scales to
// however many products get added later. Refine the rules here, not in SQL.

const RULES: ReadonlyArray<readonly [string, RegExp]> = [
  ['consumibles',       /cartucho|cart\.|cartridge|toner|inkjet|botella de tinta|\btinta\b|\bink\b|laserjet|designjet|print crtg/i],
  ['proyectores',       /proyector|\bepiq\b|power ?lite/i],
  ['impresoras',        /impresora|plotter|\bprinter\b|epson l\d|ecotank|deskjet|multifunci/i],
  ['placas-de-video',   /\bvga\b|radeon|geforce|\brtx\b|\bgtx\b|\brx ?\d{3}|placa de ?video/i],
  ['microprocesadores', /procesador|\bcpu\b|ryzen|core i[3-9]|intel core|pentium|celeron|\bathlon\b|\bapu\b/i],
  ['mothers',           /motherboard|\bmother\b|\bam4\b|\bam5\b|\blga1\d{3}|\bb[5-8]\d0\b|\ba520\b|\bh[4-8]10\b|\bz[67]90\b|chipset/i],
  ['memorias-ram',      /memoria (pc )?ddr|\bddr[345]\b|\bsodimm\b|memoria ram/i],
  ['almacenamiento',    /\bssd\b|\bhdd\b|pen ?drive|micro ?sd|\bnvme\b|disco (rigido|solido|externo|interno|ssd)|tarjeta (de )?memoria/i],
  ['coolers',           /cooler|\bfan\b|ventilador|water ?cool|disipador|refrigeracion/i],
  ['fuentes',           /\bfuente\b|\bpsu\b/i],
  ['gabinetes',         /gabinete/i],
  ['monitores',         /\bmonitor\b/i],
  ['notebooks',         /notebook|\blaptop\b/i],
  ['computadoras',      /computadora|mini ?pc|pc desktop|\bdesktop\b|barebone|all.in.one|pc kit|kit pc|thinkcentre|\bpc kelyx/i],
  ['consolas',          /consola|playstation|\bxbox\b|nintendo|\bps[45]\b/i],
  ['joysticks',         /joystick|gamepad|\bmando\b|volante gamer|silla gamer/i],
  ['pilas-baterias',    /\bpilas?\b|bateria|batería|pack de bateria/i],
  ['energia',           /\bups\b|estabilizador|prolongador|zapatilla el/i],
  ['conectividad',      /router|\bswitch|access point|\bwifi\b|repetidor|\bhub\b|antena|placa de red|adaptador|\bcable\b|conversor|\bpatch\b|\brj45\b|\barcher\b|pcix|d\.band/i],
  ['perifericos',       /\bmouse|teclado|auricular|parlante|web ?cam|c.mara web|microfono|mouse ?pad|headset|vincha|power ?bank|\bspeaker\b|soundbar|pizarra magica/i],
  ['accesorios',        /mochila|soporte|\bfunda\b|\bsilla\b|mascara led|estuche/i],
];

export function categorize(name: string): string | null {
  const n = (name ?? '').trim();
  if (!n) return null;
  for (const [slug, re] of RULES) {
    if (re.test(n)) return slug;
  }
  return null;
}
