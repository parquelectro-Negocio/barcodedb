// Standalone test for the product matching helpers. Run: npx tsx frontend/match.test.ts
import { normalize, matchScore, isLikelyMatch, matchesQuery } from './src/lib/match';

let failures = 0;
function check(name: string, cond: boolean, detail = '') {
  if (cond) console.log(`  ✓ ${name}`);
  else { console.log(`  ✗ ${name}  ${detail}`); failures++; }
}
function eq(name: string, got: string, want: string) {
  check(name, got === want, `got "${got}" want "${want}"`);
}

console.log('normalize:');
eq('accents + comma + spacing', normalize('Cable 2,5mm Sica'), 'cable 2.5 mm sica');
eq('trailing dot + accent', normalize('Art. Térmica'), 'art termica');
eq('joined code', normalize('LED9W'), 'led 9 w');

console.log('\nSAME product (should match, score ≥ 0.8):');
check('messy vs clean', isLikelyMatch('cable 2,5mm sica', 'Cable Unipolar 2.5 mm Sica'),
  `score=${matchScore('cable 2,5mm sica', 'Cable Unipolar 2.5 mm Sica').toFixed(2)}`);
check('térmica amperage', isLikelyMatch('LLAVE TÉRMICA 2x16 Genrod', 'Llave termica 2x16A genrod'),
  `score=${matchScore('LLAVE TÉRMICA 2x16 Genrod', 'Llave termica 2x16A genrod').toFixed(2)}`);
check('extra words in candidate', isLikelyMatch('cargador samsung 25w', 'Cargador Samsung 25 W original'),
  `score=${matchScore('cargador samsung 25w', 'Cargador Samsung 25 W original').toFixed(2)}`);

console.log('\nDIFFERENT product (should NOT match, score < 0.8):');
check('different section (2.5 vs 4)', !isLikelyMatch('cable 2.5 sica', 'cable 4 mm sica'),
  `score=${matchScore('cable 2.5 sica', 'cable 4 mm sica').toFixed(2)}`);
check('different amperage (16 vs 25)', !isLikelyMatch('llave termica 2x16', 'llave termica 2x25'),
  `score=${matchScore('llave termica 2x16', 'llave termica 2x25').toFixed(2)}`);
check('different product', !isLikelyMatch('auricular samsung', 'cargador samsung'),
  `score=${matchScore('auricular samsung', 'cargador samsung').toFixed(2)}`);

console.log('\nSearch-as-you-type (matchesQuery):');
check('partial prefixes find it', matchesQuery('cab 2.5 sic', 'Cable 2,5mm Sica'));
check('wrong measure not found', !matchesQuery('cable 4', 'cable 2.5 sica'));

if (failures > 0) throw new Error(`\n${failures} test(s) FAILED`);
console.log('\n✅ All matching tests passed.');
