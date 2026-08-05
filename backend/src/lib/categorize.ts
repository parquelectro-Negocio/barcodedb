// Auto-categorization by product name. Ordered rules, most specific first —
// returns the first matching category slug, or null. Single source of truth,
// run at product creation time (import + manual) so categorization scales to
// however many products get added later. Refine the rules here, not in SQL.

// Fold accents + lowercase before matching so "tóner"/"micrófono"/"cámara" match
// their ASCII rules. "t.ner" style patterns also tolerate mojibake ("t�ner").
function norm(s: string): string {
  return (s ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

const RULES: ReadonlyArray<readonly [string, RegExp]> = [
  ['consumibles',       /cartucho|cart\.|cartridge|t.ner|inkjet|botella de tinta|\btinta\b|\bink\b|laserjet|designjet|print crtg|cabezal/],
  ['proyectores',       /proyector|\bepiq\b|power ?lite/],
  ['impresoras',        /impresora|plotter|\bprinter\b|epson l\d|ecotank|deskjet|multifuncion/],
  ['placas-de-video',   /\bvga\b|radeon|geforce|\brtx\b|\bgtx\b|\brx ?\d{3}|placa de ?video/],
  ['monitores',         /\bmonitor\b/],
  ['microprocesadores', /procesador|\bcpu\b|ryzen|core i[3-9]|intel core|pentium|celeron|\bathlon\b|\bapu\b/],
  ['mothers',           /motherboard|\bmother\b|\bam4\b|\bam5\b|\blga1\d{3}|\bb[5-8]\d0\b|\ba520\b|\bh[4-8]10\b|\bz[67]90\b|chipset/],
  ['memorias-ram',      /memoria (pc )?ddr|\bddr[345]\b|\bsodimm\b|memoria ram/],
  ['coolers',           /cooler|\bfan\b|ventilador|water ?cool|disipador|refrigeracion/],
  ['fuentes',           /\bfuente\b|\bpsu\b/],
  ['gabinetes',         /gabinete/],
  ['notebooks',         /notebook|\blaptop\b/],
  ['almacenamiento',    /\bssd\b|\bhdd\b|^hd |pen ?drive|micro ?sd|\bnvme\b|disco (rigido|solido|externo|interno|ssd)|tarjeta (de )?memoria|asustor|\bnas\b/],
  ['computadoras',      /computadora|mini ?pc|pc desktop|\bdesktop\b|barebone|all.in.one|pc kit|kit pc|thinkcentre|\bpc kelyx/],
  ['consolas',          /consola|playstation|\bxbox\b|nintendo|\bps[45]\b/],
  ['joysticks',         /joystick|gamepad|\bmando\b|volante|silla gamer/],
  ['pilas-baterias',    /\bpilas?\b|bateria|pack de bateria/],
  ['energia',           /\bups\b|estabilizador|prolongador|zapatilla el/],
  ['perifericos',       /\bmouse|teclado|auricular|parlante|web ?cam|camara web|microfono|mouse ?pad|headset|vincha|power ?bank|\bspeaker\b|soundbar|pizarra magica/],
  ['conectividad',      /router|\bswitch|access point|\bwifi\b|repetidor|\bhub\b|antena|placa de red|adaptador|\bcable\b|conversor|\bpatch\b|\brj45\b|\barcher\b|pcix|d\.band|\bcamara\b|\bnvr\b|\bdvr\b|hikvision/],
  ['accesorios',        /mochila|soporte|\bfunda\b|\bsilla\b|mascara led|estuche|cargador|protector|tira led|\blampara\b|iluminacion|\bluz\b/],
];

export function categorize(name: string): string | null {
  const n = norm(name);
  if (!n) return null;
  for (const [slug, re] of RULES) {
    if (re.test(n)) return slug;
  }
  return null;
}
