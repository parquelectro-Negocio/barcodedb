import 'dotenv/config';
import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/barcodedb';

async function seed() {
  const sql = postgres(connectionString);

  // Clean existing data
  await sql`DELETE FROM sale_items`;
  await sql`DELETE FROM sales`;
  await sql`DELETE FROM business_products`;
  await sql`DELETE FROM product_votes`;
  await sql`DELETE FROM contributions`;
  await sql`DELETE FROM product_aliases`;
  await sql`DELETE FROM product_variants`;
  await sql`DELETE FROM products`;
  await sql`DELETE FROM category_attributes`;
  await sql`DELETE FROM categories`;
  await sql`DELETE FROM businesses`;
  await sql`DELETE FROM users`;

  // ── Categories ──
  const [catElectronics] = await sql`
    INSERT INTO categories (id, name, slug) VALUES
      (gen_random_uuid(), 'Electrónica', 'electronica')
    RETURNING id
  `;

  const [catComputing] = await sql`
    INSERT INTO categories (id, name, slug, parent_id) VALUES
      (gen_random_uuid(), 'Computación', 'computacion', ${catElectronics.id})
    RETURNING id
  `;

  const [catPhones] = await sql`
    INSERT INTO categories (id, name, slug, parent_id) VALUES
      (gen_random_uuid(), 'Celulares', 'celulares', ${catElectronics.id})
    RETURNING id
  `;

  const [catAudio] = await sql`
    INSERT INTO categories (id, name, slug, parent_id) VALUES
      (gen_random_uuid(), 'Audio', 'audio', ${catElectronics.id})
    RETURNING id
  `;

  const [catCables] = await sql`
    INSERT INTO categories (id, name, slug, parent_id) VALUES
      (gen_random_uuid(), 'Cables y Adaptadores', 'cables', ${catElectronics.id})
    RETURNING id
  `;

  const [catFood] = await sql`
    INSERT INTO categories (id, name, slug) VALUES
      (gen_random_uuid(), 'Alimentos', 'alimentos')
    RETURNING id
  `;

  const [catSnacks] = await sql`
    INSERT INTO categories (id, name, slug, parent_id) VALUES
      (gen_random_uuid(), 'Snacks y Galletitas', 'snacks', ${catFood.id})
    RETURNING id
  `;

  const [catDrinks] = await sql`
    INSERT INTO categories (id, name, slug, parent_id) VALUES
      (gen_random_uuid(), 'Bebidas', 'bebidas', ${catFood.id})
    RETURNING id
  `;

  const [catHome] = await sql`
    INSERT INTO categories (id, name, slug) VALUES
      (gen_random_uuid(), 'Hogar', 'hogar')
    RETURNING id
  `;

  // ── Category Attributes ──
  // Electrónica - general
  await sql`
    INSERT INTO category_attributes (category_id, name, label, type, sort_order) VALUES
      (${catElectronics.id}, 'modelo', 'Modelo', 'text', 1),
      (${catElectronics.id}, 'garantia', 'Garantía (meses)', 'number', 2),
      (${catElectronics.id}, 'origen', 'Origen', 'text', 3)
  `;

  // Celulares
  await sql`
    INSERT INTO category_attributes (category_id, name, label, type, options, sort_order) VALUES
      (${catPhones.id}, 'almacenamiento', 'Almacenamiento', 'select', '["16GB","32GB","64GB","128GB","256GB","512GB","1TB"]', 1),
      (${catPhones.id}, 'ram', 'RAM', 'select', '["2GB","3GB","4GB","6GB","8GB","12GB","16GB"]', 2),
      (${catPhones.id}, 'pantalla', 'Pantalla', 'text', null, 3),
      (${catPhones.id}, 'bateria', 'Batería (mAh)', 'number', null, 4)
  `;

  // Computación
  await sql`
    INSERT INTO category_attributes (category_id, name, label, type, options, sort_order) VALUES
      (${catComputing.id}, 'tipo', 'Tipo', 'select', '["Notebook","Desktop","Tablet","Monitor","Componente"]', 1),
      (${catComputing.id}, 'almacenamiento', 'Almacenamiento', 'select', '["128GB","256GB","512GB","1TB","2TB"]', 2),
      (${catComputing.id}, 'ram', 'RAM', 'select', '["4GB","8GB","16GB","32GB","64GB"]', 3)
  `;

  // Audio
  await sql`
    INSERT INTO category_attributes (category_id, name, label, type, options, sort_order) VALUES
      (${catAudio.id}, 'tipo', 'Tipo', 'select', '["Auricular","Parlante","Microfono","Barra de Sonido"]', 1),
      (${catAudio.id}, 'conexion', 'Conexión', 'select', '["Bluetooth","USB-C","Jack 3.5mm","HDMI"]', 2)
  `;

  // Cables
  await sql`
    INSERT INTO category_attributes (category_id, name, label, type, options, sort_order) VALUES
      (${catCables.id}, 'tipo', 'Tipo', 'select', '["HDMI","USB-C","USB-A","USB-Micro","Lightning","RJ45","VGA"]', 1),
      (${catCables.id}, 'longitud', 'Longitud (m)', 'number', null, 2)
  `;

  // Snacks
  await sql`
    INSERT INTO category_attributes (category_id, name, label, type, options, sort_order) VALUES
      (${catSnacks.id}, 'peso_neto', 'Peso neto (g)', 'number', null, 1)
  `;

  // Bebidas
  await sql`
    INSERT INTO category_attributes (category_id, name, label, type, options, sort_order) VALUES
      (${catDrinks.id}, 'volumen', 'Volumen (ml)', 'number', null, 1),
      (${catDrinks.id}, 'con_gas', 'Con gas', 'boolean', null, 2)
  `;

  // ── Products ──
  // Electrónica / Celulares
  const [p1] = await sql`
    INSERT INTO products (barcode, name, brand, category_id, unit, attributes, status, verification_score) VALUES
      ('7790040929604', 'Samsung Galaxy A16 128GB', 'Samsung', ${catPhones.id}, 'unidad',
       '{"almacenamiento":"128GB","ram":"4GB","pantalla":"6.5\"","bateria":5000}', 'verified', 5)
    RETURNING id
  `;

  const [p2] = await sql`
    INSERT INTO products (barcode, name, brand, category_id, unit, attributes, status, verification_score) VALUES
      ('7790040929605', 'Motorola Moto G54 256GB', 'Motorola', ${catPhones.id}, 'unidad',
       '{"almacenamiento":"256GB","ram":"8GB","pantalla":"6.5\"","bateria":5000}', 'verified', 4)
    RETURNING id
  `;

  const [p3] = await sql`
    INSERT INTO products (barcode, name, brand, category_id, unit, attributes, status, verification_score) VALUES
      ('7790040929606', 'iPhone 16 128GB', 'Apple', ${catPhones.id}, 'unidad',
       '{"almacenamiento":"128GB","ram":"8GB","pantalla":"6.1\"","bateria":3561}', 'verified', 8)
    RETURNING id
  `;

  // Computación
  const [p4] = await sql`
    INSERT INTO products (barcode, name, brand, category_id, unit, attributes, status, verification_score) VALUES
      ('7790040929607', 'Notebook Lenovo ThinkPad X1 Carbon', 'Lenovo', ${catComputing.id}, 'unidad',
       '{"tipo":"Notebook","almacenamiento":"512GB","ram":"16GB"}', 'verified', 3)
    RETURNING id
  `;

  const [p5] = await sql`
    INSERT INTO products (barcode, name, brand, category_id, unit, attributes, status, verification_score) VALUES
      ('7790040929608', 'Monitor Samsung 27" 4K', 'Samsung', ${catComputing.id}, 'unidad',
       '{"tipo":"Monitor"}', 'verified', 6)
    RETURNING id
  `;

  // Audio
  const [p6] = await sql`
    INSERT INTO products (barcode, name, brand, category_id, unit, attributes, status, verification_score) VALUES
      ('7790040929609', 'Auriculares Sony WH-1000XM5', 'Sony', ${catAudio.id}, 'unidad',
       '{"tipo":"Auricular","conexion":"Bluetooth"}', 'verified', 10)
    RETURNING id
  `;

  const [p7] = await sql`
    INSERT INTO products (barcode, name, brand, category_id, unit, attributes, status, verification_score) VALUES
      ('7790040929610', 'Parlante JBL Flip 6', 'JBL', ${catAudio.id}, 'unidad',
       '{"tipo":"Parlante","conexion":"Bluetooth"}', 'verified', 7)
    RETURNING id
  `;

  // Cables
  const [p8] = await sql`
    INSERT INTO products (barcode, name, brand, category_id, unit, attributes, status, verification_score) VALUES
      ('7790040929611', 'Cable HDMI 2.0 3m', 'Ugreen', ${catCables.id}, 'unidad',
       '{"tipo":"HDMI","longitud":3}', 'verified', 4)
    RETURNING id
  `;

  const [p9] = await sql`
    INSERT INTO products (barcode, name, brand, category_id, unit, attributes, status, verification_score) VALUES
      ('7790040929612', 'Cable USB-C a USB-C 2m', 'Baseus', ${catCables.id}, 'unidad',
       '{"tipo":"USB-C","longitud":2}', 'pending', 1)
    RETURNING id
  `;

  // Variant: different length
  await sql`
    INSERT INTO product_variants (product_id, name, barcode, attributes, sort_order) VALUES
      (${p8.id}, '1.5m', '7790040929613', '{"longitud":1.5}', 1),
      (${p8.id}, '5m', '7790040929614', '{"longitud":5}', 2)
  `;

  // Alimentos / Snacks
  const [p10] = await sql`
    INSERT INTO products (barcode, name, brand, category_id, unit, attributes, status, verification_score) VALUES
      ('7790040929615', 'Alfajor Milka Oreo 50g', 'Milka', ${catSnacks.id}, 'unidad',
       '{"peso_neto":50}', 'verified', 12)
    RETURNING id
  `;

  const [p11] = await sql`
    INSERT INTO products (barcode, name, brand, category_id, unit, attributes, status, verification_score) VALUES
      ('7790040929616', 'Galletitas Terrabusi Rellenas x 160g', 'Terrabusi', ${catSnacks.id}, 'unidad',
       '{"peso_neto":160}', 'verified', 9)
    RETURNING id
  `;

  // Bebidas
  const [p12] = await sql`
    INSERT INTO products (barcode, name, brand, category_id, unit, attributes, status, verification_score) VALUES
      ('7790040929617', 'Coca-Cola Zero 500ml', 'Coca-Cola', ${catDrinks.id}, 'unidad',
       '{"volumen":500,"con_gas":true}', 'verified', 15)
    RETURNING id
  `;

  const [p13] = await sql`
    INSERT INTO products (barcode, name, brand, category_id, unit, attributes, status, verification_score) VALUES
      ('7790040929618', 'Agua Mineral Villavicencio 1.5L', 'Villavicencio', ${catDrinks.id}, 'unidad',
       '{"volumen":1500,"con_gas":false}', 'verified', 11)
    RETURNING id
  `;

  // ── Aliases (for import matching) ──
  await sql`
    INSERT INTO product_aliases (product_id, alias, source) VALUES
      (${p1.id}, 'Samsung Galaxy A16', 'manual'),
      (${p1.id}, 'Galaxy A16', 'manual'),
      (${p2.id}, 'Moto G54', 'manual'),
      (${p2.id}, 'Motorola G54', 'manual'),
      (${p3.id}, 'iPhone 16', 'manual'),
      (${p4.id}, 'ThinkPad X1 Carbon', 'manual'),
      (${p4.id}, 'Lenovo ThinkPad', 'manual'),
      (${p5.id}, 'Monitor Samsung 27 4K', 'manual'),
      (${p6.id}, 'Sony WH1000XM5', 'manual'),
      (${p7.id}, 'JBL Flip 6', 'manual'),
      (${p8.id}, 'Cable HDMI 3m', 'manual'),
      (${p9.id}, 'Cable USB C', 'manual'),
      (${p10.id}, 'Alfajor Milka Oreo', 'manual'),
      (${p11.id}, 'Terrabusi Rellenas', 'manual'),
      (${p11.id}, 'Galletitas Terrabusi', 'manual'),
      (${p12.id}, 'Coca Zero 500', 'manual'),
      (${p13.id}, 'Villavicencio 1.5L', 'manual')
  `;

  // ── Businesses ──
  const [b1] = await sql`
    INSERT INTO businesses (name, slug, plan) VALUES
      ('ElectroMundo', 'electromundo', 'free')
    RETURNING id
  `;

  await sql`
    INSERT INTO businesses (name, slug, plan) VALUES
      ('TechStore', 'techstore', 'free')
  `;

  // ── Business Products (stock) ──
  await sql`
    INSERT INTO business_products (business_id, product_id, stock, cost, price) VALUES
      (${b1.id}, ${p1.id}, 10, 250000, 349999),
      (${b1.id}, ${p2.id}, 5, 180000, 259999),
      (${b1.id}, ${p3.id}, 3, 800000, 999999),
      (${b1.id}, ${p4.id}, 2, 1200000, 1599999),
      (${b1.id}, ${p6.id}, 8, 180000, 259999),
      (${b1.id}, ${p8.id}, 50, 3000, 5999),
      (${b1.id}, ${p9.id}, 30, 2500, 4500)
  `;

  // ── Votes ──
  await sql`
    INSERT INTO product_votes (user_id, product_id, vote) VALUES
      ('00000000-0000-0000-0000-000000000001', ${p1.id}, 'confirm'),
      ('00000000-0000-0000-0000-000000000002', ${p1.id}, 'confirm'),
      ('00000000-0000-0000-0000-000000000003', ${p1.id}, 'confirm'),
      ('00000000-0000-0000-0000-000000000001', ${p3.id}, 'confirm'),
      ('00000000-0000-0000-0000-000000000002', ${p3.id}, 'confirm'),
      ('00000000-0000-0000-0000-000000000004', ${p3.id}, 'confirm'),
      ('00000000-0000-0000-0000-000000000005', ${p10.id}, 'confirm'),
      ('00000000-0000-0000-0000-000000000006', ${p10.id}, 'confirm'),
      ('00000000-0000-0000-0000-000000000007', ${p10.id}, 'confirm'),
      ('00000000-0000-0000-0000-000000000001', ${p11.id}, 'confirm'),
      ('00000000-0000-0000-0000-000000000002', ${p11.id}, 'confirm')
  `;

  // ── Users (for votes) ──
  await sql`
    INSERT INTO users (id, display_name, reputation) VALUES
      ('00000000-0000-0000-0000-000000000001', 'Carlos Tech', 25),
      ('00000000-0000-0000-0000-000000000002', 'Maria Compu', 18),
      ('00000000-0000-0000-0000-000000000003', 'Juan Gadget', 12),
      ('00000000-0000-0000-0000-000000000004', 'Ana Digital', 8),
      ('00000000-0000-0000-0000-000000000005', 'Pedro Snacks', 30),
      ('00000000-0000-0000-0000-000000000006', 'Laura Market', 22),
      ('00000000-0000-0000-0000-000000000007', 'Martín Alimentos', 15)
  `;

  console.log('Seed complete:');
  console.log(`  Categories: 9`);
  console.log(`  Products: 13`);
  console.log(`  Variants: 2`);
  console.log(`  Aliases: 17`);
  console.log(`  Businesses: 2`);
  console.log(`  Business Products: 7`);
  console.log(`  Votes: 11`);
  console.log(`  Users: 7`);

  await sql.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
