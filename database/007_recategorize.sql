-- =============================================
-- Keyword re-categorization of products against the real taxonomy (006).
-- Assigns products to the child categories. Most-specific rules first; each only
-- touches still-uncategorized rows. Apply: railway connect Postgres < 007_recategorize.sql
-- =============================================

UPDATE products SET category_id=(SELECT id FROM categories WHERE slug='consumibles')
  WHERE category_id IS NULL AND name ~* '(cartucho|cart\.|cartridge|toner|inkjet|botella de tinta|\ytinta\y|\yink\y)';

UPDATE products SET category_id=(SELECT id FROM categories WHERE slug='impresoras')
  WHERE category_id IS NULL AND name ~* '(impresora|plotter|\yprinter\y)';

UPDATE products SET category_id=(SELECT id FROM categories WHERE slug='placas-de-video')
  WHERE category_id IS NULL AND name ~* '(\yvga\y|radeon|geforce|\yrtx\y|\ygtx\y|\yrx ?[0-9]{3}|placa de ?video)';

UPDATE products SET category_id=(SELECT id FROM categories WHERE slug='microprocesadores')
  WHERE category_id IS NULL AND name ~* '(procesador|\ycpu\y|ryzen|core i[3-9]|intel core|pentium|celeron|\yathlon\y|\yapu\y)';

UPDATE products SET category_id=(SELECT id FROM categories WHERE slug='mothers')
  WHERE category_id IS NULL AND name ~* '(motherboard|\ymother\y|\yam4\y|\yam5\y|\ylga1[0-9]{3}|\yb[5-8][0-9]0\y|\ya520\y|\yh[4-8]10\y|\yz[67]90\y|chipset)';

UPDATE products SET category_id=(SELECT id FROM categories WHERE slug='memorias-ram')
  WHERE category_id IS NULL AND name ~* '(memoria (pc )?ddr|\yddr[345]\y|\ysodimm\y|memoria ram)';

UPDATE products SET category_id=(SELECT id FROM categories WHERE slug='almacenamiento')
  WHERE category_id IS NULL AND name ~* '(\yssd\y|\yhdd\y|pen ?drive|micro ?sd|\ynvme\y|disco (rigido|solido|externo|interno|ssd)|tarjeta (de )?memoria)';

UPDATE products SET category_id=(SELECT id FROM categories WHERE slug='coolers')
  WHERE category_id IS NULL AND name ~* '(cooler|\yfan\y|ventilador|water ?cooling|water ?cooler|disipador|refrigeracion)';

UPDATE products SET category_id=(SELECT id FROM categories WHERE slug='fuentes')
  WHERE category_id IS NULL AND name ~* '(\yfuente\y|\ypsu\y)';

UPDATE products SET category_id=(SELECT id FROM categories WHERE slug='gabinetes')
  WHERE category_id IS NULL AND name ~* '(gabinete)';

UPDATE products SET category_id=(SELECT id FROM categories WHERE slug='monitores')
  WHERE category_id IS NULL AND name ~* '(\ymonitor\y)';

UPDATE products SET category_id=(SELECT id FROM categories WHERE slug='notebooks')
  WHERE category_id IS NULL AND name ~* '(notebook|\ylaptop\y)';

UPDATE products SET category_id=(SELECT id FROM categories WHERE slug='computadoras')
  WHERE category_id IS NULL AND name ~* '(computadora|mini ?pc|barebone|all.in.one|pc kit|kit pc|\ypc kelyx)';

UPDATE products SET category_id=(SELECT id FROM categories WHERE slug='consolas')
  WHERE category_id IS NULL AND name ~* '(consola|playstation|\yxbox\y|nintendo|\yps[45]\y)';

UPDATE products SET category_id=(SELECT id FROM categories WHERE slug='joysticks')
  WHERE category_id IS NULL AND name ~* '(joystick|gamepad|\ymando\y|volante gamer)';

UPDATE products SET category_id=(SELECT id FROM categories WHERE slug='energia')
  WHERE category_id IS NULL AND name ~* '(\yups\y|estabilizador)';

UPDATE products SET category_id=(SELECT id FROM categories WHERE slug='conectividad')
  WHERE category_id IS NULL AND name ~* '(router|\yswitch|access point|\ywifi\y|repetidor|\yhub\y|antena|placa de red|adaptador|\ycable\y|conversor|patch|\yrj45\y)';

UPDATE products SET category_id=(SELECT id FROM categories WHERE slug='perifericos')
  WHERE category_id IS NULL AND name ~* '(\ymouse\y|teclado|auricular|parlante|web ?cam|microfono|mouse ?pad|headset|vincha|power ?bank|\yspeaker\y|soundbar)';
