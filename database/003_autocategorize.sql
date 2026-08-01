-- =============================================
-- One-time keyword auto-categorization of uncategorized products.
-- Apply with:  railway connect Postgres < database/003_autocategorize.sql
-- Rules run most-specific first; each only touches still-uncategorized rows
-- (category_id IS NULL), so earlier rules win. Reversible: re-null and re-run.
-- Approximate by design — spot-check the result and refine.
-- =============================================

-- helper: assign by slug when a name pattern matches and no category yet
-- (inlined per rule below)

UPDATE products SET category_id=(SELECT id FROM categories WHERE slug='cartuchos-toners')
  WHERE category_id IS NULL AND name ~* '(cartucho|toner|\ytinta\y|\yink\y)';

UPDATE products SET category_id=(SELECT id FROM categories WHERE slug='impresoras')
  WHERE category_id IS NULL AND name ~* '(impresora|plotter|\yprinter\y)';

UPDATE products SET category_id=(SELECT id FROM categories WHERE slug='almacenamiento')
  WHERE category_id IS NULL AND name ~* '(\yssd\y|\yhdd\y|pen ?drive|micro ?sd|\ynvme\y|disco (rigido|solido|externo|interno|ssd)|memoria micro|tarjeta (de )?memoria|\ysdhc\y)';

UPDATE products SET category_id=(SELECT id FROM categories WHERE slug='componentes')
  WHERE category_id IS NULL AND name ~* '(motherboard|\ymother\y|\yddr[2-5]?\y|memoria ram|\yfuente\y|gabinete|cooler|\yfan\y|procesador|\ycpu\y|placa de video|placa video|\ygpu\y|disipador|water ?cooling|\ypci\y|refrigeracion)';

UPDATE products SET category_id=(SELECT id FROM categories WHERE slug='monitores')
  WHERE category_id IS NULL AND name ~* '(\ymonitor\y)';

UPDATE products SET category_id=(SELECT id FROM categories WHERE slug='notebooks-pc')
  WHERE category_id IS NULL AND name ~* '(notebook|\ylaptop\y|all in one|mini ?pc)';

UPDATE products SET category_id=(SELECT id FROM categories WHERE slug='joysticks')
  WHERE category_id IS NULL AND name ~* '(joystick|gamepad|\ymando\y|volante)';

UPDATE products SET category_id=(SELECT id FROM categories WHERE slug='consolas')
  WHERE category_id IS NULL AND name ~* '(consola|playstation|\yxbox\y|nintendo|\yps[45]\y)';

UPDATE products SET category_id=(SELECT id FROM categories WHERE slug='redes')
  WHERE category_id IS NULL AND name ~* '(router|\yswitch|access point|\ywifi\y|repetidor|\yhub\y|powerline|placa de red|antena wifi)';

UPDATE products SET category_id=(SELECT id FROM categories WHERE slug='camaras')
  WHERE category_id IS NULL AND name ~* '(c.mara|\ycctv\y|\ydomo\y|\ydvr\y|\ynvr\y|hikvision|vigilancia)';

UPDATE products SET category_id=(SELECT id FROM categories WHERE slug='ups-estabilizadores')
  WHERE category_id IS NULL AND name ~* '(\yups\y|estabilizador|\ysai\y)';

UPDATE products SET category_id=(SELECT id FROM categories WHERE slug='parlantes')
  WHERE category_id IS NULL AND name ~* '(parlante|\yspeaker\y|soundbar|barra de sonido)';

UPDATE products SET category_id=(SELECT id FROM categories WHERE slug='auriculares')
  WHERE category_id IS NULL AND name ~* '(auricular|\yheadset|\yheadphone|vincha)';

UPDATE products SET category_id=(SELECT id FROM categories WHERE slug='perifericos')
  WHERE category_id IS NULL AND name ~* '(\ymouse\y|teclado|webcam|microfono|mouse ?pad|pad mouse)';

UPDATE products SET category_id=(SELECT id FROM categories WHERE slug='cables-av')
  WHERE category_id IS NULL AND name ~* '(cable (hdmi|de audio|audio|vga|displayport|rca))';

UPDATE products SET category_id=(SELECT id FROM categories WHERE slug='cables-adaptadores')
  WHERE category_id IS NULL AND name ~* '(\ycable\y|adaptador|conversor)';
